/**
 * Shared Rosi/Rozy vision pipeline: validate → gate → AI JSON → normalize.
 * No HTTP, no storage. Callers must not log image payloads.
 */
import { openAiAssistantContentToString } from './openAiAssistantContent.ts'
import {
  OPENAI_VISION_SYSTEM_PROMPT,
  OPENAI_VISION_USER_PROMPT,
  parseVisionEnvelope,
  type VisionEnvelopeJson,
} from './openAiVisionPrompts.ts'

export function readOpenAiApiKey(): string {
  const raw = Deno.env.get('OPENAI_API_KEY')?.trim() || ''
  let k = raw
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim()
  }
  return k.replace(/\r?\n/g, '').replace(/\s+/g, '')
}

/** Logs response.status, full raw body, then JSON.parse. Throws if body is not JSON. */
export async function readOpenAiChatCompletionJson(
  res: Response,
  logLabel: string,
): Promise<{ status: number; data: Record<string, unknown>; rawText: string }> {
  const status = res.status
  console.log(`[${logLabel}] response.status`, status)
  const rawText = await res.text()
  console.log(`[${logLabel}] full OpenAI response body (raw):\n`, rawText)
  let data: Record<string, unknown>
  try {
    data = rawText.trim() ? (JSON.parse(rawText) as Record<string, unknown>) : {}
  } catch {
    throw new Error(`${logLabel}: OpenAI returned non-JSON body (HTTP ${status})`)
  }
  return { status, data, rawText }
}

export type VisionMode = 'hand' | 'face'

type RawVision = {
  mode?: string
  confidence?: string
  qualityOk?: boolean
  summaryAr?: string
  undertone?: string
  faceShape?: string
  recommendedColors?: unknown
  colorsToAvoid?: unknown
  recommendedHairColors?: unknown
  recommendedHaircuts?: unknown
  cautionNotes?: unknown
  retryTips?: unknown
  nextActions?: unknown
}

export type RozyVisionResult = {
  mode: VisionMode
  confidence: 'high' | 'medium' | 'low'
  qualityOk: boolean
  summaryAr: string
  undertone: 'warm' | 'cool' | 'neutral' | 'uncertain'
  faceShape: 'oval' | 'round' | 'square' | 'heart' | 'uncertain'
  recommendedColors: string[]
  colorsToAvoid: string[]
  recommendedHairColors: string[]
  recommendedHaircuts: string[]
  cautionNotes: string[]
  retryTips: string[]
  nextActions: string[]
}

const OPENAI_MODEL = 'gpt-4o'

/** Hard cap on list lengths — keeps UI stable and reduces prompt injection surface. */
const MAX_COLOR_ITEMS = 16
const MAX_AVOID_ITEMS = 10
const MAX_HAIR_COLOR_ITEMS = 12
const MAX_HAIRCUT_ITEMS = 12
const MAX_NOTE_ITEMS = 6
const MAX_RETRY_ITEMS = 8
const MAX_NEXT_ITEMS = 6
const MAX_SUMMARY_CHARS = 1400
/** يطابق maxLength لعناصر النسق في json_schema. */
const MAX_LIST_ITEM_CHARS = 200

function strArr(x: unknown, maxLen: number): string[] {
  const cap = (s: string) => s.trim().slice(0, MAX_LIST_ITEM_CHARS)
  if (typeof x === 'string') {
    const parts = x
      .split(/[\n,،؛|•]+/)
      .map((p) => cap(p))
      .filter(Boolean)
    return parts.slice(0, maxLen)
  }
  if (!Array.isArray(x)) return []
  return x
    .map((v) =>
      typeof v === 'string'
        ? cap(v)
        : typeof v === 'number' && Number.isFinite(v)
          ? cap(String(v))
          : '',
    )
    .filter(Boolean)
    .slice(0, maxLen)
}

const NEUTRAL_SAFE_NAIL_PALETTE = [
  'وردي ترابي (#D8A5A5)',
  'نود ناعم (#E8D4C4)',
  'موف رمادي (#9B8B9E)',
  'توبي ناعم (#A89080)',
]

export const QUALITY_REJECT_SUMMARY_AR = 'الصورة غير واضحة للتحليل'
const QUALITY_RETRY_TIPS_FIXED = ['إضاءة طبيعية', 'بدون فلتر', 'قريبة وواضحة'] as const

const DEFAULT_AVOID_WHEN_UNCERTAIN = [
  'برتقالي نيون صارخ (#FF6B35) — قد يزيد التباين غير المرغوب',
  'أزرق سماوي بارد (#87CEEB) — قد يبرز بشكل غير متوازن تحت إضاءة غير محايدة',
]

