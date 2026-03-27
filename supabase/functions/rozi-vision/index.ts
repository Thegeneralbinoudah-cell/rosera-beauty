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

const MAX_BASE64_CHARS = 5_200_000

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
  if (!LEGACY_MODES.has(modeRaw) && !ADVISOR_MODES.has(modeRaw)) {
    return new Response(
      JSON.stringify({
        error: 'mode يجب أن يكون hand أو face أو hair_color أو haircut أو hand_nail أو skin_analysis',
      }),
      {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      },
    )
  }

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
    console.error('[rozi-vision]', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
