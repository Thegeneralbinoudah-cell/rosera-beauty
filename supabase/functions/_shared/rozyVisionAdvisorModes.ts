/**
 * Rosy Vision — advisor-only modes (structured JSON).
 * Used by `rozi-vision` Edge Function for hair_color / haircut / hand_nail / skin_analysis.
 */
import { openAiAssistantContentToString } from './openAiAssistantContent.ts'
import {
  OPENAI_VISION_SYSTEM_PROMPT,
  OPENAI_VISION_USER_PROMPT,
  parseVisionEnvelope,
  type VisionEnvelopeJson,
} from './openAiVisionPrompts.ts'
import { logOpenAiContentBeforeParse, readOpenAiChatCompletionJson } from './roziVisionCore.ts'

const OPENAI_MODEL = 'gpt-4o'
const MAX_TOKENS = 1000

/** Always attached to advisor_result for UI / debugging; never omit. */
function advisorFieldsFromEnvelope(parsed: VisionEnvelopeJson): {
  summary: string
  details: string
  recommendations: string[]
} {
  return {
    summary: (typeof parsed.summary === 'string' && parsed.summary.trim()) ? parsed.summary.trim() : 'analysis unavailable',
    details: typeof parsed.details === 'string' ? parsed.details : '',
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
  }
}

/** Never throws — empty / HTTP / network → fallback envelope so advisor_result always ships. */
async function openAiVisionJson(dataUrl: string, apiKey: string): Promise<VisionEnvelopeJson> {
  console.log('[openAiVisionJson] final prompts sent to OpenAI', {
    system: OPENAI_VISION_SYSTEM_PROMPT,
    user: OPENAI_VISION_USER_PROMPT,
    model: OPENAI_MODEL,
    max_tokens: MAX_TOKENS,
    dataUrlLengthChars: dataUrl.length,
  })

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        max_tokens: MAX_TOKENS,
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
      const hint = errObj?.message || `HTTP ${status}`
      console.warn('[openAiVisionJson] OpenAI HTTP error — using fallback envelope', {
        status,
        hint,
        bodyPreview: rawText.slice(0, 300),
      })
      return {
        summary: 'analysis unavailable',
        details: rawText.slice(0, 2000),
        recommendations: [],
      }
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
    const env = parseVisionEnvelope(text, 'openAiVisionJson')
    console.log('[openAiVisionJson] parsed envelope object', env)
    return env
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[openAiVisionJson] failed — using fallback envelope', msg)
    return { summary: 'analysis unavailable', details: '', recommendations: [] }
  }
}

function undertoneFromEnvelopeText(s: string): HandNailAdvisorResult['undertone'] {
  const t = s.toLowerCase()
  if (/warm|داف|حار|ذهبي/.test(t)) return 'warm'
  if (/cool|بارد|وردي|فضي/.test(t)) return 'cool'
  if (/neutral|محايد|متوسط/.test(t)) return 'neutral'
  return 'unclear'
}