function defaultAvoidForHandUndertone(u: RozyVisionResult['undertone']): string[] {
  switch (u) {
    case 'warm':
      return [
        'موف بارد (#8B7B9E) — قد يبرز برداً على إنديرتون دافئ',
        'أزرق ثلجي (#B0E0E6) — قد يتعارض مع دفء الجلد الظاهر',
      ]
    case 'cool':
      return [
        'كراميل برتقالي (#D2691E) — قد يصطدم مع برودة الإنديرتون',
        'ذهبي برتقالي قوي (#DAA520) — قد يزيد الدفء بشكل غير متوازن',
      ]
    case 'neutral':
      return [
        'نيون فاقع — قد يكسر التوازن مع الإنديرتون المتوازن',
        'أسود مطفي كامل (#1A1A1A) — قد يحجب نعومة الإطلالة اليومية',
      ]
    default:
      return []
  }
}

function clampConfidence(x: unknown): 'high' | 'medium' | 'low' {
  const s = typeof x === 'string' ? x.toLowerCase().trim() : ''
  if (s === 'high' || s === 'medium' || s === 'low') return s
  return 'low'
}

/** خفض درجة واحدة دون تجاوز «low» — يُستخدم عند ضعف اكتمال المخرجات. */
function downConfidenceOneStep(c: RozyVisionResult['confidence']): RozyVisionResult['confidence'] {
  if (c === 'high') return 'medium'
  if (c === 'medium') return 'low'
  return 'low'
}

/**
 * مخرجات مفيدة + بنية متسقة: لا يرفع «high»، ولا يتجاوز حالة رفض الجودة.
 * يُستدعى بعد تعبئة المصفوفات الافتراضية ليعكس المحتوى الفعلي.
 */
function structureSupportsMediumConfidence(
  mode: VisionMode,
  q: {
    recommendedColors: string[]
    colorsToAvoid: string[]
    recommendedHairColors: string[]
    recommendedHaircuts: string[]
    summaryAr: string
  },
): boolean {
  const sum = q.summaryAr.replace(/[\s\u200c\u200f]/g, '').length
  if (sum < 40) return false
  if (mode === 'hand') {
    return q.recommendedColors.length >= 2 && q.colorsToAvoid.length >= 1
  }
  return q.recommendedHairColors.length >= 1 && q.recommendedHaircuts.length >= 1
}

function clampUndertone(x: unknown): RozyVisionResult['undertone'] {
  const s = typeof x === 'string' ? x.toLowerCase().trim() : ''
  if (s === 'warm' || s === 'cool' || s === 'neutral' || s === 'uncertain') return s
  return 'uncertain'
}

function clampFaceShape(x: unknown): RozyVisionResult['faceShape'] {
  const s = typeof x === 'string' ? x.toLowerCase().trim() : ''
  if (s === 'oval' || s === 'round' || s === 'square' || s === 'heart' || s === 'uncertain') return s
  return 'uncertain'
}

export function buildQualityRejectedResult(mode: VisionMode): RozyVisionResult {
  return {
    mode,
    confidence: 'low',
    qualityOk: false,
    summaryAr: QUALITY_REJECT_SUMMARY_AR,
    undertone: 'uncertain',
    faceShape: 'uncertain',
    recommendedColors: [],
    colorsToAvoid: [],
    recommendedHairColors: [],
    recommendedHaircuts: [],
    cautionNotes: [],
    retryTips: [...QUALITY_RETRY_TIPS_FIXED],
    nextActions: [],
  }
}

/** Safe JSON when OpenAI/network/parse fails — no sensitive data. */
export function safeFallbackResult(mode: VisionMode): RozyVisionResult {
  return {
    mode,
    confidence: 'low',
    qualityOk: false,
    summaryAr:
      mode === 'hand'
        ? 'لم أتلقَّ صورة كافية للمقاربة بأمان — أعيدي المحاولة بيدك قرب نافذة نهارية، بدون فلتر قوي.'
        : 'لم أتلقَّ صورة كافية للمقاربة بأمان — أعيدي المحاولة بوجهك أمام الكاميرا وإضاءة نهارية ناعمة.',
    undertone: 'uncertain',
    faceShape: 'uncertain',
    recommendedColors: [],
    colorsToAvoid: [],
    recommendedHairColors: [],
    recommendedHaircuts: [],
    cautionNotes: [],
    retryTips: [...QUALITY_RETRY_TIPS_FIXED],
    nextActions: [
      mode === 'hand'
        ? 'التقطي صورة جديدة ثم اضغطي «تحليل مع روزي».'
        : 'أعيدي التقاط الوجه من الأمام، ثم شغّلي التحليل مرة ثانية.',
    ],
  }
}

