import { supabase } from '@/lib/supabase'
import { getEdgeFunctionErrorMessage, getEdgeFunctionHttpErrorDetail } from '@/lib/edgeInvoke'
import type {
  RozyVisionConfidence,
  RozyVisionFaceShape,
  RozyVisionMode,
  RozyVisionResult,
  RozyVisionUndertone,
} from '@/lib/rozyVisionTypes'

export type RozyVisionInvokePayload = {
  mode: RozyVisionMode
  imageBase64: string
  imageMimeType?: string
  /** Optional Arabic hint from saved undertone/styles — forwarded to Edge (no images). */
  personalizationHint?: string
  /** Cancel in-flight invoke (navigate away / new analysis). */
  signal?: AbortSignal
}

/** Aligns with Edge `MAX_BASE64_CHARS` — max raw image size before base64 (~3.9MB). */
export const MAX_ROZY_VISION_IMAGE_BYTES = 3_800_000

/** Same as `supabase/functions/rozi-vision` — reject before upload if longer. */
export const MAX_ROZY_VISION_BASE64_CHARS = 5_200_000

/** Vision call budget — slow networks get a clear error instead of hanging UI. */
const ROZY_VISION_INVOKE_TIMEOUT_MS = 120_000

/** Thrown when invoke was aborted (navigate away / new run) — no toast. */
export class RozyVisionInvokeAbortedError extends Error {
  constructor() {
    super('rozy_vision_aborted')
    this.name = 'RozyVisionInvokeAbortedError'
  }
}

function isAbortLikeInvokeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const e = error as { name?: string; message?: string; context?: unknown }
  if (e.name === 'AbortError') return true
  if (e.name === 'FunctionsFetchError' && e.context && typeof e.context === 'object') {
    const c = e.context as { name?: string; message?: string }
    if (c.name === 'AbortError') return true
    if (typeof c.message === 'string' && /aborted|AbortError/i.test(c.message)) return true
  }
  if (typeof e.message === 'string' && /aborted|The user aborted|AbortError/i.test(e.message)) return true
  return false
}

const MAX_STR_ITEMS = 24
const MAX_ITEM_LEN = 180

function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((x): x is string => typeof x === 'string')
    .map((x) => x.trim().slice(0, MAX_ITEM_LEN))
    .filter(Boolean)
    .slice(0, MAX_STR_ITEMS)
}

function stripOverApologyAr(s: string): string {
  return s
    .replace(
      /عذراً|آسفة|آسف|معذرة|اسف|اعتذر|أعتذر|لسوء الحظ|للأسف|آسفين|نأسف|نأسف لك|يؤسفني/gi,
      '',
    )
    .replace(/\s{2,}/g, ' ')
    .trim()
}

const CONF_SET = new Set<RozyVisionConfidence>(['high', 'medium', 'low'])
const UNDERTONE_SET = new Set<RozyVisionUndertone>(['warm', 'cool', 'neutral', 'uncertain'])
const FACE_SET = new Set<RozyVisionFaceShape>(['oval', 'round', 'square', 'heart', 'uncertain'])

/** يطابق منطق الخادم: غياب الحقل = مقبول؛ الرفض الصريح فقط يرفض. */
function coerceQualityOk(v: unknown): boolean {
  if (v === false) return false
  if (v === true) return true
  if (v === 0) return false
  if (v === 1) return true
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === 'false' || s === 'no' || s === '0') return false
    if (s === 'true' || s === 'yes' || s === '1') return true
  }
  return true
}

function pickMode(v: unknown, fallback: RozyVisionMode): RozyVisionMode {
  return v === 'hand' || v === 'face' ? v : fallback
}

function pickConfidence(v: unknown): RozyVisionConfidence {
  return typeof v === 'string' && CONF_SET.has(v as RozyVisionConfidence)
    ? (v as RozyVisionConfidence)
    : 'low'
}

function pickUndertone(v: unknown): RozyVisionUndertone {
  return typeof v === 'string' && UNDERTONE_SET.has(v as RozyVisionUndertone)
    ? (v as RozyVisionUndertone)
    : 'uncertain'
}

function pickFaceShape(v: unknown): RozyVisionFaceShape {
  return typeof v === 'string' && FACE_SET.has(v as RozyVisionFaceShape)
    ? (v as RozyVisionFaceShape)
    : 'uncertain'
}

/**
 * Defense-in-depth: Edge should return a full schema, but partial JSON or version skew must not crash the UI.
 */
