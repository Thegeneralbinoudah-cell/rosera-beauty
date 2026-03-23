import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'
import { supabase, type Business, type Service } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { startOfToday } from 'date-fns'
import { formatPrice, cn } from '@/lib/utils'
import { toast } from 'sonner'
import PaymentForm, { type PaymentResult } from '@/components/payment/PaymentForm'
import { trackEvent } from '@/lib/analytics'
import { preferenceMetaFromBusiness } from '@/lib/roseyUserPreference'
import { pickBestActiveOffer, type OfferRow, type SalonActiveOffer } from '@/lib/offers'
import { platformCommissionSar } from '@/lib/bookingCommission'

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

const timeSlots: string[] = []
for (let h = 10; h <= 22; h++) {
  for (let m = 0; m < 60; m += 30) {
    if (h === 22 && m > 0) break
    timeSlots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
  }
}

const STEPS = ['① الخدمة', '② الموعد', '③ التأكيد', '④ الدفع']

const PAYMENT_MODE_FREE =
  ((import.meta.env.VITE_PAYMENT_MODE as string) || '').trim().toLowerCase() === 'free'

const BOOKING_PAY_OPTIONS: { id: 'mada' | 'visa' | 'apple'; label: string }[] = [
  { id: 'mada', label: 'مدى' },
  { id: 'visa', label: 'فيزا / ماستركارد' },
  { id: 'apple', label: 'Apple Pay' },
]

