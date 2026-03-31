/**
 * Rosy Vision — advisor-only modes (structured JSON).
 * Does not modify roziVisionCore.ts. Used by `rozi-vision` Edge Function for hair_color / haircut (+ hand_nail when routed).
 */
import { openAiAssistantContentToString } from './openAiAssistantContent.ts'
import { OPENAI_VISION_SYSTEM_PROMPT, OPENAI_VISION_USER_PROMPT } from './openAiVisionPrompts.ts'
import { logOpenAiContentBeforeParse, readOpenAiChatCompletionJson } from './roziVisionCore.ts'

const OPENAI_MODEL = 'gpt-4o'
const MAX_TOKENS = 1000

async function openAiVisionJson(dataUrl: string, apiKey: string): Promise<string> {
  console.log('[openAiVisionJson] final prompts sent to OpenAI', {
    system: OPENAI_VISION_SYSTEM_PROMPT,
    user: OPENAI_VISION_USER_PROMPT,
    model: OPENAI_MODEL,
    max_tokens: MAX_TOKENS,
    dataUrlLengthChars: dataUrl.length,
  })

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      max_tokens: MAX_TOKENS,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: OPENAI_VISION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: OPENAI_VISION_USER_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl, detail: 'low' } },
          ],
        },
      ],
    }),
  })
  const { status, data, rawText } = await readOpenAiChatCompletionJson(res, 'openAiVisionJson')
  if (!res.ok) {
    const errObj = data.error as { message?: string } | undefined
    console.log('[openAiVisionJson] outcome: HTTP error', { status, bodyPreview: rawText.slice(0, 300) })
    throw new Error(errObj?.message || `OpenAI ${status}: ${rawText.slice(0, 200)}`)
  }
  const choices = data.choices as Array<{ message?: { content?: unknown } }> | undefined
  const choice0 = choices?.[0]
  const msg = choice0?.message
  const contentRaw = msg?.content
  logOpenAiContentBeforeParse('[openAiVisionJson]', contentRaw)

  const text = openAiAssistantContentToString(contentRaw).trim()
  console.log('[openAiVisionJson] shape check', {
    hasChoices: Array.isArray(choices) && choices.length > 0,
    hasMessage: Boolean(msg),
    contentType:
      Array.isArray(contentRaw) ? 'array' : contentRaw === null || contentRaw === undefined ? 'nullish' : typeof contentRaw,
    normalizedTextLength: text.length,
  })
  if (!text) {
    console.log('[openAiVisionJson] outcome: EMPTY after normalize (will throw رد فارغ من النموذج)')
    throw new Error('رد فارغ من النموذج')
  }
  console.log('[openAiVisionJson] outcome: text OK for JSON parse', { textPreview: text.slice(0, 200) })
  return text
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const o = JSON.parse(raw) as unknown
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('JSON غير كائن')
  return o as Record<string, unknown>
}

const HEX_RE = /^#[0-9A-Fa-f]{6}$/
function normHex(h: unknown): string {
  const s = typeof h === 'string' ? h.trim() : ''
  if (HEX_RE.test(s)) return s.toUpperCase()
  return '#CCCCCC'
}

const ALLOWED_BRANDS = new Set(['OPI', 'Essie', 'Inglot', 'MAC', 'NARS'])

const ALLOWED_SKIN_BRANDS = new Set([
  'La Roche-Posay',
  'CeraVe',
  'Neutrogena',
  'The Ordinary',
  'Vichy',
  'Bioderma',
  "Paula's Choice",
])

export type HandNailAdvisorResult = {
  advisor_mode: 'hand_nail'
  undertone: 'warm' | 'cool' | 'neutral' | 'unclear'
  undertone_ar: string
  explanation_ar: string
  nail_colors: Array<{
    name_ar: string
    name_en: string
    hex: string
    reason_ar: string
    brand: string
  }>
  avoid_colors: string[]
}

export type HairColorAdvisorResult = {
  advisor_mode: 'hair_color'
  skin_tone: string
  eye_color: string
  recommended_colors: Array<{
    name_ar: string
    name_en: string
    hex: string
    technique_ar: string
    maintenance_ar: string
    why_ar: string
  }>
  avoid_colors: string[]
  disclaimer_ar: string
}

export type HaircutAdvisorResult = {
  advisor_mode: 'haircut'
  face_shape: string
  face_shape_ar: string
  recommended_cuts: Array<{
    name_ar: string
    name_en: string
    description_ar: string
    length_ar: string
  }>
  avoid_cuts: Array<{ name_ar: string; reason_ar: string }>
  styling_tip_ar: string
}

export type SkinAnalysisAdvisorResult = {
  advisor_mode: 'skin_analysis'
  skin_type: string
  concerns: string[]
  condition: 'normal' | 'needs_care' | 'needs_specialist'
  skincare_routine: { morning: string[]; evening: string[] }
  treatments: Array<{
    name_ar: string
    name_en: string
    brand: string
    reason_ar: string
  }>
  clinic_services: Array<{
    name_ar: string
    service_type: 'salon' | 'clinic'
    note_ar: string
  }>
  clinic_needed: boolean
  disclaimer_ar: string
}