function stripOverApologyArabic(s: string): string {
  return s
    .replace(
      /عذراً|آسفة|آسف|معذرة|اسف|اعتذر|أعتذر|لسوء الحظ|للأسف|آسفين|نأسف|نأسف لك|يؤسفني/gi,
      '',
    )
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** رفض واضح للجودة فقط — لا يعامل undefined/null كرفض (سلوك مستقر). */
function isExplicitQualityReject(v: unknown): boolean {
  if (v === false) return true
  if (v === 0) return true
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    return s === 'false' || s === 'no' || s === '0'
  }
  return false
}

/**
 * بعد كل JSON.parse: استخراج آمن للحقول المعروفة فقط حتى لا تمر قيم غريبة النوع إلى التطبيع.
 * strict:false يسمح أحياناً بانحراف بسيط — هذا يثبت الشكل قبل normalizeResult.
 */
function coerceParsedVision(parsed: unknown): RawVision {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {}
  }
  const o = parsed as Record<string, unknown>
  const strOpt = (v: unknown): string | undefined => {
    if (typeof v === 'string') return v
    if (typeof v === 'number' && Number.isFinite(v)) return String(v)
    return undefined
  }
  const boolOpt = (v: unknown): boolean | undefined => {
    if (typeof v === 'boolean') return v
    if (v === 1 || v === 0) return v === 1
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase()
      if (s === 'true' || s === 'yes' || s === '1') return true
      if (s === 'false' || s === 'no' || s === '0') return false
    }
    return undefined
  }

  return {
    mode: strOpt(o.mode),
    confidence: strOpt(o.confidence),
    qualityOk: boolOpt(o.qualityOk),
    summaryAr: strOpt(o.summaryAr),
    undertone: strOpt(o.undertone),
    faceShape: strOpt(o.faceShape),
    recommendedColors: o.recommendedColors,
    colorsToAvoid: o.colorsToAvoid,
    recommendedHairColors: o.recommendedHairColors,
    recommendedHaircuts: o.recommendedHaircuts,
    cautionNotes: o.cautionNotes,
    retryTips: o.retryTips,
    nextActions: o.nextActions,
  }
}

