import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { useI18n } from '@/hooks/useI18n'
import { usePreferences } from '@/contexts/PreferencesContext'

export default function AdminDashboard() {
  const { t } = useI18n()
  const { lang } = usePreferences()
  const [stats, setStats] = useState({
    users: 0,
    businesses: 0,
    bookings: 0,
    revenue: 0,
    platformCommission: 0,
    featuredSalons: 0,
    activeSubscriptions: 0,
    newBizWeek: 0,
    newUsersWeek: 0,
    realBusinesses: 0,
    demoBusinesses: 0,
    realProducts: 0,
    demoProducts: 0,
    ordersWithoutShipment: 0,
    shipmentsWithoutTracking: 0,
    slaBreachedShipments: 0,
    nearSlaBreachShipments: 0,
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
        const [p, b, bk, rev, comm, feat, subs, nb, nu, rec, rb, db, rp, dp, orderShipRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('businesses').select('id', { count: 'exact', head: true }),
          supabase.from('bookings').select('id', { count: 'exact', head: true }),
          supabase.from('bookings').select('total_price').in('status', ['completed', 'confirmed']),
          supabase.from('bookings').select('commission_amount').in('status', ['completed', 'confirmed']),
          supabase.from('businesses').select('id', { count: 'exact', head: true }).eq('is_active', true).eq('is_featured', true),
          supabase.from('salon_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('businesses').select('id', { count: 'exact', head: true }).gte('created_at', iso),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', iso),
          supabase
            .from('bookings')
            .select('id, booking_date, status, businesses(name_ar)')
            .order('created_at', { ascending: false })
            .limit(12),
          supabase.from('businesses').select('id', { count: 'exact', head: true }).eq('is_demo', false),
          supabase.from('businesses').select('id', { count: 'exact', head: true }).eq('is_demo', true),
          supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_demo', false),
          supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_demo', true),
          supabase
            .from('orders')
            .select('id, shipments(id, tracking_number, status, expected_delivery_at, sla_breached)')
            .order('created_at', { ascending: false })
            .limit(500),
        ])
        const revenue = (rev.data ?? []).reduce((a, x: { total_price: number | null }) => a + Number(x.total_price || 0), 0)
        const platformCommission = (comm.data ?? []).reduce(
          (a, x: { commission_amount: number | null }) => a + Number(x.commission_amount || 0),
          0
        )
        const orderRows = (orderShipRes.data ?? []) as {
          id: string
          shipments:
            | {
                id: string
                tracking_number: string | null
                status: string
                expected_delivery_at: string | null
                sla_breached: boolean
              }[]
            | {
                id: string
                tracking_number: string | null
                status: string
                expected_delivery_at: string | null
                sla_breached: boolean
              }
            | null
        }[]
        const now = Date.now()
        const next24h = now + 24 * 60 * 60 * 1000
        const ordersWithoutShipment = orderRows.filter((o) => {
          const s = o.shipments
          return !s || (Array.isArray(s) && s.length === 0)
        }).length
        let shipmentsWithoutTracking = 0
        let slaBreachedShipments = 0
        let nearSlaBreachShipments = 0
        for (const row of orderRows) {
          const shipment = Array.isArray(row.shipments) ? row.shipments[0] : row.shipments
          if (!shipment) continue
          if (!shipment.tracking_number) shipmentsWithoutTracking += 1
          if (shipment.sla_breached) slaBreachedShipments += 1
          if (!shipment.sla_breached && shipment.status !== 'delivered' && shipment.expected_delivery_at) {
            const eta = new Date(shipment.expected_delivery_at).getTime()
            if (eta >= now && eta <= next24h) nearSlaBreachShipments += 1
          }
        }
        if (c) {
          setStats({
            users: p.count ?? 0,
            businesses: b.count ?? 0,
            bookings: bk.count ?? 0,
            revenue,
            platformCommission,
            featuredSalons: feat.count ?? 0,
            activeSubscriptions: subs.count ?? 0,
            newBizWeek: nb.count ?? 0,
            newUsersWeek: nu.count ?? 0,
            realBusinesses: rb.count ?? 0,
            demoBusinesses: db.count ?? 0,
            realProducts: rp.count ?? 0,
            demoProducts: dp.count ?? 0,
            ordersWithoutShipment,
            shipmentsWithoutTracking,
            slaBreachedShipments,
            nearSlaBreachShipments,
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

  const locale = lang === 'en' ? 'en-US' : 'ar-SA'
  const items = [
    { id: 'users', titleKey: 'admin.dashboard.users', v: stats.users, c: 'from-primary to-accent' },
    { id: 'businesses', titleKey: 'admin.dashboard.businesses', v: stats.businesses, c: 'from-pink-500 to-rose-500' },
    { id: 'bookings', titleKey: 'admin.dashboard.bookings', v: stats.bookings, c: 'from-rose-600 to-orange-500' },
    {
      id: 'revenue',
      titleKey: 'admin.dashboard.revenue',
      v: `${Math.round(stats.revenue).toLocaleString(locale)} ${t('common.sar')}`,
      c: 'from-emerald-500 to-teal-500',
    },
  ]

  const monetizationItems = [
    {
      id: 'commission',
      titleKey: 'admin.dashboard.platformCommission',
      v: `${Math.round(stats.platformCommission).toLocaleString(locale)} ${t('common.sar')}`,
    },
    {
      id: 'featured',
      titleKey: 'admin.dashboard.featuredSalons',
      v: stats.featuredSalons.toLocaleString(locale),
    },
    {
      id: 'subs',
      titleKey: 'admin.dashboard.activeSubscriptions',
      v: stats.activeSubscriptions.toLocaleString(locale),
    },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold">{t('admin.dashboard.title')}</h1>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((x) => (
          <Card key={x.id} className="overflow-hidden border-0 shadow-lg">
            <div className={`bg-gradient-to-br ${x.c} p-6 text-white`}>
              <p className="text-sm opacity-90">{t(x.titleKey)}</p>
              <p className="mt-2 text-3xl font-extrabold">{x.v}</p>
            </div>
            <CardContent className="p-3 text-xs text-rosera-gray">{t('admin.dashboard.liveData')}</CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-10">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-foreground">{t('admin.dashboard.monetizationHub')}</h2>
          <div className="flex flex-wrap gap-2 text-sm font-semibold">
            <Link to="/admin/monetization" className="text-accent underline">
              {t('admin.dashboard.openMonetization')}
            </Link>
            <span className="text-muted-foreground">·</span>
            <Link to="/admin/revenue" className="text-accent underline">
              {t('admin.dashboard.openRevenue')}
            </Link>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {monetizationItems.map((x) => (
            <Card key={x.id} className="border-primary/15 bg-gradient-to-br from-primary/[0.06] to-card p-5">
              <p className="text-xs font-semibold text-muted-foreground">{t(x.titleKey)}</p>
              <p className="mt-2 text-2xl font-extrabold tabular-nums text-primary">{x.v}</p>
            </Card>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="p-6">
          <p className="font-bold text-primary">{t('admin.dashboard.newBizWeek')}</p>
          <p className="mt-2 text-3xl font-extrabold">{stats.newBizWeek}</p>
        </Card>
        <Card className="p-6">
          <p className="font-bold text-primary">{t('admin.dashboard.newUsersWeek')}</p>
          <p className="mt-2 text-3xl font-extrabold">{stats.newUsersWeek}</p>
        </Card>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="p-6">
          <p className="font-bold text-primary">{t('admin.dashboard.bizQuality')}</p>
          <p className="mt-2 text-sm text-rosera-gray">
            {t('admin.dashboard.bizQualitySub', { real: stats.realBusinesses, demo: stats.demoBusinesses })}
          </p>
        </Card>
        <Card className="p-6">
          <p className="font-bold text-primary">{t('admin.dashboard.storeQuality')}</p>
          <p className="mt-2 text-sm text-rosera-gray">
            {t('admin.dashboard.bizQualitySub', { real: stats.realProducts, demo: stats.demoProducts })}
          </p>
        </Card>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-6">
          <p className="font-bold text-primary">{t('admin.dashboard.ordersNoShip')}</p>
          <p className="mt-2 text-3xl font-extrabold">{stats.ordersWithoutShipment}</p>
        </Card>
        <Card className="p-6">
          <p className="font-bold text-primary">{t('admin.dashboard.noTracking')}</p>
          <p className="mt-2 text-3xl font-extrabold">{stats.shipmentsWithoutTracking}</p>
        </Card>
        <Card className="p-6">
          <p className="font-bold text-primary">{t('admin.dashboard.slaBreach')}</p>
          <p className="mt-2 text-3xl font-extrabold text-destructive">{stats.slaBreachedShipments}</p>
        </Card>
        <Card className="p-6">
          <p className="font-bold text-primary">{t('admin.dashboard.slaNear')}</p>
          <p className="mt-2 text-3xl font-extrabold">{stats.nearSlaBreachShipments}</p>
        </Card>
      </div>
      <Card className="mt-8 p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-bold text-primary">{t('admin.dashboard.recentBookings')}</p>
          <Link to="/admin/bookings" className="text-sm font-semibold text-accent underline">
            {t('admin.dashboard.all')}
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
