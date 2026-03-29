import type { Business } from '@/lib/supabase'
import { isHomeCategoryValue, type HomeCategoryValue } from '@/lib/homeCategories'

/** Search filter dialog — 5 canonical `categoryValue` keys (aligned with Home). */
export const SEARCH_BUSINESS_CATEGORY_OPTIONS: readonly {
  categoryValue: string
  key: string
}[] = [
  { categoryValue: 'salon', key: 'search.cat.salon_female' },
  { categoryValue: 'clinic', key: 'search.cat.clinic_beauty' },
  { categoryValue: 'spa', key: 'search.cat.spa_massage' },
  { categoryValue: 'makeup', key: 'search.cat.makeup' },
  { categoryValue: 'skincare', key: 'search.cat.skincare' },
] as const

/** Legacy Arabic labels (Map, old bookmarks) — `resolveSearchCategoryFilter` / `businessMatchesSearchCategory` */
const LEGACY_CANONICAL_LABELS = [
  'صالون نسائي',
  'سبا ومساج',
  'مكياج',
  'عناية بالبشرة',
  'عيادة تجميل',
  'عيادة جلدية',
  'عيادة ليزر',
  'عيادة حقن وفيلر',
] as const

const CANONICAL_VALUES: string[] = [...LEGACY_CANONICAL_LABELS]

/** URL / legacy chip text → canonical `categoryLabel` */
const ALIASES_TO_CANONICAL: Record<string, string> = {
  'عيادة حقن': 'عيادة حقن وفيلر',
  'حقن وفيلر': 'عيادة حقن وفيلر',
  /** Home chip wording vs legacy seed label */
  'عيادات تجميل': 'عيادة تجميل',
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

const VALUE_TO_LABELS: Record<HomeCategoryValue, string[]> = {
  salon: ['صالون نسائي'],
  clinic: ['عيادات تجميل', 'عيادة تجميل'],
  spa: ['سبا ومساج'],
  makeup: ['مكياج'],
  skincare: ['عناية بالبشرة'],
}

/** Map legacy `categoryLabel` URL params → canonical `categoryValue` for Home / Search chips. */
export function legacyCategoryLabelToCategoryValue(raw: string): string | null {
  const n = normalizeArabicLabel(raw)
  const map: Record<string, HomeCategoryValue> = {
    'صالون نسائي': 'salon',
    'سبا ومساج': 'spa',
    'مكياج': 'makeup',
    'عناية بالبشرة': 'skincare',
    'عيادة تجميل': 'clinic',
    'عيادات تجميل': 'clinic',
    'عيادة جلدية': 'clinic',
    'عيادة ليزر': 'clinic',
    'عيادة حقن وفيلر': 'clinic',
    'عيادة حقن': 'clinic',
  }
  return map[n] ?? null
}

/**
 * Strict filter by `category_value` (DB) or `category` / `category_label` for one of five chips.
 * Does not mix types — e.g. clinic rows never match `salon`.
 */
export function businessMatchesCategoryValue(
  b: Pick<Business, 'category' | 'category_label'> & { category_value?: string | null },
  value: string
): boolean {
  if (!isHomeCategoryValue(value)) return false
  const v = value as HomeCategoryValue

  const cv = (b.category_value ?? '').toLowerCase().trim()
  if (cv === v) return true

  const cat = (b.category ?? '').toLowerCase().trim()
  if (cat === v) return true

  const lbl = normalizeArabicLabel(b.category_label ?? '')
  if (lbl) {
    const allowed = VALUE_TO_LABELS[v]
    if (allowed.some((a) => normalizeArabicLabel(a) === lbl)) return true
  }

  /**
   * Relaxed salon matching:
   * many legacy rows are women/family salons but not labeled exactly "صالون نسائي".
   * Keep excluding explicit clinic/spa/makeup/skincare.
   */
  if (v === 'salon') {
    if (cat === 'clinic' || cat === 'spa' || cat === 'makeup' || cat === 'skincare') return false
    if (lbl) {
      if (['سبا ومساج', 'مكياج', 'عناية بالبشرة', 'عيادات تجميل', 'عيادة تجميل'].includes(lbl)) return false
      if (/^صالون\b|^مشغل\b|نسائي|سيدات|للنساء|للعائلة|عائلي|beauty salon|ladies|women|female|family/i.test(lbl))
        return true
    }
    if (cat === 'salon' || cat === 'beauty_salon') return true
  }

  if (v === 'clinic' && cat === 'clinic') return true
  if (v === 'spa' && cat === 'spa') return true
  if (v === 'makeup' && cat === 'makeup') return true
  if (v === 'skincare' && cat === 'skincare') return true
  if (v === 'salon' && (cat === 'salon' || cat === 'beauty_salon')) return true

  return false
}
