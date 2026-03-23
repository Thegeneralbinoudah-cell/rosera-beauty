import { useEffect, useState } from 'react'
import { formatPrice } from '@/lib/utils'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { trackEvent } from '@/lib/analytics'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

type PayKind = 'booking' | 'order' | 'subscription' | 'salon_ad' | 'subscription_renewal_cron' | null

export default function PaymentCallback() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'fail'>('loading')
  const [message, setMessage] = useState('')
  const [kind, setKind] = useState<PayKind>(null)
  const [bookingCommissionSar, setBookingCommissionSar] = useState<number | null>(null)

  useEffect(() => {
    const typeRaw = searchParams.get('type')
    const payStatus = (searchParams.get('status') || '').toLowerCase()

    if (typeRaw === 'subscription_renewal_cron') {
      if (payStatus === 'failed' || payStatus === 'failure') {
        setStatus('fail')
        setMessage('لم يكتمل الدفع')
        return
      }
      setKind('subscription_renewal_cron')
      setStatus('success')
      setMessage('تم استلام تأكيد الدفع.')
      return
    }

    const type = typeRaw as PayKind
    const ref = searchParams.get('ref')
    const paymentId = searchParams.get('id') || searchParams.get('payment_id')

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

    if (
      type !== 'booking' &&
      type !== 'order' &&
      type !== 'subscription' &&
      type !== 'salon_ad'
    ) {
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

        const verifyPayload = data as {
          commission_amount?: number | null
          platform_fee_percentage?: number
          salon_id?: string
          plan?: string
          previous_plan?: string | null
        }

        if (
          type === 'booking' &&
          typeof verifyPayload.commission_amount === 'number' &&
          Number.isFinite(verifyPayload.commission_amount)
        ) {
          setBookingCommissionSar(verifyPayload.commission_amount)
        } else if (type === 'booking') {
          setBookingCommissionSar(null)
        }

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (type === 'booking' && user?.id) {
          trackEvent({
            event_type: 'payment_success',
            entity_type: 'booking',
            entity_id: ref,
            user_id: user.id,
          })
        }

        if (type === 'subscription' && user?.id) {
          const salonId = typeof verifyPayload.salon_id === 'string' ? verifyPayload.salon_id : ''
          const plan = typeof verifyPayload.plan === 'string' ? verifyPayload.plan : ''
          const prev = verifyPayload.previous_plan
          if (salonId && plan) {
            const isUpgrade =
              typeof prev === 'string' && prev !== plan && ['basic', 'pro', 'premium'].includes(prev)
            trackEvent({
              event_type: isUpgrade ? 'subscription_upgraded' : 'subscription_started',
              entity_type: 'business',
              entity_id: salonId,
              user_id: user.id,
              metadata: {
                plan,
                ...(typeof prev === 'string' ? { from_plan: prev } : {}),
                subscription_id: ref,
              },
            })
          }
        }

        setStatus('success')
      } catch (e) {
        if (!cancelled) {
          console.error(e)
          setStatus('fail')
          setMessage(e instanceof Error ? e.message : 'حدث خطأ')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [searchParams])

  const successHref =
    kind === 'order'
      ? '/orders'
      : kind === 'subscription' || kind === 'subscription_renewal_cron'
        ? '/salon/subscription'
        : kind === 'salon_ad'
          ? '/salon/ads'
          : '/bookings'
  const successLabel =
    kind === 'order'
      ? 'طلباتي'
      : kind === 'subscription' || kind === 'subscription_renewal_cron'
        ? 'اشتراك الصالون'
        : kind === 'salon_ad'
          ? 'إعلانات مميزة'
          : 'حجوزاتي'

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
        <h1 className="text-2xl font-extrabold text-foreground">
          {kind === 'booking' ? 'تم الحجز ✨' : 'تم الدفع بنجاح'}
        </h1>
        <div className="max-w-sm space-y-2 text-center text-muted-foreground">
          {kind === 'booking' ? (
            <>
              <p>تم تسجيل الحجز كمدفوع — يمكنكِ المتابعة من حجوزاتك.</p>
              {bookingCommissionSar != null && bookingCommissionSar > 0 ? (
                <p className="text-base font-bold text-primary">
                  رسوم الخدمة: {formatPrice(bookingCommissionSar)}
                </p>
              ) : null}
            </>
          ) : (
            <p>
              {kind === 'subscription'
                ? 'تم تفعيل اشتراك الصالون. شكراً لثقتكِ بروزيرا.'
                : kind === 'subscription_renewal_cron'
                  ? message || 'تم استلام تأكيد الدفع.'
                  : kind === 'salon_ad'
                    ? 'تم تفعيل الإعلان المميز. سيظهر صالونكِ بشكل أوضح للعملاء.'
                    : 'تم تسجيل الطلب كمدفوع. شكراً لكِ.'}
            </p>
          )}
        </div>
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
        ) : kind === 'subscription' || kind === 'subscription_renewal_cron' ? (
          <Button asChild className="rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]">
            <Link to="/salon/subscription">الاشتراك</Link>
          </Button>
        ) : kind === 'salon_ad' ? (
          <Button asChild className="rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]">
            <Link to="/salon/ads">الإعلانات</Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
