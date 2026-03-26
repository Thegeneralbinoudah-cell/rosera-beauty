/** Readable district + city line for cards (Arabic UI). */
export function formatDistrictCityLine(
  addressAr: string | null | undefined,
  city: string | null | undefined
): string {
  const district = addressAr?.split(/[،,]/)[0]?.trim() || ''
  const c = city?.trim() || ''
  if (district && c && district !== c) return `📍 ${district} — ${c}`
  if (c) return `📍 ${c}`
  if (district) return `📍 ${district}`
  return ''
}
