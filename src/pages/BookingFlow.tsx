import { useEffect, useState } from 'react'
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

export default function BookingFlow() {
  const { salonId } = useParams()
  const nav = useNavigate()
  const loc = useLocation() as { state?: { preselect?: string } }
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
        const { data: svc } = await supabase.from('services').select('*').eq('business_id', salonId).eq('is_active', true)
        if (!c) return
        setB(biz as Business)
        setServices((svc ?? []) as Service[])
        const pre = loc.state?.preselect
        if (pre) setSelectedIds(new Set([pre]))
      } catch {
        toast.error('تعذر التحميل')
      }
    }
    void load()
    return () => { c = false }
  }, [salonId, user, nav, loc.state?.preselect])

  const toggleService = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectedServices = services.filter((s) => selectedIds.has(s.id))
  const total = selectedServices.reduce((a, s) => a + Number(s.price), 0)
  const selectedDay = date ? new Date(date + 'T12:00:00') : undefined

  const onConfirm = async () => {
    if (!user || !salonId || selectedServices.length === 0) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('bookings')
        .insert({
          user_id: user.id,
          business_id: salonId,
          service_id: selectedServices[0].id,
          service_ids: selectedServices.map((s) => s.id),
          booking_date: date,
          booking_time: time,
          total_price: total,
          status: 'pending',
        })
        .select('id')
        .single()
      if (error) throw error
      setBookingRef((data as { id: string }).id)
      setSuccess(true)
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
                <p className="text-lg font-bold text-primary">المجموع: {formatPrice(total)}</p>
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
                <p className="mt-4 text-xl font-bold text-primary">{formatPrice(total)}</p>
              </div>
              <Button
                className="w-full rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]"
                disabled={loading}
                onClick={onConfirm}
              >
                تأكيد الحجز
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