function handNailFromEnvelope(env: VisionEnvelopeJson): HandNailAdvisorResult {
  const blob = `${env.summary}\n${env.details}`
  const undertone = undertoneFromEnvelopeText(blob)
  const undertone_ar = env.summary.trim() || 'لم يُحدد بوضوح من الصورة.'
  const explanation_ar = env.details.trim() || env.summary.trim() || '—'

  const lines = env.recommendations.filter(Boolean)
  const nail_colors = lines.slice(0, 6).map((name_ar, i) => {
    const brands = ['OPI', 'Essie', 'Inglot', 'MAC', 'NARS'] as const
    return {
      name_ar: name_ar.slice(0, 120),
      name_en: 'Suggested',
      hex: ['#D8A5A5', '#E8D4C4', '#9B8B9E', '#A89080', '#C4A77D', '#B8A99A'][i % 6],
      reason_ar: (env.details.trim() || 'يتناغم مع إطلالتكِ.').slice(0, 220),
      brand: brands[i % brands.length],
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

  const avoid_colors: string[] = []
  while (avoid_colors.length < 3) {
    avoid_colors.push('درجات نيون فاقعة قد لا تناسب الإطلالة اليومية')
  }

  return {
    advisor_mode: 'hand_nail',
    undertone,
    undertone_ar,
    explanation_ar: explanation_ar.slice(0, 900),
    nail_colors,
    avoid_colors,
    ...advisorFieldsFromEnvelope(env),
  }
}

function hairColorFromEnvelope(env: VisionEnvelopeJson): HairColorAdvisorResult {
  const lines = env.recommendations.filter(Boolean)
  const recommended_colors = lines.slice(0, 5).map((name_ar) => ({
    name_ar: name_ar.slice(0, 120),
    name_en: 'Suggested tone',
    hex: '#6B4423',
    technique_ar: 'صبغة متوازنة',
    maintenance_ar: 'متوسط',
    why_ar: (env.details.trim() || 'ينسجم مع الصورة.').slice(0, 280),
  }))
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

  const avoid_colors: string[] = []
  while (avoid_colors.length < 2) avoid_colors.push('درجات قد تزيد الجفاف الظاهر للون')

  return {
    advisor_mode: 'hair_color',
    skin_tone: env.summary.slice(0, 80) || '—',
    eye_color: '—',
    recommended_colors,
    avoid_colors,
    disclaimer_ar: 'هذه توصيات فقط، استشيري متخصصة قبل الصبغ.',
    ...advisorFieldsFromEnvelope(env),
  }
}

function haircutFromEnvelope(env: VisionEnvelopeJson): HaircutAdvisorResult {
  const faceGuess = env.summary.trim().split(/\s+/)[0] || 'oval'
  const lines = env.recommendations.filter(Boolean)
  const recommended_cuts = lines.slice(0, 4).map((name_ar) => ({
    name_ar: name_ar.slice(0, 120),
    name_en: 'Suggested cut',
    description_ar: (env.details.trim() || 'يُوازن خط الوجه الظاهر في الصورة.').slice(0, 320),
    length_ar: 'متوسط',
  }))
  while (recommended_cuts.length < 4) {
    recommended_cuts.push({
      name_ar: 'قصة مقترحة',
      name_en: 'Suggested cut',
      description_ar: 'يُوازن خط الوجه الظاهر في الصورة.',
      length_ar: 'متوسط',
    })
  }

  const avoid_cuts: Array<{ name_ar: string; reason_ar: string }> = []
  while (avoid_cuts.length < 2) {
    avoid_cuts.push({
      name_ar: 'قصة غير مناسبة',
      reason_ar: 'قد توسّع أو تضيق إطلالة الوجه بشكل غير متوازن.',
    })
  }

  return {
    advisor_mode: 'haircut',
    face_shape: faceGuess.slice(0, 40),
    face_shape_ar: env.summary.slice(0, 120) || '—',
    recommended_cuts,
    avoid_cuts,
    styling_tip_ar: env.details.slice(0, 400) || '—',
    ...advisorFieldsFromEnvelope(env),
  }
}

function skinFromEnvelope(env: VisionEnvelopeJson): SkinAnalysisAdvisorResult {
  let concerns = env.recommendations.map((x) => x.slice(0, 160)).filter(Boolean).slice(0, 5)
  if (concerns.length === 0 && env.details.trim()) concerns = [env.details.trim().slice(0, 160)]
  while (concerns.length < 2) concerns.push('عناية يومية ومتابعة')

  const detailLines = env.details
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 6)
  const morning =
    detailLines.length >= 3 ? detailLines.slice(0, 3) : ['غسلي بشرتك بلطف بماء فاتر.', 'رطبّي.', 'واقي شمس.']
  const evening =
    detailLines.length > 3 ? detailLines.slice(3) : ['أزيلي المكياج بلطف ثم رطبّي.', 'نوم كافٍ.', 'ترطيب ليلي.']

  const treatments: SkinAnalysisAdvisorResult['treatments'] = [
    {
      name_ar: 'مرطب',
      name_en: 'Moisturizer',
      brand: 'CeraVe',
      reason_ar: (env.details.trim() || 'ترطيب لطيف.').slice(0, 280),
    },
  ]
  while (treatments.length < 3) {
    treatments.push({
      name_ar: 'مرطب لطيف',
      name_en: 'Gentle moisturizer',
      brand: 'La Roche-Posay',
      reason_ar: 'دعم حاجز البشرة التجميلي بلطف.',
    })
  }

  return {
    advisor_mode: 'skin_analysis',
    skin_type: env.summary.slice(0, 120) || 'غير محدد',
    concerns,
    condition: 'normal',
    skincare_routine: { morning, evening },
    treatments,
    clinic_services: [],
    clinic_needed: false,
    disclaimer_ar:
      'هذه معلومات تجميلية تعليمية فقط وليست تشخيصاً طبياً. استشيري طبيبة جلدية عند الحاجة.',
    ...advisorFieldsFromEnvelope(env),
  }
}

export type VisionAdvisorWireFields = {
  summary: string
  details: string
  recommendations: string[]
}

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
} & VisionAdvisorWireFields

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
} & VisionAdvisorWireFields

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
} & VisionAdvisorWireFields

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
} & VisionAdvisorWireFields

/** HAND — maps vision envelope → nail advisor shape; always returns `{ advisor_result }`. */
export async function runHandNailAdvisor(
  dataUrl: string,
  apiKey: string,
): Promise<{ advisor_result: HandNailAdvisorResult }> {
  const env = await openAiVisionJson(dataUrl, apiKey)
  console.log('[runHandNailAdvisor] parsed envelope for advisor_result', env)
  const advisor_result = handNailFromEnvelope(env)
  return { advisor_result }
}

/** HAIR COLOR — maps vision envelope */
export async function runHairColorAdvisor(
  dataUrl: string,
  apiKey: string,
): Promise<{ advisor_result: HairColorAdvisorResult }> {
  const env = await openAiVisionJson(dataUrl, apiKey)
  console.log('[runHairColorAdvisor] parsed envelope for advisor_result', env)
  const advisor_result = hairColorFromEnvelope(env)
  return { advisor_result }
}

/** HAIRCUT — maps vision envelope */
export async function runHaircutAdvisor(
  dataUrl: string,
  apiKey: string,
): Promise<{ advisor_result: HaircutAdvisorResult }> {
  const env = await openAiVisionJson(dataUrl, apiKey)
  console.log('[runHaircutAdvisor] parsed envelope for advisor_result', env)
  const advisor_result = haircutFromEnvelope(env)
  return { advisor_result }
}

/** بشرة تجميلية فقط — بدون تشخيص طبي. */
export async function runSkinAnalysisAdvisor(
  dataUrl: string,
  apiKey: string,
): Promise<{ advisor_result: SkinAnalysisAdvisorResult }> {
  const env = await openAiVisionJson(dataUrl, apiKey)
  console.log('[runSkinAnalysisAdvisor] parsed envelope for advisor_result', env)
  const advisor_result = skinFromEnvelope(env)
  return { advisor_result }
}