function normalizeResult(raw: RawVision, mode: VisionMode): RozyVisionResult {
  /** رفض صريح فقط؛ غياب الحقل أو قيمة غير قابلة للتحليل تُعامل كمقبول بعد نجاح البوابة. */
  const qualityOk = !isExplicitQualityReject(raw.qualityOk)
  let summaryAr =
    typeof raw.summaryAr === 'string' && raw.summaryAr.trim()
      ? stripOverApologyArabic(raw.summaryAr.trim())
      : mode === 'hand'
        ? 'يبدو أن الصورة تحتاج إضاءة أوضح لأقرأ الإنديرتون بدقة — أعيدي التقاط يدك قرب النافذة بنهار هادئ.'
        : 'يبدو أن الصورة تحتاج زاوية أوضح لوجهكِ — أعيدي التقاط أمام الكاميرا بإضاءة نهارية ناعمة.'

  let confidence = clampConfidence(raw.confidence)
  let undertone = clampUndertone(raw.undertone)
  let faceShape = clampFaceShape(raw.faceShape)
  let recommendedColors = strArr(raw.recommendedColors, MAX_COLOR_ITEMS)
  let colorsToAvoid = strArr(raw.colorsToAvoid, MAX_AVOID_ITEMS)
  let recommendedHairColors = strArr(raw.recommendedHairColors, MAX_HAIR_COLOR_ITEMS)
  let recommendedHaircuts = strArr(raw.recommendedHaircuts, MAX_HAIRCUT_ITEMS)
  let cautionNotes = strArr(raw.cautionNotes, MAX_NOTE_ITEMS)
  let retryTips = strArr(raw.retryTips, MAX_RETRY_ITEMS)
  let nextActions = strArr(raw.nextActions, MAX_NEXT_ITEMS)

  if (!qualityOk) {
    confidence = confidence === 'high' ? 'low' : confidence
    undertone = 'uncertain'
    faceShape = 'uncertain'
    recommendedColors = []
    colorsToAvoid = []
    recommendedHairColors = []
    recommendedHaircuts = []
    cautionNotes = []
    summaryAr = QUALITY_REJECT_SUMMARY_AR
    retryTips = [...QUALITY_RETRY_TIPS_FIXED]
    nextActions = []
  }

  if (mode === 'hand') {
    faceShape = 'uncertain'
    recommendedHairColors = []
    recommendedHaircuts = []
    cautionNotes = []
    if (undertone === 'uncertain' && qualityOk) {
      if (recommendedColors.length === 0) {
        recommendedColors = [...NEUTRAL_SAFE_NAIL_PALETTE]
      }
      if (colorsToAvoid.length === 0) {
        colorsToAvoid = [...DEFAULT_AVOID_WHEN_UNCERTAIN]
      }
    } else if (qualityOk && undertone !== 'uncertain' && colorsToAvoid.length === 0) {
      colorsToAvoid = defaultAvoidForHandUndertone(undertone)
    }
  } else {
    recommendedColors = []
    colorsToAvoid = []
    if (qualityOk && cautionNotes.length === 0) {
      cautionNotes = [
        'الاقتراحات تقريبية وتعتمد على الزاوية والإضاءة — استشيري كوافيرتكِ للقرار النهائي.',
        'لا توجد قراءة مثالية من صورة واحدة؛ جرّبي الاستشارة عند الصالون لأدق قرار.',
        'في الخليج والسعودية غالباً ما تهمّ الرطوبة ومظهر اللون تحت الإضاءات المحلية — جرّبي المعاينة الطبيعية قبل الصبغة.',
      ]
    }
  }

  if (qualityOk) {
    retryTips = []
  }

  /** لا نمنح «ثقة عالية» مع أدلة ضعيفة — يقلل الهلوسة الظاهرة. */
  if (qualityOk) {
    if (mode === 'hand' && undertone === 'uncertain' && confidence === 'high') {
      confidence = 'medium'
    }
    if (mode === 'face' && faceShape === 'uncertain' && confidence === 'high') {
      confidence = 'medium'
    }
    if (mode === 'face' && undertone === 'uncertain' && confidence === 'high') {
      confidence = 'medium'
    }
  }

  if (summaryAr.length > MAX_SUMMARY_CHARS) {
    summaryAr = `${summaryAr.slice(0, MAX_SUMMARY_CHARS - 1)}…`
  }

  if (!summaryAr || summaryAr.length < 8) {
    summaryAr =
      qualityOk && mode === 'hand'
        ? 'الأقرب لإطلالة يدكِ: ألوان طلاء تتماشى مع إنديرتونكِ — راجعي القائمة أدناه.'
        : qualityOk && mode === 'face'
          ? 'أنصحكِ بدرجات لون الشعر والقصات التالية لتناسب ملامحكِ — التفاصيل بالأسفل.'
          : QUALITY_REJECT_SUMMARY_AR
  }

  if (qualityOk && nextActions.length === 0) {
    nextActions =
      mode === 'hand'
        ? ['جرّبي درجتين من طلاء الأظافر من القائمة.', 'أرسلي صورة بإضاءة نهارية لدقة أعلى.']
        : [
            'احفظي لقطة شعركِ من الأمام والجانب لاقتراح أدق.',
            'جرّبي البحث عن صالون قريب لحجز استشارة صبغ أو قصّ.',
          ]
  }

  if (qualityOk && /حتماً|أكيدًا|أكيدة|بكل تأكيد|قطعاً|لا\s*شك|مضمون|مؤكد/i.test(summaryAr)) {
    if (confidence === 'high') confidence = 'medium'
  }

  if (qualityOk && summaryAr.replace(/[\s\u200c\u200f]/g, '').length < 90 && confidence === 'high') {
    confidence = 'medium'
  }

  /** اكتمال القوائم مقابل ما يعرضه الـ UI — خفض تدريجي؛ رفع «low»→«medium» فقط عند بنية سليمة. */
  if (qualityOk) {
    if (mode === 'hand' && recommendedColors.length < 2) {
      confidence = downConfidenceOneStep(confidence)
    }
    if (mode === 'face' && (recommendedHairColors.length === 0 || recommendedHaircuts.length === 0)) {
      confidence = downConfidenceOneStep(confidence)
    }
    if (
      confidence === 'low' &&
      structureSupportsMediumConfidence(mode, {
        recommendedColors,
        colorsToAvoid,
        recommendedHairColors,
        recommendedHaircuts,
        summaryAr,
      })
    ) {
      confidence = 'medium'
    }
  }

  return {
    mode,
    confidence,
    qualityOk,
    summaryAr,
    undertone,
    faceShape,
    recommendedColors,
    colorsToAvoid,
    recommendedHairColors,
    recommendedHaircuts,
    cautionNotes,
    retryTips,
    nextActions,
  }
}

