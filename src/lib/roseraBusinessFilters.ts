import type { Business } from '@/lib/supabase'
import { haversineKm } from '@/lib/utils'

/** إشارة صريحة لنسائي / عائلي — Google يصنّف كثير من الحلاقة الرجالية كـ beauty_salon */
export function hasFemaleOrFamilyBeautySignal(
  b: Pick<Business, 'name_ar' | 'name_en' | 'category_label'>
): boolean {
  const blob = [b.name_ar, b.name_en, b.category_label].filter(Boolean).join(' ')
  if (!blob.trim()) return false
  if (/نسائي|للنساء|للسيدات|سيدات|مشغل\s*نسائي|صالون\s*نسائي|للعائلة|عائلي|أمومة|أطفال|بنات|فتيات/i.test(blob))
    return true
  const low = blob.toLowerCase()
  if (/\bladies\b|\blady\b|\bwomen\b|\bwoman\b|\bfemale\b|\bfamily\b|\bgirls\b/i.test(low)) return true
  if (b.category_label && /نسائي|سيدات|للعائلة/i.test(b.category_label)) return true
  return false
}

/** استبعاد منشآت الحلاقة / الخدمات الرجالية من عرض روزيرا (نسائي). */
export function isMaleOnlyBeautyBusiness(
  b: Pick<Business, 'name_ar' | 'name_en' | 'category_label' | 'category'>
): boolean {
  const blob = [b.name_ar, b.name_en, b.category_label, b.category].filter(Boolean).join(' ')
  if (!blob.trim()) return false
  if (/حلاقة\s*رجال|حلاق\s*رجال|صالونات\s*حلاقة\s*رجال|حلاقة\s*رجالية|رجالي\s*فقط|للرجال|رجال\s*فقط|حلاق\s*رجالي/i.test(blob))
    return true
  if (b.category_label && /حلاقة\s*رج|رجالي/i.test(b.category_label)) return true
  const low = blob.toLowerCase()
  if (/\bbarbershop\b|\bgents\b|\bmen'?s\s+salon\b|\bmale\s+only\b|\bfor\s+men\b|\bmen'?s\s+barber/i.test(low))
    return true
  if (/\bbarber\b/i.test(low) && !/women|ladies|نسائي|سيدات|female|lady/i.test(low)) return true
  if ((/حلاق|صالون\s*حلاق/i.test(blob) || /\bbarbers?\b/i.test(low)) && !/نسائي|للنساء|سيدات|ladies|women|female|lady/i.test(blob))
    return true
  return false
}

/** صالات رياضية وأندية — خارج نطاق روزيرا (نسائي / عائلي تجميل). */
export function isGymOrFitnessListing(
  b: Pick<Business, 'name_ar' | 'name_en' | 'category_label' | 'category'>
): boolean {
  const blob = [b.name_ar, b.name_en, b.category_label, b.category].filter(Boolean).join(' ')
  if (!blob.trim()) return false
  if (/نادي رياضي|صالة رياضية|رياضة ولياقة|لياقة بدنية|كروسفت/i.test(blob)) return true
  const low = blob.toLowerCase()
  if (/\bgym\b|\bfitness\b|\bcrossfit\b|\bgolds gym\b|\bplanet fitness\b/i.test(low)) return true
  return false
}

function normName(b: Business): string {
  return (b.name_ar || b.name_en || '').trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 80)
}

function isGoogleRow(x: Business): boolean {
  return Boolean((x as { is_google_place?: boolean }).is_google_place) || String(x.id).startsWith('gplace:')
}

function isNearDuplicateName(a: Business, b: Business): boolean {
  if (String(a.id) === String(b.id)) return true
  const lat = Number(a.latitude)
  const lng = Number(a.longitude)
  const la = Number(b.latitude)
  const ln = Number(b.longitude)
  if (![lat, lng, la, ln].every(Number.isFinite)) return false
  if (haversineKm(lat, lng, la, ln) > 0.08) return false
  const na = normName(a)
  const nb = normName(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

/**
 * دمج صفوف من Supabase + Google بدون تكرار: يُفضَّل صف قاعدة البيانات على نتيجة Google عند التطابق.
 */
export function dedupeBusinessesForDisplay(rows: Business[]): Business[] {
  const sorted = [...rows].sort((a, b) => {
    const ga = isGoogleRow(a) ? 1 : 0
    const gb = isGoogleRow(b) ? 1 : 0
    return ga - gb
  })
  const out: Business[] = []
  for (const b of sorted) {
    if (out.some((k) => isNearDuplicateName(k, b))) continue
    out.push(b)
  }
  return out
}

/** صالون بدون إشارة نسائية — غالباً حلاقة رجالية في Google تحت beauty_salon */
function isAmbiguousSalonNeedingFemaleSignal(b: Business): boolean {
  if (b.google_place_id && b.source_type === 'provider_api') return false
  const cat = (b.category || '').toLowerCase().trim()
  if (cat === 'spa' || cat === 'clinic') return false
  if ((b.category_label || '').includes('نسائي')) return false
  if ((b.category_label || '').includes('روزيرا')) return false
  if ((b.description_ar || '').includes('[RoseraExclusive:')) return false
  return cat === 'salon' || cat === ''
}

export function filterFemaleBeautyBusinesses(rows: Business[]): Business[] {
  return rows.filter((b) => {
    if (isMaleOnlyBeautyBusiness(b) || isGymOrFitnessListing(b)) return false
    if (isAmbiguousSalonNeedingFemaleSignal(b) && !hasFemaleOrFamilyBeautySignal(b)) return false
    return true
  })
}
