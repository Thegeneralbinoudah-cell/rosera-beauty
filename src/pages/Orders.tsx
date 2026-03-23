import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Package } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { buildMapExploreUrl } from '@/lib/mapExploreUrl'
import { toast } from 'sonner'
import { useI18n } from '@/hooks/useI18n'
import { usePreferences } from '@/contexts/PreferencesContext'

type Shipment = {
  id: string
  tracking_number: string | null
  status: string
  tracking_url: string | null
  updated_at: string
  shipping_partners: { name_ar: string } | { name_ar: string }[] | null
}

type OrderRow = {
  id: string
  status: string
  total: number
  shipping: number
  created_at: string
  delivery_address: string | null
  shipments: Shipment | Shipment[] | null
}

type EventRow = {
  id: string
  order_id: string
  event_type: string
  event_data: Record<string, unknown>
  created_at: string
}

const SHIP_STATUSES = ['pending', 'ready', 'in_transit', 'delivered', 'failed', 'returned'] as const

function labelShipmentStatus(status: string, t: (k: string) => string) {
  if ((SHIP_STATUSES as readonly string[]).includes(status)) return t(`ship.${status}`)
  return status
}

export default function Orders() {
  const { t } = useI18n()
  const { lang } = usePreferences()
  const { user } = useAuth()
  const nav = useNavigate()
  const [rows, setRows] = useState<OrderRow[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const uid = user?.id
    if (!uid) {
      nav('/auth', { replace: true })
      return
    }
    let c = true
    async function load() {
      try {
        const [ordersRes, eventsRes] = await Promise.all([
          supabase
          .from('orders')
          .select('id, status, total, shipping, created_at, delivery_address, shipments(id, tracking_number, status, tracking_url, updated_at, shipping_partners(name_ar))')
          .eq('user_id', uid)
          .order('created_at', { ascending: false }),
          supabase
            .from('order_events')
            .select('id, order_id, event_type, event_data, created_at')
            .order('created_at', { ascending: false })
            .limit(300),
        ])
        if (ordersRes.error) throw ordersRes.error
        if (eventsRes.error) throw eventsRes.error
        if (c) {
          setRows((ordersRes.data ?? []) as OrderRow[])
          setEvents((eventsRes.data ?? []) as EventRow[])
        }
      } catch {
        toast.error(t('orders.loadError'))
      } finally {
        if (c) setLoading(false)
      }
    }
    void load()
    return () => {
      c = false
    }
  }, [user, nav, t])

  if (!user) return null
  if (loading) return <div className="p-8 text-center">{t('orders.loading')}</div>

  return (
    <div className="min-h-dvh bg-rosera-light px-4 py-6 dark:bg-rosera-dark">
      <h1 className="text-2xl font-bold">{t('orders.title')}</h1>
      {rows.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={Package}
            title={t('orders.emptyTitle')}
            subtitle={t('orders.emptySub')}
            ctaLabel={t('orders.goStore')}
            onClick={() => nav(buildMapExploreUrl())}
            analyticsSource="orders"
          />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {rows.map((o) => {
            const shipment = Array.isArray(o.shipments) ? o.shipments[0] : o.shipments
            const partner =
              Array.isArray(shipment?.shipping_partners)
                ? shipment?.shipping_partners[0]?.name_ar
                : shipment?.shipping_partners?.name_ar
            const shipStatus = shipment?.status || 'pending'
            return (
              <Card key={o.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold" dir="ltr">
                    #{o.id.slice(0, 8)}
                  </p>
                  <p className="text-sm text-rosera-gray" dir="ltr">
                    {new Date(o.created_at).toLocaleString('en-GB')}
                  </p>
                </div>
                <p className="mt-2 text-sm">
                  {t('orders.total')}{' '}
                  <strong dir="ltr">
                    {Number(o.total).toLocaleString(lang === 'en' ? 'en-US' : 'ar-SA')} {t('common.sar')}
                  </strong>
                </p>
                <p className="text-sm text-rosera-gray">
                  {t('orders.address')} {o.delivery_address || '—'}
                </p>
                <div className="mt-3 rounded-lg border bg-muted/20 p-3 text-sm">
                  <p className="font-semibold">
                    {t('orders.shipmentStatus')} {labelShipmentStatus(shipStatus, t)}
                  </p>
                  <p className="mt-1 text-rosera-gray">
                    {t('orders.carrier')} {partner || t('orders.carrierPending')}
                  </p>
                  <p className="mt-1 text-rosera-gray" dir="ltr">
                    {t('orders.tracking')} {shipment?.tracking_number || '—'}
                  </p>
                  {shipment?.tracking_url && (
                    <a
                      href={shipment.tracking_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-primary underline"
                    >
                      {t('orders.trackLink')}
                    </a>
                  )}
                </div>
                <div className="mt-3 rounded-lg border border-dashed p-3 text-xs">
                  <p className="font-semibold">{t('orders.timeline')}</p>
                  <ul className="mt-2 space-y-1 text-rosera-gray">
                    {events
                      .filter((e) => e.order_id === o.id)
                      .slice(0, 5)
                      .map((e) => (
                        <li key={e.id} className="flex flex-wrap items-center justify-between gap-2">
                          <span>{String(e.event_data?.message ?? e.event_type)}</span>
                          <span dir="ltr">{new Date(e.created_at).toLocaleString('en-GB')}</span>
                        </li>
                      ))}
                    {events.filter((e) => e.order_id === o.id).length === 0 && (
                      <li>{t('orders.noUpdates')}</li>
                    )}
                  </ul>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