export default function BookingFlow() {
  const { salonId } = useParams()
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const loc = useLocation() as {
    state?: {
      preselect?: string
      suggestedDate?: string
      suggestedSlots?: string[]
      initialStep?: 1 | 2 | 3 | 4
      /** من زر «احجزي بالسعر الجديد» في روزي — يُطبَّق فقط إن سمح الصالون */
      rosyNegotiation?: { discountPercent: number }
    }
  }
  const fromRosy = searchParams.get('source') === 'rosy'
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [b, setB] = useState<Business | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [date, setDate] = useState(() => addDays(new Date(), 1).toISOString().slice(0, 10))
  const [time, setTime] = useState('10:00')
  const [success, setSuccess] = useState(false)
  const [bookingRef, setBookingRef] = useState<string | null>(null)
  const [successPlatformFeeSar, setSuccessPlatformFeeSar] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [pendingRefId, setPendingRefId] = useState<string | null>(null)
  const [salonGateway, setSalonGateway] = useState<'moyasar' | 'cash' | 'disabled'>('moyasar')
  const [bookingPayMethod, setBookingPayMethod] = useState<'mada' | 'visa' | 'apple'>('mada')
  const [salonOffer, setSalonOffer] = useState<SalonActiveOffer | null>(null)
  const rosyScrollDoneRef = useRef(false)
  const rosyQuickStepRef = useRef(false)

  useEffect(() => {
    if (!user) {
      toast.error('سجّلي دخولكِ للحجز')
      nav('/auth')
      return
    }
    if (!salonId) return
    let c = true
    async function load() {
      try {
        const fromRosyUrl = new URLSearchParams(window.location.search).get('source') === 'rosy'
        const { data: biz } = await supabase.from('businesses').select('*').eq('id', salonId).single()
        const bizRow = biz as Business | null
        if (bizRow?.is_demo) {
          toast.error('لا يمكن الحجز في عروض تجريبية')
          nav('/search', { replace: true })
          return
        }
        const { data: svc } = await supabase
          .from('services')
          .select('*')
          .eq('business_id', salonId)
          .eq('is_active', true)
          .eq('is_demo', false)
        const { data: offRows } = await supabase
          .from('offers')
          .select('id, business_id, discount_percentage, title, title_ar, start_date, end_date, is_active')
          .eq('business_id', salonId)
          .eq('is_active', true)
        if (!c) return
        setB(bizRow)
        const list = (svc ?? []) as Service[]
        setServices(list)
        setSalonOffer(pickBestActiveOffer((offRows ?? []) as OfferRow[]))
        const pre = loc.state?.preselect
        if (pre) {
          setSelectedIds(new Set([pre]))
        } else if (fromRosyUrl && list.length > 0) {
          setSelectedIds(new Set([list[0].id]))
        }
        const sd = loc.state?.suggestedDate
        if (sd && /^\d{4}-\d{2}-\d{2}$/.test(sd)) setDate(sd)
        const sugSlots = loc.state?.suggestedSlots
        if (sugSlots?.length && typeof sugSlots[0] === 'string') setTime(sugSlots[0])

        let gateway: 'moyasar' | 'cash' | 'disabled' = 'moyasar'
        const { data: ss, error: ssErr } = await supabase
          .from('salon_settings')
          .select('payment_method')
          .eq('business_id', salonId)
          .maybeSingle()
        if (!c) return
        if (!ssErr && ss?.payment_method) {
          const m = ss.payment_method as string
          if (m === 'cash' || m === 'disabled' || m === 'moyasar') gateway = m
        }
        setSalonGateway(gateway)
      } catch {
        toast.error('تعذر التحميل')
      }
    }
    void load()
    return () => { c = false }
  }, [salonId, user, nav, loc.state?.preselect, loc.state?.suggestedDate, loc.state?.suggestedSlots, loc.state?.initialStep])

  useEffect(() => {
    rosyScrollDoneRef.current = false
    rosyQuickStepRef.current = false
  }, [salonId])

  const highlightServiceId = useMemo(() => {
    if (!fromRosy) return null
    const pre = loc.state?.preselect
    if (pre && services.some((s) => s.id === pre)) return pre
    return services[0]?.id ?? null
  }, [fromRosy, loc.state?.preselect, services])

  useEffect(() => {
    if (!fromRosy || services.length === 0 || rosyScrollDoneRef.current) return
    rosyScrollDoneRef.current = true
    const t = window.setTimeout(() => {
      document.getElementById('rosey-booking-services')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 280)
    return () => window.clearTimeout(t)
  }, [fromRosy, services.length])

  useEffect(() => {
    if (loc.state?.initialStep !== 2) return
    if (rosyQuickStepRef.current) return
    if (services.length === 0 || selectedIds.size === 0) return
    rosyQuickStepRef.current = true
    setStep(2)
  }, [loc.state?.initialStep, services.length, selectedIds.size])

  const toggleService = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedServices = services.filter((s) => selectedIds.has(s.id))
  const selectedIdsKey = useMemo(() => [...selectedIds].sort().join(','), [selectedIds])
  const subtotal = selectedServices.reduce((a, s) => a + Number(s.price), 0)

  useEffect(() => {
    if (step !== 1 && step !== 2) return
    setPendingRefId(null)
  }, [date, time, selectedIdsKey, step])
  const rosyAppliedNegotiationPct = useMemo(() => {
    if (!b?.rosy_discount_allowed) return 0
    const raw = loc.state?.rosyNegotiation?.discountPercent
    if (raw == null) return 0
    const want = Number(raw)
    if (!Number.isFinite(want) || want <= 0) return 0
    const cap = Math.min(15, Math.max(0, Number(b.rosy_max_discount_percent ?? 10)))
    if (cap < 5) return 0
    return Math.min(cap, want)
  }, [b?.rosy_discount_allowed, b?.rosy_max_discount_percent, loc.state?.rosyNegotiation?.discountPercent])

  const finalTotal = useMemo(() => {
    const pct =
      salonOffer && Number.isFinite(salonOffer.discount_percentage)
        ? Math.min(100, Math.max(0, salonOffer.discount_percentage))
        : 0
    let t = subtotal
    if (pct > 0) t = subtotal * (1 - pct / 100)
    t = Math.round(t * 100) / 100
    if (rosyAppliedNegotiationPct > 0) {
      t = Math.round(t * (1 - rosyAppliedNegotiationPct / 100) * 100) / 100
    }
    return t
  }, [subtotal, salonOffer, rosyAppliedNegotiationPct])
  const selectedDay = date ? new Date(date + 'T12:00:00') : undefined

  const insertBooking = async (
    paymentStatus: string,
    paymentId?: string | null,
    paymentAmount?: number,
    paymentMethod = 'moyasar'
  ) => {
    if (!user || !salonId || selectedServices.length === 0) return null
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        user_id: user.id,
        business_id: salonId,
        service_id: selectedServices[0].id,
        service_ids: selectedServices.map((s) => s.id),
        booking_date: date,
        booking_time: time,
        total_price: finalTotal,
        status: 'pending',
        payment_status: paymentStatus,
        payment_id: paymentId ?? null,
        payment_amount: paymentAmount ?? finalTotal,
        payment_method: paymentMethod,
        rosey_negotiated_discount_percent: rosyAppliedNegotiationPct > 0 ? rosyAppliedNegotiationPct : null,
      })
      .select('id, commission_amount, platform_fee_percentage')
      .single()
    if (error) throw error
    const row = data as { id: string; commission_amount?: number | null; platform_fee_percentage?: number | null }
    const bookingId = row.id
    for (const s of selectedServices) {
      trackEvent({ user_id: user.id, event_type: 'book', entity_type: 'service', entity_id: s.id })
    }
    trackEvent({ user_id: user.id, event_type: 'book', entity_type: 'business', entity_id: salonId })
    if (b) {
      trackEvent('user_preference', { user_id: user.id, ...preferenceMetaFromBusiness(b, 'book') })
    }
    if (subtotal > finalTotal + 0.005) {
      trackEvent({
        event_type: 'offer_applied',
        entity_type: 'business',
        entity_id: salonId,
        user_id: user.id,
      })
    }
    const fee =
      typeof row.commission_amount === 'number' && Number.isFinite(row.commission_amount)
        ? row.commission_amount
        : platformCommissionSar(finalTotal, typeof row.platform_fee_percentage === 'number' ? row.platform_fee_percentage : undefined)
    return { id: bookingId, platformFeeSar: fee }
  }

  const onPaymentSuccess = async (result: PaymentResult) => {
    if (result.payment_status !== 'free') return
    setLoading(true)
    try {
      const res = await insertBooking('free', null, finalTotal, 'free')
      if (res) {
        await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', res.id)
        setBookingRef(res.id)
        setSuccessPlatformFeeSar(res.platformFeeSar)
        setSuccess(true)
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الحجز')
    } finally {
      setLoading(false)
    }
  }

  /** بعد ملخص الحجز: إنشاء حجز pending ثم الانتقال لخطوة Moyasar (ما عدا الوضع التجريبي بدون دفع). */
  const proceedToPaymentStep = async () => {
    if (!user || !salonId || selectedServices.length === 0) return
    if (salonGateway !== 'moyasar') return
    if (PAYMENT_MODE_FREE) {
      setStep(4)
      return
    }
    if (pendingRefId) {
      setStep(4)
      return
    }
    setLoading(true)
    try {
      const res = await insertBooking('pending', null, finalTotal, bookingPayMethod)
      if (res) {
        setPendingRefId(res.id)
        setStep(4)
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل إنشاء الحجز')
    } finally {
      setLoading(false)
    }
  }

  const confirmCashAtSalon = async () => {
    setLoading(true)
    try {
      const res = await insertBooking('pending', null, finalTotal, 'cash')
      if (res) {
        setBookingRef(res.id)
        setSuccessPlatformFeeSar(res.platformFeeSar)
        setSuccess(true)
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الحجز')
    } finally {
      setLoading(false)
    }
  }

  if (!b) return <div className="p-8 text-center">جاري التحميل...</div>

  if (success) {
    return (
      <div className="min-h-dvh bg-rosera-light flex flex-col items-center justify-center px-6 dark:bg-rosera-dark">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-l from-[#9C27B0] to-[#E91E8C] text-white"
        >
          <Check className="h-10 w-10" />
        </motion.div>
        <h2 className="mt-6 text-2xl font-extrabold">تم الحجز ✨</h2>
        <p className="mt-2 text-rosera-gray">
          رقم الحجز: <span className="font-mono font-bold text-foreground">{bookingRef?.slice(0, 8)}</span>
        </p>
        {successPlatformFeeSar != null && successPlatformFeeSar > 0 ? (
          <p className="mt-3 text-center text-base font-bold text-primary">
            رسوم الخدمة: {formatPrice(successPlatformFeeSar)}
          </p>
        ) : null}
        <Button
          className="mt-8 w-full max-w-xs rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]"
          onClick={() => nav('/home')}
        >
          العودة للرئيسية
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-rosera-light pb-28 dark:bg-rosera-dark">
      <header className="sticky top-0 z-10 border-b border-primary/10 bg-white px-4 py-4 dark:bg-card">
        <button type="button" onClick={() => (step > 1 ? setStep(step - 1) : nav(-1))} className="font-semibold text-primary">
          ← رجوع
        </button>
        <h1 className="mt-2 text-xl font-bold">حجز — {b.name_ar}</h1>
        <div className="mt-4 flex gap-2">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-2 flex-1 rounded-full ${step >= i + 1 ? 'bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]' : 'bg-muted'}`}
            />
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-6">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key={1}
              id="rosey-booking-services"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-4 scroll-mt-24"
            >
              <h2 className="text-lg font-bold">اختيار الخدمات</h2>
              <div className="space-y-2">
                {services.map((s) => (
                  <label
                    key={s.id}
                    className={cn(
                      'flex cursor-pointer items-center gap-4 rounded-2xl border border-primary/10 bg-white p-4 dark:bg-card',
                      highlightServiceId === s.id &&
                        'ring-2 ring-pink-400/90 ring-offset-2 ring-offset-white dark:ring-offset-card'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(s.id)}
                      onChange={() => toggleService(s.id)}
                      className="h-5 w-5 rounded border-primary text-primary"
                    />
                    <div className="flex-1">
                      <p className="font-bold">{s.name_ar}</p>
                      <p className="text-sm text-rosera-gray">{formatPrice(Number(s.price))} · {s.duration_minutes} د</p>
                    </div>
                  </label>
                ))}
              </div>
              {selectedServices.length > 0 && (
                <div className="space-y-1">
                  {subtotal > finalTotal + 0.005 ? (
                    <>
                      <p className="text-sm text-rosera-gray line-through">قبل الخصم: {formatPrice(subtotal)}</p>
                      <p className="text-lg font-bold text-primary">بعد العرض: {formatPrice(finalTotal)}</p>
                    </>
                  ) : (
                    <p className="text-lg font-bold text-primary">المجموع: {formatPrice(finalTotal)}</p>
                  )}
                  {rosyAppliedNegotiationPct > 0 ? (
                    <p className="text-xs font-semibold text-[#BE185D]">
                      خصم روزي ✨ {rosyAppliedNegotiationPct}% (يُطبَّق بعد عروض الصالون إن وُجدت)
                    </p>
                  ) : null}
                  <p className="text-xs text-rosera-gray">
                    رسوم خدمة المنصة التقريبية: {formatPrice(platformCommissionSar(finalTotal))} (10٪ من المبلغ)
                  </p>
                </div>
              )}
              <Button
                className="w-full rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]"
                disabled={selectedServices.length === 0}
                onClick={() => setStep(2)}
              >
                التالي
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key={2} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <h2 className="text-lg font-bold">التاريخ والوقت</h2>
              <Calendar
                mode="single"
                selected={selectedDay}
                onSelect={(d) => d && setDate(d.toISOString().slice(0, 10))}
                disabled={{ before: startOfToday() }}
                className="rounded-2xl border border-primary/10"
              />
              <div>
                <h3 className="mb-2 font-bold">الوقت</h3>
                <div className="grid grid-cols-4 gap-2">
                  {timeSlots.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTime(t)}
                      className={`rounded-xl py-2.5 text-sm font-semibold ${
                        time === t ? 'bg-gradient-to-l from-[#9C27B0] to-[#E91E8C] text-white' : 'border bg-white dark:bg-card'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <Button className="w-full rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]" onClick={() => setStep(3)}>
                التالي
              </Button>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key={3} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <h2 className="text-lg font-bold">ملخص الحجز</h2>
              <div className="rounded-2xl border border-primary/10 bg-white p-5 shadow-sm dark:bg-card">
                <p className="font-bold">{b.name_ar}</p>
                <p className="mt-2 text-rosera-gray">{selectedServices.map((s) => s.name_ar).join('، ')}</p>
                <p className="mt-2">{date} — {time}</p>
                <div className="mt-4 space-y-1">
                  {subtotal > finalTotal + 0.005 ? (
                    <>
                      <p className="text-sm text-rosera-gray line-through">{formatPrice(subtotal)}</p>
                      <p className="text-xl font-bold text-primary">{formatPrice(finalTotal)}</p>
                    </>
                  ) : (
                    <p className="text-xl font-bold text-primary">{formatPrice(finalTotal)}</p>
                  )}
                  {rosyAppliedNegotiationPct > 0 ? (
                    <p className="mt-2 text-xs font-semibold text-[#BE185D]">خصم روزي ✨ {rosyAppliedNegotiationPct}%</p>
                  ) : null}
                </div>
              </div>
              {salonGateway === 'disabled' && (
                <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-center text-sm font-semibold text-destructive">
                  الحجز الإلكتروني غير مفعّل لهذا الصالون.
                </p>
              )}
              {salonGateway === 'cash' && (
                <div className="space-y-4 rounded-2xl border border-primary/15 bg-primary/5 p-5">
                  <p className="text-center font-semibold text-foreground">الدفع عند الزيارة في الصالون</p>
                  <Button
                    className="w-full rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]"
                    disabled={loading}
                    onClick={() => void confirmCashAtSalon()}
                  >
                    تأكيد الحجز
                  </Button>
                </div>
              )}
              {salonGateway === 'moyasar' && (
                <Button
                  className="w-full rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]"
                  disabled={loading}
                  onClick={() => void proceedToPaymentStep()}
                >
                  {PAYMENT_MODE_FREE ? 'التالي — الدفع التجريبي' : 'متابعة للدفع'}
                </Button>
              )}
            </motion.div>
          )}

          {step === 4 && salonGateway === 'moyasar' && (
            <motion.div key={4} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-6">
              <h2 className="text-lg font-bold">الدفع</h2>
              <p className="text-sm text-muted-foreground">
                المبلغ: <span className="font-bold text-foreground">{formatPrice(finalTotal)}</span>
                {PAYMENT_MODE_FREE ? ' — وضع تجريبي بدون بطاقة' : null}
              </p>
              {!PAYMENT_MODE_FREE && (
                <div>
                  <p className="mb-2 text-sm font-bold text-foreground">طريقة الدفع المفضّلة</p>
                  <div className="grid grid-cols-2 gap-2">
                    {BOOKING_PAY_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setBookingPayMethod(opt.id)}
                        className={`rounded-2xl border-2 p-3 text-sm font-bold ${
                          bookingPayMethod === opt.id ? 'border-primary bg-primary/10' : 'border-primary/15 bg-white dark:bg-card'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <PaymentForm
                type="booking"
                amount={finalTotal}
                description={`حجز ${b.name_ar}`}
                refId={PAYMENT_MODE_FREE ? null : pendingRefId}
                checkoutPaymentMethod={bookingPayMethod}
                onSuccess={onPaymentSuccess}
                onError={(msg) => {
                  console.error('[BookingFlow payment]', msg)
                  toast.error(msg)
                }}
                disabled={loading || (!PAYMENT_MODE_FREE && !pendingRefId)}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
