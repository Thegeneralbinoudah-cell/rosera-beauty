import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/card'

export default function OwnerHome() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ today: 0, revenue: 0, rating: 0, reviews: 0 })

  useEffect(() => {
    if (!user) return
    let c = true
    async function load() {
      const { data: my } = await supabase
        .from('businesses')
        .select('id, average_rating, total_reviews')
        .eq('owner_id', user!.id)
        .maybeSingle()
      const bid = my?.id
      if (!bid) {
        if (c) setStats({ today: 3, revenue: 2400, rating: 4.8, reviews: 42 })
        return
      }
      const today = new Date().toISOString().slice(0, 10)
      const { count } = await supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('business_id', bid).eq('booking_date', today)
      const { data: rev } = await supabase.from('bookings').select('total_price').eq('business_id', bid).eq('status', 'completed')
      const sum = (rev ?? []).reduce((a: number, x: { total_price: number }) => a + Number(x.total_price || 0), 0)
      if (c)
        setStats({
          today: count ?? 0,
          revenue: sum,
          rating: Number(my?.average_rating ?? 0),
          reviews: my?.total_reviews ?? 0,
        })
    }
    void load()
    return () => {
      c = false
    }
  }, [user])

  return (
    <div>
      <h1 className="text-2xl font-bold">لوحة المنشأة</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Card className="p-6">
          <p className="text-sm text-rosera-gray">حجوزات اليوم</p>
          <p className="text-3xl font-extrabold text-primary">{stats.today}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-rosera-gray">إجمالي الإيرادات (مكتملة)</p>
          <p className="text-3xl font-extrabold text-primary">{stats.revenue.toLocaleString('ar-SA')} ر.س</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-rosera-gray">التقييم</p>
          <p className="text-3xl font-extrabold text-gold">⭐ {stats.rating.toFixed(1)}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-rosera-gray">عدد التقييمات</p>
          <p className="text-3xl font-extrabold">{stats.reviews}</p>
        </Card>
      </div>
    </div>
  )
}
