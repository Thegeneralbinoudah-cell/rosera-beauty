import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getMySalonBusinessId } from '@/lib/salonOwner'
import { Card } from '@/components/ui/card'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { colors } from '@/theme/tokens'

export default function OwnerReports() {
  const { user } = useAuth()
  const [bid, setBid] = useState<string | null>(null)
  const [monthRev, setMonthRev] = useState(0)
  const [monthBk, setMonthBk] = useState(0)
  const [rating, setRating] = useState(0)
  const [topSvc, setTopSvc] = useState<{ name: string; count: number }[]>([])

  const ym = useMemo(() => new Date().toISOString().slice(0, 7), [])

  const load = useCallback(async () => {
    if (!bid) return
    const start = `${ym}-01`
    const { data: bk } = await supabase
      .from('bookings')
      .select('id, total_price, status, service_id, created_at')
      .eq('business_id', bid)
      .gte('created_at', start)
    const list = bk ?? []
    const completed = list.filter((x: { status: string }) => x.status === 'completed')
    const rev = completed.reduce((a: number, x: { total_price: number | null }) => a + Number(x.total_price || 0), 0)
    setMonthRev(rev)
    setMonthBk(list.length)
    const { data: bz } = await supabase.from('businesses').select('average_rating').eq('id', bid).single()
    setRating(Number((bz as { average_rating?: number } | null)?.average_rating ?? 0))
    const cnt = new Map<string, number>()
    for (const row of list as { service_id: string | null }[]) {
      if (row.service_id) cnt.set(row.service_id, (cnt.get(row.service_id) ?? 0) + 1)
    }
    const ids = [...cnt.keys()]
    if (ids.length) {
      const { data: sv } = await supabase.from('services').select('id, name_ar').in('id', ids)
      const names = new Map((sv ?? []).map((s: { id: string; name_ar: string }) => [s.id, s.name_ar]))
      setTopSvc(
        [...cnt.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([id, c]) => ({ name: names.get(id) ?? 'خدمة', count: c }))
      )
    } else setTopSvc([])
  }, [bid, ym])

  useEffect(() => {
    if (!user) return
    void getMySalonBusinessId(user.id).then(setBid)
  }, [user])

  useEffect(() => {
    queueMicrotask(() => {
      void load()
    })
  }, [load])

  const maxC = Math.max(...topSvc.map((x) => x.count), 1)

  return (
    <div>
      <h1 className="text-2xl font-bold">التقارير</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-6">
          <p className="text-sm text-rosera-gray">إيرادات الشهر</p>
          <p className="text-2xl font-extrabold text-primary">{monthRev.toLocaleString('ar-SA')} ر.س</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-rosera-gray">حجوزات الشهر</p>
          <p className="text-2xl font-extrabold">{monthBk}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-rosera-gray">متوسط التقييم</p>
          <p className="text-2xl font-extrabold text-primary">{rating.toFixed(1)}</p>
        </Card>
      </div>
      <Card className="mt-8 p-6">
        <p className="mb-4 font-bold">أكثر الخدمات حجزاً (هذا الشهر)</p>
        {topSvc.length === 0 ? (
          <p className="text-sm text-rosera-gray">لا بيانات بعد</p>
        ) : (
          <>
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topSvc} layout="vertical" margin={{ left: 8 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [Number(v ?? 0), 'حجوزات']} />
                  <Bar dataKey="count" fill={colors.chartPrimary} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {topSvc.map((s) => (
                <div key={s.name}>
                  <div className="flex justify-between text-xs">
                    <span>{s.name}</span>
                    <span>{s.count}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full gradient-primary"
                      style={{ width: `${Math.round((s.count / maxC) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
