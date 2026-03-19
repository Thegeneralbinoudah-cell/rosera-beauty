import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    users: 0,
    businesses: 0,
    bookings: 0,
    revenue: 0,
    newBizWeek: 0,
    newUsersWeek: 0,
  })
  const [recent, setRecent] = useState<
    { id: string; booking_date: string; status: string; businesses: { name_ar: string } | null }[]
  >([])

  useEffect(() => {
    let c = true
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const iso = weekAgo.toISOString()
    async function load() {
      try {
        const [p, b, bk, rev, nb, nu, rec] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('businesses').select('id', { count: 'exact', head: true }),
          supabase.from('bookings').select('id', { count: 'exact', head: true }),
          supabase.from('bookings').select('total_price').eq('status', 'completed'),
          supabase.from('businesses').select('id', { count: 'exact', head: true }).gte('created_at', iso),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', iso),
          supabase
            .from('bookings')
            .select('id, booking_date, status, businesses(name_ar)')
            .order('created_at', { ascending: false })
            .limit(12),
        ])
        const revenue = (rev.data ?? []).reduce((a, x: { total_price: number | null }) => a + Number(x.total_price || 0), 0)
        if (c) {
          setStats({
            users: p.count ?? 0,
            businesses: b.count ?? 0,
            bookings: bk.count ?? 0,
            revenue,
            newBizWeek: nb.count ?? 0,
            newUsersWeek: nu.count ?? 0,
          })
          const raw = (rec.data ?? []) as {
            id: string
            booking_date: string
            status: string
            businesses: { name_ar: string } | { name_ar: string }[] | null
          }[]
          setRecent(
            raw.map((r) => ({
              ...r,
              businesses: Array.isArray(r.businesses) ? r.businesses[0] ?? null : r.businesses,
            }))
          )
        }
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
    { k: 'الصالونات', v: stats.businesses, c: 'from-pink-500 to-rose-500' },
    { k: 'الحجوزات', v: stats.bookings, c: 'from-amber-500 to-orange-500' },
    { k: 'إجمالي الإيرادات (مكتملة)', v: `${Math.round(stats.revenue).toLocaleString('ar-SA')} ر.س`, c: 'from-emerald-500 to-teal-500' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold">لوحة التحكم</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((x) => (
          <Card key={x.k} className="overflow-hidden border-0 shadow-lg">
            <div className={`bg-gradient-to-br ${x.c} p-6 text-white`}>
              <p className="text-sm opacity-90">{x.k}</p>
              <p className="mt-2 text-3xl font-extrabold">{x.v}</p>
            </div>
            <CardContent className="p-3 text-xs text-rosera-gray">بيانات مباشرة من المنصة</CardContent>
          </Card>
        ))}
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="p-6">
          <p className="font-bold text-primary">صالونات جديدة هذا الأسبوع</p>
          <p className="mt-2 text-3xl font-extrabold">{stats.newBizWeek}</p>
        </Card>
        <Card className="p-6">
          <p className="font-bold text-primary">مستخدمون جدد هذا الأسبوع</p>
          <p className="mt-2 text-3xl font-extrabold">{stats.newUsersWeek}</p>
        </Card>
      </div>
      <Card className="mt-8 p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-bold text-primary">آخر الحجوزات</p>
          <Link to="/admin/bookings" className="text-sm font-semibold text-primary underline">
            الكل
          </Link>
        </div>
        <ul className="space-y-2 text-sm">
          {recent.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-2 border-b border-border/50 py-2">
              <span>{r.businesses?.name_ar ?? '—'}</span>
              <span dir="ltr">{r.booking_date}</span>
              <span className="text-primary">{r.status}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
