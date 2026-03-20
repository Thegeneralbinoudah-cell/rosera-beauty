import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
    if (type !== 'booking' && type !== 'order') {
      return new Response(JSON.stringify({ error: 'نوع غير صالح' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const secret = Deno.env.get('MOYASAR_SECRET_KEY')
    if (secret) {
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
      const pay = await res.json() as { status?: string }
      if (pay.status !== 'paid') {
        return new Response(JSON.stringify({ error: 'الدفع غير مكتمل', status: pay.status }), {
          status: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const table = type === 'booking' ? 'bookings' : 'orders'
    const { error } = await supabase
      .from(table)
      .update({ payment_status: 'paid', payment_id })
      .eq('id', ref)

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
