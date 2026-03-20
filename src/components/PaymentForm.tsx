import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

const PAYMENT_MODE = (import.meta.env.VITE_PAYMENT_MODE as string) || 'free'
const MOYASAR_PK = import.meta.env.VITE_MOYASAR_PUBLISHABLE_KEY as string | undefined

export type PaymentResult = {
  payment_status: 'free' | 'paid'
  payment_id?: string
}

type PaymentFormProps = {
  type: 'booking' | 'order'
  amount: number
  description: string
  refId: string | null
  onSuccess: (result: PaymentResult) => void
  onPending?: (refId: string) => void
  disabled?: boolean
}

declare global {
  interface Window {
    Moyasar?: {
      init: (opts: {
        element: string
        amount: number
        currency: string
        description: string
        publishable_api_key: string
        callback_url: string
        on_completed?: (payment: { id: string; status: string }) => Promise<void>
        methods?: string[]
      }) => void
    }
  }
}

export default function PaymentForm({
  type,
  amount,
  description,
  refId,
  onSuccess,
  onPending,
  disabled,
}: PaymentFormProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scriptLoaded, setScriptLoaded] = useState(false)

  useEffect(() => {
    if (PAYMENT_MODE !== 'live' || !MOYASAR_PK || !refId || !containerRef.current) return
    const loadScript = () => {
      if (window.Moyasar) {
        setScriptLoaded(true)
        return
      }
      const script = document.createElement('script')
      script.src = 'https://cdn.moyasar.com/moyasar.js'
      script.async = true
      script.onload = () => setScriptLoaded(true)
      document.head.appendChild(script)
    }
    loadScript()
  }, [refId])

  useEffect(() => {
    if (PAYMENT_MODE !== 'live' || !scriptLoaded || !window.Moyasar || !MOYASAR_PK || !refId || !containerRef.current) return
    const base = window.location.origin
    const callbackUrl = `${base}/payment/callback?type=${type}&ref=${encodeURIComponent(refId)}`
    window.Moyasar.init({
      element: '.mysr-form',
      amount: Math.round(amount * 100),
      currency: 'SAR',
      description,
      publishable_api_key: MOYASAR_PK,
      callback_url: callbackUrl,
      methods: ['creditcard', 'applepay'],
    })
  }, [type, amount, description, refId, scriptLoaded])

  if (PAYMENT_MODE === 'free') {
    return (
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <p className="text-center font-semibold text-foreground">الخدمة مجانية حالياً — تجربة مجانية</p>
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

  if (PAYMENT_MODE === 'live') {
    if (!MOYASAR_PK) {
      return (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-5">
          <p className="text-center text-sm text-destructive">إعدادات الدفع غير مكتملة (VITE_MOYASAR_PUBLISHABLE_KEY)</p>
        </div>
      )
    }
    if (!refId) {
      return (
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
          <p className="text-center text-sm text-muted-foreground">جاري التحضير...</p>
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
      <div ref={containerRef} className="mysr-form rounded-2xl border border-primary/10 bg-white p-4 dark:bg-card">
        {scriptLoaded ? (
          <p className="text-center text-sm text-muted-foreground">أدخلي بيانات الدفع أدناه</p>
        ) : (
          <p className="text-center text-sm text-muted-foreground">جاري تحميل نموذج الدفع...</p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
      <p className="text-center font-semibold">الخدمة مجانية حالياً — تجربة مجانية</p>
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
