import { useEffect, useMemo, useState } from 'react'
import { formatPrice } from '@/lib/utils'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { trackEvent } from '@/lib/analytics'
import { captureBookingFailed, type BookingFailedReason } from '@/lib/posthog'
import { trackRosyHesitationCheckoutIfAttributed } from '@/lib/roseyHesitationAnalytics'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

type PayKind = 'booking' | 'order' | 'subscription' | 'salon_ad' | 'subscription_renewal_cron' | null

type ParsedCallback =
  | {
      kind: 'sync'
      status: 'success' | 'fail'
      message: string
      payKind: PayKind
      bookingCommissionSar: number | null
    }
  | {
      kind: 'verify'
      type: 'booking' | 'order' | 'subscription' | 'salon_ad'
      ref: string
      paymentId: string
    }

function parsePaymentCallback(sp: URLSearchParams): ParsedCallback {
  const typeRaw = sp.get('type')
  const payStatus = (sp.get('status') || '').toLowerCase()

  if (typeRaw === 'subscription_renewal_cron') {
    if (payStatus === 'failed' || payStatus === 'failure') {
      return {
        kind: 'sync',
        status: 'fail',
        message: 'لم يكتمل الدفع',
        payKind: 'subscription_renewal_cron',
        bookingCommissionSar: null,
      }
    }
    return {
      kind: 'sync',
      status: 'success',
      message: 'تم استلام تأكيد الدفع.',
      payKind: 'subscription_renewal_cron',
      bookingCommissionSar: null,
    }
  }

  const type = typeRaw as PayKind
  const ref = sp.get('ref')
  const paymentId = (sp.get('id') || sp.get('payment_id') || '').trim()

  if (payStatus === 'failed' || payStatus === 'failure') {
    return {
      kind: 'sync',
      status: 'fail',
      message: 'لم يكتمل الدفع',
      payKind: type,
      bookingCommissionSar: null,
    }
  }

  if (!type || !ref) {
    return {
      kind: 'sync',
      status: 'fail',
      message: 'رابط غير صالح',
      payKind: type,
      bookingCommissionSar: null,
    }
  }

  if (!['booking', 'order', 'subscription', 'salon_ad'].includes(type)) {
    return {
      kind: 'sync',
      status: 'fail',
      message: 'نوع العملية غير معروف',
      payKind: type,
      bookingCommissionSar: null,
    }
  }

  if (!paymentId) {
    console.error('[PaymentCallback] missing payment id in callback URL', { type, ref })
    return {
      kind: 'sync',
      status: 'fail',
      message: 'لم يتم استلام معرّف الدفع من Moyasar',
      payKind: type,
      bookingCommissionSar: null,
    }
  }

  return {
    kind: 'verify',
    type: type as 'booking' | 'order' | 'subscription' | 'salon_ad',
    ref,
    paymentId,
  }
}

function getBookingCaptureReasonFromUrl(sp: URLSearchParams): BookingFailedReason | null {
  const typeRaw = sp.get('type')
  const payStatus = (sp.get('status') || '').toLowerCase()
  if (typeRaw === 'subscription_renewal_cron') return null
  if (payStatus === 'failed' || payStatus === 'failure') {
    return typeRaw === 'booking' ? 'callback_pay_failed' : null
  }
  const type = typeRaw as PayKind
  const ref = sp.get('ref')
  const paymentId = (sp.get('id') || sp.get('payment_id') || '').trim()
  if (!type || !ref) return typeRaw === 'booking' ? 'callback_invalid_url' : null
  if (!['booking', 'order', 'subscription', 'salon_ad'].includes(type)) {
    return typeRaw === 'booking' ? 'callback_bad_type' : null
  }
  if (!paymentId) return type === 'booking' ? 'callback_missing_payment_id' : null
  return null
}

