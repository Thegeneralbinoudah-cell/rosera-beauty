import { supabase } from '@/lib/supabase'
import {
  getEdgeFunctionErrorMessage,
  getEdgeFunctionErrorPayload,
  getEdgeFunctionHttpErrorDetail,
} from '@/lib/edgeInvoke'
import { normalizeRozyVisionResult, MAX_ROZY_VISION_BASE64_CHARS } from '@/lib/rozyVision'
import type { RozyVisionMode } from '@/lib/rozyVisionTypes'
import type {
  HairColorAdvisorResult,
  HaircutAdvisorResult,
  HandNailAdvisorResult,
  RozyAdvisorMode,
  RozyVisionChatResult,
  SkinAnalysisAdvisorResult,
  VisionAdvisorWireFields,
} from '@/lib/rozyVisionChatTypes'

export const VISION_FAIL_AR = 'عذراً، حدث خطأ في التحليل. حاولي مجدداً.'

const ROZY_VISION_INVOKE_TIMEOUT_MS = 120_000

export type RozyVisionEdgeDebug = { phase?: string; detail?: string; reason?: string }

/** رسالة واحدة للعرض المؤقت في فقاعة المحادثة (تشخيص rozi-vision). */
export function formatRoziVisionDebugError(edgeError: string, debug: RozyVisionEdgeDebug | null | undefined): string {
  const phase = debug?.phase?.trim() || '—'
  const reason = debug?.reason?.trim() || '—'
  const detail = debug?.detail?.trim() || '—'
  return `[rozi-vision debug]\nphase: ${phase}\nreason: ${reason}\ndetail: ${detail}\nerror: ${edgeError}`
}

function asDebug(x: unknown): RozyVisionEdgeDebug | null {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null
  const o = x as Record<string, unknown>
  return {
    phase: typeof o.phase === 'string' ? o.phase : undefined,
    detail: typeof o.detail === 'string' ? o.detail : undefined,
    reason: typeof o.reason === 'string' ? o.reason : undefined,
  }
}

function ensureVisionWireFields(o: Record<string, unknown>): VisionAdvisorWireFields {
  const summary =
    typeof o.summary === 'string' && o.summary.trim() ? o.summary.trim() : 'analysis unavailable'
  const details = typeof o.details === 'string' ? o.details : ''
  const recommendations = Array.isArray(o.recommendations)
    ? o.recommendations.filter((x): x is string => typeof x === 'string')
    : []
  return { summary, details, recommendations }
}

function fallbackHandNail(): HandNailAdvisorResult {
  const brands = ['OPI', 'Essie', 'Inglot', 'MAC', 'NARS', 'OPI'] as const
  const nail_colors = Array.from({ length: 6 }, (_, i) => ({
    name_ar: 'لون مقترح',
    name_en: 'Suggested',
    hex: '#D8A5A5',
    reason_ar: 'يتناغم مع إطلالتكِ.',
    brand: brands[i],
  }))
  return {
    advisor_mode: 'hand_nail',
    undertone: 'unclear',
    undertone_ar: 'analysis unavailable',
    explanation_ar: '—',
    nail_colors,
    avoid_colors: Array(3).fill('درجات نيون فاقعة قد لا تناسب الإطلالة اليومية'),
    summary: 'analysis unavailable',
    details: '',
    recommendations: [],
  }
}

function fallbackHairColor(): HairColorAdvisorResult {
  const recommended_colors = Array.from({ length: 5 }, () => ({
    name_ar: 'صبغة مقترحة',
    name_en: 'Suggested tone',
    hex: '#6B4423',
    technique_ar: 'صبغة متوازنة',
    maintenance_ar: 'متوسط',
    why_ar: 'ينسجم مع درجة بشرتكِ الظاهرة.',
  }))
  return {
    advisor_mode: 'hair_color',
    skin_tone: '—',
    eye_color: '—',
    recommended_colors,
    avoid_colors: ['درجات قد تزيد الجفاف الظاهر للون', 'درجات قد تزيد الجفاف الظاهر للون'],
    disclaimer_ar: 'هذه توصيات فقط، استشيري متخصصة قبل الصبغ.',
    summary: 'analysis unavailable',
    details: '',
    recommendations: [],
  }
}

function fallbackHaircut(): HaircutAdvisorResult {
  const recommended_cuts = Array.from({ length: 4 }, () => ({
    name_ar: 'قصة مقترحة',
    name_en: 'Suggested cut',
    description_ar: 'يُوازن خط الوجه الظاهر في الصورة.',
    length_ar: 'متوسط',
  }))
  const avoid_cuts = [
    { name_ar: 'قصة غير مناسبة', reason_ar: 'قد توسّع أو تضيق إطلالة الوجه بشكل غير متوازن.' },
    { name_ar: 'قصة غير مناسبة', reason_ar: 'قد توسّع أو تضيق إطلالة الوجه بشكل غير متوازن.' },
  ]
  return {
    advisor_mode: 'haircut',
    face_shape: 'oval',
    face_shape_ar: '—',
    recommended_cuts,
    avoid_cuts,
    styling_tip_ar: '—',
    summary: 'analysis unavailable',
    details: '',
    recommendations: [],
  }
}

