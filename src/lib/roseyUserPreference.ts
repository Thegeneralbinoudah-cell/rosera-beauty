import type { Business } from '@/lib/supabase'
import { businessMatchesServiceType, type RosyServiceType } from '@/lib/roseySalonSuggestions'

/** Stable keys stored in user_events.metadata.service */
export type PreferenceServiceKey = RosyServiceType | 'spa'

export type UserPreferenceSource =
  | 'salon_card_open'
  | 'salon_card_book'
  | 'salon_page_view'
  | 'favorite'
  | 'book'

export function inferPreferenceServiceKey(
  row: Pick<Business, 'category' | 'category_label' | 'name_ar' | 'name_en' | 'description_ar'>
): PreferenceServiceKey | null {
  for (const t of ['nails', 'hair', 'laser'] as const) {
    if (businessMatchesServiceType(row, t)) return t
  }
  const blob = `${row.category_label || ''} ${row.category || ''}`.toLowerCase()
  if (/spa|سبا|مساج|حمام\s*مغربي|moroccan/i.test(blob)) return 'spa'
  return null
}

export function preferenceMetaFromBusiness(
  b: Pick<Business, 'id' | 'category' | 'category_label' | 'name_ar' | 'name_en' | 'description_ar' | 'city' | 'price_range'>,
  source: UserPreferenceSource
) {
  return {
    source,
    service: inferPreferenceServiceKey(b),
    salon_id: b.id,
    price_range: b.price_range?.trim() || null,
    location: b.city?.trim() || null,
  }
}