export default function PaymentCallback() {
  const [searchParams] = useSearchParams()
  const parsed = useMemo(() => parsePaymentCallback(searchParams), [searchParams])

  const [verifyResult, setVerifyResult] = useState<{
    status: 'success' | 'fail'
    message: string
    payKind: PayKind
    bookingCommissionSar: number | null
  } | null>(null)

  useEffect(() => {
    const reason = getBookingCaptureReasonFromUrl(searchParams)
    if (reason) captureBookingFailed(reason, { phase: 'payment_callback' })
  }, [searchParams])

  useEffect(() => {
    const p = parsePaymentCallback(searchParams)
    if (p.kind !== 'verify') return
    const { type, ref, paymentId } = p
    queueMicrotask(() => setVerifyResult(null))
    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { type, ref, payment_id: paymentId },
        })
        if (cancelled) return
        const err = (data as { error?: string })?.error
        if (error || err) {
          if (type === 'booking') captureBookingFailed('callback_verify', { phase: 'payment_callback' })
          setVerifyResult({
            status: 'fail',
            message: err || error?.message || 'فشل التحقق من الدفع',
            payKind: type,
            bookingCommissionSar: null,
          })
          return
        }

        const verifyPayload = data as {
          commission_amount?: number | null
          platform_fee_percentage?: number
          salon_id?: string
          plan?: string
          previous_plan?: string | null
        }

        let bookingCommissionSar: number | null = null
        if (
          type === 'booking' &&
          typeof verifyPayload.commission_amount === 'number' &&
          Number.isFinite(verifyPayload.commission_amount)
        ) {
          bookingCommissionSar = verifyPayload.commission_amount
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

        if (type === 'order' && user?.id) {
          trackRosyHesitationCheckoutIfAttributed(user.id)
        }

        setVerifyResult({
          status: 'success',
          message: '',
          payKind: type,
          bookingCommissionSar,
        })
      } catch (e) {
        if (!cancelled) {
          console.error(e)
          if (type === 'booking') captureBookingFailed('callback_exception', { phase: 'payment_callback' })
          setVerifyResult({
            status: 'fail',
            message: e instanceof Error ? e.message : 'حدث خطأ',
            payKind: type,
            bookingCommissionSar: null,
          })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [searchParams])

  const effective =
    parsed.kind === 'sync'
      ? {
          status: parsed.status,
          message: parsed.message,
          payKind: parsed.payKind,
          bookingCommissionSar: parsed.bookingCommissionSar,
        }
      : verifyResult

  const status = effective?.status ?? 'loading'
  const message = effective?.message ?? ''
  const kind = effective?.payKind ?? null
  const bookingCommissionSar = effective?.bookingCommissionSar ?? null

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
          <Button asChild className="rounded-2xl gradient-primary">
            <Link to={successHref}>{successLabel}</Link>
          </Button>
          <Button asChild variant="outline" className="rounded-2xl">
            <Link to="/home">الرئيسية</Link>
          </Button>
        </div>
      </div>
    )
  }

  const salonRetryId = kind === 'booking' ? (searchParams.get('salon') || '').trim() : ''

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
        <XCircle className="h-12 w-12 text-destructive" />
      </div>
      <h1 className="text-2xl font-extrabold text-foreground">فشل الدفع</h1>
      <p className="max-w-sm text-center text-muted-foreground">{message}</p>
      <div className="flex max-w-md flex-wrap justify-center gap-3">
        {kind === 'booking' && salonRetryId ? (
          <Button asChild className="rounded-2xl">
            <Link to={`/booking/${salonRetryId}`}>إعادة محاولة الدفع</Link>
          </Button>
        ) : null}
        <Button asChild variant="outline" className="rounded-2xl">
          <Link to="/home">الرئيسية</Link>
        </Button>
        {kind === 'booking' ? (
          <Button asChild variant="outline" className="rounded-2xl">
            <Link to="/bookings">حجوزاتي</Link>
          </Button>
        ) : kind === 'order' ? (
          <Button asChild className="rounded-2xl gradient-primary">
            <Link to="/cart">السلة</Link>
          </Button>
        ) : kind === 'subscription' || kind === 'subscription_renewal_cron' ? (
          <Button asChild className="rounded-2xl gradient-primary">
            <Link to="/salon/subscription">الاشتراك</Link>
          </Button>
        ) : kind === 'salon_ad' ? (
          <Button asChild className="rounded-2xl gradient-primary">
            <Link to="/salon/ads">الإعلانات</Link>
          </Button>
        ) : null}
      </div>
    </div>
  )
}
