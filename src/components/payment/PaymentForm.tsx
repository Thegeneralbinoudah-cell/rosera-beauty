import { useEffect, useId, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'

const MOYASAR_PK = (import.meta.env.VITE_MOYASAR_PUBLISHABLE_KEY as string | undefined)?.trim()
const PAYMENT_MODE_FREE = ((import.meta.env.VITE_PAYMENT_MODE as string) || '').trim().toLowerCase() === 'free'
const IS_PRODUCTION = import.meta.env.PROD

export type PaymentResult = {
  payment_status: 'free' | 'paid'
  payment_id?: string
}

type CheckoutPaymentMethod = 'mada' | 'visa' | 'apple' | 'tamara' | string

export type PaymentFormProps = {
  type: 'booking' | 'order'
  amount: number
  description: string
  refId: string | null
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

function buildMoyasarMethods(checkoutPaymentMethod?: CheckoutPaymentMethod): string[] {
  const m = checkoutPaymentMethod ?? 'mada'
  if (m === 'apple') return ['applepay', 'creditcard']
  return ['creditcard', 'applepay']
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
  checkoutPaymentMethod = 'mada',
  onSuccess,
  onPending,
  onError,
  disabled,
}: PaymentFormProps) {
  const reactId = useId().replace(/:/g, '')
  const hostIdRef = useRef(`mysr-host-${type}-${reactId}`)
  const containerRef = useRef<HTMLDivElement>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const initOnceRef = useRef(false)
  const [localError, setLocalError] = useState<string | null>(null)

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
  }, [refId, amount, description, type, checkoutPaymentMethod, useMoyasar])

  useEffect(() => {
    if (!useMoyasar || !scriptLoaded || !window.Moyasar || !MOYASAR_PK || !refId) return
    if (initOnceRef.current) return
    const el = containerRef.current
    if (!el) return

    initOnceRef.current = true
    el.innerHTML = ''
    const base = window.location.origin
    const callbackUrl = `${base}/payment/callback?type=${encodeURIComponent(type)}&ref=${encodeURIComponent(refId)}`

    const amountHalalas = Math.max(0, Math.round(Number(amount) * 100))

    const opts: MoyasarInitOpts = {
      element: `#${hostIdRef.current}`,
      amount: amountHalalas,
      currency: 'SAR',
      description,
      publishable_api_key: MOYASAR_PK,
      callback_url: callbackUrl,
      methods: buildMoyasarMethods(checkoutPaymentMethod),
      supported_networks: buildSupportedNetworks(checkoutPaymentMethod),
      fixed_width: false,
      language: 'ar',
      apple_pay: {
        country: 'SA',
        label: 'Rosera',
        validate_merchant_url: 'https://api.moyasar.com/v1/applepay/initiate',
        supported_countries: ['SA'],
      },
      on_completed: async (payment: MoyasarPayment) => {
        if (payment?.status === 'paid' || payment?.status === 'authorized') {
          window.location.assign(
            `${base}/payment/callback?type=${encodeURIComponent(type)}&ref=${encodeURIComponent(refId)}&id=${encodeURIComponent(payment.id)}`
          )
        }
      },
    }

    try {
      window.Moyasar.init(opts)
    } catch (e) {
      initOnceRef.current = false
      reportError(e instanceof Error ? e.message : 'فشل تهيئة الدفع')
      console.error('[PaymentForm] Moyasar.init', e)
    }
  }, [
    type,
    amount,
    description,
    refId,
    scriptLoaded,
    checkoutPaymentMethod,
    useMoyasar,
    reportError,
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
          className="mt-4 w-full rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]"
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
          className="mt-4 w-full rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]"
          disabled={disabled}
          onClick={() => onPending?.('')}
        >
          متابعة للدفع
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {localError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
          {localError}
        </div>
      ) : null}
      {checkoutPaymentMethod === 'tamara' && (
        <p className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-center text-sm text-foreground">
          تمارا: أكملي الدفع عبر <strong>مدى</strong> أو <strong>بطاقة</strong> أو <strong>Apple Pay</strong> في النموذج أدناه.
        </p>
      )}
      <p className="text-center text-xs text-muted-foreground">
        البطاقة والاسم والصلاحية والرمز تُعالج عبر Moyasar — لا نخزّن بيانات البطاقة.
      </p>
      <div className="flex flex-wrap items-stretch justify-center gap-2">
        <div className="flex min-h-[44px] min-w-[7.5rem] flex-1 items-center justify-center rounded-2xl border-2 border-[#00A859]/45 bg-gradient-to-b from-[#e8f8ef] to-white px-3 py-2 text-center shadow-sm dark:from-[#0d2818] dark:to-card">
          <span className="text-sm font-extrabold tracking-tight text-[#006b3c] dark:text-[#6ee7a8]">مدى Mada</span>
        </div>
        <div className="flex min-h-[44px] min-w-[7.5rem] flex-1 items-center justify-center rounded-2xl border-2 border-black/10 bg-black px-3 py-2 text-center shadow-sm dark:border-white/20">
          <span className="text-sm font-extrabold text-white">Apple Pay</span>
        </div>
      </div>
      {!scriptLoaded && (
        <p className="text-center text-sm text-muted-foreground">جاري تحميل نموذج الدفع...</p>
      )}
      <div
        id={hostIdRef.current}
        ref={containerRef}
        className="mysr-form min-h-[280px] w-full max-w-full rounded-2xl border-2 border-primary/15 bg-white p-3 shadow-inner dark:border-primary/25 dark:bg-[#14141c] sm:p-5"
      />
    </div>
  )
}
