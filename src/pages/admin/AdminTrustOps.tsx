import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

type Shipment = {
  id: string
  status: string
  sla_breached: boolean
  expected_delivery_at: string | null
  tracking_number: string | null
}

type OrderRow = {
  id: string
  status: string
  total: number
  created_at: string
  risk_score: number
  risk_flags: string[]
  shipments: Shipment | Shipment[] | null
}

type EventRow = {
  id: string
  order_id: string
  event_type: string
  event_data: Record<string, unknown>
  created_at: string
}

export default function AdminTrustOps() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)

  const [eventOrderId, setEventOrderId] = useState('')
  const [eventType, setEventType] = useState('ops_note')
  const [eventMessage, setEventMessage] = useState('')
  const [savingEvent, setSavingEvent] = useState(false)

  const [riskOrderId, setRiskOrderId] = useState('')
  const [riskScore, setRiskScore] = useState('0')
  const [riskFlagsText, setRiskFlagsText] = useState('')
  const [savingRisk, setSavingRisk] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [ordersRes, eventsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, status, total, created_at, risk_score, risk_flags, shipments(id, status, sla_breached, expected_delivery_at, tracking_number)')
          .order('created_at', { ascending: false })
          .limit(250),
        supabase
          .from('order_events')
          .select('id, order_id, event_type, event_data, created_at')
          .order('created_at', { ascending: false })
          .limit(300),
      ])
      if (ordersRes.error) throw ordersRes.error
      if (eventsRes.error) throw eventsRes.error
      setOrders((ordersRes.data ?? []) as OrderRow[])
      setEvents((eventsRes.data ?? []) as EventRow[])
    } catch {
      toast.error('تعذر تحميل بيانات الثقة والعمليات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const riskyOrders = useMemo(
    () => orders.filter((o) => Number(o.risk_score || 0) >= 60 || (o.risk_flags ?? []).length > 0),
    [orders]
  )

  const breachedOrders = useMemo(
    () =>
      orders.filter((o) => {
        const s = Array.isArray(o.shipments) ? o.shipments[0] : o.shipments
        return Boolean(s?.sla_breached)
      }),
    [orders]
  )

  const nearBreachOrders = useMemo(() => {
    const now = Date.now()
    const next24h = now + 24 * 60 * 60 * 1000
    return orders.filter((o) => {
      const s = Array.isArray(o.shipments) ? o.shipments[0] : o.shipments
      if (!s?.expected_delivery_at) return false
      if (s.sla_breached || s.status === 'delivered') return false
      const eta = new Date(s.expected_delivery_at).getTime()
      return eta >= now && eta <= next24h
    })
  }, [orders])

  const addEvent = async () => {
    if (!eventOrderId || !eventType || !eventMessage.trim()) {
      toast.error('حددي الطلب ونوع الحدث واكتبي الملاحظة')
      return
    }
    setSavingEvent(true)
    try {
      const { error } = await supabase.from('order_events').insert({
        order_id: eventOrderId,
        event_type: eventType,
        event_data: { message: eventMessage.trim() },
      })
      if (error) throw error
      toast.success('تمت إضافة الحدث')
      setEventMessage('')
      await load()
    } catch {
      toast.error('فشل إضافة الحدث')
    } finally {
      setSavingEvent(false)
    }
  }

  const updateRisk = async () => {
    if (!riskOrderId) {
      toast.error('اختاري طلب')
      return
    }
    const parsedScore = Number(riskScore)
    if (!Number.isFinite(parsedScore) || parsedScore < 0 || parsedScore > 100) {
      toast.error('risk_score يجب أن يكون بين 0 و100')
      return
    }
    const flags = riskFlagsText
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
    setSavingRisk(true)
    try {
      const { error } = await supabase
        .from('orders')
        .update({ risk_score: parsedScore, risk_flags: flags })
        .eq('id', riskOrderId)
      if (error) throw error
      toast.success('تم تحديث المخاطر')
      await load()
    } catch {
      toast.error('فشل تحديث المخاطر')
    } finally {
      setSavingRisk(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">الثقة والعمليات</h1>
        <p className="mt-2 text-sm text-foreground">
          مراقبة مخاطر الطلبات، تأخيرات SLA، وسجل أحداث التشغيل.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-5">
          <p className="font-bold text-primary">طلبات عالية المخاطر</p>
          <p className="mt-2 text-3xl font-extrabold">{riskyOrders.length}</p>
        </Card>
        <Card className="p-5">
          <p className="font-bold text-primary">طلبات متجاوزة SLA</p>
          <p className="mt-2 text-3xl font-extrabold">{breachedOrders.length}</p>
        </Card>
      </div>

      <Card className="p-4 md:p-6">
        <h2 className="font-bold text-primary">طلبات قريبة من خرق SLA (خلال 24 ساعة)</h2>
        {nearBreachOrders.length === 0 ? (
          <p className="mt-3 text-sm text-rosera-gray">لا توجد طلبات حرجة حاليًا.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {nearBreachOrders.map((o) => {
              const s = Array.isArray(o.shipments) ? o.shipments[0] : o.shipments
              return (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
                  <span className="font-semibold" dir="ltr">#{o.id.slice(0, 8)}</span>
                  <span>{s?.status ?? 'pending'}</span>
                  <span dir="ltr">{s?.expected_delivery_at ? new Date(s.expected_delivery_at).toLocaleString('en-GB') : '—'}</span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card className="p-4 md:p-6">
        <h2 className="font-bold text-primary">تحديث مخاطر الطلب</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <Label>الطلب</Label>
            <Select value={riskOrderId} onValueChange={setRiskOrderId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="اختاري طلب" />
              </SelectTrigger>
              <SelectContent>
                {orders.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    #{o.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Risk Score (0-100)</Label>
            <Input className="mt-2" dir="ltr" value={riskScore} onChange={(e) => setRiskScore(e.target.value)} />
          </div>
          <div>
            <Label>Risk Flags (comma separated)</Label>
            <Input className="mt-2" dir="ltr" value={riskFlagsText} onChange={(e) => setRiskFlagsText(e.target.value)} placeholder="address_mismatch,velocity_risk" />
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={() => void updateRisk()} disabled={savingRisk}>
            {savingRisk ? 'جاري الحفظ...' : 'حفظ المخاطر'}
          </Button>
        </div>
      </Card>

      <Card className="p-4 md:p-6">
        <h2 className="font-bold text-primary">إضافة حدث تشغيلي</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div>
            <Label>الطلب</Label>
            <Select value={eventOrderId} onValueChange={setEventOrderId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="اختاري طلب" />
              </SelectTrigger>
              <SelectContent>
                {orders.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    #{o.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>نوع الحدث</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ops_note">ops_note</SelectItem>
                <SelectItem value="risk_review">risk_review</SelectItem>
                <SelectItem value="shipment_exception">shipment_exception</SelectItem>
                <SelectItem value="provider_verification">provider_verification</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>الملاحظة</Label>
            <Input className="mt-2" value={eventMessage} onChange={(e) => setEventMessage(e.target.value)} placeholder="تفاصيل الإجراء..." />
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={() => void addEvent()} disabled={savingEvent}>
            {savingEvent ? 'جاري الإضافة...' : 'إضافة الحدث'}
          </Button>
        </div>
      </Card>

      <Card className="p-4 md:p-6">
        <h2 className="font-bold text-primary">سجل الأحداث</h2>
        {loading ? (
          <p className="mt-4 text-sm text-rosera-gray">جاري التحميل...</p>
        ) : events.length === 0 ? (
          <p className="mt-4 text-sm text-rosera-gray">لا توجد أحداث بعد.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {events.map((e) => (
              <div key={e.id} className="rounded-xl border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold" dir="ltr">
                    #{e.order_id.slice(0, 8)} — {e.event_type}
                  </p>
                  <p className="text-xs text-rosera-gray" dir="ltr">
                    {new Date(e.created_at).toLocaleString('en-GB')}
                  </p>
                </div>
                <p className="mt-1 text-rosera-gray">
                  {String(e.event_data?.message ?? '—')}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
