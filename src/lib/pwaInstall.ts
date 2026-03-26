/** كشف وضع التثبيت كتطبيق (PWA) والأجهزة التي لا تدعم beforeinstallprompt */

/** حدث المتصفح غير القياسي — Chrome/Edge/Android */
export interface BeforeInstallPromptEventLike extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferredPrompt: BeforeInstallPromptEventLike | null = null
const listeners = new Set<() => void>()

function notifyDeferred() {
  for (const fn of listeners) fn()
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEventLike
    notifyDeferred()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notifyDeferred()
    void import('@/lib/analytics').then(({ trackPwaInstalled }) => {
      trackPwaInstalled()
    })
  })
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEventLike | null {
  return deferredPrompt
}

export function clearDeferredInstallPrompt() {
  deferredPrompt = null
  notifyDeferred()
}

export function subscribeDeferredInstallPrompt(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** تطبيق مثبت: PWA في نافذة standalone أو وضع iOS Safari (fullscreen من الشاشة الرئيسية) */
export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(display-mode: standalone)').matches) return true
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true
}

/**
 * iPhone / iPod / iPad في وضع الموبايل، أو iPadOS مع وضع سطح المكتب (Macintosh + لمس).
 */
export function isAppleMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (/iPhone|iPod/.test(ua)) return true
  if (/iPad/.test(ua)) return true
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

/** @deprecated prefer isAppleMobileDevice */
export function isIOSDevice(): boolean {
  return isAppleMobileDevice()
}

const IOS_OTHER_BROWSER =
  /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|Brave\/|DuckDuckGo\/|bingweb|QQBrowser|UCBrowser|SamsungBrowser/i
const IOS_IN_APP_WEBVIEW =
  /FBAN|FBAV|Instagram|Line|Snapchat|Twitter|TikTok|LinkedInApp|Pinterest|wv\)|OKHttp|Electron/i

/**
 * Safari على iPhone/iPad فقط — ليس Chrome أو Edge أو Firefox أو Opera أو متصفحات داخل التطبيقات.
 * على iOS لا يُعتمد على beforeinstallprompt؛ استخدمي دليل «شاركي ← Add to Home Screen».
 */
export function isIOSSafari(): boolean {
  if (!isAppleMobileDevice()) return false
  const ua = navigator.userAgent
  if (IOS_OTHER_BROWSER.test(ua)) return false
  if (IOS_IN_APP_WEBVIEW.test(ua)) return false
  if (!/Safari\//.test(ua)) return false
  return true
}

/** عرض دليل التثبيت اليدوي لـ Safari — التطبيق غير مثبت بعد */
export function shouldShowIOSInstallGuide(): boolean {
  return isIOSSafari() && !isStandaloneDisplayMode()
}

/** متصفح داخل تطبيق (Instagram وغيره) — التثبيت عادة غير متاح */
export function isInAppOrRestrictedBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  if (IOS_IN_APP_WEBVIEW.test(ua)) return true
  if (/; wv\)/i.test(ua)) return true
  return false
}

/** عرض ترقية التثبيت: ليس وضع تطبيق، سياق آمن، وليس متصفحاً مضمّناً */
export function isPwaInstallPromoSupported(): boolean {
  if (typeof window === 'undefined') return false
  if (isStandaloneDisplayMode()) return false
  if (isInAppOrRestrictedBrowser()) return false
  const host = window.location.hostname
  const local = host === 'localhost' || host === '127.0.0.1'
  if (!window.isSecureContext && !local) return false
  return true
}
