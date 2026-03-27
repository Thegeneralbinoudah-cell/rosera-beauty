import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getMySalonBusinessId } from '@/lib/salonOwner'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'

type Status = 'pending' | 'confirmed' | 'completed' | 'cancelled'

type Row = {
  id: string
  user_id: string
  service_id: string | null
  status: string
  booking_date: string
  booking_time: string
  total_price: number | null
}

const tabs: { key: Status; label: string }[] = [
  { key: 'pending', label: 'في الانتظار' },
  { key: 'confirmed', label: 'مؤكد' },
  { key: 'completed', label: 'مكتمل' },
  { key: 'cancelled', label: 'ملغى' },
]

const statusLabel: Record<string, string> = {
  pending: 'في الانتظار',
  confirmed: 'مؤكد',
  completed: 'مكتمل',
  cancelled: 'ملغى',
}

async function notifyUser(userId: string, title: string, body: string, type: string) {
  await supabase.functions.invoke('send-notification', {
    body: { user_id: userId, title, body, type },
  })
}

export default function OwnerBookings() {
  const { user } = useAuth()
  const [bid, setBid] = useState<string | null>(null)
  const [tab, setTab] = useState<Status>('pending')
  const [rows, setRows] = useState<Row[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [svcNames, setSvcNames] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    if (!user || !bid) return
    const { data, error } = await supabase
      .from('bookings')
      .select('id, user_id, service_id, status, booking_date, booking_time, total_price')
      .eq('business_id', bid)
      .order('booking_date', { ascending: false })
      .order('booking_time', { ascending: false })
    if (error) {
      toast.error('تعذر تحميل الحجوزات')
      return
    }
    const list = (data ?? []) as Row[]
    setRows(list)
    const uids = [...new Set(list.map((r) => r.user_id))]
    const sids = [...new Set(list.map((r) => r.service_id).filter(Boolean) as string[])]
    if (uids.length) {
      const { data: p, error: pubErr } = await supabase.from('public_profiles').select('id, full_name').in('id', uids)
      if (pubErr) {
        console.error(pubErr)
        toast.error('تعذر تحميل أسماء العميلات')
      }
      const nm: Record<string, string> = {}
      ;(p ?? []).forEach((x: { id: string; full_name: string | null }) => {
        nm[x.id] = x.full_name?.trim() || 'عميلة'
      })
      setNames(nm)
    } else setNames({})
    if (sids.length) {
      const { data: s } = await supabase.from('services').select('id, name_ar').in('id', sids)
      const sn: Record<string, string> = {}
      ;(s ?? []).forEach((x: { id: string; name_ar: string }) => {
        sn[x.id] = x.name_ar
      })
      setSvcNames(sn)
    } else setSvcNames({})
  }, [user, bid])

  useEffect(() => {
    if (!user) return
    void getMySalonBusinessId(user.id).then(setBid)
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const updateStatus = async (id: string, status: string, clientUserId?: string) => {
    try {
      const { error } = await supabase.from('bookings').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      if (status === 'confirmed' && clientUserId) {
        void notifyUser(clientUserId, 'تأكيد الحجز', 'تم تأكيد حجزك من الصالون.', 'booking_confirmed')
      }
      toast.success('تم التحديث')
      void load()
    } catch {
      toast.error('فشل التحديث')
    }
  }

  const filtered = useMemo(() => rows.filter((r) => r.status === tab), [rows, tab])

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-extrabold text-foreground">الحجوزات</h1>
      <p className="text-sm text-muted-foreground">قبول، تأكيد، إكمال، أو إلغاء الحجوزات</p>
      <Tabs value={tab} onValueChange={(v) => setTab(v as Status)} className="mt-4">
        <TabsList className="flex h-auto w-full flex-wrap gap-1 bg-muted/50 p-1">
          {tabs.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="flex-1 text-xs sm:text-sm">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((t) => (
          <TabsContent key={t.key} value={t.key} className="mt-4 space-y-3">
            {t.key === tab && filtered.length === 0 && (
              <p className="py-8 text-center text-rosera-gray">لا توجد حجوزات في هذا القسم</p>
            )}
            {t.key === tab &&
              filtered.map((b) => (
                <BookingCard
                  key={b.id}
                  b={b}
                  clientName={names[b.user_id] ?? 'عميلة'}
                  serviceName={b.service_id ? svcNames[b.service_id] ?? 'خدمة' : 'خدمة'}
                  onAccept={() => void updateStatus(b.id, 'confirmed', b.user_id)}
                  onReject={() => void updateStatus(b.id, 'cancelled')}
                  onComplete={() => void updateStatus(b.id, 'completed')}
                />
              ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

function BookingCard({
  b,
  clientName,
  serviceName,
  onAccept,
  onReject,
  onComplete,
}: {
  b: Row
  clientName: string
  serviceName: string
  onAccept: () => void
  onReject: () => void
  onComplete: () => void
}) {
  return (
    <Card className="border-pink-100/70 p-4 shadow-sm dark:border-border">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-bold">{clientName}</p>
          <p className="text-sm text-rosera-gray">{serviceName}</p>
          <p className="mt-1 text-sm" dir="ltr">
            {b.booking_date} — {String(b.booking_time).slice(0, 5)}
          </p>
          {b.total_price != null && (
            <p className="text-sm font-semibold text-accent">{Number(b.total_price).toLocaleString('ar-SA')} ر.س</p>
          )}
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">
          {statusLabel[b.status] ?? b.status}
        </span>
      </div>
      {b.status === 'pending' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" className="rounded-xl bg-green-600 hover:bg-green-700" onClick={onAccept}>
            قبول
          </Button>
          <Button size="sm" variant="destructive" className="rounded-xl" onClick={onReject}>
            إلغاء
          </Button>
        </div>
      )}
      {b.status === 'confirmed' && (
        <Button size="sm" className="mt-3 rounded-xl" onClick={onComplete}>
          إكمال
        </Button>
      )}
    </Card>
  )
}
