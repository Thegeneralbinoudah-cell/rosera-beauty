/** Persist last explicit city from user wording for Rosy / rozi-chat context. */
export const ROZY_CHAT_LAST_CITY_KEY = 'rosera:rozyChatLastCity'

/** Map free text to canonical Arabic `businesses.city` when obvious. */
export function inferCityArFromUserText(text: string): string | null {
  const t = text.trim()
  if (!t) return null
  if (/الخبر|\bkhobar\b|al[\s-]*khobar|الخُبر/i.test(t)) return 'الخبر'
  if (/الدمام|\bdammam\b/i.test(t)) return 'الدمام'
  if (/الرياض|\briyadh\b|رياض/i.test(t)) return 'الرياض'
  if (/جدة|جده|\bjeddah\b/i.test(t)) return 'جدة'
  if (/مكة|\bmakkah\b|مكة المكرمة/i.test(t)) return 'مكة المكرمة'
  if (/المدينة|\bmedina\b|المدينة المنورة/i.test(t)) return 'المدينة المنورة'
  return null
}

/**
 * Priority: current message → profile city → last stored city from chat.
 * Does not default to Khobar; edge still applies its own default for DB filter.
 */
export function resolveClientPreferredCityForRozy(
  profileCity: string | null | undefined,
  normalizedUserMessage: string
): string | null {
  const fromMsg = inferCityArFromUserText(normalizedUserMessage)
  if (fromMsg) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(ROZY_CHAT_LAST_CITY_KEY, fromMsg)
    } catch {
      /* ignore */
    }
    return fromMsg
  }
  const p = profileCity?.trim()
  if (p) return p
  try {
    if (typeof localStorage === 'undefined') return null
    const s = localStorage.getItem(ROZY_CHAT_LAST_CITY_KEY)
    return s?.trim() || null
  } catch {
    return null
  }
}
