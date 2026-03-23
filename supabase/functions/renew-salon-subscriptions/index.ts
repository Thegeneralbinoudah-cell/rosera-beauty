import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const PLAN_PRICE_HALALAS: Record<string, number> = {
  basic: 199 * 100,
  pro: 399 * 100,
  premium: 799 * 100,
}

type SubRow = {
  id: string
  salon_id: string
  plan: string
  price: number
  expires_at: string
  payment_method_id: string
  renewal_failed_count: number
}

async function notifySalonOwners(
  supabase: ReturnType<typeof createClient>,
  salonId: string,
  title: string,
  body: string
) {
  const userIds = new Set<string>()
  const { data: owners } = await supabase.from('salon_owners').select('user_id').eq('salon_id', salonId)
  for (const r of owners ?? []) {
    const u = (r as { user_id?: string }).user_id
    if (u) userIds.add(u)
  }
  const { data: biz } = await supabase.from('businesses').select('owner_id').eq('id', salonId).maybeSingle()
  const oid = (biz as { owner_id?: string } | null)?.owner_id
  if (oid) userIds.add(oid)

  for (const user_id of userIds) {
    await supabase.from('notifications').insert({
      user_id,
      title,
      body,
      type: 'billing',
      is_read: false,
    })

    const { data: prof } = await supabase.from('profiles').select('push_token').eq('id', user_id).maybeSingle()
    const token = prof?.push_token as string | undefined
    const fcmKey = Deno.env.get('FCM_SERVER_KEY')
    if (token && fcmKey) {
      await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `key=${fcmKey}`,
        },
        body: JSON.stringify({
          to: token,
          notification: { title, body },
        }),
      }).catch(() => {})
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const secret = Deno.env.get('RENEWAL_CRON_SECRET')?.trim()
  const hdr = req.headers.get('x-cron-secret')?.trim()
  if (!secret || hdr !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const moyasarSecret = Deno.env.get('MOYASAR_SECRET_KEY')?.trim()
  if (!moyasarSecret) {
    return new Response(JSON.stringify({ error: 'MOYASAR_SECRET_KEY not configured' }), {
      status: 503,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  const siteUrl = (Deno.env.get('SITE_URL') || Deno.env.get('SUPABASE_URL') || 'https://rosera.app').replace(/\/$/, '')
  const callbackUrl = `${siteUrl}/payment/callback?type=subscription_renewal_cron`

  const nowIso = new Date().toISOString()
  const { data: due, error: qErr } = await supabase
    .from('salon_subscriptions')
    .select('id, salon_id, plan, price, expires_at, payment_method_id, renewal_failed_count')
    .eq('status', 'active')
    .eq('auto_renew', true)
    .eq('billing_provider', 'moyasar')
    .not('payment_method_id', 'is', null)
    .lt('renewal_failed_count', 3)
    .lte('expires_at', nowIso)

  if (qErr) {
    console.error('[renew-salon-subscriptions]', qErr)
    return new Response(JSON.stringify({ error: qErr.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const rows = (due ?? []) as SubRow[]
  const results: { id: string; ok: boolean; detail?: string }[] = []
  const auth = btoa(moyasarSecret + ':')

  for (const sub of rows) {
    const plan = sub.plan as string
    const expectedHalalas = PLAN_PRICE_HALALAS[plan]
    if (expectedHalalas == null) {
      results.push({ id: sub.id, ok: false, detail: 'bad_plan' })
      continue
    }

    const attemptNum = Math.min(3, Number(sub.renewal_failed_count) + 1)

    try {
      const res = await fetch('https://api.moyasar.com/v1/payments', {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          given_id: crypto.randomUUID(),
          amount: expectedHalalas,
          currency: 'SAR',
          description: `Rosera salon subscription renewal — ${plan}`,
          callback_url: callbackUrl,
          source: {
            type: 'token',
            token: sub.payment_method_id,
            '3ds': false,
            manual: false,
          },
          metadata: {
            subscription_id: String(sub.id),
            salon_id: String(sub.salon_id),
            kind: 'salon_subscription_renewal',
          },
        }),
      })

      const raw = await res.json().catch(() => ({}))
      const pay = raw as {
        id?: string
        status?: string
        amount?: number
        message?: string
      }

      if (!res.ok || (pay.status !== 'paid' && pay.status !== 'captured')) {
        const msg = pay.message || `http_${res.status}`
        await supabase.from('salon_subscription_renewal_logs').insert({
          subscription_id: sub.id,
          salon_id: sub.salon_id,
          success: false,
          attempt_number: attemptNum,
          moyasar_payment_id: pay.id ?? null,
          error_message: String(msg).slice(0, 500),
          amount_halalas: expectedHalalas,
        })

        const nextFail = Number(sub.renewal_failed_count) + 1
        const patch: Record<string, unknown> = { renewal_failed_count: nextFail }
        if (nextFail >= 3) {
          patch.status = 'expired'
        }
        await supabase.from('salon_subscriptions').update(patch).eq('id', sub.id)

        if (nextFail >= 3) {
          if (plan === 'premium') {
            await supabase.from('businesses').update({ is_featured: false }).eq('id', sub.salon_id)
          }
          await notifySalonOwners(
            supabase,
            sub.salon_id,
            'فشل الدفع ❗',
            'يرجى تحديث وسيلة الدفع أو تجديد الاشتراك يدوياً من لوحة الصالون.'
          )
        }

        results.push({ id: sub.id, ok: false, detail: String(msg).slice(0, 120) })
        continue
      }

      if (typeof pay.amount === 'number' && pay.amount !== expectedHalalas) {
        await supabase.from('salon_subscription_renewal_logs').insert({
          subscription_id: sub.id,
          salon_id: sub.salon_id,
          success: false,
          attempt_number: attemptNum,
          moyasar_payment_id: pay.id ?? null,
          error_message: 'amount_mismatch',
          amount_halalas: expectedHalalas,
        })
        results.push({ id: sub.id, ok: false, detail: 'amount_mismatch' })
        continue
      }

      const prevExp = new Date(sub.expires_at).getTime()
      const base = Math.max(prevExp, Date.now())
      const newExp = new Date(base + 30 * 86_400_000).toISOString()
      const paidAt = new Date().toISOString()

      await supabase
        .from('salon_subscriptions')
        .update({
          expires_at: newExp,
          last_payment_at: paidAt,
          renewal_failed_count: 0,
          moyasar_payment_id: pay.id ?? null,
        })
        .eq('id', sub.id)

      await supabase.from('salon_subscription_renewal_logs').insert({
        subscription_id: sub.id,
        salon_id: sub.salon_id,
        success: true,
        attempt_number: attemptNum,
        moyasar_payment_id: pay.id ?? null,
        error_message: null,
        amount_halalas: expectedHalalas,
      })

      if (plan === 'premium') {
        await supabase.from('businesses').update({ is_featured: true }).eq('id', sub.salon_id)
      }

      await notifySalonOwners(supabase, sub.salon_id, 'تم تجديد اشتراكك بنجاح 💖', 'شكراً لثقتكِ بروزيرا — اشتراك الصالون مفعّل لمدة 30 يوماً إضافية.')

      results.push({ id: sub.id, ok: true })
    } catch (e) {
      console.error('[renew-salon-subscriptions] row', sub.id, e)
      await supabase.from('salon_subscription_renewal_logs').insert({
        subscription_id: sub.id,
        salon_id: sub.salon_id,
        success: false,
        attempt_number: attemptNum,
        error_message: String(e).slice(0, 500),
        amount_halalas: expectedHalalas,
      })
      const nextFail = Number(sub.renewal_failed_count) + 1
      const patch: Record<string, unknown> = { renewal_failed_count: nextFail }
      if (nextFail >= 3) {
        patch.status = 'expired'
        if (plan === 'premium') {
          await supabase.from('businesses').update({ is_featured: false }).eq('id', sub.salon_id)
        }
        await notifySalonOwners(
          supabase,
          sub.salon_id,
          'فشل الدفع ❗',
          'يرجى تحديث وسيلة الدفع أو تجديد الاشتراك يدوياً من لوحة الصالون.'
        )
      }
      await supabase.from('salon_subscriptions').update(patch).eq('id', sub.id)
      results.push({ id: sub.id, ok: false, detail: 'exception' })
    }
  }

  await supabase.rpc('expire_salon_subscriptions')

  return new Response(
    JSON.stringify({
      processed: rows.length,
      results,
    }),
    { headers: { ...cors, 'Content-Type': 'application/json' } }
  )
})