function buildHandUndertonePrompt(): string {
  return `أنتِ «روزي»، مساعدة تجميل بالعربية لمستخدمات في **السعودية ودول الخليج**. مهمتكِ: قراءة **صورة يد** لتقدير **اتجاه إنديرتون الجلد** واقتراح **ألوان طلاء أظافر** — للإلهام فقط، **ليس تشخيصاً طبياً**.

## الصدق أهم من الإبهام
- إن لم تكوني واثقة من الإضاءة أو الزاوية: undertone = "uncertain" وخفّضي confidence — **لا حكماً قاطعاً**.
- صوغي: يبدو، غالباً، الأقرب، قد يناسبكِ — وليس: أكيد، حتماً، بدون منازعة.
- **لا تنتقدي** شكل اليد أو الأظافر — ركّزي على الإرشاد التجميلي.

## ماذا تنظرين (بدون اختلاق)
- دفء/برودة لون الجلد كنمط عام.
- أوردة ظاهرة: **لا تبنين الإنديرتون على لون الوريد وحده** — ادمجيه مع البشرة والظلال والإضاءة.
- إضاءة صفراء قوية، فلتر ثقيل، أو ضبابية → اذكري ذلك في summaryAr وخفّضي confidence.

## سياق خليجي (جملة واحدة عند الحاجة)
- الرطوبة والحر قد يغيّران إدراك اللمعان على الطلاء — بدون مبالغة.
- أسماء ألوان **بالعربية** كما في الصالونات المحليّة.

## undertone (واحدة)
warm | cool | neutral | uncertain

## ألوان الطلاء
- 4–8 عناصر "اسم عربي (#RRGGBB)" عند qualityOk=true؛ **uncertain** → لوحة آمنة هادئة فقط.
- colorsToAvoid: 2–6 عناصر + سبب قصير عربي — ألوان تزيد تعارضاً محتملاً مع القراءة.

## اتساق JSON (إلزامي — بدون strict)
- أرجعي **كائناً واحداً** فقط؛ بلا Markdown ولا شرح خارج JSON.
- **كل** المفاتيح الاثنا عشر في المثال أدناه يجب أن تظهر دائماً؛ لا تحذفي أي مفتاح ولا تستبدلي المصفوفة بـ null.
- المصفوفات دائماً \`[]\` (فارغة أو مملوءة) — ليست null وليست مفقودة.
- \`mode\` بالضبط \`"hand"\`؛ \`faceShape\` بالضبط \`"uncertain"\` لهذه المهمة.
- \`summaryAr\`: نص عربي مفيد؛ **اختصري** إن طال (يفضّل ≤ ${MAX_SUMMARY_CHARS} حرفاً).
- كل عنصر داخل أي مصفوفة: **فكرة واحدة** قصيرة؛ يفضّل ≤ ${MAX_LIST_ITEM_CHARS} حرفاً للعنصر الواحد.

## JSON فقط — جميع المفاتيح التالية دائماً (مصفوفات قد تكون فارغة):
{"mode":"hand","confidence":"high|medium|low","qualityOk":true|false,"summaryAr":"…","undertone":"…","faceShape":"uncertain","recommendedColors":[],"colorsToAvoid":[],"recommendedHairColors":[],"recommendedHaircuts":[],"cautionNotes":[],"retryTips":[],"nextActions":[]}

- qualityOk=true: املئي الألوان وnextActions؛ retryTips=[]؛ cautionNotes=[].
- qualityOk=false: افرغي الألوان وnextActions؛ املئي retryTips (≥3)؛ شرح لطيف في summaryAr.

## ممنوع
- اعتذار مفرط (عذراً، آسفة، للأسف، نأسف…).
- إحراج المستخدم أو تقييم مظهرها كشخص.`
}

