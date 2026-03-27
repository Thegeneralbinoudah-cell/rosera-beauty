import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { colors } from '@/theme/tokens'

function CheckoutInner({
  returnUrl,
  onPaid,
  onError,
  disabled,
}: {
  returnUrl: string
  onPaid: () => Promise<void>
  onError: (m: string) => void
  disabled?: boolean
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements || disabled) return
    setBusy(true)
    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: 'if_required',
      })
      if (error) {
        onError(error.message || 'فشل الدفع')
        return
      }
      await onPaid()
    } catch (err) {
      onError(err instanceof Error ? err.message : 'حدث خطأ')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={(ev) => void handleSubmit(ev)} className="space-y-4">
      <PaymentElement
        options={{
          layout: { type: 'tabs', defaultCollapsed: false },
          wallets: { applePay: 'auto', googlePay: 'auto' },
        }}
      />
      <Button
        type="submit"
        disabled={!stripe || busy || disabled}
        className="w-full rounded-xl gradient-primary"
      >
        {busy ? (
          <>
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
            جاري المعالجة…
          </>
        ) : (
          'ادفع والاشتراك'
        )}
      </Button>
    </form>
  )
}

type Props = {
  publishableKey: string
  subscriptionId: string
  returnUrl?: string
  disabled?: boolean
  onPaid: () => Promise<void>
  onError: (message: string) => void
}

export default function SalonStripeSubscriptionForm({
  publishableKey,
  subscriptionId,
  returnUrl,
  disabled,
  onPaid,
  onError,
}: Props) {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey])
  const resolvedReturn = returnUrl ?? `${window.location.origin}/salon/subscription`

  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [initError, setInitError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setInitError(null)
      setClientSecret(null)
      const { data, error } = await supabase.functions.invoke('create-subscription', {
        body: { salon_subscription_id: subscriptionId },
      })
      if (cancelled) return
      const errMsg = (data as { error?: string })?.error
      if (error || errMsg) {
        setInitError(errMsg || error?.message || 'تعذر بدء جلسة الدفع')
        setClientSecret(null)
      } else {
        const secret = (data as { clientSecret?: string }).clientSecret
        setClientSecret(secret && secret.length > 0 ? secret : null)
        if (!secret) setInitError('لم يُرجع مفتاح الدفع')
      }
      setLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [subscriptionId])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        جاري تجهيز الدفع…
      </div>
    )
  }

  if (initError || !clientSecret) {
    return <p className="text-sm text-destructive">{initError || 'تعذر تحميل Stripe'}</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-center text-sm text-muted-foreground">
        💳 بطاقة · 🍎 Apple Pay <span className="text-xs">(يظهر Apple Pay عند الدعم على الجهاز والمتصفح)</span>
      </p>
      <Elements
        stripe={stripePromise}
        options={{
          clientSecret,
          appearance: {
            theme: 'stripe',
            variables: {
              colorPrimary: colors.primary,
              borderRadius: '12px',
            },
          },
        }}
      >
        <CheckoutInner returnUrl={resolvedReturn} onPaid={onPaid} onError={onError} disabled={disabled} />
      </Elements>
    </div>
  )
}
