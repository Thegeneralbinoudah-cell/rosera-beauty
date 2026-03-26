import type { Business } from '@/lib/supabase'

/** Canonical Arabic labels — must stay aligned with Search filter UI and Home chips. */
export const SEARCH_BUSINESS_CATEGORY_OPTIONS: readonly {
  value: string
  key: string
}[] = [
  { value: 'صالون نسائي', key: 'search.cat.salon_female' },
  { value: 'سبا ومساج', key: 'search.cat.spa_massage' },
  { value: 'مكياج', key: 'search.cat.makeup' },
  { value: 'عناية بالبشرة', key: 'search.cat.skincare' },
  { value: 'عيادة تجميل', key: 'search.cat.clinic_beauty' },
  { value: 'عيادة جلدية', key: 'search.cat.clinic_skin' },
  { value: 'عيادة ليزر', key: 'search.cat.clinic_laser' },
  { value: 'عيادة حقن وفيلر', key: 'search.cat.clinic_filler' },
] as const

const CANONICAL_VALUES = SEARCH_BUSINESS_CATEGORY_OPTIONS.map((o) => o.value)

/** URL / legacy chip text → canonical `categoryLabel` */
const ALIASES_TO_CANONICAL: Record<string, string> = {
  'عيادة حقن': 'عيادة حقن وفيلر',
  'حقن وفيلر': 'عيادة حقن وفيلر',
}

export function normalizeArabicLabel(s: string): string {
  return s
    .replace(/\u0640/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function canonicalBusinessSearchCategoryLabel(raw: string): string {
  const n = normalizeArabicLabel(raw)
  if (!n) return ''
  return ALIASES_TO_CANONICAL[n] ?? n
}

export type ResolvedSearchCategory =
  | { ok: true; canonical: string }
  | { ok: false }

/** Unknown `categoryLabel` params do not filter (avoids mixed garbage results). */
export function resolveSearchCategoryFilter(raw: string): ResolvedSearchCategory {
  const n = normalizeArabicLabel(raw)
  if (!n) return { ok: false }
  const canonical = canonicalBusinessSearchCategoryLabel(raw)
  const c = normalizeArabicLabel(canonical)
  if (!CANONICAL_VALUES.includes(c)) return { ok: false }
  return { ok: true, canonical: c }
}

export function searchCategoryChipKind(
  canonicalLabel: string
): 'salon' | 'clinic' | null {
  const i = CANONICAL_VALUES.indexOf(normalizeArabicLabel(canonicalLabel))
  if (i < 0) return null
  return i < 4 ? 'salon' : 'clinic'
}

/**
 * Split venues for search chips: clinics (عيادة…) vs salons/spa/makeup rows.
 * Uses `category` when `category_label` is missing.
 */
export function businessSearchVenueKind(
  b: Pick<Business, 'category' | 'category_label'>
): 'clinic' | 'salon' {
  const lbl = normalizeArabicLabel(b.category_label ?? '')
  if (/^عيادة\b/.test(lbl)) return 'clinic'

  const cat = (b.category ?? '').toLowerCase().trim()
  if (
    cat === 'clinic' ||
    cat === 'doctor' ||
    cat === 'dentist' ||
    cat === 'hospital' ||
    cat.includes('clinic') ||
    cat === 'physiotherapist' ||
    cat === 'dermatologist'
  )
    return 'clinic'

  return 'salon'
}

/**
 * Strict: same bucket as the chip + `category_label` equals canonical (normalized).
 * Rows without `category_label` never match a category chip.
 */
export function businessMatchesSearchCategory(
  b: Pick<Business, 'category' | 'category_label'>,
  canonicalLabel: string
): boolean {
  const canonical = normalizeArabicLabel(canonicalLabel)
  const kind = searchCategoryChipKind(canonical)
  if (!kind) return false

  const venue = businessSearchVenueKind(b)
  if (kind === 'salon' && venue === 'clinic') return false
  if (kind === 'clinic' && venue === 'salon') return false

  const lbl = normalizeArabicLabel(b.category_label ?? '')
  if (!lbl) return false

  return lbl === canonical
}

export type OffersVenueTab = 'all' | 'salon' | 'clinic' | 'spa'

/**
 * صفحة العروض — تبويب صالونات / عيادات / سبا:
 * يستخدم نفس `businessSearchVenueKind` مثل البحث والخرائط (category + category_label العربي).
 */
export function businessMatchesOffersVenueTab(
  filter: OffersVenueTab,
  b: Pick<Business, 'category' | 'category_label'>
): boolean {
  if (filter === 'all') return true

  const cat = (b.category ?? '').toLowerCase().trim()
  const lbl = normalizeArabicLabel(b.category_label ?? '')
  const spaLabel = normalizeArabicLabel('سبا ومساج')

  if (filter === 'spa') {
    if (cat === 'spa') return true
    if (lbl && lbl === spaLabel) return true
    if (lbl && /^سبا\b/.test(lbl)) return true
    if (lbl && lbl.includes('مساج') && !/^عيادة\b/.test(lbl)) return true
    return false
  }

  if (filter === 'clinic') {
    return businessSearchVenueKind(b) === 'clinic'
  }

  if (filter === 'salon') {
    if (businessSearchVenueKind(b) === 'clinic') return false
    if (cat === 'spa') return false
    if (lbl && lbl === spaLabel) return false
    if (lbl && /^سبا\b/.test(lbl)) return false
    return businessSearchVenueKind(b) === 'salon'
  }

  return true
}
