import type { RecommendSort } from '@/lib/aiRanking'
import type { RosyServiceType } from '@/lib/roseySalonSuggestions'

/** هل الرسالة تستدعي اقتراح صالونات محلياً (بدون استدعاء Edge)؟ */
export function shouldUseLocalSalonRecommend(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length < 2) return false

  const booking =
    /أبغى\s*أحجز|ابغى\s*احجز|أحجز|احجز|حجز|موعد|احجزي|أبغى\s*موعد|ابغى\s*موعد|ابغي\s*احجز|أبغي\s*أحجز/i.test(t)
  const salonWord = /صالون|صالونات|سبا|عيادة\s*تجميل/i.test(t)
  const discover = /أقرب|الأقرب|اقرب|قريب|قريبة|مني|أفضل|الأفضل|افضل|أعلى\s*تقييم|اعلى\s*تقييم|احسن|تقييم/i.test(t)
  const service =
    /أظافر|اظافر|مانيكير|بديكير|شعر|تسريح|صبغة|ليزر|إزالة\s*شعر|ازالة\s*شعر|بروتين|كيراتين|\bnails?\b/i.test(t)
  const helpFind = /ساعد|اقترح|خيارات|وين\s*ألقى|وين\s*القى|دلّيني|دليني|وريني|ورّيني|ابغى\s*صالون|أبغى\s*صالون|ابي\s*صالون|أبي\s*صالون|ابغي\s*صالون|أبغي\s*صالون/i.test(
    t
  )

  return booking || salonWord || discover || service || helpFind
}

export type LocalSalonIntent = {
  sort: RecommendSort
  serviceType: RosyServiceType | null
}

/**
 * استخراج ترتيب التفضيل ونوع الخدمة من نص المستخدم (عربي وعامية).
 * الأقرب تتغلب على «أفضل» إن وُجدت معاً بشكل صريح.
 */
export function parseLocalSalonIntent(text: string): LocalSalonIntent {
  const t = text.replace(/\s+/g, ' ').trim()

  let serviceType: RosyServiceType | null = null
  if (/أظافر|اظافر|مانيكير|بديكير|nails?/i.test(t)) serviceType = 'nails'
  else if (/شعر|تسريح|صبغة|بروتين|كيراتين|هايلايت/i.test(t)) serviceType = 'hair'
  else if (/ليزر|إزالة\s*شعر|ازالة\s*شعر/i.test(t)) serviceType = 'laser'

  const nearest = /أقرب|الأقرب|اقرب|قريب\s*مني|قريب\s*منّي|القريب|nearest/i.test(t)
  const rating =
    /أفضل|الأفضل|افضل|أعلى\s*تقييم|اعلى\s*تقييم|احسن\s*تقييم|أحسن\s*صالون|احسن\s*صالون|top\s*rated/i.test(t)

  let sort: RecommendSort = 'ai'
  if (nearest) sort = 'distance'
  else if (rating) sort = 'rating'

  return { sort, serviceType }
}
