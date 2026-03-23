import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  rankProducts,
  rankServices,
  skinTokensFromPayload,
  type ProductForRank,
  type ServiceForRank,
  type SkinPayloadForRank,
  type UserRecommendationHistory,
} from '../_shared/ranking.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPENAI_MODEL = 'gpt-4o'

type Msg = { role: 'user' | 'assistant' | 'system'; content: string }

type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

type OpenAIChatMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string | OpenAIContentPart[]
}

type IntentName = 'search_salon' | 'recommend_service' | 'booking_request' | 'general_question'

type ClassifyResult = {
  intent: IntentName
  entities: Record<string, unknown>
}

type BookingExtract = {
  salon_id: string | null
  service_id: string | null
  booking_date: string | null
}

type SalonRow = {
  id: string
  name_ar: string
  city: string
  city_id: string | null
  category: string | null
  category_label: string | null
  average_rating: number | null
  address_ar: string | null
  opening_hours: Record<string, { open: string; close: string }> | null
}

type ServiceRow = ServiceForRank

type ProductRow = ProductForRank

type ProfileRow = {
  id: string
  full_name: string | null
  city: string | null
  preferred_language: string | null
}

type SkinContextRow = {
  skin_type: string | null
  issues: string[] | null
  analysis_result: Record<string, unknown> | null
  created_at: string
}

const EVENT_HALFLIFE_DAYS = 14

function emptyRecoHistory(): UserRecommendationHistory {
  return {
    bookedServiceIds: new Set(),
    bookedBusinessIds: new Set(),
    orderedProductIds: new Set(),
    favoriteBusinessIds: new Set(),
    serviceEventScore: new Map(),
    productEventScore: new Map(),
    businessEventScore: new Map(),
  }
}

function decayFactorReco(createdAt: string): number {
  const ageDays = (Date.now() - new Date(createdAt).getTime()) / 86_400_000
  return Math.pow(0.5, ageDays / EVENT_HALFLIFE_DAYS)
}

function bumpRecoScore(map: Map<string, number>, id: string, delta: number) {
  if (!id) return
  map.set(id, (map.get(id) ?? 0) + delta)
}

async function fetchRecoHistory(sb: SupabaseClient, userId: string): Promise<UserRecommendationHistory> {
  const h = emptyRecoHistory()
  const [bookingsRes, favRes, itemsRes, eventsRes] = await Promise.all([
    sb.from('bookings').select('business_id, service_id, service_ids').eq('user_id', userId),
    sb.from('favorites').select('business_id').eq('user_id', userId),
    sb
      .from('order_items')
      .select('product_id, orders!inner(user_id)')
      .eq('orders.user_id', userId),
    sb
      .from('user_events')
      .select('event_type, entity_type, entity_id, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(400),
  ])

  if (bookingsRes.error) console.warn('[rozi-chat] bookings history', bookingsRes.error.message)
  if (favRes.error) console.warn('[rozi-chat] favorites history', favRes.error.message)
  if (itemsRes.error) console.warn('[rozi-chat] order_items history', itemsRes.error.message)
  if (eventsRes.error) console.warn('[rozi-chat] user_events history', eventsRes.error.message)

  for (const row of bookingsRes.data ?? []) {
    const b = row as { business_id?: string; service_id?: string | null; service_ids?: string[] | null }
    if (b.business_id) h.bookedBusinessIds.add(b.business_id)
    if (b.service_id) h.bookedServiceIds.add(b.service_id)
    for (const sid of b.service_ids || []) {
      if (sid) h.bookedServiceIds.add(sid)
    }
  }
  for (const row of favRes.data ?? []) {
    const bid = (row as { business_id?: string }).business_id
    if (bid) h.favoriteBusinessIds.add(bid)
  }
  for (const row of itemsRes.data ?? []) {
    const pid = (row as { product_id?: string | null }).product_id
    if (pid) h.orderedProductIds.add(pid)
  }
  for (const row of eventsRes.data ?? []) {
    const r = row as { event_type: string; entity_type: string; entity_id: string; created_at: string }
    const d = decayFactorReco(r.created_at)
    const w = r.event_type === 'book' ? 1.15 : r.event_type === 'click' ? 0.5 : 0.15
    const add = w * d
    if (r.entity_type === 'service') bumpRecoScore(h.serviceEventScore, r.entity_id, add)
    else if (r.entity_type === 'product') bumpRecoScore(h.productEventScore, r.entity_id, add)
    else if (r.entity_type === 'business') bumpRecoScore(h.businessEventScore, r.entity_id, add)
  }
  return h
}

function skinPayloadFromRow(row: SkinContextRow | null): SkinPayloadForRank | null {
  const ar = row?.analysis_result
  if (!ar || typeof ar !== 'object') return null
  const o = ar as Record<string, unknown>
  const concerns = Array.isArray(o.concerns) ? (o.concerns as unknown[]).map((x) => String(x)) : undefined
  const rt = Array.isArray(o.recommended_treatments)
    ? (o.recommended_treatments as unknown[]).map((x) => String(x))
    : undefined
  const rs = Array.isArray(o.recommended_services) ? (o.recommended_services as unknown[]).map((x) => String(x)) : undefined
  return {
    skin_type: typeof o.skin_type === 'string' ? o.skin_type : row?.skin_type ?? undefined,
    concerns,
    recommended_treatments: rt,
    recommended_services: rs,
  }
}

const INTENTS: IntentName[] = ['search_salon', 'recommend_service', 'booking_request', 'general_question']

function readOpenAiApiKey(): string {
  const raw = Deno.env.get('OPENAI_API_KEY')?.trim() || ''
  let k = raw
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim()
  }
  return k.replace(/\r?\n/g, '').replace(/\s+/g, '')
}

