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

function jsonDebugResponse(
  status: number,
  error: string,
  debug: { phase: string; detail?: string },
): Response {
  return new Response(JSON.stringify({ error, debug }), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}

const LEGACY_MODES = new Set(['hand', 'face'])
const ADVISOR_MODES = new Set(['hair_color', 'haircut', 'hand_nail', 'skin_analysis'])

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
  console.log('[rozi-vision] bearer access_token present', accessToken.length > 0)
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
  } catch (parseErr) {
    console.error('[rozi-vision] invalid JSON body', parseErr)
    return jsonDebugResponse(400, 'جسم الطلب غير صالح', {
      phase: 'invalid_json',
      detail: parseErr instanceof Error ? parseErr.message : String(parseErr),
    })
  }

  const modeRaw = typeof body.mode === 'string' ? body.mode.trim().toLowerCase() : ''
  if (!LEGACY_MODES.has(modeRaw) && !ADVISOR_MODES.has(modeRaw)) {
    console.error('[rozi-vision] invalid mode', { mode: body.mode })
    return jsonDebugResponse(
      400,
      'mode يجب أن يكون hand أو face أو hair_color أو haircut أو hand_nail أو skin_analysis',
      { phase: 'invalid_mode', detail: String(body.mode ?? '') },
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
      detail: !b64 ? 'empty_base64' : `length_${b64.length}_exceeds_max`,
    })
  }

  const mimeRaw = typeof body.imageMimeType === 'string' ? body.imageMimeType.trim() : ''
  const mimeAccepted = /^image\/(jpeg|jpg|png|webp)$/i.test(mimeRaw)
  if (mimeRaw && !mimeAccepted) {
    console.error('[rozi-vision] unsupported image mime (will default to image/jpeg)', { mime: mimeRaw })
  }
  const mime = mimeAccepted ? mimeRaw.toLowerCase().replace('jpg', 'jpeg') : 'image/jpeg'

  const dataUrl = `data:${mime};base64,${b64}`

  const apiKey = readOpenAiApiKey()
  if (!apiKey) {
    console.error('[rozi-vision] missing OPENAI_API_KEY in Edge Function secrets')
    return jsonDebugResponse(503, 'OPENAI_API_KEY غير مُعرّف في أسرار الدالة', {
      phase: 'missing_openai_key',
    })
  }

  try {
    if (ADVISOR_MODES.has(modeRaw)) {
      if (modeRaw === 'hand_nail') {
        const advisor_result = await runHandNailAdvisor(dataUrl, apiKey)
        return new Response(JSON.stringify({ advisor_result }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
      if (modeRaw === 'hair_color') {
        const advisor_result = await runHairColorAdvisor(dataUrl, apiKey)
        return new Response(JSON.stringify({ advisor_result }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
      if (modeRaw === 'skin_analysis') {
        const advisor_result = await runSkinAnalysisAdvisor(dataUrl, apiKey)
        return new Response(JSON.stringify({ advisor_result }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
      const advisor_result = await runHaircutAdvisor(dataUrl, apiKey)
      return new Response(JSON.stringify({ advisor_result }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const mode = modeRaw as VisionMode
    const hint =
      typeof body.personalizationHint === 'string' && body.personalizationHint.trim()
        ? body.personalizationHint.trim().slice(0, 900)
        : undefined

    const result = await runVisionAnalysis(mode, dataUrl, apiKey, hint ? { personalizationHint: hint } : undefined)
    return new Response(JSON.stringify({ result }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'خطأ غير متوقع'
    const stack = e instanceof Error ? e.stack : undefined
    console.error('[rozi-vision] OpenAI / advisor pipeline failed', { message: msg, stack, err: e })
    return jsonDebugResponse(500, msg, {
      phase: 'openai_or_advisor',
      detail: stack?.split('\n').slice(0, 5).join(' | '),
    })
  }
})
