import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from 'recharts'
import { colors } from '@/theme/tokens'

const PERF_TYPES = ['view_salon', 'booking_click'] as const

type TopPerformingRow = {
  entity_id: string
  name_ar: string
  average_rating: number | null
  total_views: number
  total_booking_clicks: number
  conversion_rate: number
  high_performance: boolean
}

type RevenueBySalonRow = {
  business_id: string
  name_ar: string
  revenue: number
}

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [views, setViews] = useState(0)
  const [bookingClicks, setBookingClicks] = useState(0)
  const [aiViews, setAiViews] = useState(0)
  const [topPerforming, setTopPerforming] = useState<TopPerformingRow[]>([])
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [revenueBySalon, setRevenueBySalon] = useState<RevenueBySalonRow[]>([])

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setErr(null)
      try {
        const since90 = new Date()
        since90.setDate(since90.getDate() - 90)
        const sinceIso = since90.toISOString()

        const [r1, r2, r3, perfRes, paidBookingsRes] = await Promise.all([
          supabase
            .from('user_events')
            .select('id', { count: 'exact', head: true })
            .eq('event_type', 'view_salon')
            .gte('created_at', sinceIso),
          supabase
            .from('user_events')
            .select('id', { count: 'exact', head: true })
            .eq('event_type', 'booking_click')
            .gte('created_at', sinceIso),
          supabase
            .from('user_events')
            .select('id', { count: 'exact', head: true })
            .eq('event_type', 'ai_recommended_view')
            .gte('created_at', sinceIso),
          supabase
            .from('user_events')
            .select('entity_id, event_type')
            .eq('entity_type', 'business')
            .in('event_type', [...PERF_TYPES])
            .gte('created_at', sinceIso)
            .order('created_at', { ascending: false })
            .limit(5000),
          supabase
            .from('bookings')
            .select('business_id, total_price')
            .eq('payment_status', 'paid')
            .gte('created_at', sinceIso)
            .order('created_at', { ascending: false })
            .limit(8000),
        ])

        if (cancelled) return

        if (r1.error) throw r1.error
        if (r2.error) throw r2.error
        if (r3.error) throw r3.error
        if (perfRes.error) throw perfRes.error
        if (paidBookingsRes.error) throw paidBookingsRes.error

        setViews(r1.count ?? 0)
        setBookingClicks(r2.count ?? 0)
        setAiViews(r3.count ?? 0)

        let revenueSum = 0
        const revenueMap = new Map<string, number>()
        for (const row of paidBookingsRes.data ?? []) {
          const r = row as { business_id?: string; total_price?: number | string | null }
          const price = Number(r.total_price ?? 0)
          if (!Number.isFinite(price)) continue
          revenueSum += price
          const bid = r.business_id
          if (!bid) continue
          revenueMap.set(bid, (revenueMap.get(bid) ?? 0) + price)
        }

        const revRanked = [...revenueMap.entries()]
          .map(([business_id, revenue]) => ({ business_id, revenue }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 15)

        const revIds = revRanked.map((x) => x.business_id)
        let revBizMap = new Map<string, string>()
        if (revIds.length) {
          const { data: revBiz, error: revBizErr } = await supabase
            .from('businesses')
            .select('id, name_ar')
            .in('id', revIds)
          if (!cancelled && !revBizErr && revBiz) {
            revBizMap = new Map(
              revBiz.map((b) => [b.id, ((b.name_ar ?? '').trim() || b.id.slice(0, 8) + '…') as string])
            )
          }
        }

        if (!cancelled) {
          setTotalRevenue(revenueSum)
          setRevenueBySalon(
            revRanked.map((row) => ({
              business_id: row.business_id,
              name_ar: revBizMap.get(row.business_id) ?? row.business_id.slice(0, 8) + '…',
              revenue: row.revenue,
            }))
          )
        }

        const bySalon = new Map<string, { total_views: number; total_booking_clicks: number }>()
        for (const row of perfRes.data ?? []) {
          const r = row as { entity_id?: string; event_type?: string }
          const id = r.entity_id
          if (!id) continue
          const cur = bySalon.get(id) ?? { total_views: 0, total_booking_clicks: 0 }
          if (r.event_type === 'view_salon') cur.total_views += 1
          else if (r.event_type === 'booking_click') cur.total_booking_clicks += 1
          bySalon.set(id, cur)
        }

        const ranked = [...bySalon.entries()]
          .map(([entity_id, m]) => {
            const conversion_rate = m.total_views > 0 ? m.total_booking_clicks / m.total_views : 0
            return {
              entity_id,
              ...m,
              conversion_rate,
              high_performance: conversion_rate > 0.3,
            }
          })
          .sort((a, b) => b.total_booking_clicks - a.total_booking_clicks)
          .slice(0, 10)

        const ids = ranked.map((x) => x.entity_id)
        let bizMap = new Map<string, { name_ar: string; average_rating: number | null }>()
        if (ids.length) {
          const { data: biz, error: bErr } = await supabase
            .from('businesses')
            .select('id, name_ar, average_rating')
            .in('id', ids)
          if (!cancelled && !bErr && biz) {
            bizMap = new Map(
              biz.map((b) => [
                b.id,
                { name_ar: (b.name_ar ?? '').trim() || b.id.slice(0, 8) + '…', average_rating: b.average_rating ?? null },
              ])
            )
          }
        }

        if (!cancelled) {
          setTopPerforming(
            ranked.map((row) => {
              const b = bizMap.get(row.entity_id)
              return {
                entity_id: row.entity_id,
                name_ar: b?.name_ar ?? row.entity_id.slice(0, 8) + '…',
                average_rating: b?.average_rating ?? null,
                total_views: row.total_views,
                total_booking_clicks: row.total_booking_clicks,
                conversion_rate: row.conversion_rate,
                high_performance: row.high_performance,
              }
            })
          )
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : 'فشل التحميل')
          setViews(0)
          setBookingClicks(0)
          setAiViews(0)
          setTopPerforming([])
          setTotalRevenue(0)
          setRevenueBySalon([])
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const chartData = useMemo(
    () => [
      { key: 'views', label: 'Views', labelAr: 'مشاهدات الصالون', value: views, fill: colors.chartPrimary },
      { key: 'book', label: 'Bookings', labelAr: 'نقرات الحجز', value: bookingClicks, fill: colors.chartAccent },
      { key: 'ai', label: 'AI', labelAr: 'توصيات AI', value: aiViews, fill: colors.chartAccent },
    ],
    [views, bookingClicks, aiViews]
  )

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-foreground">التحليلات</h1>
        <p className="mt-1 text-sm text-rosera-gray">أحداث المستخدمين من جدول user_events</p>
      </div>

      {err ? (
        <Card className="border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{err}</Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <>
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
            <Skeleton className="h-32 rounded-2xl" />
          </>
        ) : (
          <>
            <Card className="border-primary/15 bg-gradient-to-br from-white to-primary-subtle/50 p-6 shadow-sm dark:from-card dark:to-card">
              <p className="text-3xl" aria-hidden>
                👁️
              </p>
              <p className="mt-2 text-xs font-bold uppercase tracking-wide text-rosera-gray">Views</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">
                {views.toLocaleString('ar-SA')}
              </p>
              <p className="mt-1 text-xs text-rosera-gray">view_salon</p>
            </Card>
            <Card className="border-primary/15 bg-gradient-to-br from-white to-primary-subtle/60 p-6 shadow-sm dark:from-card dark:to-card">
              <p className="text-3xl" aria-hidden>
                📅
              </p>
              <p className="mt-2 text-xs font-bold uppercase tracking-wide text-rosera-gray">Bookings</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">
                {bookingClicks.toLocaleString('ar-SA')}
              </p>
              <p className="mt-1 text-xs text-rosera-gray">booking_click</p>
            </Card>
            <Card className="border-primary/15 bg-gradient-to-br from-white to-gold-subtle/50 p-6 shadow-sm dark:from-card dark:to-card">
              <p className="text-3xl" aria-hidden>
                ✨
              </p>
              <p className="mt-2 text-xs font-bold uppercase tracking-wide text-rosera-gray">AI clicks</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">
                {aiViews.toLocaleString('ar-SA')}
              </p>
              <p className="mt-1 text-xs text-rosera-gray">ai_recommended_view</p>
            </Card>
            <Card className="border-primary/15 bg-gradient-to-br from-white to-success/50 p-6 shadow-sm dark:from-card dark:to-card">
              <p className="text-3xl" aria-hidden>
                💰
              </p>
              <p className="mt-2 text-xs font-bold uppercase tracking-wide text-rosera-gray">Total Revenue</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">
                {totalRevenue.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-xs text-rosera-gray">SUM(total_price) · payment_status = paid</p>
            </Card>
          </>
        )}
      </div>

      <Card className="border-primary/10 p-4 shadow-sm dark:bg-card sm:p-6">
        <p className="mb-4 text-sm font-bold text-foreground">حسب نوع الحدث</p>
        {loading ? (
          <Skeleton className="h-72 w-full rounded-xl" />
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  formatter={(v) => [
                    Number(v ?? 0).toLocaleString('ar-SA'),
                    'العدد',
                  ]}
                  labelFormatter={(label) => {
                    const row = chartData.find((d) => d.label === label)
                    return row?.labelAr ?? String(label ?? '')
                  }}
                />
                <Bar dataKey="value" name="العدد" radius={[8, 8, 0, 0]} maxBarSize={72}>
                  {chartData.map((e) => (
                    <Cell key={e.key} fill={e.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card className="border-primary/10 p-4 shadow-sm dark:bg-card sm:p-6">
        <p className="mb-1 text-sm font-bold text-foreground">إيراد حسب الصالون</p>
        <p className="mb-4 text-xs text-rosera-gray">حجوزات مدفوعة — GROUP BY business_id — أعلى 15</p>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : revenueBySalon.length === 0 ? (
          <p className="py-8 text-center text-sm text-rosera-gray">لا إيراد مسجّل بعد</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-primary/10">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-primary/10 bg-muted/40 text-start">
                  <th className="px-4 py-3 text-start font-bold text-foreground">الصالون</th>
                  <th className="px-4 py-3 text-end font-bold text-rosera-gray">الإيراد (ر.س)</th>
                </tr>
              </thead>
              <tbody>
                {revenueBySalon.map((row) => (
                  <tr
                    key={row.business_id}
                    className="border-b border-primary/5 transition-colors hover:bg-primary/[0.03]"
                  >
                    <td className="px-4 py-3 font-semibold text-foreground">
                      <span className="line-clamp-2">{row.name_ar}</span>
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums font-bold text-primary">
                      {row.revenue.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="border-primary/10 p-4 shadow-sm dark:bg-card sm:p-6">
        <p className="mb-1 text-sm font-bold text-foreground">Top Performing Salons</p>
        <p className="mb-4 text-xs text-rosera-gray">
          view_salon + booking_click — مرتبة حسب نقرات الحجز — أعلى 10
        </p>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : topPerforming.length === 0 ? (
          <p className="py-8 text-center text-sm text-rosera-gray">لا توجد بيانات بعد</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-primary/10">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-primary/10 bg-muted/40 text-start">
                  <th className="px-4 py-3 text-start font-bold text-foreground">Salon Name</th>
                  <th className="px-4 py-3 text-end font-bold text-rosera-gray">Views 👁️</th>
                  <th className="px-4 py-3 text-end font-bold text-rosera-gray">Bookings 📅</th>
                  <th className="px-4 py-3 text-end font-bold text-rosera-gray">Conversion (%)</th>
                  <th className="px-4 py-3 text-end font-bold text-rosera-gray">Rating</th>
                  <th className="px-4 py-3 text-start font-bold text-rosera-gray" />
                </tr>
              </thead>
              <tbody>
                {topPerforming.map((row) => {
                  const pct = row.total_views > 0 ? row.conversion_rate * 100 : 0
                  return (
                    <tr
                      key={row.entity_id}
                      className="border-b border-primary/5 transition-colors hover:bg-primary/[0.03]"
                    >
                      <td className="px-4 py-3 font-semibold text-foreground">
                        <span className="line-clamp-2">{row.name_ar}</span>
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums text-foreground">
                        {row.total_views.toLocaleString('ar-SA')}
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums font-bold text-primary">
                        {row.total_booking_clicks.toLocaleString('ar-SA')}
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums text-foreground">
                        {row.total_views > 0 ? `${pct.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums text-rosera-gray">
                        {row.average_rating != null && Number.isFinite(row.average_rating)
                          ? row.average_rating.toFixed(1)
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {row.high_performance ? (
                          <Badge className="border-0 bg-gradient-to-r from-amber-500 to-orange-500 text-[10px] font-extrabold text-white shadow-sm">
                            🔥 أداء عالي
                          </Badge>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
