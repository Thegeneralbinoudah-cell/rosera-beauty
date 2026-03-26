import { useEffect, useId, useRef, useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

const MOYASAR_PK = (import.meta.env.VITE_MOYASAR_PUBLISHABLE_KEY as string | undefined)?.trim()
const PAYMENT_MODE_FREE = ((import.meta.env.VITE_PAYMENT_MODE as string) || '').trim().toLowerCase() === 'free'
const IS_PRODUCTION = import.meta.env.PROD

const MOYASAR_APPLE_PAY_LABEL =
  (import.meta.env.VITE_MOYASAR_APPLE_PAY_LABEL as string | undefined)?.trim() || 'Beauty Hub Saudi'

function detectApplePayAvailable(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const ApplePaySession = (
      window as unknown as { ApplePaySession?: { canMakePayments: () => boolean } }
    ).ApplePaySession
    if (!ApplePaySession || typeof ApplePaySession.canMakePayments !== 'function') return false
    return Boolean(ApplePaySession.canMakePayments())
  } catch {
    return false
  }
}

/** iPhone / iPod / iPad (incl. iPadOS reporting as Mac) — used to prioritize Apple Pay in the methods list. */
function detectAppleMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPhone|iPod/i.test(ua)) return true
  if (/iPad/i.test(ua)) return true
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true
  return false
}

export type PaymentResult = {
  payment_status: 'free' | 'paid'
  payment_id?: string
}

type CheckoutPaymentMethod = 'mada' | 'visa' | 'apple' | string

export type PaymentFormProps = {
  type: 'booking' | 'order' | 'subscription' | 'salon_ad'
  amount: number
  description: string
  refId: string | null
  /** يُضاف لرابط callback لصفحة الدفع — يسمح بالعودة لمسار الحجز عند الفشل */
  bookingSalonId?: string | null
  checkoutPaymentMethod?: CheckoutPaymentMethod
  onSuccess: (result: PaymentResult) => void
  onPending?: (refId: string) => void
  onError?: (message: string) => void
  disabled?: boolean
}

type MoyasarPayment = { id: string; status: string }

type MoyasarInitOpts = {
  element: string
  amount: number
  currency: string
  description: string
  publishable_api_key: string
  callback_url: string
  methods: string[]
  supported_networks?: string[]
  fixed_width?: boolean
  language?: string
  /** Tokenization for subscription renewals (requires Moyasar tokenization on the account). */
  credit_card?: { save_card?: boolean }
  apple_pay?: {
    country: string
    label: string
    validate_merchant_url: string
    supported_countries?: string[]
  }
  on_completed?: (payment: MoyasarPayment) => Promise<void>
}

declare global {
  interface Window {
    Moyasar?: {
      init: (opts: MoyasarInitOpts) => void
    }
  }
}

function buildMoyasarMethods(
  checkoutPaymentMethod: CheckoutPaymentMethod | undefined,
  applePayAvailable: boolean,
  appleMobile: boolean
): string[] {
  const m = checkoutPaymentMethod ?? 'mada'
  const cardAndStc: string[] = ['creditcard', 'stcpay']

  if (!applePayAvailable) return cardAndStc

  if (m === 'apple' || appleMobile) {
    return ['applepay', 'creditcard', 'stcpay']
  }

  return ['creditcard', 'applepay', 'stcpay']
}

function buildSupportedNetworks(checkoutPaymentMethod?: CheckoutPaymentMethod): string[] {
  const m = checkoutPaymentMethod ?? 'mada'
  if (m === 'visa') return ['visa', 'mastercard', 'mada']
  return ['mada', 'visa', 'mastercard']
}

