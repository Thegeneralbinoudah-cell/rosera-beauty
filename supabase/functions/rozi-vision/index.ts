/**
 * Rozi Vision AI — hand/face (legacy core) + advisor modes (structured JSON).
 * Deploy as Edge Function slug `rozi-vision` (only canonical vision endpoint).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { readOpenAiApiKey, runVisionAnalysis, type VisionMode } from '../_shared/roziVisionCore.ts'
import {
  runHandNailAdvisor,
  runHairColorAdvisor,
  runHaircutAdvisor,
  runSkinAnalysisAdvisor,
} from '../_shared/rozyVisionAdvisorModes.ts'

export type { RozyVisionResult } from '../_shared/roziVisionCore.ts'
export type {
  HandNailAdvisorResult,
  HairColorAdvisorResult,
  HaircutAdvisorResult,
  SkinAnalysisAdvisorResult,
} from '../_shared/rozyVisionAdvisorModes.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

console.log('[rozi-vision] edge secrets presence', {
  OPENAI_API_KEY: Boolean(Deno.env.get('OPENAI_API_KEY')?.trim()),
})

const MAX_BASE64_CHARS = 5_200_000

type RoziVisionDebug = { phase: string; detail?: string; reason?: string }

function jsonDebugResponse(status: number, error: string, debug: RoziVisionDebug): Response {
  return new Response(JSON.stringify({ error, debug }), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

function jsonOkWithDebug(body: Record<string, unknown>, debug: RoziVisionDebug): Response {
  return new Response(JSON.stringify({ ...body, debug }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

const LEGACY_MODES = new Set(['hand', 'face'])
const ADVISOR_MODES = new Set(['hair_color', 'haircut', 'hand_nail', 'skin_analysis'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return jsonDebugResponse(405, 'Method not allowed', {
      phase: 'http',
      reason: 'method_not_allowed',
      detail: req.method,
    })
  }

  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return jsonDebugResponse(401, 'يجب تسجيل الدخول', {
      phase: 'auth',
      reason: 'missing_or_invalid_authorization_header',
    })
  }

  const accessToken = auth.slice(7).trim()
  console.log('[rozi-vision] bearer access_token present', accessToken.length > 0)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim()
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonDebugResponse(500, 'إعداد Supabase ناقص', {
      phase: 'config',
      reason: 'missing_supabase_url_or_anon_key',
    })
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey)
  const { data: userData, error: authErr } = await authClient.auth.getUser(accessToken)
  if (authErr || !userData?.user) {
    return jsonDebugResponse(401, 'جلسة غير صالحة', {
      phase: 'auth',
      reason: 'get_user_failed',
      detail: authErr?.message ?? 'no_user',
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
  } catch (parseErr) {
    console.error('[rozi-vision] invalid JSON body', parseErr)
    return jsonDebugResponse(400, 'جسم الطلب غير صالح', {
      phase: 'invalid_json',
      reason: 'body_parse_failed',
      detail: parseErr instanceof Error ? parseErr.message : String(parseErr),
    })
  }

  const modeRaw = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : ''
  if (!LEGACY_MODES.has(modeRaw) && !ADVISOR_MODES.has(modeRaw)) {
    console.error('[rozi-vision] invalid mode', { mode: body.mode })
    return jsonDebugResponse(
      400,
      'mode يجب أن يكون hand أو face أو hair_color أو haircut أو hand_nail أو skin_analysis',
      { phase: 'invalid_mode', reason: 'unsupported_mode', detail: String(body.mode ?? '') },
    )
  }

  const b64 = typeof body.imageBase64 === 'string' ? body.imageBase64.trim() : ''
  if (!b64 || b64.length > MAX_BASE64_CHARS) {
    console.error('[rozi-vision] invalid image payload', {
      empty: !b64,
      length: b64.length,
      max: MAX_BASE64_CHARS,
    })
    return jsonDebugResponse(400, 'صورة غير صالحة أو كبيرة جداً', {
      phase: 'invalid_image',
      reason: !b64 ? 'empty_base64' : 'base64_too_large',
      detail: !b64 ? 'empty_base64' : `length_${b64.length}_exceeds_max`,
    })
  }

  const mimeRaw = typeof body.imageMimeType === 'string' ? body.imageMimeType.trim() : ''
  const mimeAccepted = /^image\/(jpeg|jpg|png|webp)$/i.test(mimeRaw)
  if (mimeRaw && !mimeAccepted) {
    console.error('[rozi-vision] unsupported image mime (will default to image/jpeg)', { mime: mimeRaw })
  }
  const mime = mimeAccepted ? mimeRaw.toLowerCase().replace('jpg', 'jpeg') : 'image/jpeg'

  console.log('[rozi-vision] image payload (no raw base64)', {
    mode: modeRaw,
    imageBase64Length: b64.length,
    imageMimeTypeRaw: mimeRaw || '(omitted)',
    imageMimeResolved: mime,
    mimeAcceptedFromClient: mimeAccepted,
  })

  const dataUrl = `data:${mime};base64,${b64}`

  let debugKeyInfo = ''
  try {
    const key = Deno.env.get('OPENAI_API_KEY') || ''
    debugKeyInfo = `
   exists: ${Boolean(key)}
   length: ${key.length}
   startsWith sk: ${key.startsWith('sk-')}
   first10: ${key.slice(0, 10)}
   `

    return new Response(
      JSON.stringify({
        error: 'debug_key_check',
        debug: {
          phase: 'key_check',
          detail: debugKeyInfo,
        },
      }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    )

    if (!key) throw new Error('OPENAI_API_KEY missing')
    if (!key.startsWith('sk-')) throw new Error('OPENAI_API_KEY invalid format')
    if (key.length < 20) throw new Error('OPENAI_API_KEY too short')

    const apiKey = readOpenAiApiKey()

    if (ADVISOR_MODES.has(modeRaw)) {
      if (modeRaw === 'hand_nail') {
        const advisor_result = await runHandNailAdvisor(dataUrl, apiKey)
        return jsonOkWithDebug({ advisor_result }, { phase: 'ok', detail: 'hand_nail' })
      }
      if (modeRaw === 'hair_color') {
        const advisor_result = await runHairColorAdvisor(dataUrl, apiKey)
        return jsonOkWithDebug({ advisor_result }, { phase: 'ok', detail: 'hair_color' })
      }
      if (modeRaw === 'skin_analysis') {
        const advisor_result = await runSkinAnalysisAdvisor(dataUrl, apiKey)
        return jsonOkWithDebug({ advisor_result }, { phase: 'ok', detail: 'skin_analysis' })
      }
      const advisor_result = await runHaircutAdvisor(dataUrl, apiKey)
      return jsonOkWithDebug({ advisor_result }, { phase: 'ok', detail: 'haircut' })
    }

    const mode = modeRaw as VisionMode
    const hint =
      typeof body.personalizationHint === 'string' && body.personalizationHint.trim()
        ? body.personalizationHint.trim().slice(0, 900)
        : undefined

    const result = await runVisionAnalysis(mode, dataUrl, apiKey, hint ? { personalizationHint: hint } : undefined)
    return jsonOkWithDebug({ result }, { phase: 'ok', detail: mode })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'خطأ غير متوقع'
    const stack = e instanceof Error ? e.stack : undefined
    console.error('[rozi-vision] OpenAI / advisor pipeline failed', { message: msg, stack, err: e })
    const detailTail = stack?.split('\n').slice(0, 5).join(' | ') ?? ''
    const detailWithKey = debugKeyInfo
      ? `${debugKeyInfo.trim()}\n\n${detailTail}`.trim()
      : detailTail
    return jsonDebugResponse(500, msg, {
      phase: 'openai_or_advisor',
      reason: e instanceof Error ? e.name : 'unknown',
      detail: detailWithKey || undefined,
    })
  }
})
