/**
 * Rosy Vision AI — hand undertone / face hair analysis.
 * Delegates to shared pipeline; errors return HTTP 500 (legacy).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { readOpenAiApiKey, runVisionAnalysis, type VisionMode } from '../_shared/roziVisionCore.ts'

export type { RozyVisionResult } from '../_shared/roziVisionCore.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_BASE64_CHARS = 5_200_000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
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
  if (!supabaseUrl || !supabaseAnonKey) {
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

  let body: { mode?: string; imageBase64?: string; imageMimeType?: string; personalizationHint?: string }
  try {
    body = (await req.json()) as {
      mode?: string
      imageBase64?: string
      imageMimeType?: string
      personalizationHint?: string
    }
  } catch {
    return new Response(JSON.stringify({ error: 'جسم الطلب غير صالح' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const modeRaw = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : ''
  if (modeRaw !== 'face' && modeRaw !== 'hand') {
    return new Response(JSON.stringify({ error: 'mode يجب أن يكون hand أو face' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
  const mode = modeRaw as VisionMode

  const b64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : ''
  if (!b64 || b64.length > MAX_BASE64_CHARS) {
    return new Response(JSON.stringify({ error: 'صورة غير صالحة أو كبيرة جداً' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const mime = typeof body.imageMimeType === 'string' && /^image\/(jpeg|jpg|png|webp)$/i.test(body.imageMimeType.trim())
    ? body.imageMimeType.trim().toLowerCase().replace('jpg', 'jpeg')
    : 'image/jpeg'

  const dataUrl = `data:${mime};base64,${b64}`

  const apiKey = readOpenAiApiKey()
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY غير مُعرّف في أسرار الدالة' }), {
      status: 503,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const hint =
    typeof body.personalizationHint === 'string' && body.personalizationHint.trim()
      ? body.personalizationHint.trim().slice(0, 900)
      : undefined

  try {
    const result = await runVisionAnalysis(mode, dataUrl, apiKey, hint ? { personalizationHint: hint } : undefined)
    return new Response(JSON.stringify({ result }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'خطأ غير متوقع'
    console.error('[rozy-vision]', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