export default function PaymentForm({
  type,
  amount,
  description,
  refId,
  bookingSalonId,
  checkoutPaymentMethod = 'mada',
  onSuccess,
  onPending,
  onError,
  disabled,
}: PaymentFormProps) {
  const reactId = useId().replace(/:/g, '')
  /** يتغير عند «إعادة المحاولة» لإعادة تهيئة ويدجت Moyasar */
  const [widgetKey, setWidgetKey] = useState(0)
  const hostId = `mysr-host-${type}-${reactId}-${widgetKey}`
  const containerRef = useRef<HTMLDivElement>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const initOnceRef = useRef(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [applePayAvailable] = useState(detectApplePayAvailable)
  const [appleMobile] = useState(detectAppleMobileDevice)

  const moyasarKeyOk = Boolean(
    MOYASAR_PK && (!IS_PRODUCTION || MOYASAR_PK.startsWith('pk_live_'))
  )

  const reportError = useCallback(
    (msg: string) => {
      setLocalError(msg)
      onError?.(msg)
    },
    [onError]
  )

  useEffect(() => {
    setLocalError(null)
  }, [refId, amount, type, checkoutPaymentMethod])

  const useMoyasar = Boolean(MOYASAR_PK && moyasarKeyOk && !PAYMENT_MODE_FREE)

  useEffect(() => {
    if (!useMoyasar || !refId || !containerRef.current) return
    const loadScript = () => {
      if (window.Moyasar) {
        setScriptLoaded(true)
        return
      }
      const script = document.createElement('script')
      script.src = 'https://cdn.moyasar.com/moyasar.js'
      script.async = true
      script.onload = () => setScriptLoaded(true)
      script.onerror = () => reportError('تعذر تحميل بوابة الدفع')
      document.head.appendChild(script)
    }
    loadScript()
  }, [refId, useMoyasar, reportError])

  useEffect(() => {
    initOnceRef.current = false
  }, [refId, amount, description, type, checkoutPaymentMethod, useMoyasar, widgetKey])

  useEffect(() => {
    if (!useMoyasar || !scriptLoaded || !window.Moyasar || !MOYASAR_PK || !refId) return
    if (initOnceRef.current) return
    const el = containerRef.current
    if (!el) return

    initOnceRef.current = true
    el.innerHTML = ''
    const base = window.location.origin
    const salonQ =
      type === 'booking' && bookingSalonId && String(bookingSalonId).trim()
        ? `&salon=${encodeURIComponent(String(bookingSalonId).trim())}`
        : ''
    const callbackUrl = `${base}/payment/callback?type=${encodeURIComponent(type)}&ref=${encodeURIComponent(refId)}${salonQ}`

    const amountHalalas = Math.max(0, Math.round(Number(amount) * 100))

    const methods = buildMoyasarMethods(checkoutPaymentMethod, applePayAvailable, appleMobile)

    const opts: MoyasarInitOpts = {
      element: `#${hostId}`,
      amount: amountHalalas,
      currency: 'SAR',
      description,
      publishable_api_key: MOYASAR_PK,
      callback_url: callbackUrl,
      methods,
      supported_networks: buildSupportedNetworks(checkoutPaymentMethod),
      fixed_width: false,
      language: 'ar',
      ...(type === 'subscription' ? { credit_card: { save_card: true } } : {}),
      ...(applePayAvailable
        ? {
            apple_pay: {
              country: 'SA',
              label: MOYASAR_APPLE_PAY_LABEL,
              validate_merchant_url: 'https://api.moyasar.com/v1/applepay/initiate',
              supported_countries: ['SA'],
            },
          }
        : {}),
      on_completed: async (payment: MoyasarPayment) => {
        if (payment?.status === 'paid' || payment?.status === 'authorized') {
          const pid = payment?.id != null ? String(payment.id).trim() : ''
          if (!pid) {
            console.error('[PaymentForm] Moyasar on_completed without payment id', { type, refId, status: payment?.status })
            reportError('لم يُستلم رقم عملية الدفع')
            return
          }
          window.location.assign(
            `${base}/payment/callback?type=${encodeURIComponent(type)}&ref=${encodeURIComponent(refId)}&id=${encodeURIComponent(pid)}${salonQ}`
          )
        }
      },
    }

    try {
      window.Moyasar.init(opts)
    } catch (e) {
      initOnceRef.current = false
      reportError(e instanceof Error ? e.message : 'فشل تهيئة الدفع')
    }
  }, [
    type,
    amount,
    description,
    refId,
    scriptLoaded,
    checkoutPaymentMethod,
    applePayAvailable,
    appleMobile,
    useMoyasar,
    reportError,
    hostId,
    bookingSalonId,
  ])

  if (PAYMENT_MODE_FREE || !MOYASAR_PK) {
    if (!PAYMENT_MODE_FREE && !MOYASAR_PK) {
      return (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5">
          <p className="text-center text-sm text-destructive">
            عرّفي <code className="rounded bg-destructive/15 px-1">VITE_MOYASAR_PUBLISHABLE_KEY</code> في البيئة، أو فعّلي{' '}
            <code className="rounded bg-destructive/15 px-1">VITE_PAYMENT_MODE=free</code> للتجربة.
          </p>
        </div>
      )
    }
    return (
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <p className="text-center font-semibold text-foreground">الدفع التجريبي — بدون بطاقة</p>
        <Button
          className="mt-4 w-full rounded-2xl"
          disabled={disabled}
          onClick={() => onSuccess({ payment_status: 'free' })}
        >
          تأكيد
        </Button>
      </div>
    )
  }

  if (!moyasarKeyOk) {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5">
        <p className="text-center text-sm text-destructive">
          في الإنتاج يجب استخدام مفتاح يبدأ بـ <code className="rounded bg-destructive/15 px-1">pk_live_</code>
        </p>
      </div>
    )
  }

  if (!refId) {
    return (
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <p className="text-center text-sm text-muted-foreground">جاري تجهيز الطلب...</p>
        <Button
          className="mt-4 w-full rounded-2xl"
          disabled={disabled}
          onClick={() => onPending?.('')}
        >
          متابعة للدفع
        </Button>
      </div>
    )
  }

  const retryWidget = () => {
    initOnceRef.current = false
    setLocalError(null)
    setWidgetKey((k) => k + 1)
  }

  return (
    <div className="space-y-4">
      {localError ? (
        <div className="space-y-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-4 text-center">
          <p className="text-sm text-destructive">{localError}</p>
          <Button type="button" variant="outline" className="rounded-xl" onClick={retryWidget}>
            إعادة المحاولة
          </Button>
        </div>
      ) : null}
      <p className="text-center text-sm font-semibold text-foreground">الدفع الآمن 🔒</p>
      <p className="text-center text-xs text-muted-foreground">
        البطاقة وApple Pay وSTC Pay تُعالج عبر Moyasar — لا نخزّن بيانات الدفع.
      </p>
      <div className="flex flex-wrap items-stretch justify-center gap-2">
        <div className="flex min-h-[44px] min-w-[7.5rem] flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 border-primary/20 bg-gradient-to-b from-pink-50/90 to-white px-3 py-2 text-center shadow-sm dark:from-pink-950/40 dark:to-card">
          <span className="text-base" aria-hidden>
            💳
          </span>
          <span className="text-sm font-bold text-foreground">بطاقة</span>
        </div>
        {applePayAvailable ? (
          <div className="flex min-h-[44px] min-w-[7.5rem] flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 border-black/10 bg-black px-3 py-2 text-center shadow-sm dark:border-white/20">
            <span className="text-base" aria-hidden>
              🍎
            </span>
            <span className="text-sm font-extrabold text-white">Apple Pay</span>
          </div>
        ) : null}
        <div className="flex min-h-[44px] min-w-[7.5rem] flex-1 items-center justify-center gap-1.5 rounded-2xl border-2 border-[#4f008c]/25 bg-gradient-to-b from-violet-50/90 to-white px-3 py-2 text-center shadow-sm dark:from-violet-950/35 dark:to-card">
          <span className="text-base" aria-hidden>
            📱
          </span>
          <span className="text-sm font-bold text-[#4f008c] dark:text-violet-200">STC Pay</span>
        </div>
      </div>
      {!scriptLoaded ? (
        <div className="flex flex-col items-center justify-center gap-2 py-6">
          <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
          <p className="text-center text-sm text-muted-foreground">جاري تحميل نموذج الدفع…</p>
        </div>
      ) : null}
      <div
        id={hostId}
        ref={containerRef}
        className="mysr-form min-h-[280px] w-full max-w-full rounded-2xl border-2 border-primary/15 bg-white p-3 shadow-inner dark:border-primary/25 dark:bg-[#14141c] sm:p-5"
      />
    </div>
  )
}
