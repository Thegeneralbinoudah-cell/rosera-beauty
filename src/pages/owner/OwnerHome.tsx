import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getMySalonBusinessId, getMySalonName } from '@/lib/salonOwner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { addDays, format, startOfWeek } from 'date-fns'
import { ar } from 'date-fns/locale'

export default function OwnerHome() {
  const { user } = useAuth()
  const [salon, setSalon] = useState<{ id: string; name_ar: string } | null>(null)
  const [stats, setStats] = useState({ today: 0, week: 0, revenue: 0, rating: 0, reviews: 0 })

  useEffect(() => {
    if (!user) return
    let c = true
    async function load() {
      const s = await getMySalonName(user!.id)
      if (!c) return
      setSalon(s)
      const bid = s?.id ?? (await getMySalonBusinessId(user!.id))
      if (!bid) return
      const today = new Date().toISOString().slice(0, 10)
      const w0 = format(startOfWeek(new Date(), { weekStartsOn: 0 }), 'yyyy-MM-dd')
      const w1 = format(addDays(startOfWeek(new Date(), { weekStartsOn: 0 }), 6), 'yyyy-MM-dd')
      const [{ count: cToday }, { count: cWeek }, { data: rev }, { data: bz }] = await Promise.all([
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('business_id', bid).eq('booking_date', today),
        supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('business_id', bid)
          .gte('booking_date', w0)
          .lte('booking_date', w1),
        supabase.from('bookings').select('total_price').eq('business_id', bid).eq('status', 'completed'),
        supabase.from('businesses').select('average_rating, total_reviews').eq('id', bid).single(),
      ])
      const sum = (rev ?? []).reduce((a: number, x: { total_price: number | null }) => a + Number(x.total_price || 0), 0)
      if (c)
        setStats({
          today: cToday ?? 0,
          week: cWeek ?? 0,
          revenue: sum,
          rating: Number((bz as { average_rating?: number } | null)?.average_rating ?? 0),
          reviews: (bz as { total_reviews?: number } | null)?.total_reviews ?? 0,
        })
    }
    void load()
    return () => {
      c = false
    }
  }, [user])

  return (
    <div>
      <Card className="mb-8 overflow-hidden border-0 gradient-primary p-6 text-white shadow-lg">
        <p className="text-sm opacity-90">مرحباً بكِ في</p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">{salon?.name_ar ?? 'صالونك'}</h1>
        <p className="mt-2 text-sm opacity-90">{format(new Date(), 'EEEE d MMMM yyyy', { locale: ar })}</p>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="p-6">
          <p className="text-sm text-rosera-gray">حجوزات اليوم</p>
          <p className="text-3xl font-extrabold text-primary">{stats.today}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-rosera-gray">حجوزات الأسبوع</p>
          <p className="text-3xl font-extrabold text-primary">{stats.week}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-rosera-gray">إجمالي الإيرادات (مكتملة)</p>
          <p className="text-3xl font-extrabold text-primary">{stats.revenue.toLocaleString('ar-SA')} ر.س</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-rosera-gray">التقييمات</p>
          <p className="text-3xl font-extrabold text-primary">⭐ {stats.rating.toFixed(1)}</p>
          <p className="text-sm text-rosera-gray">{stats.reviews} تقييم</p>
        </Card>
      </div>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild className="rounded-2xl bg-green-600 hover:bg-green-700">
          <Link to="/salon/bookings">قبول حجز</Link>
        </Button>
        <Button asChild variant="secondary" className="rounded-2xl">
          <Link to="/salon/services">إضافة خدمة</Link>
        </Button>
      </div>
    </div>
  )
}
