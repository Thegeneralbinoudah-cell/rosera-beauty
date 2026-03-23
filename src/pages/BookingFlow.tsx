import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'
import { supabase, type Business, type Service } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { startOfToday } from 'date-fns'
import { formatPrice } from '@/lib/utils'
import { toast } from 'sonner'
import PaymentForm, { type PaymentResult } from '@/components/payment/PaymentForm'
import { trackUserEvent } from '@/lib/userEvents'
import { trackEvent } from '@/lib/analytics'
import { pickBestActiveOffer, type OfferRow, type SalonActiveOffer } from '@/lib/offers'

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

const STEPS = ['① الخدمة', '② الموعد', '③ التأكيد']

const BOOKING_PAY_OPTIONS: { id: 'mada' | 'visa' | 'apple' | 'tamara'; label: string }[] = [
  { id: 'mada', label: 'مدى' },
  { id: 'visa', label: 'فيزا / ماستركارد' },
  { id: 'apple', label: 'Apple Pay' },
  { id: 'tamara', label: 'تمارا' },
]

export default function BookingFlow() {
  const { salonId } = useParams()
  const nav = useNavigate()
  const loc = useLocation() as {
    state?: { preselect?: string; suggestedDate?: string; suggestedSlots?: string[] }
  }
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [b, setB] = useState<Business | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [date, setDate] = useState(() => addDays(new Date(), 1).toISOString().slice(0, 10))
  const [time, setTime] = useState('10:00')
  const [success, setSuccess] = useState(false)
  const [bookingRef, setBookingRef] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [pendingRefId, setPendingRefId] = useState<string | null>(null)
  const [salonGateway, setSalonGateway] = useState<'moyasar' | 'cash' | 'disabled'>('moyasar')
  const [bookingPayMethod, setBookingPayMethod] = useState<'mada' | 'visa' | 'apple' | 'tamara'>('mada')
  const [salonOffer, setSalonOffer] = useState<SalonActiveOffer | null>(null)

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
        setServices((svc ?? []) as Service[])
        setSalonOffer(pickBestActiveOffer((offRows ?? []) as OfferRow[]))
        const pre = loc.state?.preselect
        if (pre) setSelectedIds(new Set([pre]))
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
  }, [salonId, user, nav, loc.state?.preselect, loc.state?.suggestedDate, loc.state?.suggestedSlots])

  const toggleService = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedServices = services.filter((s) => selectedIds.has(s.id))
  const subtotal = selectedServices.reduce((a, s) => a + Number(s.price), 0)
  const finalTotal = useMemo(() => {
    const pct =
      salonOffer && Number.isFinite(salonOffer.discount_percentage)
        ? Math.min(100, Math.max(0, salonOffer.discount_percentage))
        : 0
    if (pct <= 0) return Math.round(subtotal * 100) / 100
    const x = subtotal * (1 - pct / 100)
    return Math.round(x * 100) / 100
  }, [subtotal, salonOffer])
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
      })
      .select('id')
      .single()
    if (error) throw error
    const bookingId = (data as { id: string }).id
    for (const s of selectedServices) {
      trackUserEvent({ userId: user.id, event_type: 'book', entity_type: 'service', entity_id: s.id })
    }
    trackUserEvent({ userId: user.id, event_type: 'book', entity_type: 'business', entity_id: salonId })
    if (subtotal > finalTotal + 0.005) {
      trackEvent({
        event_type: 'offer_applied',
        entity_type: 'business',
        entity_id: salonId,
        user_id: user.id,
      })
    }
    return bookingId
  }

  const onPaymentSuccess = async (result: PaymentResult) => {
    if (result.payment_status === 'free') {
      setLoading(true)
      try {
        const id = await insertBooking('free', null, finalTotal, 'free')
        if (id) {
          setBookingRef(id)
          setSuccess(true)
        }
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'فشل الحجز')
      } finally {
        setLoading(false)
      }
    }
  }

  const onPaymentPending = async () => {
    setLoading(true)
    try {
      const id = await insertBooking('pending', null, finalTotal, bookingPayMethod)
      if (id) setPendingRefId(id)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل إنشاء الحجز')
    } finally {
      setLoading(false)
    }
  }

  const confirmCashAtSalon = async () => {
    setLoading(true)
    try {
      const id = await insertBooking('pending', null, finalTotal, 'cash')
      if (id) {
        setBookingRef(id)
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
        <h2 className="mt-6 text-2xl font-extrabold">تم الحجز بنجاح!</h2>
        <p className="mt-2 text-rosera-gray">رقم الحجز: <span className="font-mono font-bold text-foreground">{bookingRef?.slice(0, 8)}</span></p>
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
            <motion.div key={1} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
              <h2 className="text-lg font-bold">اختيار الخدمات</h2>
              <div className="space-y-2">
                {services.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-4 rounded-2xl border border-primary/10 bg-white p-4 dark:bg-card"
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
                    <p className="text-lg font-bold text-primary">المجموع: {formatPrice(subtotal)}</p>
                  )}
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
                    <p className="text-xl font-bold text-primary">{formatPrice(subtotal)}</p>
                  )}
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
                <>
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
                  <PaymentForm
                    type="booking"
                    amount={finalTotal}
                    description={`حجز ${b.name_ar} — ${selectedServices.map((s) => s.name_ar).join('، ')}`}
                    refId={pendingRefId}
                    checkoutPaymentMethod={bookingPayMethod}
                    onSuccess={onPaymentSuccess}
                    onPending={onPaymentPending}
                    onError={(msg) => toast.error(msg)}
                    disabled={loading}
                  />
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
