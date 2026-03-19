import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Row = {
  id: string
  booking_date: string
  status: string
  business_id: string
  businesses: { name_ar: string } | null
}

export default function AdminBookings() {
  const [rows, setRows] = useState<Row[]>([])
  const [salons, setSalons] = useState<{ id: string; name_ar: string }[]>([])
  const [status, setStatus] = useState<string>('all')
  const [salonId, setSalonId] = useState<string>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    void supabase
      .from('bookings')
      .select('id, booking_date, status, business_id, businesses(name_ar)')
      .order('booking_date', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        const raw = (data ?? []) as {
          id: string
          booking_date: string
          status: string
          business_id: string
          businesses: { name_ar: string } | { name_ar: string }[] | null
        }[]
        setRows(
          raw.map((r) => ({
            ...r,
            businesses: Array.isArray(r.businesses) ? r.businesses[0] ?? null : r.businesses,
          }))
        )
      })
    void supabase.from('businesses').select('id, name_ar').order('name_ar').then(({ data }) => setSalons(data ?? []))
  }, [])

  const filtered = useMemo(() => {
    let r = rows
    if (status !== 'all') r = r.filter((x) => x.status === status)
    if (salonId !== 'all') r = r.filter((x) => x.business_id === salonId)
    if (from) r = r.filter((x) => x.booking_date >= from)
    if (to) r = r.filter((x) => x.booking_date <= to)
    return r
  }, [rows, status, salonId, from, to])

  return (
    <div>
      <h1 className="text-2xl font-bold">كل الحجوزات</h1>
      <div className="mt-6 flex flex-wrap gap-3">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="pending">قيد الانتظار</SelectItem>
            <SelectItem value="confirmed">مؤكد</SelectItem>
            <SelectItem value="completed">مكتمل</SelectItem>
            <SelectItem value="cancelled">ملغى</SelectItem>
          </SelectContent>
        </Select>
        <Select value={salonId} onValueChange={setSalonId}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="الصالون" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الصالونات</SelectItem>
            {salons.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name_ar}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
      </div>
      <div className="mt-6 space-y-2">
        {filtered.map((r) => (
          <div key={r.id} className="flex flex-wrap justify-between gap-2 rounded-xl border bg-white p-4 dark:bg-card">
            <span className="font-medium">{r.businesses?.name_ar}</span>
            <span dir="ltr">{r.booking_date}</span>
            <span className="text-primary">{r.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
