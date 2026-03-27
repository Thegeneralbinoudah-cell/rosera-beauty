import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { formatPrice } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'
import { colors } from '@/theme/tokens'

type BookingRow = {
  total_price: number | null
  commission_amount: number | null
  created_at: string
  business_id: string
  status?: string | null
  payment_status?: string | null
}

export default function AdminRevenue() {
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [biz, setBiz] = useState<{ id: string; name_ar: string; city: string }[]>([])

  useEffect(() => {
    void supabase
      .from('bookings')
      .select('total_price, commission_amount, created_at, business_id, status, payment_status')
      .in('status', ['completed', 'confirmed'])
      .then(({ data }) => setBookings((data ?? []) as BookingRow[]))
    void supabase.from('businesses').select('id, name_ar, city').then(({ data }) => setBiz(data ?? []))
  }, [])

  const totals = useMemo(() => {
    let gmv = 0
    let commission = 0
    for (const b of bookings) {
      gmv += Number(b.total_price || 0)
      commission += Number(b.commission_amount || 0)
    }
    return { gmv, commission, count: bookings.length }
  }, [bookings])

  const byMonth = useMemo(() => {
    const m: Record<string, { revenue: number; commission: number }> = {}
    for (const b of bookings) {
      const key = (b.created_at || '').slice(0, 7)
      if (!key) continue
      if (!m[key]) m[key] = { revenue: 0, commission: 0 }
      m[key].revenue += Number(b.total_price || 0)
      m[key].commission += Number(b.commission_amount || 0)
    }
    return Object.entries(m)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        revenue: Math.round(v.revenue),
        commission: Math.round(v.commission * 100) / 100,
      }))
  }, [bookings])

  const byRegion = useMemo(() => {
    const map = new Map<string, { revenue: number; commission: number }>()
    const idToCity = new Map(biz.map((x) => [x.id, x.city]))
    for (const b of bookings) {
      const city = idToCity.get(b.business_id) ?? 'أخرى'
      const cur = map.get(city) ?? { revenue: 0, commission: 0 }
      cur.revenue += Number(b.total_price || 0)
      cur.commission += Number(b.commission_amount || 0)
      map.set(city, cur)
    }
    const totalRev = [...map.values()].reduce((a, x) => a + x.revenue, 0) || 1
    return [...map.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([region, v]) => ({
        region,
        revenue: Math.round(v.revenue),
        commission: Math.round(v.commission * 100) / 100,
        pct: Math.round((v.revenue / totalRev) * 100),
      }))
  }, [bookings, biz])

  const topSalons = useMemo(() => {
    const rev = new Map<string, { gmv: number; commission: number }>()
    for (const b of bookings) {
      const cur = rev.get(b.business_id) ?? { gmv: 0, commission: 0 }
      cur.gmv += Number(b.total_price || 0)
      cur.commission += Number(b.commission_amount || 0)
      rev.set(b.business_id, cur)
    }
    const name = new Map(biz.map((x) => [x.id, x.name_ar]))
    return [...rev.entries()]
      .sort((a, b) => b[1].commission - a[1].commission)
      .slice(0, 8)
      .map(([id, v]) => ({
        name: name.get(id) ?? id,
        gmv: Math.round(v.gmv),
        commission: Math.round(v.commission * 100) / 100,
      }))
  }, [bookings, biz])

  return (
    <div>
      <h1 className="text-2xl font-bold">الإيرادات</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        الأرقام من حجوزات <span className="font-semibold text-foreground">مكتملة أو مؤكدة</span> (بما فيها بعد الدفع
        الإلكتروني) — عمولة المنصة في{' '}
        <code className="rounded bg-muted px-1">commission_amount</code>.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4 dark:bg-card">
          <p className="text-xs font-semibold text-muted-foreground">حجوزات (مكتملة / مؤكدة)</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums">{totals.count.toLocaleString('ar-SA')}</p>
        </div>
        <div className="rounded-xl border bg-card p-4 dark:bg-card">
          <p className="text-xs font-semibold text-muted-foreground">مجمّع المبيعات (GMV)</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">
            {formatPrice(totals.gmv)}
          </p>
        </div>
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 dark:bg-card">
          <p className="text-xs font-semibold text-primary">عمولة المنصة (إجمالي)</p>
          <p className="mt-1 text-2xl font-extrabold tabular-nums text-primary">
            {formatPrice(totals.commission)}
          </p>
        </div>
      </div>

      <div className="mt-8 h-80 w-full rounded-xl border bg-card p-4 dark:bg-card">
        <p className="mb-2 text-sm font-bold text-muted-foreground">شهرياً — GMV وعمولة المنصة</p>
        <ResponsiveContainer width="100%" height="88%">
          <BarChart data={byMonth}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v, name) => [`${Number(v ?? 0).toLocaleString('ar-SA')} ر.س`, name === 'revenue' ? 'GMV' : 'عمولة']}
            />
            <Legend />
            <Bar dataKey="revenue" fill={colors.chartRevenue} radius={[6, 6, 0, 0]} name="GMV" />
            <Bar dataKey="commission" fill={colors.chartPrimary} radius={[6, 6, 0, 0]} name="عمولة" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border bg-card p-4 dark:bg-card">
          <p className="font-bold text-primary">حسب المدينة</p>
          <ul className="mt-4 space-y-3">
            {byRegion.map((r) => (
              <li key={r.region}>
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span>{r.region}</span>
                  <span className="font-bold">{formatPrice(r.revenue)}</span>
                </div>
                <p className="text-xs text-muted-foreground">عمولة: {formatPrice(r.commission)}</p>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full gradient-primary"
                    style={{ width: `${r.pct}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border bg-card p-4 dark:bg-card">
          <p className="font-bold text-primary">أعلى الصالونات عمولةً</p>
          <ol className="mt-4 list-decimal space-y-2 pe-4 text-sm">
            {topSalons.map((s) => (
              <li key={s.name} className="flex flex-col gap-0.5 border-b border-border/60 pb-2 last:border-0">
                <div className="flex justify-between gap-2 font-semibold">
                  <span>{s.name}</span>
                  <span className="whitespace-nowrap text-accent">{formatPrice(s.commission)}</span>
                </div>
                <span className="text-xs text-muted-foreground">GMV: {formatPrice(s.gmv)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  )
}
