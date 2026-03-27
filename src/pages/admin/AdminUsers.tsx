import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { isPlatformOwner } from '@/lib/platformOwner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const ROLES = [
  { value: '', label: 'كل الأدوار' },
  { value: 'user', label: 'مستخدم' },
  { value: 'owner', label: 'مالك' },
  { value: 'admin', label: 'مسؤول' },
  { value: 'supervisor', label: 'مشرف' },
]

type Row = {
  id: string
  full_name: string | null
  email: string | null
  role: string | null
  is_suspended?: boolean | null
}

export default function AdminUsers() {
  const { profile } = useAuth()
  const isOwner = isPlatformOwner(profile)
  const [rows, setRows] = useState<Row[]>([])
  const [q, setQ] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [detail, setDetail] = useState<Row | null>(null)
  const [bookings, setBookings] = useState<{ id: string; booking_date: string; status: string }[]>([])
  const [changeRoleRow, setChangeRoleRow] = useState<Row | null>(null)
  const [newRole, setNewRole] = useState<string>('user')

  const load = () => {
    void supabase
      .from('profiles')
      .select('id, full_name, email, role, is_suspended')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => setRows((data ?? []) as Row[]))
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    let list = rows
    if (roleFilter) {
      list = list.filter((r) => (r.role ?? 'user').toLowerCase() === roleFilter)
    }
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      list = list.filter(
        (r) =>
          (r.full_name ?? '').toLowerCase().includes(s) ||
          (r.email ?? '').toLowerCase().includes(s) ||
          (r.id ?? '').includes(s)
      )
    }
    return list
  }, [rows, q, roleFilter])

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

  const changeRole = async () => {
    if (!changeRoleRow || !['user', 'owner', 'admin', 'supervisor'].includes(newRole)) return
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', changeRoleRow.id)
      if (error) throw error
      setRows((prev) => prev.map((x) => (x.id === changeRoleRow.id ? { ...x, role: newRole } : x)))
      if (detail?.id === changeRoleRow.id) setDetail({ ...detail, role: newRole })
      setChangeRoleRow(null)
      toast.success('تم تغيير الدور')
    } catch {
      toast.error('فشل تغيير الدور')
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">المستخدمون</h1>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Input
          placeholder="بحث بالاسم أو البريد"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="الدور" />
          </SelectTrigger>
          <SelectContent>
            {ROLES.map((r) => (
              <SelectItem key={r.value || 'all'} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="mt-6 overflow-x-auto rounded-xl border bg-card">
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
                <td className="p-3 text-center">{r.is_suspended ? 'معلّق' : 'نشط'}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" onClick={() => void openDetail(r)}>
                      تفاصيل
                    </Button>
                    <Button
                      size="sm"
                      variant={r.is_suspended ? 'secondary' : 'destructive'}
                      onClick={() => void toggleSuspend(r)}
                    >
                      {r.is_suspended ? 'تفعيل' : 'تعليق'}
                    </Button>
                    {isOwner && (
                      <Button size="sm" variant="outline" onClick={() => { setChangeRoleRow(r); setNewRole((r.role ?? 'user').toLowerCase()) }}>
                        تغيير الدور
                      </Button>
                    )}
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
              <p className="mt-4 font-bold text-primary">حجوزاتها</p>
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

      <Dialog open={!!changeRoleRow} onOpenChange={() => setChangeRoleRow(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تغيير الدور</DialogTitle>
          </DialogHeader>
          {changeRoleRow && (
            <div className="space-y-4">
              <p className="text-sm">
                المستخدم: <strong>{changeRoleRow.full_name ?? changeRoleRow.email ?? changeRoleRow.id}</strong>
              </p>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">مستخدم</SelectItem>
                  <SelectItem value="owner">مالك</SelectItem>
                  <SelectItem value="admin">مسؤول</SelectItem>
                  <SelectItem value="supervisor">مشرف</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setChangeRoleRow(null)}>
                  إلغاء
                </Button>
                <Button onClick={() => void changeRole()}>حفظ</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