function fallbackSkinAnalysis(): SkinAnalysisAdvisorResult {
  return {
    advisor_mode: 'skin_analysis',
    skin_type: 'غير محدد',
    concerns: ['عناية يومية ومتابعة', 'عناية يومية ومتابعة'],
    condition: 'normal',
    skincare_routine: {
      morning: ['غسلي بشرتك بلطف بماء فاتر.', 'رطبّي.', 'واقي شمس.'],
      evening: ['أزيلي المكياج بلطف ثم رطبّي.', 'نوم كافٍ.', 'ترطيب ليلي.'],
    },
    treatments: [
      {
        name_ar: 'مرطب لطيف',
        name_en: 'Gentle moisturizer',
        brand: 'CeraVe',
        reason_ar: 'دعم حاجز البشرة التجميلي بلطف.',
      },
      {
        name_ar: 'مرطب لطيف',
        name_en: 'Gentle moisturizer',
        brand: 'La Roche-Posay',
        reason_ar: 'دعم حاجز البشرة التجميلي بلطف.',
      },
      {
        name_ar: 'مرطب لطيف',
        name_en: 'Gentle moisturizer',
        brand: 'CeraVe',
        reason_ar: 'دعم حاجز البشرة التجميلي بلطف.',
      },
    ],
    clinic_services: [],
    clinic_needed: false,
    disclaimer_ar:
      'هذه معلومات تجميلية تعليمية فقط وليست تشخيصاً طبياً. استشيري طبيبة جلدية عند الحاجة.',
    summary: 'analysis unavailable',
    details: '',
    recommendations: [],
  }
}

function normalizeHandNailAdvisor(raw: unknown): HandNailAdvisorResult {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const wire = ensureVisionWireFields(o)
  const invalid =
    o.advisor_mode !== 'hand_nail' || !Array.isArray(o.nail_colors) || !Array.isArray(o.avoid_colors)
  if (invalid) {
    console.warn('[rozyVisionChatInvoke] hand_nail advisor_result missing or invalid; using safe fallback', {
      advisor_mode: o.advisor_mode,
    })
    return { ...fallbackHandNail(), ...wire }
  }
  return { ...(o as unknown as HandNailAdvisorResult), ...wire }
}

function normalizeHairColorAdvisor(raw: unknown): HairColorAdvisorResult {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const wire = ensureVisionWireFields(o)
  const invalid = o.advisor_mode !== 'hair_color' || !Array.isArray(o.recommended_colors) || !Array.isArray(o.avoid_colors)
  if (invalid) {
    console.warn('[rozyVisionChatInvoke] hair_color advisor_result missing or invalid; using safe fallback', {
      advisor_mode: o.advisor_mode,
    })
    return { ...fallbackHairColor(), ...wire }
  }
  return { ...(o as unknown as HairColorAdvisorResult), ...wire }
}

function normalizeHaircutAdvisor(raw: unknown): HaircutAdvisorResult {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const wire = ensureVisionWireFields(o)
  const invalid =
    o.advisor_mode !== 'haircut' || !Array.isArray(o.recommended_cuts) || !Array.isArray(o.avoid_cuts)
  if (invalid) {
    console.warn('[rozyVisionChatInvoke] haircut advisor_result missing or invalid; using safe fallback', {
      advisor_mode: o.advisor_mode,
    })
    return { ...fallbackHaircut(), ...wire }
  }
  return { ...(o as unknown as HaircutAdvisorResult), ...wire }
}

function normalizeSkinAnalysisAdvisor(raw: unknown): SkinAnalysisAdvisorResult {
  const o = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const wire = ensureVisionWireFields(o)
  const routine = o.skincare_routine && typeof o.skincare_routine === 'object' && !Array.isArray(o.skincare_routine)
    ? (o.skincare_routine as Record<string, unknown>)
    : null
  const invalid =
    o.advisor_mode !== 'skin_analysis' ||
    !Array.isArray(o.concerns) ||
    !Array.isArray(o.treatments) ||
    !routine ||
    !Array.isArray(routine.morning) ||
    !Array.isArray(routine.evening)
  if (invalid) {
    console.warn('[rozyVisionChatInvoke] skin_analysis advisor_result missing or invalid; using safe fallback', {
      advisor_mode: o.advisor_mode,
    })
    return { ...fallbackSkinAnalysis(), ...wire }
  }
  return { ...(o as unknown as SkinAnalysisAdvisorResult), ...wire }
}

/**
 * يستدعي `rozi-vision` مع أي وضع مدعوم ويُرجع اتحاداً مميزاً حسب `mode`.
 * عند الفشل: `console.error` كامل + رمي `Error` برسالة تفصيلية للتشخيص (مؤقتاً).
 */
