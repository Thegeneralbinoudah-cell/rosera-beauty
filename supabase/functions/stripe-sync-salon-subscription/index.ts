import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@17.4.0?target=deno'
import { applyStripeSubscriptionAfterPayment, userOwnsSalon } from '../_shared/stripeSalonSubscription.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    return new Response(JSON.stringify({ error: 'Stripe غير مُعدّ' }), {
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
    .select('id, salon_id, status, stripe_subscription_id')
    .eq('id', ref)
    .maybeSingle()

  if (rowErr || !row) {
    return new Response(JSON.stringify({ error: 'اشتراك غير موجود' }), {
      status: 404,
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

  const stripeSubId = row.stripe_subscription_id as string | null
  if (!stripeSubId) {
    return new Response(JSON.stringify({ error: 'لا يوجد اشتراك Stripe مرتبط' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() })
  let sub: Stripe.Subscription
  try {
    sub = await stripe.subscriptions.retrieve(stripeSubId)
  } catch (e) {
    console.error('[stripe-sync-salon-subscription]', e)
    return new Response(JSON.stringify({ error: 'تعذر جلب الاشتراك من Stripe' }), {
      status: 502,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  if (sub.status !== 'active' && sub.status !== 'trialing') {
    return new Response(
      JSON.stringify({ ok: false, stripe_status: sub.status, message: 'الدفع لم يكتمل بعد' }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  }

  await applyStripeSubscriptionAfterPayment(sb, sub)

  const { data: after } = await sb
    .from('salon_subscriptions')
    .select('id, salon_id, plan, status')
    .eq('id', ref)
    .maybeSingle()

  return new Response(
    JSON.stringify({
      ok: true,
      plan: (after as { plan?: string } | null)?.plan,
      salon_id: (after as { salon_id?: string } | null)?.salon_id,
      status: (after as { status?: string } | null)?.status,
    }),
    { headers: { ...cors, 'Content-Type': 'application/json' } }
  )
})
