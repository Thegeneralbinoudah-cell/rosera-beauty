/** مسار ما بعد تسجيل الدخول (تسجيل صالون سريع) */
export const POST_AUTH_PATH_KEY = 'rosera_post_auth_path'

/** يقرأ ويمسح مساراً داخلياً آمناً (مثل /for-salons/onboard) بعد تسجيل الدخول */
export function consumePostAuthPath(): string | null {
  try {
    const p = sessionStorage.getItem(POST_AUTH_PATH_KEY)
    if (p && p.startsWith('/') && !p.startsWith('//')) {
      sessionStorage.removeItem(POST_AUTH_PATH_KEY)
      return p
    }
  } catch {
    /* ignore */
  }
  return null
}

/** تخزين محلي: بداية مسار اكتساب الصالون (لعرض تحويل بعد 7 أيام) */
export function acquisitionFunnelKey(businessId: string): string {
  return `rosera_salon_acquisition_${businessId}`
}

export function setAcquisitionFunnelStart(businessId: string): void {
  try {
    localStorage.setItem(acquisitionFunnelKey(businessId), new Date().toISOString())
  } catch {
    /* ignore */
  }
}

export function getAcquisitionFunnelStart(businessId: string): string | null {
  try {
    return localStorage.getItem(acquisitionFunnelKey(businessId))
  } catch {
    return null
  }
}

const DISMISS_KEY = 'rosera_salon_upgrade_pitch_dismissed'

export function isUpgradePitchDismissed(businessId: string): boolean {
  try {
    return sessionStorage.getItem(`${DISMISS_KEY}_${businessId}`) === '1'
  } catch {
    return false
  }
}

export function dismissUpgradePitch(businessId: string): void {
  try {
    sessionStorage.setItem(`${DISMISS_KEY}_${businessId}`, '1')
  } catch {
    /* ignore */
  }
}

/** إحداثيات تقريبية للمدن — للتسجيل السريع بدون خريطة */
export const SAUDI_CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  الرياض: { lat: 24.7136, lng: 46.6753 },
  جدة: { lat: 21.4858, lng: 39.1925 },
  الدمام: { lat: 26.4207, lng: 50.0888 },
  الخبر: { lat: 26.2172, lng: 50.1971 },
  مكة: { lat: 21.3891, lng: 39.8579 },
  المدينة: { lat: 24.5247, lng: 39.5692 },
  الطائف: { lat: 21.2703, lng: 40.4158 },
  أبها: { lat: 18.2164, lng: 42.5043 },
  تبوك: { lat: 28.3998, lng: 36.5705 },
  بريدة: { lat: 26.326, lng: 43.975 },
  خميس: { lat: 18.3, lng: 42.73 },
  نجران: { lat: 17.565, lng: 44.229 },
}

export const ACQUISITION_CITY_OPTIONS = Object.keys(SAUDI_CITY_COORDS).sort((a, b) => a.localeCompare(b, 'ar'))

export function coordsForCity(city: string): { lat: number; lng: number } {
  const t = city.trim()
  if (SAUDI_CITY_COORDS[t]) return SAUDI_CITY_COORDS[t]
  return SAUDI_CITY_COORDS['الرياض']
}

export function defaultSalonHoursPayload(): { day: number; open: string; close: string; closed: boolean }[] {
  return Array.from({ length: 7 }, (_, day) => ({
    day,
    open: '10:00',
    close: '22:00',
    closed: false,
  }))
}

/** رقم واتساب دعم اكتساب الصالونات — بدون + أو مسافات */
export function salonAcquisitionWhatsAppDigits(): string {
  const raw = (import.meta.env.VITE_SALON_ACQUISITION_WHATSAPP as string | undefined)?.replace(/\D/g, '') ?? ''
  return raw.length >= 9 ? raw : '966500000000'
}

export function salonAcquisitionWhatsAppUrl(): string {
  const d = salonAcquisitionWhatsAppDigits()
  const text = encodeURIComponent('مرحباً روزيرا، أبغى أفعّل باقة صالوني')
  return `https://wa.me/${d}?text=${text}`
}

export function openSalonAcquisitionWhatsApp(): void {
  if (typeof window === 'undefined') return
  window.open(salonAcquisitionWhatsAppUrl(), '_blank', 'noopener,noreferrer')
}
