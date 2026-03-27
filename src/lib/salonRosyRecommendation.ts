import type { Service } from '@/lib/supabase'

export type SalonRosyRecommendationSource = 'rosey_nav' | 'fallback_premium'

export type SalonRosyRecommendationResolved = {
  service: Service
  source: SalonRosyRecommendationSource
  /** نص قصير للواجهة — من حالة التنقل أو افتراضي */
  explanationAr: string
}

/**
 * يختار خدمة للبطاقة بدون استدعاء AI: نتيجة روزي من التنقل (preselect + source=rosy) أو أعلى سعر كبديل «مميز».
 */
export function resolveSalonRosyRecommendation(
  services: Service[],
  opts: {
    preselectServiceId?: string | null
    fromRosySource?: boolean
    /** من `location.state` عند تمريره من المحادثة مستقبلاً */
    customNoteAr?: string | null
  },
): SalonRosyRecommendationResolved | null {
  if (services.length === 0) return null

  const pre = opts.preselectServiceId?.trim()
  if (opts.fromRosySource && pre) {
    const svc = services.find((s) => s.id === pre)
    if (svc) {
      const explanationAr =
        opts.customNoteAr?.trim() ||
        'متناسق مع ما ناقشناه مع روزي — يمكنكِ المتابعة للحجز مباشرة.'
      return { service: svc, source: 'rosey_nav', explanationAr }
    }
  }

  /** لا يوجد تقييم لكل خدمة في الجدول — «مميز» = أعلى سعر كبديل معقول */
  const sorted = [...services].sort((a, b) => Number(b.price) - Number(a.price))
  const svc = sorted[0]
  if (!svc) return null

  return {
    service: svc,
    source: 'fallback_premium',
    explanationAr: 'اقتراح من الخدمات المتاحة — خيار بقيمة مميزة في هذا الصالون.',
  }
}

/** خدمة افتراضية عند فتح الحجز بدون `preselect` — أعلى سعر كبديل «مميز» (لا يوجد تقييم لكل خدمة في الجدول). */
export function pickDefaultServiceIdForBooking(services: Service[]): string | null {
  if (services.length === 0) return null
  const sorted = [...services].sort((a, b) => Number(b.price) - Number(a.price))
  return sorted[0]?.id ?? null
}
