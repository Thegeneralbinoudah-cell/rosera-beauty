import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getMySalonBusinessId } from '@/lib/salonOwner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { format, addDays, startOfWeek } from 'date-fns'
import { ar } from 'date-fns/locale'

type BookingRow = { booking_date: string; booking_time: string; id: string }

type BlockRow = { id: string; block_date: string; start_time: string | null; end_time: string | null; reason: string | null }

const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

export default function OwnerSchedule() {
  const { user } = useAuth()
  const [bid, setBid] = useState<string | null>(null)
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [blocks, setBlocks] = useState<BlockRow[]>([])
  const [hours, setHours] = useState<Record<string, { open: string; close: string }>>({})
  const [blockDate, setBlockDate] = useState('')
  const [blockStart, setBlockStart] = useState('10:00')
  const [blockEnd, setBlockEnd] = useState('12:00')

  const load = useCallback(async () => {
    if (!bid) return
    const w0 = format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd')
    const w1 = format(addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), 6), 'yyyy-MM-dd')
    const [{ data: bk }, { data: bl }, { data: bz }] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, booking_date, booking_time')
        .eq('business_id', bid)
        .gte('booking_date', w0)
        .lte('booking_date', w1)
        .order('booking_date')
        .order('booking_time'),
      supabase.from('salon_blocked_slots').select('*').eq('business_id', bid).gte('block_date', w0),
      supabase.from('businesses').select('opening_hours').eq('id', bid).single(),
    ])
    setBookings((bk ?? []) as BookingRow[])
    setBlocks((bl ?? []) as BlockRow[])
    const oh = (bz as { opening_hours?: Record<string, { open: string; close: string }> } | null)?.opening_hours ?? {}
    setHours(typeof oh === 'object' && oh ? oh : {})
  }, [bid])

  useEffect(() => {
    if (!user) return
    void getMySalonBusinessId(user.id).then(setBid)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), i)
    return { date: format(d, 'yyyy-MM-dd'), label: DAYS[d.getDay()], display: format(d, 'd MMM', { locale: ar }) }
  })

  const saveHours = async () => {
    if (!bid) return
    try {
      const { error } = await supabase.from('businesses').update({ opening_hours: hours }).eq('id', bid)
      if (error) throw error
      toast.success('حُفظت ساعات العمل')
    } catch {
      toast.error('فشل الحفظ')
    }
  }

  const addBlock = async () => {
    if (!bid || !blockDate) return
    try {
      const { error } = await supabase.from('salon_blocked_slots').insert({
        business_id: bid,
        block_date: blockDate,
        start_time: blockStart || null,
        end_time: blockEnd || null,
        reason: 'محجوز',
      })
      if (error) throw error
      toast.success('تم حظر الفترة')
      void load()
    } catch {
      toast.error('فشل — نفّذي ترحيل قاعدة البيانات 009 إن لزم')
    }
  }

  const removeBlock = async (id: string) => {
    try {
      await supabase.from('salon_blocked_slots').delete().eq('id', id)
      void load()
    } catch {
      toast.error('فشل الحذف')
    }
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">الجدول</h1>
      <section>
        <h2 className="mb-4 font-bold text-primary">أسبوع الحالي — الحجوزات</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {weekDays.map((day) => (
            <Card key={day.date} className="p-4">
              <p className="font-bold">
                {day.label} — {day.display}
              </p>
              <ul className="mt-2 space-y-1 text-sm">
                {bookings
                  .filter((b) => b.booking_date === day.date)
                  .map((b) => (
                    <li key={b.id} className="text-rosera-gray" dir="ltr">
                      {String(b.booking_time).slice(0, 5)}
                    </li>
                  ))}
                {bookings.filter((b) => b.booking_date === day.date).length === 0 && (
                  <li className="text-xs text-foreground">لا حجوزات</li>
                )}
              </ul>
            </Card>
          ))}
        </div>
      </section>
      <section>
        <h2 className="mb-4 font-bold text-primary">ساعات العمل (مفتاح اليوم: sun, mon, ...)</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((k, i) => (
            <div key={k} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
              <span className="w-20 text-sm font-bold">{DAYS[i]}</span>
              <Input
                className="w-24"
                placeholder="فتح"
                value={hours[k]?.open ?? ''}
                onChange={(e) => setHours((h) => ({ ...h, [k]: { open: e.target.value, close: h[k]?.close ?? '22:00' } }))}
              />
              <span>—</span>
              <Input
                className="w-24"
                placeholder="إغلاق"
                value={hours[k]?.close ?? ''}
                onChange={(e) => setHours((h) => ({ ...h, [k]: { open: h[k]?.open ?? '10:00', close: e.target.value } }))}
              />
            </div>
          ))}
        </div>
        <Button className="mt-4" onClick={() => void saveHours()}>
          حفظ ساعات العمل
        </Button>
      </section>
      <section>
        <h2 className="mb-4 font-bold text-primary">حظر فترة</h2>
        <div className="flex flex-wrap gap-2">
          <Input type="date" value={blockDate} onChange={(e) => setBlockDate(e.target.value)} className="w-40" />
          <Input type="time" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} className="w-32" />
          <Input type="time" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} className="w-32" />
          <Button onClick={() => void addBlock()}>حظر</Button>
        </div>
        <ul className="mt-4 space-y-2">
          {blocks.map((b) => (
            <li key={b.id} className="flex items-center justify-between rounded-lg border p-2 text-sm">
              <span dir="ltr">
                {b.block_date} {b.start_time?.slice(0, 5) ?? ''}–{b.end_time?.slice(0, 5) ?? ''}
              </span>
              <Button size="sm" variant="ghost" onClick={() => void removeBlock(b.id)}>
                إزالة
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
