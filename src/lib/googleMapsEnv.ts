import { GOOGLE_MAPS_API_KEY_EMBEDDED } from '@/config/googleMapsApiKey'

/**
 * Google Maps JS + Places — الأولوية: `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`
 * (محقون من Vite define)، ثم المفتاح الثابت من `googleMapsApiKey.ts` عند فشل/فراغ env.
 */
function isUsableKey(s: string): boolean {
  const t = s.trim()
  if (t === '' || t === 'VITE_GOOGLE_MAPS_API_KEY') return false
  if (/^placeholder$/i.test(t)) return false
  return true
}

export function getGoogleMapsApiKey(): string {
  const raw = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  if (typeof raw === 'string' && isUsableKey(raw)) return raw.trim()
  return GOOGLE_MAPS_API_KEY_EMBEDDED
}

export function isGoogleMapsConfigured(): boolean {
  return getGoogleMapsApiKey().length > 0
}