async function openaiComplete(apiKey: string, messages: OpenAIChatMessage[], maxTokens = 1200): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.55,
      max_tokens: maxTokens,
    }),
  })

  const data = (await res.json()) as {
    error?: { message?: string }
    choices?: { message?: { content?: string | null } }[]
  }

  if (!res.ok) {
    throw new Error(data.error?.message || `OpenAI ${res.status}`)
  }

  const text = data.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Empty OpenAI response')
  }
  return text.trim()
}

async function openaiJson<T>(apiKey: string, system: string, user: string, maxTokens = 400): Promise<T> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.15,
      max_tokens: maxTokens,
    }),
  })

  const data = (await res.json()) as {
    error?: { message?: string }
    choices?: { message?: { content?: string | null } }[]
  }

  if (!res.ok) {
    throw new Error(data.error?.message || `OpenAI ${res.status}`)
  }

  const raw = data.choices?.[0]?.message?.content
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('Empty JSON from OpenAI')
  }
  return JSON.parse(raw) as T
}

function normalizeIntent(x: string | undefined): IntentName {
  if (x && (INTENTS as string[]).includes(x)) return x as IntentName
  return 'general_question'
}

function lastUserText(messages: Msg[], hasImage: boolean): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]
    if (m.role === 'user' && typeof m.content === 'string' && m.content.trim()) {
      return m.content.trim()
    }
  }
  if (hasImage) return 'تحليل صورة الوجه للبشرة والعناية'
  return ''
}

function formatHistoryLines(
  rows: { message: string | null; response: string | null; is_user: boolean | null; created_at: string }[]
): string {
  return rows
    .slice()
    .reverse()
    .map((r) => {
      if (r.is_user) return `المستخدم: ${(r.message || '').slice(0, 500)}`
      return `روزي: ${(r.response || r.message || '').slice(0, 500)}`
    })
    .join('\n')
}

function defaultSlots(): string[] {
  return ['10:00', '14:00', '17:00']
}

function pickSlotsFromOpeningHours(oh: Record<string, { open: string; close: string }> | null | undefined): string[] {
  if (!oh || typeof oh !== 'object') return defaultSlots()
  const day = oh['السبت'] || oh['الأحد'] || Object.values(oh)[0]
  const openStr = day?.open
  if (!openStr || typeof openStr !== 'string') return defaultSlots()
  const h = parseInt(openStr.split(':')[0] ?? '', 10)
  if (!Number.isFinite(h) || h < 8 || h > 20) return defaultSlots()
  const a = `${String(h).padStart(2, '0')}:00`
  const b = `${String(Math.min(h + 4, 20)).padStart(2, '0')}:00`
  const c = `${String(Math.min(h + 7, 21)).padStart(2, '0')}:00`
  return [a, b, c]
}

