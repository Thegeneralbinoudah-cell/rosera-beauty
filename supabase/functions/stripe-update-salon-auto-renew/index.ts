import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@17.4.0?target=deno'
import { resolveOwnerSalonId } from '../_shared/stripeSalonSubscription.ts'

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

  let body: { enabled?: boolean }
  try {
    body = (await req.json()) as { enabled?: boolean }
  } catch {
    return new Response(JSON.stringify({ error: 'جسم الطلب غير صالح' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  if (typeof body.enabled !== 'boolean') {
    return new Response(JSON.stringify({ error: 'enabled مطلوب (boolean)' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const sb = createClient(supabaseUrl, serviceKey)
  const salonId = await resolveOwnerSalonId(sb, userId)
  if (!salonId) {
    return new Response(JSON.stringify({ error: 'لا يوجد صالون مرتبط' }), {
      status: 404,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const { data: row, error: rowErr } = await sb
    .from('salon_subscriptions')
    .select('id, stripe_subscription_id, billing_provider')
    .eq('salon_id', salonId)
    .eq('status', 'active')
    .maybeSingle()

  if (rowErr || !row) {
    return new Response(JSON.stringify({ error: 'لا يوجد اشتراك نشط' }), {
      status: 404,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const r = row as { id: string; stripe_subscription_id: string | null; billing_provider: string }
  if (r.billing_provider !== 'stripe' || !r.stripe_subscription_id) {
    return new Response(JSON.stringify({ error: 'التجديد التلقائي لـ Stripe غير مطبّق على هذا الاشتراك' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() })
  try {
    await stripe.subscriptions.update(r.stripe_subscription_id, {
      cancel_at_period_end: !body.enabled,
    })
  } catch (e) {
    console.error('[stripe-update-salon-auto-renew]', e)
    return new Response(JSON.stringify({ error: 'فشل تحديث Stripe' }), {
      status: 502,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const { error: upErr } = await sb.from('salon_subscriptions').update({ auto_renew: body.enabled }).eq('id', r.id)
  if (upErr) {
    console.error('[stripe-update-salon-auto-renew] db', upErr)
    return new Response(JSON.stringify({ error: 'فشل حفظ الإعداد' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true, auto_renew: body.enabled }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