function buildFaceSystemPrompt(): string {
  return `أنتِ «روزي»، مساعدة جمال بالعربية لمستخدمات في **السعودية ودول الخليج** — **اقتراح ألوان شعر وقصّات** يتوافق مع **ملامح الوجه** من صورة أمامية تقريبية. هذا **رأي تجميلي تقريبي** وليس قراراً طبياً أو نهائياً.

## الصدق
- غياب اليقين أفضل من الاختلاق: faceShape أو undertone = "uncertain" عند ضعف الأدلة، وخفّضي confidence.
- صيغة ملاحظة: يبدو، قد يناسبكِ، الأقرب — دون «حتماً» أو «الأفضل دائماً».
- لا تنتقدي ملامح الوجه؛ لا تقارنين بمعايير جمال قاسية.

## ما تفحصينه (ما يظهر فقط)
- خط الفك والزوايا؛ عرض/طول الوجه كنسبة تقريبية؛ توازن الجبهة والوجنتين والذقن حسب الوضوح.
- إضاءة قوية من جهة، ظلال ثقيلة، زاوية جانبية فقط → qualityOk=false أو faceShape=uncertain مع تنبيه في summaryAr.

## سياق صالون الخليج
- اذكري عند الحاجة: صبغة، هايلايت، بالياج، سموكي، ويفي، طبقات — بمفردات **عربية عادية** في الصالونات.
- الرطوبة ونوعية المياه قد تؤثر على مظهر الصبغة — جملة حذرة واحدة في cautionNotes عند المناسبة، دون تخويف.

## faceShape (واحدة)
oval | round | square | heart | uncertain

## undertone بشرة الوجه (تقريبي)
warm | cool | neutral | uncertain — للإشارة فقط؛ لا تُجبري تخميناً قوياً من صورة سيئة.

## اتساق JSON (إلزامي — بدون strict)
- أرجعي **كائناً واحداً** فقط؛ بلا Markdown ولا نص قبل/بعد.
- **كل** المفاتيح الاثنا عشر أدناه دائماً؛ لا null للمصفوفات ولا حذف لمفتاح.
- \`mode\` بالضبط \`"face"\`؛ \`recommendedColors\` و \`colorsToAvoid\` دائماً \`[]\`.
- \`summaryAr\` عربي وواضح؛ يفضّل ≤ ${MAX_SUMMARY_CHARS} حرفاً.
- عناصر المصفوفات قصيرة؛ يفضّل ≤ ${MAX_LIST_ITEM_CHARS} حرفاً لكل عنصر.

## JSON فقط — المفاتيح كاملة دائماً:
{"mode":"face","confidence":"high|medium|low","qualityOk":true|false,"summaryAr":"…","undertone":"…","faceShape":"…","recommendedColors":[],"colorsToAvoid":[],"recommendedHairColors":[],"recommendedHaircuts":[],"cautionNotes":[],"retryTips":[],"nextActions":[]}

- recommendedColors و colorsToAvoid دائماً [].
- qualityOk=true: 3–10 عناصر في recommendedHairColors؛ 3–10 في recommendedHaircuts؛ 2–5 cautionNotes واقعية؛ nextActions عملية (حجز، صور إضافية).
- qualityOk=false: افرغي الشعر والقصات وcautionNotes وnextActions؛ املئي retryTips (≥3).
- retryTips دائماً [] عندما qualityOk=true.

## قصّات (أمثلة اتجاهات — بلطف)
- round / square / oval / heart / uncertain — اربطي الاقتراح بالشكل المقدَّر مع صيغة «قد يناسبكِ».

## ممنوع
- اعتذار مفرط.
- وعود نتيجة مضمونة من صورة واحدة.`
}

function buildSystemPrompt(mode: VisionMode): string {
  return mode === 'hand' ? buildHandUndertonePrompt() : buildFaceSystemPrompt()
}

/** Structured output (strict:false) — يوجّه النموذج دون رفض صارم عند انحراف بسيط. */
function rozyVisionResponseFormat(mode: VisionMode): {
  type: 'json_schema'
  json_schema: {
    name: string
    strict: boolean
    schema: Record<string, unknown>
  }
} {
  const strList = (maxItems: number) => ({
    type: 'array',
    items: { type: 'string', maxLength: 200 },
    maxItems,
  })
  return {
    type: 'json_schema',
    json_schema: {
      name: mode === 'hand' ? 'rozy_vision_hand' : 'rozy_vision_face',
      strict: false,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: [
          'mode',
          'confidence',
          'qualityOk',
          'summaryAr',
          'undertone',
          'faceShape',
          'recommendedColors',
          'colorsToAvoid',
          'recommendedHairColors',
          'recommendedHaircuts',
          'cautionNotes',
          'retryTips',
          'nextActions',
        ],
        properties: {
          mode: { type: 'string', enum: mode === 'hand' ? ['hand'] : ['face'] },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          qualityOk: { type: 'boolean' },
          summaryAr: { type: 'string', maxLength: MAX_SUMMARY_CHARS + 400 },
          undertone: { type: 'string', enum: ['warm', 'cool', 'neutral', 'uncertain'] },
          faceShape: {
            type: 'string',
            enum:
              mode === 'hand'
                ? ['uncertain']
                : ['oval', 'round', 'square', 'heart', 'uncertain'],
          },
          recommendedColors: strList(MAX_COLOR_ITEMS),
          colorsToAvoid: strList(MAX_AVOID_ITEMS),
          recommendedHairColors: strList(MAX_HAIR_COLOR_ITEMS),
          recommendedHaircuts: strList(MAX_HAIRCUT_ITEMS),
          cautionNotes: strList(MAX_NOTE_ITEMS),
          retryTips: strList(MAX_RETRY_ITEMS),
          nextActions: strList(MAX_NEXT_ITEMS),
        },
      },
    },
  }
}

