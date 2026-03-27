import { useCallback, useEffect, useMemo, useState } from 'react'
import { subDays, format } from 'date-fns'
import { ar } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getMySalonBusinessId } from '@/lib/salonOwner'
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'
import { Eye, MousePointerClick, CalendarCheck } from 'lucide-react'

const VIEW_TYPES = ['view', 'view_salon', 'ai_recommended_view'] as const
const CLICK_TYPES = ['click', 'booking_click', 'salon_clicks'] as const

export default function SalonAnalytics() {
  const { user } = useAuth()
  const [bid, setBid] = useState<string | null>(null)
  const [views, setViews] = useState(0)
  const [clicks, setClicks] = useState(0)
  const [bookingsByDay, setBookingsByDay] = useState<{ date: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    void getMySalonBusinessId(user.id).then(setBid)
  }, [user])

  const load = useCallback(async () => {
    if (!bid) return
    setLoading(true)
    const since = subDays(new Date(), 13)
    const sinceIso = since.toISOString()

    try {
      const { data: evs, error: evErr } = await supabase
        .from('user_events')
        .select('event_type')
        .eq('entity_type', 'business')
        .eq('entity_id', bid)
        .gte('created_at', sinceIso)

      if (evErr) throw evErr

      let v = 0
      let c = 0
      for (const row of evs ?? []) {
        const t = (row as { event_type?: string }).event_type
        if (VIEW_TYPES.includes(t as (typeof VIEW_TYPES)[number])) v += 1
        else if (CLICK_TYPES.includes(t as (typeof CLICK_TYPES)[number])) c += 1
      }
      setViews(v)
      setClicks(c)

      const from = format(subDays(new Date(), 13), 'yyyy-MM-dd')
      const { data: bks, error: bkErr } = await supabase
        .from('bookings')
        .select('booking_date')
        .eq('business_id', bid)
        .gte('booking_date', from)

      if (bkErr) throw bkErr

      const map = new Map<string, number>()
      for (let i = 0; i < 14; i++) {
        const d = format(subDays(new Date(), 13 - i), 'yyyy-MM-dd')
        map.set(d, 0)
      }
      for (const row of bks ?? []) {
        const d = (row as { booking_date: string }).booking_date
        if (map.has(d)) map.set(d, (map.get(d) ?? 0) + 1)
      }
      setBookingsByDay([...map.entries()].map(([date, count]) => ({ date, count })))
    } catch (e) {
      console.error(e)
      toast.error('تعذر تحميل التحليلات — تأكدي من تطبيق آخر migration على Supabase')
      setViews(0)
      setClicks(0)
      setBookingsByDay([])
    } finally {
      setLoading(false)
    }
  }, [bid])

  useEffect(() => {
    void load()
  }, [load])

  const maxBook = useMemo(() => Math.max(1, ...bookingsByDay.map((x) => x.count)), [bookingsByDay])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">التحليلات</h1>
        <p className="mt-1 text-sm text-muted-foreground">آخر 14 يوماً — تفاعل العملاء مع صفحة صالونك</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-primary/15 bg-gradient-to-br from-primary-subtle/80 to-white p-4 dark:border-border dark:from-primary/15 dark:to-card">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-subtle text-primary dark:bg-primary/15 dark:text-primary">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">المشاهدات</p>
              <p className="text-2xl font-extrabold tabular-nums text-foreground">
                {loading ? '…' : views.toLocaleString('ar-SA')}
              </p>
            </div>
          </div>
        </Card>
        <Card className="border-primary/15 bg-gradient-to-br from-gold-subtle/90 to-white p-4 dark:border-border dark:from-accent/15 dark:to-card">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-subtle text-accent dark:bg-accent/20 dark:text-accent">
              <MousePointerClick className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground">النقرات</p>
              <p className="text-2xl font-extrabold tabular-nums text-foreground">
                {loading ? '…' : clicks.toLocaleString('ar-SA')}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="border-primary/15 p-4 dark:border-border">
        <div className="mb-4 flex items-center gap-2">
          <CalendarCheck className="h-5 w-5 text-primary" />
          <h2 className="font-extrabold text-foreground">الحجوزات حسب اليوم</h2>
        </div>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">جاري التحميل…</p>
        ) : (
          <div className="flex h-44 items-end gap-0.5 border-b border-primary/15 pb-1 sm:gap-1 dark:border-border">
            {bookingsByDay.map(({ date, count }) => {
              const barPx = Math.round((count / maxBook) * 120)
              return (
                <div key={date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
                  <div
                    className="w-full max-w-[1.75rem] rounded-t-md bg-gradient-to-t from-accent to-primary dark:from-primary/50 dark:to-accent/90"
                    style={{ height: `${Math.max(6, barPx)}px` }}
                    title={`${date}: ${count}`}
                  />
                  <span className="text-[8px] font-medium tabular-nums text-muted-foreground">
                    {format(new Date(date + 'T12:00:00'), 'd', { locale: ar })}
                  </span>
                </div>
              )
            })}
          </div>
        )}
        <p className="mt-2 text-center text-[10px] text-muted-foreground">كل عمود = يوم (من الأقدم للأحدث)</p>
      </Card>
    </div>
  )
}
