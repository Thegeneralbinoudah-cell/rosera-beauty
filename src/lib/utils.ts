import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const STORAGE_KEYS = {
  appLaunched: 'rosera_app_launched',
  onboarding: 'rosera_onboarding_done',
  guest: 'rosera_guest',
  city: 'rosera_city',
  dark: 'rosera_dark',
  lang: 'rosera_lang',
  /** لا تُعرَض نافذة «ثبّتي التطبيق» التلقائية حتى يُعاد الضغط من الإعدادات */
  pwaNudgeDismissed: 'rosera_pwa_nudge_dismissed',
  /** نافذة التحميل الأولى — مرة واحدة فقط */
  pwaFirstVisitDone: 'rosera_pwa_first_visit_done',
  /** أول رسالة ترحيب من روزي في الدردشة — مرة واحدة لكل متصفح */
  roseraRosyFirstWelcomeShown: 'rosera_rosy_first_welcome_v1',
} as const

export function formatPrice(n: number) {
  return `${n.toLocaleString('ar-SA')} ر.س`
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))
}