const QUALITY_GATE_SYSTEM = `أنتِ فاحصة صور صارمة قبل تحليل تجميلي.
قيمي الصورة فقط من ناحية الجودة — **بدون** تحليل ألوان بشرة أو شعر.

المعايير (يجب أن تمرّ جميعها ليعتبر passes=true):
1) **السطوع / الإضاءة**: ليست مظلمة جداً أو محروقة بالكامل؛ يُفضّل إضاءة نهارية معقولة (ليس شرطاً مثالية).
2) **الضبابية**: الصورة ليست ضبابية بشكل يمنع رؤية التفاصيل (حركة شديدة أو عدم تركيز واضح = فشل).
3) **ظهور الموضوع**: HAND_OR_FACE يظهر بوضوح معقول في الإطار (ليست صورة بعيدة جداً أو مقطوعة بحيث لا يُرى الجزء المطلوب).

إن شككتِ أو كان أي معيار غير مستوفٍ: passes=false.

أرجعي **JSON فقط** بهذا الشكل بالضبط:
{"passes":true}
أو
{"passes":false}`

function qualityGateSystemForMode(mode: VisionMode): string {
  const subj = mode === 'hand' ? 'اليد' : 'الوجه'
  return QUALITY_GATE_SYSTEM.replace('HAND_OR_FACE', subj)
}

/** Debug: describe message.content before normalization (no image data in logs). */
function visionEnvelopeToRawVision(env: VisionEnvelopeJson, mode: VisionMode): RawVision {
  const sum = (env.summary || env.details || '').trim() || '—'
  const rec = env.recommendations
  const forHand = mode === 'hand'
  return {
    mode,
    confidence: 'medium',
    qualityOk: true,
    summaryAr: sum.slice(0, MAX_SUMMARY_CHARS),
    undertone: 'uncertain',
    faceShape: 'uncertain',
    recommendedColors: rec.slice(0, MAX_COLOR_ITEMS),
    colorsToAvoid: [],
    recommendedHairColors: forHand ? [] : rec.slice(0, MAX_HAIR_COLOR_ITEMS),
    recommendedHaircuts: forHand ? [] : rec.slice(0, MAX_HAIRCUT_ITEMS),
    cautionNotes: env.details.trim() ? [env.details.trim().slice(0, 240)] : [],
    retryTips: [],
    nextActions: [],
  }
}

export function logOpenAiContentBeforeParse(
  label: string,
  contentRaw: unknown,
): void {
  let rawLen = 0
  if (typeof contentRaw === 'string') rawLen = contentRaw.length
  else if (Array.isArray(contentRaw)) rawLen = contentRaw.length
  else if (contentRaw != null) rawLen = JSON.stringify(contentRaw).length
  const preview =
    typeof contentRaw === 'string'
      ? contentRaw.slice(0, 500)
      : JSON.stringify(contentRaw, null, 0)?.slice(0, 500) ?? String(contentRaw)
  console.log(`${label} BEFORE parsing: raw message.content`, {
    typeofContent: contentRaw === null ? 'null' : contentRaw === undefined ? 'undefined' : Array.isArray(contentRaw) ? 'array' : typeof contentRaw,
    contentRawLengthApprox: rawLen,
    previewFirst500Chars: preview,
  })
}

