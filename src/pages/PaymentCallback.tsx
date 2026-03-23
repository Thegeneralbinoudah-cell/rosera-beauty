import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { trackEvent } from '@/lib/analytics'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function PaymentCallback() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'fail'>('loading')
  const [message, setMessage] = useState('')
  const [kind, setKind] = useState<'booking' | 'order' | null>(null)

  useEffect(() => {
    const type = searchParams.get('type') as 'booking' | 'order' | null
    const ref = searchParams.get('ref')
    const paymentId = searchParams.get('id') || searchParams.get('payment_id')
    const payStatus = (searchParams.get('status') || '').toLowerCase()

    if (payStatus === 'failed' || payStatus === 'failure') {
      setStatus('fail')
      setMessage('لم يكتمل الدفع')
      return
    }

    if (!type || !ref) {
      setStatus('fail')
      setMessage('رابط غير صالح')
      return
    }

    if (type !== 'booking' && type !== 'order') {
      setStatus('fail')
      setMessage('نوع العملية غير معروف')
      return
    }

    setKind(type)

    if (!paymentId) {
      setStatus('fail')
      setMessage('لم يتم استلام معرّف الدفع من Moyasar')
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { type, ref, payment_id: paymentId },
        })
        if (cancelled) return
        const err = (data as { error?: string })?.error
        if (error || err) {
          setStatus('fail')
          setMessage(err || error?.message || 'فشل التحقق من الدفع')
          return
        }
        if (type === 'booking') {
          await supabase.from('bookings').update({ payment_status: 'paid' }).eq('id', ref)
          const {
            data: { user },
          } = await supabase.auth.getUser()
          if (user?.id) {
            trackEvent({
              event_type: 'payment_success',
              entity_type: 'booking',
              entity_id: ref,
              user_id: user.id,
            })
          }
        }
        setStatus('success')
      } catch (e) {
        if (!cancelled) {
          setStatus('fail')
          setMessage(e instanceof Error ? e.message : 'حدث خطأ')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [searchParams])

  const successHref = kind === 'order' ? '/orders' : '/bookings'
  const successLabel = kind === 'order' ? 'طلباتي' : 'حجوزاتي'

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg font-semibold">جاري التحقق من الدفع...</p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-2xl font-extrabold text-foreground">تم الدفع بنجاح</h1>
        <p className="max-w-sm text-center text-muted-foreground">
          {kind === 'booking'
            ? 'تم تسجيل الحجز كمدفوع. يمكنكِ متابعة التفاصيل من حجوزاتك.'
            : 'تم تسجيل الطلب كمدفوع. شكراً لكِ.'}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button asChild className="rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]">
            <Link to={successHref}>{successLabel}</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-2xl">
            <Link to="/home">الرئيسية</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
        <XCircle className="h-12 w-12 text-destructive" />
      </div>
      <h1 className="text-2xl font-extrabold text-foreground">فشل الدفع</h1>
      <p className="max-w-sm text-center text-muted-foreground">{message}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild variant="outline" className="rounded-2xl">
          <Link to="/home">الرئيسية</Link>
        </Button>
        {kind === 'booking' ? (
          <Button asChild className="rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]">
            <Link to="/bookings">حجوزاتي</Link>
          </Button>
        ) : kind === 'order' ? (
          <Button asChild className="rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]">
            <Link to="/cart">السلة</Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
