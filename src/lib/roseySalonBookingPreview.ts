import { supabase } from '@/lib/supabase'

export type RosySalonBookingPreview = {
  serviceCount: number
  /** أول خدمة نشطة — لمسار الحجز السريع */
  firstServiceId: string | null
  /** اسم الخدمة المقترَحة (عربي) */
  firstServiceNameAr: string | null
}

/**
 * جلب معاينة خدمات الصالون لبطاقات روزي (حجز سريع عند توفر خدمات).
 * أوقات الحجز الفعلية تُحدَّد في صفحة الحجز؛ هنا نكتفي بوجود خدمات قابلة للحجز.
 */
export async function fetchRosySalonBookingPreview(salonIds: string[]): Promise<Map<string, RosySalonBookingPreview>> {
  const out = new Map<string, RosySalonBookingPreview>()
  const ids = [...new Set(salonIds.filter(Boolean))]
  for (const id of ids) {
    out.set(id, { serviceCount: 0, firstServiceId: null, firstServiceNameAr: null })
  }
  if (ids.length === 0) return out

  const { data, error } = await supabase
    .from('services')
    .select('id, business_id, name_ar')
    .in('business_id', ids)
    .eq('is_active', true)
    .eq('is_demo', false)
    .order('name_ar', { ascending: true })

  if (error || !data?.length) return out

  for (const row of data as { id: string; business_id: string; name_ar: string }[]) {
    const bid = row.business_id
    if (!bid) continue
    const cur = out.get(bid) ?? { serviceCount: 0, firstServiceId: null, firstServiceNameAr: null }
    cur.serviceCount += 1
    if (!cur.firstServiceId) {
      cur.firstServiceId = row.id
      cur.firstServiceNameAr = typeof row.name_ar === 'string' && row.name_ar.trim() ? row.name_ar.trim() : null
    }
    out.set(bid, cur)
  }
  return out
}
