import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { phone } = await req.json()
    if (!phone || typeof phone !== 'string' || !phone.startsWith('+966')) {
      return new Response(JSON.stringify({ error: 'رقم غير صالح' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { count, error: cErr } = await supabase
      .from('otp_codes')
      .select('*', { count: 'exact', head: true })
      .eq('phone', phone)
      .gte('created_at', tenMinAgo)
    if (cErr) throw cErr
    if ((count ?? 0) >= 3) {
      return new Response(JSON.stringify({ error: 'تجاوزتِ الحد — حاولي بعد 10 دقائق' }), {
        status: 429,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const otp = String(Math.floor(1000 + Math.random() * 9000))
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    const { error: insErr } = await supabase.from('otp_codes').insert({
      phone,
      otp,
      expires_at: expiresAt,
      used: false,
    })
    if (insErr) throw insErr

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID')
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN')
    const fromNumber = Deno.env.get('TWILIO_FROM') ?? Deno.env.get('TWILIO_PHONE_NUMBER')
    if (!accountSid || !authToken || !fromNumber) {
      console.error('Twilio env missing')
      return new Response(JSON.stringify({ error: 'إعدادات SMS غير مكتملة' }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const body = new URLSearchParams({
      To: phone,
      From: fromNumber,
      Body: `رمز التحقق من روزيرا: ${otp}\nلا تشاركيه مع أحد.`,
    })
    const tw = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa(`${accountSid}:${authToken}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      }
    )
    if (!tw.ok) {
      const t = await tw.text()
      console.error('Twilio', t)
      return new Response(JSON.stringify({ error: 'فشل إرسال الرسالة' }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true }), {
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
