import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function internalEmail(phone: string) {
  const d = phone.replace(/\D/g, '')
  return `p${d}@rosera.phone`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { phone, otp } = await req.json()
    if (!phone || !otp || String(otp).length !== 4) {
      return new Response(JSON.stringify({ error: 'رمز التحقق غير صحيح' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const now = new Date().toISOString()
    const { data: rows, error: qErr } = await supabase
      .from('otp_codes')
      .select('id')
      .eq('phone', phone)
      .eq('otp', String(otp))
      .eq('used', false)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)

    if (qErr || !rows?.length) {
      return new Response(JSON.stringify({ error: 'رمز التحقق غير صحيح' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const otpId = rows[0].id
    await supabase.from('otp_codes').update({ used: true }).eq('id', otpId)

    const email = internalEmail(phone)
    const password = crypto.randomUUID() + crypto.randomUUID()

    const { data: mapRow } = await supabase
      .from('phone_auth_users')
      .select('user_id')
      .eq('phone', phone)
      .maybeSingle()

    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    let userId: string

    if (mapRow?.user_id) {
      userId = mapRow.user_id
      const admin = createClient(url, service)
      const { error: upErr } = await admin.auth.admin.updateUserById(userId, { password })
      if (upErr) throw upErr
    } else {
      const admin = createClient(url, service)
      const { data: created, error: crErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        phone,
        phone_confirm: true,
        user_metadata: { phone },
      })
      if (crErr) {
        if (crErr.message?.includes('already') || crErr.message?.includes('registered')) {
          const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
          const u = list?.users?.find((x) => x.phone === phone || x.email === email)
          if (!u) throw crErr
          userId = u.id
          await admin.auth.admin.updateUserById(userId, { password })
        } else throw crErr
      } else {
        userId = created.user!.id
      }
      await supabase.from('phone_auth_users').upsert({
        phone,
        user_id: userId,
        internal_email: email,
        updated_at: now,
      })
    }

    const tokenRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({ email, password }),
    })

    const tokenJson = await tokenRes.json()
    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error(tokenJson)
      return new Response(JSON.stringify({ error: 'رمز التحقق غير صحيح' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        access_token: tokenJson.access_token,
        refresh_token: tokenJson.refresh_token,
        expires_in: tokenJson.expires_in,
        user: tokenJson.user,
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: 'رمز التحقق غير صحيح' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
