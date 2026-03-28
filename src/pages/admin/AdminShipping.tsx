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

type PartnerRow = {
  id: string
  name_ar: string
  code: string | null
  api_base_url: string | null
  is_active: boolean
}

type ShipmentNested = {
  id: string
  shipping_partner_id: string | null
  tracking_number: string | null
  status: string
  tracking_url: string | null
}

type OrderRow = {
  id: string
  status: string
  total: number
  created_at: string
  delivery_address: string | null
  shipments: ShipmentNested | ShipmentNested[] | null
}

const statusOptions = ['pending', 'ready', 'in_transit', 'delivered', 'failed', 'returned']

export default function AdminShipping() {
  const [partners, setPartners] = useState<PartnerRow[]>([])
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)

  const [partnerName, setPartnerName] = useState('')
  const [partnerCode, setPartnerCode] = useState('')
  const [partnerApi, setPartnerApi] = useState('')
  const [creatingPartner, setCreatingPartner] = useState(false)

  const [orderId, setOrderId] = useState('')
  const [partnerId, setPartnerId] = useState('')
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingUrl, setTrackingUrl] = useState('')
  const [shipmentStatus, setShipmentStatus] = useState('ready')
  const [savingShipment, setSavingShipment] = useState(false)

  const activePartners = useMemo(() => partners.filter((p) => p.is_active), [partners])

  const load = async () => {
    setLoading(true)
    try {
      const [partnersRes, ordersRes] = await Promise.all([
        supabase
          .from('shipping_partners')
          .select('id, name_ar, code, api_base_url, is_active')
          .order('created_at', { ascending: false }),
        supabase
          .from('orders')
          .select('id, status, total, created_at, delivery_address, shipments(id, shipping_partner_id, tracking_number, status, tracking_url)')
          .order('created_at', { ascending: false })
          .limit(200),
      ])
      if (partnersRes.error) throw partnersRes.error
      if (ordersRes.error) throw ordersRes.error
      setPartners((partnersRes.data ?? []) as PartnerRow[])
      setOrders((ordersRes.data ?? []) as OrderRow[])
    } catch {
      toast.error('تعذر تحميل بيانات الشحن')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const createPartner = async () => {
    if (!partnerName.trim()) {
      toast.error('اسم شركة الشحن مطلوب')
      return
    }
    setCreatingPartner(true)
    try {
      const { error } = await supabase.from('shipping_partners').insert({
        name_ar: partnerName.trim(),
        code: partnerCode.trim() || null,
        api_base_url: partnerApi.trim() || null,
        is_active: true,
      })
      if (error) throw error
      toast.success('تمت إضافة شركة الشحن')
      setPartnerName('')
      setPartnerCode('')
      setPartnerApi('')
      await load()
    } catch {
      toast.error('فشلت إضافة شركة الشحن')
    } finally {
      setCreatingPartner(false)
    }
  }

  const saveShipment = async () => {
    if (!orderId || !partnerId) {
      toast.error('اختاري الطلب وشركة الشحن')
      return
    }
    if (!trackingNumber.trim()) {
      toast.error('رقم التتبع مطلوب')
      return
    }
    setSavingShipment(true)
    try {
      const { error } = await supabase.from('shipments').upsert(
        {
          order_id: orderId,
          shipping_partner_id: partnerId,
          tracking_number: trackingNumber.trim(),
          status: shipmentStatus,
          tracking_url: trackingUrl.trim() || null,
          shipped_at: shipmentStatus === 'in_transit' || shipmentStatus === 'delivered' ? new Date().toISOString() : null,
          delivered_at: shipmentStatus === 'delivered' ? new Date().toISOString() : null,
        },
        { onConflict: 'order_id' }
      )
      if (error) throw error
      toast.success('تم حفظ الشحنة/التتبع')
      await load()
    } catch {
      toast.error('فشل حفظ بيانات الشحنة')
    } finally {
      setSavingShipment(false)
    }
  }

  const updateShipmentStatus = async (order: OrderRow, nextStatus: string) => {
    const nested = Array.isArray(order.shipments) ? order.shipments[0] : order.shipments
    if (!nested?.id) {
      toast.error('لا توجد شحنة مرتبطة بهذا الطلب')
      return
    }
    try {
      const { error } = await supabase
        .from('shipments')
        .update({
          status: nextStatus,
          shipped_at: nextStatus === 'in_transit' || nextStatus === 'delivered' ? new Date().toISOString() : null,
          delivered_at: nextStatus === 'delivered' ? new Date().toISOString() : null,
        })
        .eq('id', nested.id)
      if (error) throw error
      toast.success('تم تحديث حالة الشحنة')
      await load()
    } catch {
      toast.error('تعذر تحديث حالة الشحنة')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">العمليات والشحن</h1>
        <p className="mt-2 text-sm text-foreground">
          إدارة شركات الشحن، إنشاء الشحنات، وتحديث حالة التتبع.
        </p>
      </div>

      <Card className="p-4 md:p-6">
        <h2 className="font-bold text-primary">إضافة شركة شحن</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <Label>اسم شركة الشحن</Label>
            <Input className="mt-2" value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="مثال: سمسا" />
          </div>
          <div>
            <Label>الكود</Label>
            <Input className="mt-2" dir="ltr" value={partnerCode} onChange={(e) => setPartnerCode(e.target.value)} placeholder="SMSA" />
          </div>
          <div className="md:col-span-2">
            <Label>API Base URL (اختياري)</Label>
            <Input className="mt-2" dir="ltr" value={partnerApi} onChange={(e) => setPartnerApi(e.target.value)} placeholder="https://api.shipping.com/v1" />
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={() => void createPartner()} disabled={creatingPartner}>
            {creatingPartner ? 'جاري الإضافة...' : 'إضافة شركة الشحن'}
          </Button>
        </div>
      </Card>

      <Card className="p-4 md:p-6">
        <h2 className="font-bold text-primary">إنشاء/تحديث شحنة</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>الطلب</Label>
            <Select value={orderId} onValueChange={setOrderId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="اختاري طلب" />
              </SelectTrigger>
              <SelectContent>
                {orders.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {`#${o.id.slice(0, 8)} - ${Number(o.total).toLocaleString('en-US')} SAR`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>شركة الشحن</Label>
            <Select value={partnerId} onValueChange={setPartnerId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="اختاري شركة" />
              </SelectTrigger>
              <SelectContent>
                {activePartners.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name_ar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>حالة الشحنة</Label>
            <Select value={shipmentStatus} onValueChange={setShipmentStatus}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>رقم التتبع</Label>
            <Input className="mt-2" dir="ltr" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="TRK-123456" />
          </div>
          <div className="md:col-span-2">
            <Label>رابط التتبع (اختياري)</Label>
            <Input className="mt-2" dir="ltr" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} placeholder="https://track.example.com/TRK-123456" />
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={() => void saveShipment()} disabled={savingShipment}>
            {savingShipment ? 'جاري الحفظ...' : 'حفظ الشحنة'}
          </Button>
        </div>
      </Card>

      <Card className="p-4 md:p-6">
        <h2 className="font-bold text-primary">الطلبات والتتبع</h2>
        {loading ? (
          <p className="mt-4 text-sm text-rosera-gray">جاري التحميل...</p>
        ) : orders.length === 0 ? (
          <p className="mt-4 text-sm text-rosera-gray">لا توجد طلبات بعد.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="p-3 text-start">رقم الطلب</th>
                  <th className="p-3">القيمة</th>
                  <th className="p-3">حالة الطلب</th>
                  <th className="p-3">رقم التتبع</th>
                  <th className="p-3">حالة الشحنة</th>
                  <th className="p-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => {
                  const shipment = Array.isArray(o.shipments) ? o.shipments[0] : o.shipments
                  return (
                    <tr key={o.id} className="border-b">
                      <td className="p-3 font-semibold" dir="ltr">
                        #{o.id.slice(0, 8)}
                      </td>
                      <td className="p-3 text-center" dir="ltr">
                        {Number(o.total).toLocaleString('en-US')} SAR
                      </td>
                      <td className="p-3 text-center">{o.status}</td>
                      <td className="p-3 text-center" dir="ltr">
                        {shipment?.tracking_number || '—'}
                      </td>
                      <td className="p-3 text-center">{shipment?.status || 'no_shipment'}</td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          {shipment?.tracking_url && (
                            <a
                              href={shipment.tracking_url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-md border px-2 py-1 text-xs font-semibold text-primary"
                            >
                              فتح رابط التتبع
                            </a>
                          )}
                          {shipment && (
                            <Select
                              value={shipment.status}
                              onValueChange={(next) => void updateShipmentStatus(o, next)}
                            >
                              <SelectTrigger className="h-8 w-40">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {statusOptions.map((s) => (
                                  <SelectItem key={s} value={s}>
                                    {s}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
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
