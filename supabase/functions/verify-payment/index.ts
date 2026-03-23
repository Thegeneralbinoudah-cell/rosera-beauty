import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PLAN_PRICE_HALALAS: Record<string, number> = {
  basic: 199 * 100,
  pro: 399 * 100,
  premium: 799 * 100,
}

const FEATURED_AD_DAILY_SAR = 50

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { type, ref, payment_id } = await req.json()
    if (!type || !ref || !payment_id) {
      return new Response(JSON.stringify({ error: 'معطيات ناقصة' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    if (type !== 'booking' && type !== 'order' && type !== 'subscription' && type !== 'salon_ad') {
      return new Response(JSON.stringify({ error: 'نوع غير صالح' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const isFreeSimSubscription =
      type === 'subscription' && String(payment_id).startsWith('free_')
    const isFreeSimSalonAd = type === 'salon_ad' && String(payment_id).startsWith('free_')

    const secret = Deno.env.get('MOYASAR_SECRET_KEY')
    if (isFreeSimSubscription && secret) {
      return new Response(JSON.stringify({ error: 'الدفع التجريبي غير متاح مع مفتاح Moyasar السري' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    if (isFreeSimSalonAd && secret) {
      return new Response(JSON.stringify({ error: 'الدفع التجريبي غير متاح مع مفتاح Moyasar السري' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    let payAmountHalalas: number | null = null
    let moyasarSourceToken: string | null = null
    if (secret && !isFreeSimSubscription && !isFreeSimSalonAd) {
      const auth = btoa(secret + ':')
      const res = await fetch(`https://api.moyasar.com/v1/payments/${payment_id}`, {
        headers: { Authorization: 'Basic ' + auth },
      })
      if (!res.ok) {
        const t = await res.text()
        console.error('Moyasar', t)
        return new Response(JSON.stringify({ error: 'فشل التحقق من الدفع' }), {
          status: 502,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
      const pay = (await res.json()) as {
        status?: string
        amount?: number
        currency?: string
        source?: { type?: string; token?: string }
      }
      if (pay.status !== 'paid') {
        return new Response(JSON.stringify({ error: 'الدفع غير مكتمل', status: pay.status }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
      if (typeof pay.amount === 'number' && Number.isFinite(pay.amount)) {
        payAmountHalalas = pay.amount
      }
      const cur = (pay.currency || 'SAR').toUpperCase()
      if (cur !== 'SAR') {
        return new Response(JSON.stringify({ error: 'عملة غير مدعومة' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
      const tok = pay.source?.token
      if (typeof tok === 'string' && tok.trim().length > 0) {
        moyasarSourceToken = tok.trim()
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (type === 'subscription') {
      const { data: sub, error: subErr } = await supabase
        .from('salon_subscriptions')
        .select('id, salon_id, plan, price, status, moyasar_payment_id')
        .eq('id', ref)
        .maybeSingle()

      if (subErr || !sub) {
        console.error(subErr)
        return new Response(JSON.stringify({ error: 'اشتراك غير موجود' }), {
          status: 404,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      if (sub.status === 'active' && sub.moyasar_payment_id === payment_id) {
        return new Response(
          JSON.stringify({
            success: true,
            type,
            ref,
            salon_id: sub.salon_id,
            plan: sub.plan,
            duplicate: true,
          }),
          { headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      if (sub.status !== 'pending_payment') {
        return new Response(JSON.stringify({ error: 'حالة الاشتراك لا تسمح بالتفعيل' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      const plan = sub.plan as string
      const expectedHalalas = PLAN_PRICE_HALALAS[plan]
      if (expectedHalalas == null) {
        return new Response(JSON.stringify({ error: 'خطة غير صالحة' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      const expectedSar = expectedHalalas / 100
      if (Number(sub.price) !== expectedSar) {
        return new Response(JSON.stringify({ error: 'سعر الاشتراك المخزّن لا يطابق الخطة' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      if (secret && payAmountHalalas != null && payAmountHalalas !== expectedHalalas) {
        return new Response(JSON.stringify({ error: 'مبلغ الدفع لا يطابق الخطة' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      const { data: prevActive } = await supabase
        .from('salon_subscriptions')
        .select('id, plan')
        .eq('salon_id', sub.salon_id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle()

      const previous_plan = (prevActive?.plan as string | undefined) ?? null

      await supabase
        .from('salon_subscriptions')
        .update({ status: 'cancelled' })
        .eq('salon_id', sub.salon_id)
        .eq('status', 'active')

      const nowIso = new Date().toISOString()
      const expires = new Date(Date.now() + 30 * 86_400_000).toISOString()

      const subUpdate: Record<string, unknown> = {
        status: 'active',
        starts_at: nowIso,
        expires_at: expires,
        moyasar_payment_id: payment_id,
        last_payment_at: nowIso,
        renewal_failed_count: 0,
      }
      if (moyasarSourceToken) {
        subUpdate.payment_method_id = moyasarSourceToken
      }

      const { error: upErr } = await supabase.from('salon_subscriptions').update(subUpdate).eq('id', ref)

      if (upErr) {
        console.error(upErr)
        return new Response(JSON.stringify({ error: 'فشل تفعيل الاشتراك' }), {
          status: 500,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      const featured = plan === 'premium'
      const { error: bizErr } = await supabase.from('businesses').update({ is_featured: featured }).eq('id', sub.salon_id)
      if (bizErr) console.error(bizErr)

      void supabase
        .from('salon_subscription_renewal_logs')
        .insert({
          subscription_id: ref,
          salon_id: sub.salon_id,
          success: true,
          attempt_number: 1,
          moyasar_payment_id: payment_id,
          error_message: null,
          amount_halalas: expectedHalalas,
        })
        .then(
          () => {},
          (e) => console.warn('renewal log (initial sub)', e)
        )

      return new Response(
        JSON.stringify({
          success: true,
          type,
          ref,
          salon_id: sub.salon_id,
          plan,
          previous_plan,
        }),
        { headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    if (type === 'salon_ad') {
      const { data: ad, error: adErr } = await supabase
        .from('salon_ads')
        .select('id, salon_id, budget, day_count, status, moyasar_payment_id')
        .eq('id', ref)
        .maybeSingle()

      if (adErr || !ad) {
        console.error(adErr)
        return new Response(JSON.stringify({ error: 'إعلان غير موجود' }), {
          status: 404,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      if (ad.status === 'active' && ad.moyasar_payment_id === payment_id) {
        return new Response(
          JSON.stringify({ success: true, type, ref, salon_id: ad.salon_id, duplicate: true }),
          { headers: { ...cors, 'Content-Type': 'application/json' } }
        )
      }

      if (ad.status !== 'pending_payment') {
        return new Response(JSON.stringify({ error: 'حالة الإعلان لا تسمح بالتفعيل' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      const days = Number(ad.day_count)
      if (!Number.isFinite(days) || days < 1 || days > 60) {
        return new Response(JSON.stringify({ error: 'مدة الإعلان غير صالحة' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      const expectedSar = days * FEATURED_AD_DAILY_SAR
      if (Number(ad.budget) !== expectedSar) {
        return new Response(JSON.stringify({ error: 'ميزانية الإعلان لا تطابق السعر' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      const expectedHalalas = Math.round(expectedSar * 100)
      if (secret && payAmountHalalas != null && payAmountHalalas !== expectedHalalas) {
        return new Response(JSON.stringify({ error: 'مبلغ الدفع لا يطابق الإعلان' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      const startD = new Date().toISOString().slice(0, 10)
      const endDate = new Date(`${startD}T12:00:00.000Z`)
      endDate.setUTCDate(endDate.getUTCDate() + days - 1)
      const endD = endDate.toISOString().slice(0, 10)

      const { error: upErr } = await supabase
        .from('salon_ads')
        .update({
          status: 'active',
          start_date: startD,
          end_date: endD,
          moyasar_payment_id: payment_id,
        })
        .eq('id', ref)

      if (upErr) {
        console.error(upErr)
        return new Response(JSON.stringify({ error: 'فشل تفعيل الإعلان' }), {
          status: 500,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      return new Response(
        JSON.stringify({ success: true, type, ref, salon_id: ad.salon_id, day_count: days }),
        { headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    if (type === 'booking') {
      const { data: bk, error: bkErr } = await supabase
        .from('bookings')
        .select('id, total_price, commission_amount, platform_fee_percentage, payment_status')
        .eq('id', ref)
        .maybeSingle()

      if (bkErr || !bk) {
        console.error(bkErr)
        return new Response(JSON.stringify({ error: 'حجز غير موجود' }), {
          status: 404,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      const totalSar = Number((bk as { total_price?: unknown }).total_price)
      if (!Number.isFinite(totalSar) || totalSar < 0) {
        return new Response(JSON.stringify({ error: 'سعر الحجز غير صالح' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      const expectedHalalas = Math.round(totalSar * 100)
      if (secret && payAmountHalalas != null && payAmountHalalas !== expectedHalalas) {
        return new Response(JSON.stringify({ error: 'مبلغ الدفع لا يطابق الحجز' }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      const { error: upBk } = await supabase
        .from('bookings')
        .update({ payment_status: 'paid', payment_id, status: 'confirmed' })
        .eq('id', ref)

      if (upBk) {
        console.error(upBk)
        return new Response(JSON.stringify({ error: 'فشل تحديث الحجز' }), {
          status: 500,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }

      const row = bk as { commission_amount?: unknown; platform_fee_percentage?: unknown }
      const commission_amount =
        typeof row.commission_amount === 'number' ? row.commission_amount : Number(row.commission_amount)
      const platform_fee_percentage =
        typeof row.platform_fee_percentage === 'number'
          ? row.platform_fee_percentage
          : Number(row.platform_fee_percentage)

      return new Response(
        JSON.stringify({
          success: true,
          type,
          ref,
          total_price: totalSar,
          commission_amount: Number.isFinite(commission_amount) ? commission_amount : null,
          platform_fee_percentage: Number.isFinite(platform_fee_percentage) ? platform_fee_percentage : 10,
          settlement_note:
            'Moyasar: full amount settled to merchant; commission_amount is for reporting / manual payout until Connect.',
        }),
        { headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    const { error } = await supabase.from('orders').update({ payment_status: 'paid', payment_id }).eq('id', ref)

    if (error) {
      console.error(error)
      return new Response(JSON.stringify({ error: 'فشل تحديث الحالة' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, type, ref }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
