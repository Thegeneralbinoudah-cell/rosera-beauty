import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type Row = {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
  is_suspended?: boolean | null
}

export default function AdminUsers() {
  const [rows, setRows] = useState<Row[]>([])
  const [q, setQ] = useState('')
  const [detail, setDetail] = useState<Row | null>(null)
  const [bookings, setBookings] = useState<{ id: string; booking_date: string; status: string }[]>([])

  const load = () => {
    void supabase
      .from('profiles')
      .select('id, full_name, email, role, is_suspended')
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => setRows((data ?? []) as Row[]))
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    if (!q.trim()) return rows
    const s = q.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (r.full_name ?? '').toLowerCase().includes(s) ||
        (r.email ?? '').toLowerCase().includes(s) ||
        (r.id ?? '').includes(s)
    )
  }, [rows, q])

  const openDetail = async (r: Row) => {
    setDetail(r)
    const { data } = await supabase
      .from('bookings')
      .select('id, booking_date, status')
      .eq('user_id', r.id)
      .order('booking_date', { ascending: false })
      .limit(20)
    setBookings(data ?? [])
  }

  const toggleSuspend = async (r: Row) => {
    const next = !r.is_suspended
    try {
      const { error } = await supabase.from('profiles').update({ is_suspended: next }).eq('id', r.id)
      if (error) throw error
      setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_suspended: next } : x)))
      if (detail?.id === r.id) setDetail({ ...r, is_suspended: next })
      toast.success(next ? 'تم التعليق' : 'تم التفعيل')
    } catch {
      toast.error('فشل — تأكدي من ترحيل 008 وصلاحيات الأدمن')
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">المستخدمون</h1>
      <Input placeholder="بحث بالاسم أو البريد" value={q} onChange={(e) => setQ(e.target.value)} className="mt-4 max-w-md" />
      <div className="mt-6 overflow-x-auto rounded-xl border bg-white dark:bg-card">
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr>
              <th className="p-3 text-start">الاسم</th>
              <th className="p-3">البريد</th>
              <th className="p-3">الدور</th>
              <th className="p-3">حالة</th>
              <th className="p-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-3">{r.full_name ?? '—'}</td>
                <td className="p-3">{r.email ?? '—'}</td>
                <td className="p-3 text-center">{r.role ?? '—'}</td>
                <td className="p-3 text-center">{r.is_suspended ? 'موقوف' : 'نشط'}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => void openDetail(r)}>
                      تفاصيل
                    </Button>
                    <Button size="sm" variant={r.is_suspended ? 'secondary' : 'destructive'} onClick={() => void toggleSuspend(r)}>
                      {r.is_suspended ? 'تفعيل' : 'تعليق'}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!detail} onOpenChange={() => setDetail(null)}>
        <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل المستخدم</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-2 text-sm">
              <p>
                <strong>الاسم:</strong> {detail.full_name}
              </p>
              <p>
                <strong>البريد:</strong> {detail.email}
              </p>
              <p className="font-bold text-primary mt-4">حجوزاتها</p>
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {bookings.length === 0 && <li className="text-rosera-gray">لا حجوزات</li>}
                {bookings.map((b) => (
                  <li key={b.id} className="flex justify-between border-b py-1" dir="ltr">
                    <span>{b.booking_date}</span>
                    <span>{b.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
