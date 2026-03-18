import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase, type Business, type Service } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatPrice } from '@/lib/utils'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar } from '@/components/ui/calendar'
import { startOfToday } from 'date-fns'

const specialists = ['أي أخصائية', 'فاطمة', 'نورة', 'ريم', 'لينا']

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

export default function Booking() {
  const { salonId } = useParams()
  const nav = useNavigate()
  const loc = useLocation() as { state?: { preselect?: string } }
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [b, setB] = useState<Business | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [date, setDate] = useState(() => addDays(new Date(), 1).toISOString().slice(0, 10))
  const [time, setTime] = useState('10:00')
  const [spec, setSpec] = useState(specialists[0])
  const [notes, setNotes] = useState('')
  const [payment, setPayment] = useState<'cash' | 'online'>('cash')
  const [success, setSuccess] = useState(false)
  const [slots] = useState(() =>
    ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00']
  )

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
        if (pre) setSelected(new Set([pre]))
      } catch {
        toast.error('تعذر التحميل')
      }
    }
    void load()
    return () => {
      c = false
    }
  }, [salonId, user, nav, loc.state?.preselect])

  const toggle = (id: string) => {
    const n = new Set(selected)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    setSelected(n)
  }

  const selectedServices = services.filter((s) => selected.has(s.id))
  const total = selectedServices.reduce((a, s) => a + Number(s.price), 0)

  const submit = async () => {
    if (!user || !salonId || selectedServices.length === 0) return
    const first = selectedServices[0]
    const ids = selectedServices.map((s) => s.id)
    try {
      const { error } = await supabase.from('bookings').insert({
        user_id: user.id,
        business_id: salonId,
        service_id: first.id,
        service_ids: ids,
        booking_date: date,
        booking_time: time,
        total_price: total,
        notes,
        payment_method: payment,
        specialist_name: spec === specialists[0] ? null : spec,
        status: 'confirmed',
      })
      if (error) throw error
      setSuccess(true)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الحجز')
    }
  }

  const selectedDay = date ? new Date(date + 'T12:00:00') : undefined

  if (!b) return <div className="p-8 text-center">جاري التحميل...</div>

  return (
    <div className="min-h-dvh bg-rosera-light pb-28 dark:bg-rosera-dark">
      <header className="sticky top-0 z-10 border-b bg-white px-4 py-4 dark:bg-card">
        <button type="button" onClick={() => nav(-1)} className="text-primary font-semibold">
          ← رجوع
        </button>
        <h1 className="mt-2 text-xl font-bold">حجز موعد — {b.name_ar}</h1>
        <div className="mt-4 flex gap-2">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full ${step >= s ? 'gradient-rosera' : 'bg-muted'}`}
            />
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-6">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div key={1} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <h2 className="text-lg font-bold">اختيار الخدمات</h2>
              <div className="mt-4 space-y-3">
                {services.map((s) => (
                  <label
                    key={s.id}
                    className="flex cursor-pointer items-center gap-4 rounded-xl border bg-white p-4 dark:bg-card"
                  >
                    <Checkbox checked={selected.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                    <div className="flex-1">
                      <p className="font-bold">{s.name_ar}</p>
                      <p className="text-sm text-rosera-gray">
                        {formatPrice(Number(s.price))} · {s.duration_minutes} د
                      </p>
                    </div>
                  </label>
                ))}
              </div>
              <Button className="mt-8 w-full" disabled={!selected.size} onClick={() => setStep(2)}>
                التالي
              </Button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key={2} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <h2 className="text-lg font-bold">اختيار التاريخ</h2>
              <div className="mt-4 flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDay}
                  onSelect={(d) => d && setDate(d.toISOString().slice(0, 10))}
                  disabled={{ before: startOfToday() }}
                />
              </div>
              <div className="mt-8 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setStep(1)}>
                  السابق
                </Button>
                <Button className="flex-1" onClick={() => setStep(3)}>
                  التالي
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key={3} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <h2 className="text-lg font-bold">اختيار الوقت</h2>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {slots.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTime(t)}
                    className={`rounded-xl border py-3 font-semibold ${
                      time === t ? 'border-primary bg-primary text-white' : 'bg-white dark:bg-card'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <h3 className="mt-8 font-bold">الأخصائية (اختياري)</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {specialists.map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => setSpec(sp)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold ${
                      spec === sp ? 'border-primary bg-primary/10 text-primary' : ''
                    }`}
                  >
                    {sp}
                  </button>
                ))}
              </div>
              <div className="mt-8 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setStep(2)}>
                  السابق
                </Button>
                <Button className="flex-1" onClick={() => setStep(4)}>
                  التالي
                </Button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key={4} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
              <h2 className="text-lg font-bold">ملخص الحجز</h2>
              <div className="mt-4 space-y-3 rounded-2xl border bg-white p-4 dark:bg-card">
                <p>
                  <strong>المنشأة:</strong> {b.name_ar}
                </p>
                <p>
                  <strong>الخدمات:</strong> {selectedServices.map((s) => s.name_ar).join('، ')}
                </p>
                <p>
                  <strong>التاريخ:</strong> {date}
                </p>
                <p>
                  <strong>الوقت:</strong> {time}
                </p>
                <p className="text-xl font-bold text-primary">الإجمالي: {formatPrice(total)}</p>
              </div>
              <div className="mt-4">
                <Label>ملاحظات</Label>
                <Input className="mt-2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="اختياري" />
              </div>
              <div className="mt-4 flex gap-4">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={payment === 'cash'} onChange={() => setPayment('cash')} />
                  نقدي
                </label>
                <label className="flex items-center gap-2 opacity-60">
                  <input type="radio" disabled />
                  إلكتروني (قريباً)
                </label>
              </div>
              <div className="mt-8 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setStep(3)}>
                  السابق
                </Button>
                <Button className="flex-1" onClick={submit}>
                  تأكيد الحجز
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Dialog open={success} onOpenChange={setSuccess}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-center text-2xl">تم الحجز بنجاح! 🎉</DialogTitle>
          </DialogHeader>
          <p className="text-center text-rosera-gray">
            {b.name_ar} — {date} {time}
          </p>
          <Button className="w-full" onClick={() => nav('/bookings')}>
            حجوزاتي
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