async function fetchSalonsForUser(
  sb: SupabaseClient,
  profileCity: string,
  intent: IntentName,
  entities: Record<string, unknown>
): Promise<SalonRow[]> {
  let q = sb
    .from('businesses')
    .select('id,name_ar,city,city_id,category,category_label,average_rating,address_ar,opening_hours')
    .eq('is_active', true)
    .eq('is_demo', false)

  const searchQ = typeof entities.query === 'string' ? entities.query.trim() : ''
  const salonHint = typeof entities.salon_hint === 'string' ? entities.salon_hint.trim() : ''

  if ((intent === 'search_salon' || intent === 'recommend_service') && searchQ) {
    q = q.ilike('name_ar', `%${searchQ}%`)
  } else if ((intent === 'search_salon' || intent === 'recommend_service') && salonHint) {
    q = q.ilike('name_ar', `%${salonHint}%`)
  } else if (profileCity) {
    q = q.eq('city', profileCity)
  }

  const { data, error } = await q.order('average_rating', { ascending: false }).limit(22)
  if (error) throw error
  let list = (data ?? []) as SalonRow[]
  if (list.length === 0 && profileCity) {
    const fb = await sb
      .from('businesses')
      .select('id,name_ar,city,city_id,category,category_label,average_rating,address_ar,opening_hours')
      .eq('is_active', true)
      .eq('is_demo', false)
      .order('average_rating', { ascending: false })
      .limit(18)
    if (!fb.error) list = (fb.data ?? []) as SalonRow[]
  }
  return list
}

async function fetchServices(sb: SupabaseClient, businessIds: string[], serviceKeyword?: string): Promise<ServiceRow[]> {
  if (businessIds.length === 0) return []
  let q = sb
    .from('services')
    .select(
      'id,business_id,name_ar,category,price,duration_minutes,is_demo, businesses ( total_bookings, average_rating, total_reviews )'
    )
    .in('business_id', businessIds)
    .eq('is_active', true)
    .eq('is_demo', false)
  if (serviceKeyword) {
    q = q.ilike('name_ar', `%${serviceKeyword}%`)
  }
  const { data, error } = await q.limit(96)
  if (error) throw error
  return (data ?? []) as ServiceRow[]
}

async function fetchProducts(sb: SupabaseClient): Promise<ProductRow[]> {
  const { data, error } = await sb
    .from('products')
    .select('id,name_ar,price,category,description_ar,brand_ar,rating,review_count')
    .eq('is_active', true)
    .eq('is_demo', false)
    .limit(120)
  if (error) return []
  return (data ?? []) as ProductRow[]
}

function formatSkinContextBlock(row: SkinContextRow | null): string {
  if (!row) return ''
  const ar = row.analysis_result
  const notes = ar && typeof ar.notes_ar === 'string' ? ar.notes_ar : ''
  const sev = ar && typeof ar.severity === 'string' ? ar.severity : ''
  const treat = Array.isArray(ar?.recommended_treatments)
    ? (ar.recommended_treatments as string[]).join('، ')
    : ''
  const svc = Array.isArray(ar?.recommended_services) ? (ar.recommended_services as string[]).join('، ') : ''
  const concerns = (row.issues || []).join('، ')
  return `## تحليل بشرة المستخدمة (من تطبيق روزيرا — تقديري وليس تشخيصاً طبياً)
- تاريخ أحدث تحليل: ${row.created_at || '—'}
- نوع البشرة (تقديري): ${row.skin_type || '—'}
- ملخص عربي من النموذج: ${notes || '—'}
- الشدة التقديرية: ${sev || '—'}
- نقاط الاهتمام: ${concerns || '—'}
- علاجات مقترحة: ${treat || '—'}
- خدمات مناسبة (صالون): ${svc || '—'}

عند السؤال عن البشرة أو التوصية، ابدئي أحياناً بـ "بناءً على تحليل بشرتكِ الأخير في التطبيق..." ثم اربطي النصيحة ببيانات الصالونات/الخدمات أدناه عند التوفر.`
}