export async function invokeRozyAdvisor(
  mode: RozyAdvisorMode,
  base64: string,
  mimeType: string,
): Promise<RozyVisionChatResult> {
  try {
    if (base64.length > MAX_ROZY_VISION_BASE64_CHARS) {
      const msg = `[rozyVisionChatInvoke] image base64 too large: ${base64.length} chars (max ${MAX_ROZY_VISION_BASE64_CHARS})`
      console.error(msg)
      throw new Error(
        formatRoziVisionDebugError(msg, {
          phase: 'client',
          reason: 'image_base64_too_large',
          detail: `length=${base64.length}`,
        }),
      )
    }

    const { data: { session } } = await supabase.auth.getSession()
    let token = session?.access_token?.trim() ?? ''
    const now = Math.floor(Date.now() / 1000)
    const exp = session?.expires_at
    const needsRefresh = !token || (typeof exp === 'number' && exp <= now + 30)
    if (needsRefresh) {
      const { data: ref } = await supabase.auth.refreshSession()
      token = ref.session?.access_token?.trim() ?? ''
    }
    console.log('[rozyVisionChatInvoke] access_token present', Boolean(token))
    if (!token) {
      throw new Error(
        formatRoziVisionDebugError(
          'يجب تسجيل الدخول لاستخدام روزي مع الصورة. سجّلي دخولكِ ثم أعيدي المحاولة.',
          { phase: 'client', reason: 'no_access_token' },
        ),
      )
    }

    const { data, error, response: fnResponse } = await supabase.functions.invoke('rozi-vision', {
      body: {
        mode,
        imageBase64: base64,
        imageMimeType: mimeType?.trim() || 'image/jpeg',
      },
      headers: { Authorization: `Bearer ${token}` },
      timeout: ROZY_VISION_INVOKE_TIMEOUT_MS,
    })

    if (error) {
      const payload = await getEdgeFunctionErrorPayload(error, fnResponse ?? null)
      const fromBody = await getEdgeFunctionHttpErrorDetail(error, fnResponse ?? null)
      const hint =
        (typeof payload?.error === 'string' && payload.error.trim() ? payload.error.trim() : null) ??
        fromBody ??
        getEdgeFunctionErrorMessage(error as Error, data)
      console.error('[rozyVisionChatInvoke] functions.invoke failed', {
        error,
        data,
        responseStatus: fnResponse?.status,
        message: hint,
        debug: payload?.debug,
      })
      throw new Error(
        formatRoziVisionDebugError(
          hint || (error instanceof Error ? error.message : String(error)),
          payload?.debug ?? null,
        ),
      )
    }

    const pack = data as {
      result?: unknown
      advisor_result?: unknown
      error?: string
      debug?: unknown
    } | null
    if (pack?.error) {
      const errText =
        typeof pack.error === 'string' ? pack.error : JSON.stringify(pack.error)
      const dbg = asDebug(pack.debug)
      console.error('[roziVisionChatInvoke] rozi-vision body error', { error: pack.error, debug: pack.debug })
      throw new Error(formatRoziVisionDebugError(errText, dbg))
    }

    if (mode === 'hand' || mode === 'face') {
      if (!pack?.result || typeof pack.result !== 'object') {
        const msg = `[rozyVisionChatInvoke] missing or invalid result for mode=${mode}`
        console.error(msg, { pack })
        throw new Error(formatRoziVisionDebugError(msg, asDebug(pack?.debug)))
      }
      const result = normalizeRozyVisionResult(pack.result, mode as RozyVisionMode)
      const out = mode === 'hand' ? ({ mode: 'hand' as const, result }) : ({ mode: 'face' as const, result })
      console.log('[rozyVisionChatInvoke] final response to UI', out)
      return out
    }

    if (mode === 'hair_color') {
      const advisor_result = normalizeHairColorAdvisor(pack?.advisor_result)
      const out = { mode: 'hair_color' as const, advisor_result }
      console.log('[rozyVisionChatInvoke] final response to UI', out)
      return out
    }

    if (mode === 'haircut') {
      const advisor_result = normalizeHaircutAdvisor(pack?.advisor_result)
      const out = { mode: 'haircut' as const, advisor_result }
      console.log('[rozyVisionChatInvoke] final response to UI', out)
      return out
    }

    if (mode === 'hand_nail') {
      const advisor_result = normalizeHandNailAdvisor(pack?.advisor_result)
      const out = { mode: 'hand_nail' as const, advisor_result }
      console.log('[rozyVisionChatInvoke] final response to UI', out)
      return out
    }

    if (mode === 'skin_analysis') {
      const advisor_result = normalizeSkinAnalysisAdvisor(pack?.advisor_result)
      const out = { mode: 'skin_analysis' as const, advisor_result }
      console.log('[rozyVisionChatInvoke] final response to UI', out)
      return out
    }

    const msg = `[rozyVisionChatInvoke] unsupported mode branch: ${mode}`
    console.error(msg)
    throw new Error(formatRoziVisionDebugError(msg, null))
  } catch (e) {
    console.error('[rozyVisionChatInvoke] failed', e)
    if (e instanceof Error) throw e
    throw new Error(formatRoziVisionDebugError(String(e), null))
  }
}