async function openaiVisionQualityGate(apiKey: string, mode: VisionMode, dataUrl: string): Promise<boolean> {
  console.log('[openaiVisionQualityGate] final prompts sent to OpenAI', {
    system: OPENAI_VISION_SYSTEM_PROMPT,
    user: OPENAI_VISION_USER_PROMPT,
    mode,
    dataUrlLengthChars: dataUrl.length,
  })

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: OPENAI_VISION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: OPENAI_VISION_USER_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 80,
    }),
  })

  const { status, data } = await readOpenAiChatCompletionJson(res, 'openaiVisionQualityGate')

  if (!res.ok) {
    const errObj = data.error as { message?: string } | undefined
    const msg = errObj?.message || `HTTP ${status}`
    throw new Error(`OpenAI quality gate: ${msg}`)
  }

  const choices = data.choices as { message?: { content?: unknown } }[] | undefined
  const contentRaw = choices?.[0]?.message?.content
  logOpenAiContentBeforeParse('[openaiVisionQualityGate]', contentRaw)

  const raw = openAiAssistantContentToString(contentRaw).trim()
  console.log('[openaiVisionQualityGate] shape check', {
    hasChoices: Array.isArray(choices) && choices.length > 0,
    hasMessage: Boolean(choices?.[0]?.message),
    contentType:
      Array.isArray(contentRaw) ? 'array' : contentRaw === null || contentRaw === undefined ? 'nullish' : typeof contentRaw,
    normalizedTextLength: raw.length,
  })
  const env = parseVisionEnvelope(raw, 'openaiVisionQualityGate')
  console.log('[openaiVisionQualityGate] envelope (gate never blocks)', env)
  return true
}

function clampPersonalizationHint(raw: string | undefined): string | undefined {
  if (typeof raw !== 'string') return undefined
  const t = raw.trim()
  if (!t) return undefined
  return t.length > 900 ? `${t.slice(0, 897)}…` : t
}

async function openaiVisionJsonStrict(
  apiKey: string,
  mode: VisionMode,
  dataUrl: string,
  _personalizationHint?: string,
): Promise<RawVision> {
  console.log('[openaiVisionJsonStrict] final prompts sent to OpenAI', {
    system: OPENAI_VISION_SYSTEM_PROMPT,
    user: OPENAI_VISION_USER_PROMPT,
    model: OPENAI_MODEL,
    mode,
    dataUrlLengthChars: dataUrl.length,
  })

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: OPENAI_VISION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: OPENAI_VISION_USER_PROMPT },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.12,
      max_tokens: mode === 'hand' ? 1800 : 1900,
    }),
  })

  const { status, data } = await readOpenAiChatCompletionJson(res, 'openaiVisionJsonStrict')

  if (!res.ok) {
    const errObj = data.error as { message?: string } | undefined
    throw new Error(errObj?.message || `OpenAI vision JSON HTTP ${status}`)
  }

  const choices = data.choices as { message?: { content?: unknown } }[] | undefined
  const contentRaw = choices?.[0]?.message?.content
  logOpenAiContentBeforeParse('[openaiVisionJsonStrict]', contentRaw)

  const raw = openAiAssistantContentToString(contentRaw).trim()
  console.log('[openaiVisionJsonStrict] shape check', {
    hasChoices: Array.isArray(choices) && choices.length > 0,
    hasMessage: Boolean(choices?.[0]?.message),
    contentType:
      Array.isArray(contentRaw) ? 'array' : contentRaw === null || contentRaw === undefined ? 'nullish' : typeof contentRaw,
    normalizedTextLength: raw.length,
  })
  const env = parseVisionEnvelope(raw, 'openaiVisionJsonStrict')
  const out = visionEnvelopeToRawVision(env, mode)
  console.log('[openaiVisionJsonStrict] envelope → RawVision', {
    summaryArLength: String(out.summaryAr ?? '').length,
  })
  return out
}

export type VisionAnalysisOptions = {
  /** Short Arabic context from saved undertone/styles — never include PII or raw images */
  personalizationHint?: string
}

/**
 * 1) Quality gate 2) mode-specific prompt + vision JSON 3) normalize/sanitize.
 */
export async function runVisionAnalysis(
  mode: VisionMode,
  dataUrl: string,
  apiKey: string,
  opts?: VisionAnalysisOptions,
): Promise<RozyVisionResult> {
  const passesGate = await openaiVisionQualityGate(apiKey, mode, dataUrl)
  console.log('[runVisionAnalysis] quality gate summary', {
    mode,
    passesGate,
    ifFalseMeans: passesGate
      ? 'n/a'
      : 'buildQualityRejectedResult (صورة رُفضت بالبوابة — ليس بالضرورة رد OpenAI فارغ)',
  })
  if (!passesGate) {
    return buildQualityRejectedResult(mode)
  }
  const raw = await openaiVisionJsonStrict(apiKey, mode, dataUrl, opts?.personalizationHint)
  return normalizeResult(raw, mode)
}
