import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function internalEmail(phone: string) {
  const d = phone.replace(/\D/g, '')
  return `p${d}@rosera.phone`
}

/** آخر 4 أرقام فقط — للسجلات دون كشف الرقم كاملاً */
function phoneTail(phone: string) {
  const d = phone.replace(/\D/g, '')
  return d.length >= 4 ? `…${d.slice(-4)}` : '(short)'
}

function errDetails(e: unknown): string {
  if (e instanceof Error) return `${e.name}: ${e.message}`
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}

/** يجب أن تكون متوفرة تلقائياً في Supabase Hosted Edge Functions */
function readRequiredEnv(): { url: string; service: string; anon: string } | Response {
  const url = Deno.env.get('SUPABASE_URL')?.trim()
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  const anon = Deno.env.get('SUPABASE_ANON_KEY')?.trim()
  const ok = Boolean(url && service && anon)
  console.info('[verify-otp] env', {
    hasSupabaseUrl: Boolean(url),
    hasServiceRole: Boolean(service),
    hasAnonKey: Boolean(anon),
  })
  if (!ok) {
    console.error('[verify-otp] missing env — set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY (Dashboard → Edge Functions → Secrets)')
    return json(
      {
        success: false,
        error: 'إعدادات الخادم غير مكتملة. راجعي متغيرات الدالة في Supabase.',
      },
      500
    )
  }
  return { url: url!, service: service!, anon: anon! }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    let body: Record<string, unknown>
    try {
      body = (await req.json()) as Record<string, unknown>
    } catch (parseErr) {
      console.error('[verify-otp] invalid JSON body', errDetails(parseErr))
      return json({ success: false, error: 'طلب غير صالح' }, 400)
    }

    const phone = body?.phone as string | undefined
    const codeRaw = (body?.code ?? body?.otp) as string | number | undefined
    const code = codeRaw != null ? String(codeRaw).trim() : ''

    console.info('[verify-otp] request', { phoneTail: phone ? phoneTail(phone) : '(none)', codeLen: code.length })

    if (!phone || typeof phone !== 'string' || !phone.startsWith('+966')) {
      console.warn('[verify-otp] validation failed: phone format')
      return json({ success: false, error: 'رقم غير صالح' }, 400)
    }
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      console.warn('[verify-otp] validation failed: code format')
      return json({ success: false, error: 'رمز غير صحيح أو منتهي' }, 400)
    }

    const envOrErr = readRequiredEnv()
    if (envOrErr instanceof Response) return envOrErr
    const { url, service, anon } = envOrErr

    const supabase = createClient(url, service)

    const now = new Date().toISOString()
    const { data: rows, error: qErr } = await supabase
      .from('otp_codes')
      .select('id')
      .eq('phone', phone)
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', now)
      .order('created_at', { ascending: false })
      .limit(1)

    if (qErr) {
      console.error('[verify-otp] otp_codes query error', qErr.message, qErr)
      return json({ success: false, error: 'رمز غير صحيح أو منتهي' })
    }
    if (!rows?.length) {
      console.warn('[verify-otp] no matching OTP row', { phoneTail: phoneTail(phone) })
      return json({ success: false, error: 'رمز غير صحيح أو منتهي' })
    }

    const otpId = rows[0].id
    console.info('[verify-otp] otp row ok', { otpId })

    const email = internalEmail(phone)
    const password = crypto.randomUUID() + crypto.randomUUID()

    const { data: mapRow } = await supabase
      .from('phone_auth_users')
      .select('user_id')
      .eq('phone', phone)
      .maybeSingle()

    let userId: string

    if (mapRow?.user_id) {
      console.info('[verify-otp] branch: existing phone_auth_users mapping', { userId: mapRow.user_id })
      userId = mapRow.user_id
      const admin = createClient(url, service)
      const { error: upErr } = await admin.auth.admin.updateUserById(userId, { password })
      if (upErr) {
        console.error('[verify-otp] updateUserById (mapped user) failed', upErr.message, upErr)
        throw upErr
      }
    } else {
      console.info('[verify-otp] branch: create or recover user')
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
          console.warn('[verify-otp] createUser duplicate — recovering', crErr.message)
          const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 })
          const u = list?.users?.find((x) => x.phone === phone || x.email === email)
          if (!u) {
            console.error('[verify-otp] duplicate user but not found in listUsers')
            throw crErr
          }
          userId = u.id
          const { error: recoverPwErr } = await admin.auth.admin.updateUserById(userId, { password })
          if (recoverPwErr) {
            console.error('[verify-otp] updateUserById after duplicate user', recoverPwErr.message, recoverPwErr)
            throw recoverPwErr
          }
          console.info('[verify-otp] recovered password for existing auth user', { userId })
        } else {
          console.error('[verify-otp] createUser failed', crErr.message, crErr)
          throw crErr
        }
      } else {
        userId = created.user!.id
        console.info('[verify-otp] new auth user created', { userId })
      }
      const { error: upsertErr } = await supabase.from('phone_auth_users').upsert({
        phone,
        user_id: userId,
        internal_email: email,
        updated_at: now,
      })
      if (upsertErr) {
        console.error('[verify-otp] phone_auth_users upsert', upsertErr.message, upsertErr)
        throw upsertErr
      }
    }

    console.info('[verify-otp] requesting password session token')
    const tokenRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({ email, password }),
    })

    const tokenJson = (await tokenRes.json()) as Record<string, unknown>
    if (!tokenRes.ok || !tokenJson.access_token) {
      console.error('[verify-otp] token endpoint failed', {
        status: tokenRes.status,
        body: tokenJson,
      })
      return json({ success: false, error: 'رمز غير صحيح أو منتهي' })
    }

    const { error: otpConsumedErr } = await supabase.from('otp_codes').update({ used: true }).eq('id', otpId)
    if (otpConsumedErr) {
      console.error('[verify-otp] failed to mark OTP used after successful session', otpConsumedErr.message, otpConsumedErr)
    }

    console.info('[verify-otp] success', { phoneTail: phoneTail(phone) })
    return json({
      success: true,
      access_token: tokenJson.access_token,
      refresh_token: tokenJson.refresh_token,
      expires_in: tokenJson.expires_in,
      user: tokenJson.user,
    })
  } catch (e) {
    console.error('[verify-otp] unhandled', errDetails(e), e)
    return json({ success: false, error: 'تعذر إتمام التحقق. حاولي مرة أخرى أو تواصلي مع الدعم.' }, 500)
  }
})