const FALLBACK_SUMMARY: Record<RozyVisionMode, string> = {
  hand: 'لم نستلم ملخصاً كاملاً من الخادم — جرّبي «إعادة المحاولة» أو صورة بإضاءة نهارية أوضح.',
  face: 'لم نستلم ملخصاً كاملاً من الخادم — جرّبي «إعادة المحاولة» أو لقطة أمامية أوضح للوجه.',
}

export function normalizeRozyVisionResult(raw: unknown, fallbackMode: RozyVisionMode): RozyVisionResult {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const mode = pickMode(r.mode, fallbackMode)
  let summaryRaw = typeof r.summaryAr === 'string' ? stripOverApologyAr(r.summaryAr) : ''
  if (summaryRaw.replace(/[\s\u200c\u200f]/g, '').length < 4) {
    summaryRaw = FALLBACK_SUMMARY[mode]
  }
  const base: RozyVisionResult = {
    mode,
    confidence: pickConfidence(r.confidence),
    qualityOk: coerceQualityOk(r.qualityOk),
    summaryAr: summaryRaw,
    undertone: pickUndertone(r.undertone),
    faceShape: pickFaceShape(r.faceShape),
    recommendedColors: strArr(r.recommendedColors),
    colorsToAvoid: strArr(r.colorsToAvoid),
    recommendedHairColors: strArr(r.recommendedHairColors),
    recommendedHaircuts: strArr(r.recommendedHaircuts),
    cautionNotes: strArr(r.cautionNotes),
    retryTips: strArr(r.retryTips),
    nextActions: strArr(r.nextActions),
  }
  if (!base.qualityOk && base.retryTips.length === 0) {
    return {
      ...base,
      retryTips: ['إضاءة طبيعية نهارية', 'بدون فلتر قوي', 'قريبة وواضحة'],
    }
  }
  if (
    base.qualityOk &&
    base.recommendedColors.length === 0 &&
    base.recommendedHairColors.length === 0 &&
    base.recommendedHaircuts.length === 0
  ) {
    return { ...base, confidence: 'low' }
  }
  return base
}

/**
 * Production Rosy Vision — analyzes hand (undertone + nails) or face (hair colors + haircuts).
 * Requires authenticated session; returns strict JSON from Edge.
 */
export async function invokeRozyVision(payload: RozyVisionInvokePayload): Promise<RozyVisionResult> {
  const { data: { session } } = await supabase.auth.getSession()
  let token = session?.access_token?.trim() ?? ''
  const now = Math.floor(Date.now() / 1000)
  const exp = session?.expires_at
  const needsRefresh = !token || (typeof exp === 'number' && exp <= now + 30)
  if (needsRefresh) {
    const { data: ref } = await supabase.auth.refreshSession()
    token = ref.session?.access_token?.trim() ?? ''
  }
  console.log('[invokeRozyVision] access_token present', Boolean(token))
  if (!token) {
    throw new Error('يجب تسجيل الدخول لتحليل الصورة. سجّلي دخولكِ ثم أعيدي المحاولة.')
  }

  if (payload.imageBase64.length > MAX_ROZY_VISION_BASE64_CHARS) {
    throw new Error('الصورة كبيرة جداً بعد التحويل — اختاري ملفاً أصغر')
  }

  const { data, error, response } = await supabase.functions.invoke('rozi-vision', {
    body: {
      mode: payload.mode,
      imageBase64: payload.imageBase64,
      imageMimeType: payload.imageMimeType ?? 'image/jpeg',
      ...(payload.personalizationHint?.trim()
        ? { personalizationHint: payload.personalizationHint.trim().slice(0, 900) }
        : {}),
    },
    headers: { Authorization: `Bearer ${token}` },
    timeout: ROZY_VISION_INVOKE_TIMEOUT_MS,
    ...(payload.signal ? { signal: payload.signal } : {}),
  })

  if (error) {
    if (isAbortLikeInvokeError(error)) {
      throw new RozyVisionInvokeAbortedError()
    }
    const hint = await getEdgeFunctionHttpErrorDetail(error, response ?? null)
    const base = hint || getEdgeFunctionErrorMessage(error as Error, data)
    if (/timed out|timeout|abort/i.test(base)) {
      throw new Error('انتهت مهلة التحليل — تحققي من الشبكة ثم أعيدي المحاولة')
    }
    throw new Error(base)
  }

  const pack = data as { result?: unknown; error?: string } | null
  if (pack?.error) throw new Error(pack.error)
  if (!pack?.result || typeof pack.result !== 'object') {
    throw new Error('استجابة غير صالحة من روزي فيجن')
  }
  return normalizeRozyVisionResult(pack.result, payload.mode)
}