function str(x: unknown, max = 400): string {
  return typeof x === 'string' ? x.trim().slice(0, max) : ''
}

/** HAND — wrist veins, nail_colors[6], avoid_colors[3]; brands OPI/Essie/Inglot/MAC/NARS */
export async function runHandNailAdvisor(dataUrl: string, apiKey: string): Promise<HandNailAdvisorResult> {
  const raw = await openAiVisionJson(dataUrl, apiKey)
  const j = parseJsonObject(raw)
  const ut = str(j.undertone, 20).toLowerCase()
  const undertone: HandNailAdvisorResult['undertone'] =
    ut === 'warm' || ut === 'cool' || ut === 'neutral' || ut === 'unclear' ? ut : 'unclear'

  const nailRaw = Array.isArray(j.nail_colors) ? j.nail_colors : []
  const nail_colors = nailRaw.slice(0, 6).map((item) => {
    const o = item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : {}
    let brand = str(o.brand, 40)
    if (!ALLOWED_BRANDS.has(brand)) brand = 'OPI'
    return {
      name_ar: str(o.name_ar, 120),
      name_en: str(o.name_en, 120),
      hex: normHex(o.hex),
      reason_ar: str(o.reason_ar, 220),
      brand,
    }
  })
  while (nail_colors.length < 6) {
    nail_colors.push({
      name_ar: 'لون مقترح',
      name_en: 'Suggested',
      hex: '#D8A5A5',
      reason_ar: 'يتناغم مع إطلالتكِ.',
      brand: 'Essie',
    })
  }

  const avoidRaw = Array.isArray(j.avoid_colors) ? j.avoid_colors : []
  const avoid_colors = avoidRaw.map((x) => str(x, 200)).filter(Boolean).slice(0, 3)
  while (avoid_colors.length < 3) avoid_colors.push('درجات نيون فاقعة قد لا تناسب الإطلالة اليومية')

  return {
    advisor_mode: 'hand_nail',
    undertone,
    undertone_ar: str(j.undertone_ar, 300),
    explanation_ar: str(j.explanation_ar, 900),
    nail_colors,
    avoid_colors,
  }
}

/** HAIR COLOR — selfie: skin + eyes, recommended_colors[5], avoid_colors[2] */
export async function runHairColorAdvisor(dataUrl: string, apiKey: string): Promise<HairColorAdvisorResult> {
  const raw = await openAiVisionJson(dataUrl, apiKey)
  const j = parseJsonObject(raw)
  const recRaw = Array.isArray(j.recommended_colors) ? j.recommended_colors : []
  const recommended_colors = recRaw.slice(0, 5).map((item) => {
    const o = item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : {}
    return {
      name_ar: str(o.name_ar, 120),
      name_en: str(o.name_en, 120),
      hex: normHex(o.hex),
      technique_ar: str(o.technique_ar, 120),
      maintenance_ar: str(o.maintenance_ar, 80),
      why_ar: str(o.why_ar, 280),
    }
  })
  while (recommended_colors.length < 5) {
    recommended_colors.push({
      name_ar: 'صبغة مقترحة',
      name_en: 'Suggested tone',
      hex: '#6B4423',
      technique_ar: 'صبغة متوازنة',
      maintenance_ar: 'متوسط',
      why_ar: 'ينسجم مع درجة بشرتكِ الظاهرة.',
    })
  }

  const avoidRaw = Array.isArray(j.avoid_colors) ? j.avoid_colors : []
  const avoid_colors = avoidRaw.map((x) => str(x, 220)).filter(Boolean).slice(0, 2)
  while (avoid_colors.length < 2) avoid_colors.push('درجات قد تزيد الجفاف الظاهر للون')

  return {
    advisor_mode: 'hair_color',
    skin_tone: str(j.skin_tone, 80),
    eye_color: str(j.eye_color, 80),
    recommended_colors,
    avoid_colors,
    disclaimer_ar: str(
      j.disclaimer_ar,
      500,
    ) || 'هذه توصيات فقط، استشيري متخصصة قبل الصبغ.',
  }
}

