import { supabase } from '@/lib/supabase'
import type {
  RozyVisionFaceShape,
  RozyVisionMode,
  RozyVisionResult,
  RozyVisionUndertone,
} from '@/lib/rozyVisionTypes'

const MAX_STYLES = 24
const MAX_HISTORY = 12

export type RozyVisionHistoryEntry = {
  at: string
  mode: RozyVisionMode
  confidence: string
  quality_ok: boolean
  undertone?: RozyVisionUndertone
  face_shape?: RozyVisionFaceShape
  /** Short labels from that session */
  styles: string[]
}

export type RozyVisionPersonalizationV1 = {
  v: 1
  undertone?: RozyVisionUndertone | null
  face_shape?: RozyVisionFaceShape | null
  preferred_styles: string[]
  history: RozyVisionHistoryEntry[]
  updated_at?: string
}

function emptyState(): RozyVisionPersonalizationV1 {
  return { v: 1, preferred_styles: [], history: [] }
}

function normalizeStored(raw: unknown): RozyVisionPersonalizationV1 {
  if (!raw || typeof raw !== 'object') return emptyState()
  const o = raw as Record<string, unknown>
  if (o.v !== 1) return emptyState()
  const styles = Array.isArray(o.preferred_styles)
    ? o.preferred_styles.map((s) => (typeof s === 'string' ? s.trim() : '')).filter(Boolean).slice(0, MAX_STYLES)
    : []
  const history = Array.isArray(o.history) ? (o.history as RozyVisionHistoryEntry[]).slice(-MAX_HISTORY) : []
  return {
    v: 1,
    undertone: typeof o.undertone === 'string' ? (o.undertone as RozyVisionUndertone) : null,
    face_shape: typeof o.face_shape === 'string' ? (o.face_shape as RozyVisionFaceShape) : null,
    preferred_styles: styles,
    history,
    updated_at: typeof o.updated_at === 'string' ? o.updated_at : undefined,
  }
}

export async function loadRozyVisionPersonalization(userId: string): Promise<RozyVisionPersonalizationV1> {
  const { data, error } = await supabase
    .from('profiles')
    .select('rozy_vision_personalization')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.warn('[rozyVisionPersonalization] load', error.message)
    return emptyState()
  }
  if (!data?.rozy_vision_personalization) return emptyState()
  return normalizeStored(data.rozy_vision_personalization)
}

/** Merge successful analysis into profile JSON (undertone, styles, rolling history). */
export async function persistRozyVisionPersonalization(
  userId: string,
  result: RozyVisionResult,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!result.qualityOk) return { ok: true }

  const prev = await loadRozyVisionPersonalization(userId)
  const stylesFromResult = collectStyleStrings(result)
  const mergedStyles = dedupeStrings([...prev.preferred_styles, ...stylesFromResult]).slice(0, MAX_STYLES)

  let undertone = prev.undertone ?? null
  let faceShape = prev.face_shape ?? null
  if (result.mode === 'hand' && result.undertone !== 'uncertain') {
    undertone = result.undertone
  }
  if (result.mode === 'face' && result.faceShape !== 'uncertain') {
    faceShape = result.faceShape
  }

  const entry: RozyVisionHistoryEntry = {
    at: new Date().toISOString(),
    mode: result.mode,
    confidence: result.confidence,
    quality_ok: result.qualityOk,
    undertone: result.mode === 'hand' ? result.undertone : undefined,
    face_shape: result.mode === 'face' ? result.faceShape : undefined,
    styles: stylesFromResult.slice(0, 8),
  }

  const history = [...prev.history, entry].slice(-MAX_HISTORY)

  const next: RozyVisionPersonalizationV1 = {
    v: 1,
    undertone,
    face_shape: faceShape,
    preferred_styles: mergedStyles,
    history,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('profiles')
    // Column added in migration 076 — Json-compatible object
    .update({ rozy_vision_personalization: next } as Record<string, unknown>)
    .eq('id', userId)

  if (error) {
    console.warn('[rozyVisionPersonalization] persist failed', error.message)
    return { ok: false as const, error: error.message }
  }
  return { ok: true as const }
}

function collectStyleStrings(r: RozyVisionResult): string[] {
  const out: string[] = []
  const take = (arr: string[], n: number) => {
    for (const x of arr.slice(0, n)) {
      const t = x.replace(/\s*\(#?[0-9A-Fa-f]+\)\s*$/i, '').trim()
      if (t.length > 2) out.push(t)
    }
  }
  if (r.mode === 'hand') {
    take(r.recommendedColors, 6)
  } else {
    take(r.recommendedHairColors, 5)
    take(r.recommendedHaircuts, 5)
  }
  return dedupeStrings(out)
}

function dedupeStrings(arr: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of arr) {
    const k = s.slice(0, 120).toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(s.slice(0, 120))
  }
  return out
}

/** Short Arabic hint for the vision model (no PII). Max ~700 chars. */
export function buildPersonalizationHintForVision(
  p: RozyVisionPersonalizationV1,
  currentMode: RozyVisionMode,
): string | undefined {
  const parts: string[] = []
  if (p.undertone && p.undertone !== 'uncertain') {
    parts.push(`إنديرتون مُخزَّن سابقاً: ${p.undertone}`)
  }
  if (p.face_shape && p.face_shape !== 'uncertain' && currentMode === 'face') {
    parts.push(`شكل وجه مُخزَّن سابقاً: ${p.face_shape}`)
  }
  if (p.preferred_styles.length > 0) {
    parts.push(`تفضيلات أسلوب/ألوان سابقة (مرجع فقط): ${p.preferred_styles.slice(0, 10).join(' — ')}`)
  }
  if (p.history.length > 0) {
    const last = p.history[p.history.length - 1]
    parts.push(
      `آخر جلسة: ${last.mode === 'hand' ? 'يد' : 'وجه'}، ثقة ${last.confidence}${last.styles.length ? `، أمثلة: ${last.styles.slice(0, 3).join('، ')}` : ''}`,
    )
  }
  if (parts.length === 0) return undefined
  const hint =
    'بيانات تذكير من حساب المستخدم (لا تُفترض صحة مطلقة مع الصورة الحالية؛ ادمجي بلطف إن توافقت):\n' +
    parts.join('\n')
  return hint.length > 700 ? `${hint.slice(0, 697)}…` : hint
}

/** Keywords for boosting salon search (Latin + Arabic tokens). */
export function styleKeywordsForRecommendations(p: RozyVisionPersonalizationV1): string[] {
  const out: string[] = []
  for (const s of p.preferred_styles) {
    for (const token of s.split(/[\s،,]+/)) {
      const t = token.trim()
      if (t.length >= 2) out.push(t)
    }
  }
  return dedupeStrings(out).slice(0, 16)
}
