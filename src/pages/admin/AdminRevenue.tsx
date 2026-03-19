import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

type Booking = { total_price: number | null; created_at: string; business_id: string }

export default function AdminRevenue() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [biz, setBiz] = useState<{ id: string; name_ar: string; city: string }[]>([])

  useEffect(() => {
    void supabase
      .from('bookings')
      .select('total_price, created_at, business_id')
      .eq('status', 'completed')
      .then(({ data }) => setBookings((data ?? []) as Booking[]))
    void supabase.from('businesses').select('id, name_ar, city').then(({ data }) => setBiz(data ?? []))
  }, [])

  const byMonth = useMemo(() => {
    const m: Record<string, number> = {}
    for (const b of bookings) {
      const key = (b.created_at || '').slice(0, 7)
      if (!key) continue
      m[key] = (m[key] ?? 0) + Number(b.total_price || 0)
    }
    return Object.entries(m)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, revenue]) => ({ month, revenue: Math.round(revenue) }))
  }, [bookings])

  const byRegion = useMemo(() => {
    const map = new Map<string, number>()
    const idToCity = new Map(biz.map((x) => [x.id, x.city]))
    for (const b of bookings) {
      const city = idToCity.get(b.business_id) ?? 'أخرى'
      map.set(city, (map.get(city) ?? 0) + Number(b.total_price || 0))
    }
    const total = [...map.values()].reduce((a, x) => a + x, 0) || 1
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([region, rev]) => ({ region, revenue: Math.round(rev), pct: Math.round((rev / total) * 100) }))
  }, [bookings, biz])

  const topSalons = useMemo(() => {
    const rev = new Map<string, number>()
    for (const b of bookings) {
      rev.set(b.business_id, (rev.get(b.business_id) ?? 0) + Number(b.total_price || 0))
    }
    const name = new Map(biz.map((x) => [x.id, x.name_ar]))
    return [...rev.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, r]) => ({ name: name.get(id) ?? id, revenue: Math.round(r) }))
  }, [bookings, biz])

  return (
    <div>
      <h1 className="text-2xl font-bold">الإيرادات</h1>
      <div className="mt-8 h-72 w-full rounded-xl border bg-white p-4 dark:bg-card">
        <p className="mb-2 text-sm font-bold text-rosera-gray">الإيرادات حسب الشهر</p>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={byMonth}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => [`${Number(v ?? 0).toLocaleString('ar-SA')} ر.س`, 'الإيرادات']} />
            <Bar dataKey="revenue" fill="#E91E8C" radius={[6, 6, 0, 0]} name="ر.س" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-4 dark:bg-card">
          <p className="font-bold text-primary">حسب المدينة</p>
          <ul className="mt-4 space-y-3">
            {byRegion.map((r) => (
              <li key={r.region}>
                <div className="flex justify-between text-sm">
                  <span>{r.region}</span>
                  <span className="font-bold">{r.revenue.toLocaleString('ar-SA')} ر.س</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]" style={{ width: `${r.pct}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border bg-white p-4 dark:bg-card">
          <p className="font-bold text-primary">أعلى الصالونات دخلاً</p>
          <ol className="mt-4 list-decimal space-y-2 pe-4 text-sm">
            {topSalons.map((s) => (
              <li key={s.name} className="flex justify-between gap-2">
                <span>{s.name}</span>
                <span className="font-bold whitespace-nowrap">{s.revenue.toLocaleString('ar-SA')} ر.س</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