/** HAIRCUT — face shape, recommended_cuts[4], avoid_cuts[2] */
export async function runHaircutAdvisor(dataUrl: string, apiKey: string): Promise<HaircutAdvisorResult> {
  const raw = await openAiVisionJson(dataUrl, apiKey)
  const j = parseJsonObject(raw)
  const cutsRaw = Array.isArray(j.recommended_cuts) ? j.recommended_cuts : []
  const recommended_cuts = cutsRaw.slice(0, 4).map((item) => {
    const o = item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : {}
    return {
      name_ar: str(o.name_ar, 120),
      name_en: str(o.name_en, 120),
      description_ar: str(o.description_ar, 320),
      length_ar: str(o.length_ar, 80),
    }
  })
  while (recommended_cuts.length < 4) {
    recommended_cuts.push({
      name_ar: 'قصة مقترحة',
      name_en: 'Suggested cut',
      description_ar: 'يُوازن خط الوجه الظاهر في الصورة.',
      length_ar: 'متوسط',
    })
  }

  const avoidRaw = Array.isArray(j.avoid_cuts) ? j.avoid_cuts : []
  const avoid_cuts = avoidRaw
    .slice(0, 2)
    .map((item) => {
      const o = item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : {}
      return { name_ar: str(o.name_ar, 120), reason_ar: str(o.reason_ar, 280) }
    })
    .filter((x) => x.name_ar)
  while (avoid_cuts.length < 2) {
    avoid_cuts.push({ name_ar: 'قصة غير مناسبة', reason_ar: 'قد توسّع أو تضيق إطلالة الوجه بشكل غير متوازن.' })
  }

  return {
    advisor_mode: 'haircut',
    face_shape: str(j.face_shape, 40),
    face_shape_ar: str(j.face_shape_ar, 120),
    recommended_cuts,
    avoid_cuts,
    styling_tip_ar: str(j.styling_tip_ar, 400),
  }
}

function clampSkinCondition(x: unknown): SkinAnalysisAdvisorResult['condition'] {
  const s = str(x, 24).toLowerCase()
  if (s === 'normal' || s === 'needs_care' || s === 'needs_specialist') return s
  return 'normal'
}

/** بشرة تجميلية فقط — بدون تشخيص طبي. */
export async function runSkinAnalysisAdvisor(dataUrl: string, apiKey: string): Promise<SkinAnalysisAdvisorResult> {
  const raw = await openAiVisionJson(dataUrl, apiKey)
  const j = parseJsonObject(raw)
  const condition = clampSkinCondition(j.condition)
  const clinic_needed = condition === 'needs_care' || condition === 'needs_specialist'

  const concernsRaw = Array.isArray(j.concerns) ? j.concerns : []
  const concerns = concernsRaw.map((x) => str(x, 160)).filter(Boolean).slice(0, 5)
  while (concerns.length < 2) concerns.push('عناية يومية ومتابعة')

  const routineRaw = j.skincare_routine && typeof j.skincare_routine === 'object' && !Array.isArray(j.skincare_routine)
    ? (j.skincare_routine as Record<string, unknown>)
    : {}
  const mRaw = Array.isArray(routineRaw.morning) ? routineRaw.morning : []
  const eRaw = Array.isArray(routineRaw.evening) ? routineRaw.evening : []
  const morning = mRaw.map((x) => str(x, 240)).filter(Boolean).slice(0, 6)
  const evening = eRaw.map((x) => str(x, 240)).filter(Boolean).slice(0, 6)
  while (morning.length < 3) morning.push('غسلي بشرتك بلطف بماء فاتر.')
  while (evening.length < 3) evening.push('أزيلي المكياج بلطف ثم رطبّي.')

  const treatRaw = Array.isArray(j.treatments) ? j.treatments : []
  const treatments = treatRaw.slice(0, 5).map((item) => {
    const o = item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : {}
    let brand = str(o.brand, 48)
    if (!ALLOWED_SKIN_BRANDS.has(brand)) brand = 'La Roche-Posay'
    return {
      name_ar: str(o.name_ar, 140),
      name_en: str(o.name_en, 120),
      brand,
      reason_ar: str(o.reason_ar, 280),
    }
  })
  while (treatments.length < 3) {
    treatments.push({
      name_ar: 'مرطب لطيف',
      name_en: 'Gentle moisturizer',
      brand: 'CeraVe',
      reason_ar: 'دعم حاجز البشرة التجميلي بلطف.',
    })
  }

  let clinic_services: SkinAnalysisAdvisorResult['clinic_services'] = []
  if (clinic_needed) {
    const csRaw = Array.isArray(j.clinic_services) ? j.clinic_services : []
    clinic_services = csRaw.slice(0, 5).map((item) => {
      const o = item && typeof item === 'object' && !Array.isArray(item) ? (item as Record<string, unknown>) : {}
      const st = str(o.service_type, 12).toLowerCase()
      const service_type: 'salon' | 'clinic' = st === 'clinic' ? 'clinic' : 'salon'
      return {
        name_ar: str(o.name_ar, 140),
        service_type,
        note_ar: str(o.note_ar, 320),
      }
    })
  }

  return {
    advisor_mode: 'skin_analysis',
    skin_type: str(j.skin_type, 120),
    concerns,
    condition,
    skincare_routine: { morning, evening },
    treatments,
    clinic_services,
    clinic_needed,
    disclaimer_ar:
      str(j.disclaimer_ar, 600) ||
      'هذه معلومات تجميلية تعليمية فقط وليست تشخيصاً طبياً. استشيري طبيبة جلدية عند الحاجة.',
  }
}
