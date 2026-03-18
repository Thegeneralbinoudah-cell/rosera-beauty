import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, businesses: 0, bookings: 0, reviews: 0 })

  useEffect(() => {
    let c = true
    async function load() {
      try {
        const [p, b, bk, r] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('businesses').select('id', { count: 'exact', head: true }),
          supabase.from('bookings').select('id', { count: 'exact', head: true }),
          supabase.from('reviews').select('id', { count: 'exact', head: true }),
        ])
        if (c)
          setStats({
            users: p.count ?? 0,
            businesses: b.count ?? 0,
            bookings: bk.count ?? 0,
            reviews: r.count ?? 0,
          })
      } catch {
        /* ignore */
      }
    }
    void load()
    return () => {
      c = false
    }
  }, [])

  const items = [
    { k: 'المستخدمون', v: stats.users, c: 'from-violet-500 to-purple-600' },
    { k: 'المنشآت', v: stats.businesses, c: 'from-pink-500 to-rose-500' },
    { k: 'الحجوزات', v: stats.bookings, c: 'from-amber-500 to-orange-500' },
    { k: 'التقييمات', v: stats.reviews, c: 'from-emerald-500 to-teal-500' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold">لوحة التحكم</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((x) => (
          <Card key={x.k} className="overflow-hidden border-0 shadow-lg">
            <div className={`bg-gradient-to-br ${x.c} p-6 text-white`}>
              <p className="text-sm opacity-90">{x.k}</p>
              <p className="mt-2 text-4xl font-extrabold">{x.v}</p>
            </div>
            <CardContent className="p-3 text-xs text-rosera-gray">إجمالي السجلات</CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-8 p-6">
        <p className="font-bold text-primary">الإيرادات (تقديري)</p>
        <p className="mt-2 text-3xl font-extrabold">{((stats.bookings * 150) || 0).toLocaleString('ar-SA')} ر.س</p>
      </Card>
    </div>
  )
}
