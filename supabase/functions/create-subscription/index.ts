import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@17.4.0?target=deno'
import { userOwnsSalon } from '../_shared/stripeSalonSubscription.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PLAN_PRICE_SAR: Record<string, number> = {
  basic: 199,
  pro: 399,
  premium: 799,
}

function stripePriceIdForPlan(plan: string): string | null {
  const map: Record<string, string | undefined> = {
    basic: Deno.env.get('STRIPE_PRICE_ID_BASIC')?.trim(),
    pro: Deno.env.get('STRIPE_PRICE_ID_PRO')?.trim(),
    premium: Deno.env.get('STRIPE_PRICE_ID_PREMIUM')?.trim(),
  }
  const id = map[plan]
  return id && id.length > 0 ? id : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')?.trim()
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: 'Stripe غير مُعدّ على الخادم' }), {
      status: 503,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'يجب تسجيل الدخول' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const accessToken = auth.slice(7).trim()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim()
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
    return new Response(JSON.stringify({ error: 'إعداد Supabase ناقص' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey)
  const { data: userData, error: authErr } = await authClient.auth.getUser(accessToken)
  if (authErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'جلسة غير صالحة' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
  const userId = userData.user.id
  const userEmail = userData.user.email ?? undefined

  let body: { salon_subscription_id?: string }
  try {
    body = (await req.json()) as { salon_subscription_id?: string }
  } catch {
    return new Response(JSON.stringify({ error: 'جسم الطلب غير صالح' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const ref = body.salon_subscription_id?.trim()
  if (!ref) {
    return new Response(JSON.stringify({ error: 'معرّف الاشتراك مطلوب' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const sb = createClient(supabaseUrl, serviceKey)

  const { data: row, error: rowErr } = await sb
    .from('salon_subscriptions')
    .select('id, salon_id, plan, price, status, stripe_subscription_id, stripe_customer_id')
    .eq('id', ref)
    .maybeSingle()

  if (rowErr || !row) {
    return new Response(JSON.stringify({ error: 'اشتراك غير موجود' }), {
      status: 404,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  if (row.status !== 'pending_payment') {
    return new Response(JSON.stringify({ error: 'الاشتراك ليس في انتظار الدفع' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const plan = row.plan as string
  const expectedSar = PLAN_PRICE_SAR[plan]
  if (expectedSar == null || Number(row.price) !== expectedSar) {
    return new Response(JSON.stringify({ error: 'السعر لا يطابق الخطة' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const owns = await userOwnsSalon(sb, userId, row.salon_id as string)
  if (!owns) {
    return new Response(JSON.stringify({ error: 'غير مصرّح' }), {
      status: 403,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const priceId = stripePriceIdForPlan(plan)
  if (!priceId) {
    return new Response(JSON.stringify({ error: 'Stripe price ids غير مُعدّة' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const stripe = new Stripe(stripeKey, {
    httpClient: Stripe.createFetchHttpClient(),
  })

  let priceOk = false
  try {
    const price = await stripe.prices.retrieve(priceId)
    const cur = (price.currency || '').toLowerCase()
    const minor = price.unit_amount
    const expectedMinor = Math.round(expectedSar * 100)
    if (cur === 'sar' && typeof minor === 'number' && minor === expectedMinor) {
      priceOk = true
    }
  } catch (e) {
    console.error('[create-subscription] price retrieve', e)
    return new Response(JSON.stringify({ error: 'تعذر التحقق من سعر Stripe' }), {
      status: 502,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  if (!priceOk) {
    return new Response(
      JSON.stringify({
        error: `سعر/عملة Stripe لا تطابق روسيرا (توقّع SAR و${expectedSar} ر.س شهرياً)`,
      }),
      { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  const prevSubId = row.stripe_subscription_id as string | null
  if (prevSubId) {
    try {
      await stripe.subscriptions.cancel(prevSubId)
    } catch {
      /* abandoned checkout */
    }
  }

  let customerId = row.stripe_customer_id as string | null
  if (!customerId) {
    const c = await stripe.customers.create({
      email: userEmail,
      metadata: { supabase_user_id: userId, salon_id: String(row.salon_id) },
    })
    customerId = c.id
  }

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
    metadata: {
      salon_subscription_id: ref,
      salon_id: String(row.salon_id),
      plan,
      supabase_user_id: userId,
    },
  })

  const inv = subscription.latest_invoice
  let invObj: Stripe.Invoice | null = null
  if (typeof inv === 'string') {
    invObj = await stripe.invoices.retrieve(inv, { expand: ['payment_intent'] })
  } else if (inv && typeof inv === 'object') {
    invObj = inv as Stripe.Invoice
  }

  const piRaw = invObj?.payment_intent
  let pi: Stripe.PaymentIntent | null = null
  if (typeof piRaw === 'string') {
    pi = await stripe.paymentIntents.retrieve(piRaw)
  } else if (piRaw && typeof piRaw === 'object') {
    pi = piRaw as Stripe.PaymentIntent
  }

  const clientSecret = pi?.client_secret ?? null
  if (!clientSecret) {
    return new Response(JSON.stringify({ error: 'تعذر إنشاء PaymentIntent للاشتراك' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const { error: upErr } = await sb
    .from('salon_subscriptions')
    .update({
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      billing_provider: 'stripe',
    })
    .eq('id', ref)

  if (upErr) {
    console.error('[create-subscription] persist stripe ids', upErr)
    return new Response(JSON.stringify({ error: 'فشل حفظ جلسة Stripe' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  return new Response(
    JSON.stringify({
      clientSecret,
      stripeSubscriptionId: subscription.id,
    }),
    { headers: { ...cors, 'Content-Type': 'application/json' } }
  )
})