function buildBrainContext(params: {
  profile: ProfileRow
  historyText: string
  salons: SalonRow[]
  services: ServiceRow[]
  products: ProductRow[]
  skinBlock: string
  rankedServicesLines: string
  rankedProductsLines: string
}): string {
  const { profile, historyText, salons, services, products, skinBlock, rankedServicesLines, rankedProductsLines } = params
  const salonLines =
    salons
      .map(
        (b) =>
          `- [${b.id}] ${b.name_ar} — ${b.city} — ${b.category_label || b.category || ''} — تقييم ${Number(b.average_rating ?? 0).toFixed(1)} — ${b.address_ar || ''}`
      )
      .join('\n') || '(لا توجد صالونات مطابقة في البيانات)'

  const svcLines =
    services
      .map((s) => `- [${s.id}] لصالون ${s.business_id}: ${s.name_ar} — ${Number(s.price ?? 0).toFixed(0)} ر.س — ${s.duration_minutes ?? '?'} د`)
      .join('\n') || '(لا خدمات في القائمة الحالية)'

  const prodLines =
    products.map((p) => `- [${p.id}] ${p.name_ar} — ${Number(p.price ?? 0).toFixed(0)} ر.س`).join('\n') || '(لا منتجات)'

  const skinSection = skinBlock.trim() ? `${skinBlock}\n\n` : ''

  const rankSection =
    rankedServicesLines.trim() || rankedProductsLines.trim()
      ? `## توصيات مرتبة لبشرتكِ وتفضيلاتكِ (استخدمي الأسباب في الرد)
### خدمات (أعلى نقاطاً أولاً)
${rankedServicesLines.trim() || '(لا توجد)'}

### منتجات
${rankedProductsLines.trim() || '(لا توجد)'}

`
      : ''

  return `## الملف الشخصي
- الاسم: ${profile.full_name || '—'}
- المدينة المفضلة في الملف: ${profile.city || '—'}

${skinSection}${rankSection}## آخر المحادثات (ملخص)
${historyText || '(بداية المحادثة)'}

## صالونات وعيادات (بيانات حقيقية من قاعدة روزيرا — استخدمي المعرفات [uuid] عند التوصية)
${salonLines}

## خدمات متاحة لهذه الصالونات
${svcLines}

## منتجات المتجر
${prodLines}`
}

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
    return new Response(JSON.stringify({ error: 'يجب تسجيل الدخول لاستخدام روزي' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const accessToken = auth.slice(7).trim()
  if (!accessToken) {
    return new Response(JSON.stringify({ error: 'يجب تسجيل الدخول لاستخدام روزي' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim()
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: 'إعداد خادم Supabase ناقص' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey)
  let userId: string
  try {
    const { data, error: authErr } = await authClient.auth.getUser(accessToken)
    if (authErr || !data?.user) {
      return new Response(JSON.stringify({ error: 'يجب تسجيل الدخول لاستخدام روزي (جلسة غير صالحة)' }), {
        status: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
    userId = data.user.id
  } catch {
    return new Response(JSON.stringify({ error: 'تعذر الاتصال بخدمة التحقق من الجلسة' }), {
      status: 502,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const userSb = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })

  try {
    const body = (await req.json()) as {
      messages?: Msg[]
      imageBase64?: string
      imageMimeType?: string
      contextBlock?: string
    }

    const historyMsgs = Array.isArray(body.messages) ? body.messages.filter((m) => m.role !== 'system').slice(-16) : []
    const legacyCtx = typeof body.contextBlock === 'string' && body.contextBlock.trim() ? body.contextBlock.trim() : ''

    const hasImage =
      typeof body.imageBase64 === 'string' &&
      body.imageBase64.length > 0 &&
      typeof body.imageMimeType === 'string' &&
      body.imageMimeType.length > 0

    const apiKey = readOpenAiApiKey()
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            'لم يُعرّف مفتاح OpenAI. أضيفي OPENAI_API_KEY في Supabase → Edge Functions → Secrets (مفتاح من platform.openai.com، سطر واحد بدون اقتباسات).',
        }),
        { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } }
      )
    }

    const [{ data: prof, error: pErr }, { data: histRows, error: hErr }, { data: skinRow, error: skErr }] =
      await Promise.all([
        userSb.from('profiles').select('id,full_name,city,preferred_language').eq('id', userId).maybeSingle(),
        userSb
          .from('chat_messages')
          .select('message,response,is_user,created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(10),
        userSb
          .from('skin_analysis')
          .select('skin_type,issues,analysis_result,created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

    if (pErr) console.warn('[rozi-chat] profile', pErr.message)
    if (hErr) console.warn('[rozi-chat] history', hErr.message)
    if (skErr) console.warn('[rozi-chat] skin_analysis', skErr.message)

    const profile = (prof ?? { id: userId, full_name: null, city: null, preferred_language: 'ar' }) as ProfileRow
    const profileCity = (profile.city || 'الخبر').trim()
    const historyText = formatHistoryLines((histRows ?? []) as Parameters<typeof formatHistoryLines>[0])
    const skinBlock = formatSkinContextBlock((skinRow ?? null) as SkinContextRow | null)

    const utterance = lastUserText(historyMsgs, hasImage)

    let intent: IntentName = 'general_question'
    let entities: Record<string, unknown> = {}

    try {
      const cls = await openaiJson<{ intent?: string; entities?: Record<string, unknown> }>(
        apiKey,
        `You classify user messages for a Saudi women's beauty app (Rosera). Reply with JSON only:
{"intent":"search_salon"|"recommend_service"|"booking_request"|"general_question","entities":{}}

Definitions:
- search_salon: looking for a salon/clinic/spa by name, area, or type.
- recommend_service: wants service advice (nails, hair, laser, spa, etc.).
- booking_request: wants to book, reserve, or pick date/time.
- general_question: chit-chat, products, app help, or image/skin analysis.

entities may include: query (string), service_keyword (string), salon_hint (string), city (string), date_hint (string).
Use Arabic context. If unclear, intent general_question and empty entities.`,
        `User message:\n${utterance.slice(0, 1200)}`
      )
      intent = normalizeIntent(cls.intent)
      entities = cls.entities && typeof cls.entities === 'object' ? cls.entities : {}
    } catch (e) {
      console.warn('[rozi-chat] classify fallback', e)
    }

    const serviceKeyword =
      typeof entities.service_keyword === 'string'
        ? entities.service_keyword
        : typeof entities.query === 'string' && intent === 'recommend_service'
          ? entities.query
          : ''

    const salons = await fetchSalonsForUser(userSb, profileCity, intent, entities)
    const businessIds = salons.map((s) => s.id)
    const services = await fetchServices(userSb, businessIds, serviceKeyword || undefined)
    const products = await fetchProducts(userSb)

    const recoHistory = await fetchRecoHistory(userSb, userId)
    const skinPayload = skinPayloadFromRow((skinRow ?? null) as SkinContextRow | null)
    const tokens = skinTokensFromPayload(skinPayload)
    const rankedSvc = rankServices(services as ServiceForRank[], skinPayload, tokens, recoHistory, 10)
    const rankedProd = rankProducts(products as ProductForRank[], skinPayload, tokens, recoHistory, 8)
    const rankedServicesLines = rankedSvc
      .map(
        (x) =>
          `- [${x.item.id}] (نقاط ${x.score}) ${x.item.name_ar} — صالون ${x.item.business_id} — أسباب: ${x.reasons.join('؛ ')}`
      )
      .join('\n')
    const rankedProductsLines = rankedProd
      .map((x) => `- [${x.item.id}] (نقاط ${x.score}) ${x.item.name_ar} — أسباب: ${x.reasons.join('؛ ')}`)
      .join('\n')

    const brainContext = buildBrainContext({
      profile,
      historyText,
      salons,
      services,
      products,
      skinBlock,
      rankedServicesLines,
      rankedProductsLines,
    })

    const extraLegacy = legacyCtx ? `\n\n## سياق إضافي من العميل (قديم — اختياري)\n${legacyCtx}` : ''

    const systemMain = `أنتِ "روزي" — عقل روزيرا (Rosy Brain): خبيرة تجميل وجمال رقمية تتحدثين بالعربية فقط بأسلوب ودود واحترافي للنساء في السعودية.

## مهمتكِ
- فهم نية المستخدمة: التصنيف الحالي من النظام هو **${intent}**.
- الاعتماد على **البيانات الحقيقية** في قسم "بيانات حقيقية" أدناه فقط لذكر صالون/خدمة/منتج محدد (استخدمي المعرف [uuid] عند الإشارة للحجز: رابط الصالون /salon/{id} ثم زر احجزي → /booking/{id}).
- شجّعي على الحجز عند المناسب بجملة واضحة.
- للمنتجات: وجّهي لـ /store و /product/{id} عند توفر المعرف في البيانات.
- صورة الوجه: إن وُجدت في الرسالة، حللي البشرة باختصار — بدون تشخيص طبي، وذكّري أن النتيجة تقديرية. لا تطلبي حفظ الصور.
- إن وُجد قسم "تحليل بشرة المستخدمة" في البيانات، استخدميه لتخصيص الرد وقللي "بناءً على تحليل بشرتكِ الأخير في التطبيق..." عندما يناسب السياق.
- إن وُجد قسم "توصيات مرتبة لبشرتكِ وتفضيلاتكِ"، فاضيفي أحياناً جملة مثل: "أنصحك بهذا الخيار لأنه..." وادمجي 2–3 أسباب من عمود "أسباب" (مثال: يناسب تحليل بشرتكِ + تقييم عالي + شائع بالحجوزات).

## بيانات حقيقية (من Supabase)
${brainContext}
${extraLegacy}

## ممنوع
- اختلاق أسماء صالونات أو أسعار أو أرقام غير موجودة في البيانات أعلاه.
- استخدام الإنجليزية في الرد النهائي (ما عدا معرفات uuid إن لزم).`

    const messagesForApi: OpenAIChatMessage[] = [{ role: 'system', content: systemMain }]

    for (const m of historyMsgs) {
      if (m.role === 'user' || m.role === 'assistant') {
        messagesForApi.push({ role: m.role, content: m.content })
      }
    }

    if (hasImage) {
      const dataUrl = `data:${body.imageMimeType};base64,${body.imageBase64}`
      let patched = false
      for (let i = messagesForApi.length - 1; i >= 0; i--) {
        if (messagesForApi[i].role === 'user') {
          const prev = messagesForApi[i].content
          const text = typeof prev === 'string' ? prev : ''
          messagesForApi[i] = {
            role: 'user',
            content: [
              { type: 'text', text },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          }
          patched = true
          break
        }
      }
      if (!patched) {
        messagesForApi.push({
          role: 'user',
          content: [
            { type: 'text', text: 'تحليل صورة الوجه للبشرة والعلاجات المقترحة (بدون حفظ الصورة)' },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        })
      }
    }

    const reply = await openaiComplete(apiKey, messagesForApi, 1400)

    let bookingAction: {
      action: 'booking'
      salon_id: string | null
      service_id: string | null
      booking_date: string | null
      suggested_slots: string[]
    } | null = null

    if (intent === 'booking_request') {
      const salonCatalog = salons.map((s) => ({ id: s.id, name: s.name_ar })).slice(0, 20)
      const svcCatalog = services.map((s) => ({ id: s.id, business_id: s.business_id, name: s.name_ar })).slice(0, 30)
      try {
        const extracted = await openaiJson<BookingExtract>(
          apiKey,
          `Extract booking fields as JSON only: {"salon_id":string|null,"service_id":string|null,"booking_date":"YYYY-MM-DD"|null}
Rules:
- salon_id and service_id MUST be copied exactly from the catalog UUIDs if mentioned; otherwise null.
- booking_date: normalize Arabic dates to ISO date (assume Asia/Riyadh today context if year missing — use next occurrence).
- If unsure, use null.`,
          `Catalog salons: ${JSON.stringify(salonCatalog)}
Catalog services: ${JSON.stringify(svcCatalog)}
Recent conversation (last user + assistant):\n${utterance}\n---\nAssistant draft reply:\n${reply.slice(0, 800)}`,
          300
        )

        const sid = extracted.salon_id && salons.some((s) => s.id === extracted.salon_id) ? extracted.salon_id : null
        let svcId = extracted.service_id && services.some((s) => s.id === extracted.service_id) ? extracted.service_id : null
        if (svcId && sid && services.find((s) => s.id === svcId)?.business_id !== sid) {
          svcId = null
        }
        const dateOk = extracted.booking_date && /^\d{4}-\d{2}-\d{2}$/.test(extracted.booking_date) ? extracted.booking_date : null

        const salonForSlots = sid ? salons.find((s) => s.id === sid) : null
        const slots = salonForSlots ? pickSlotsFromOpeningHours(salonForSlots.opening_hours) : defaultSlots()

        if (sid) {
          bookingAction = {
            action: 'booking',
            salon_id: sid,
            service_id: svcId,
            booking_date: dateOk,
            suggested_slots: slots,
          }
        }
      } catch (e) {
        console.warn('[rozi-chat] booking extract', e)
      }
    }

    return new Response(
      JSON.stringify({
        reply,
        brain: { intent, entities },
        action: bookingAction,
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'خطأ غير متوقع'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
