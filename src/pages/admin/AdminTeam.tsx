import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'

type AdminRow = {
  id: string
  user_id: string
  role: string
  created_at: string
  full_name?: string | null
  email?: string | null
}

export default function AdminTeam() {
  const { profile } = useAuth()
  const isOwner = (profile?.role ?? '').toLowerCase() === 'owner'
  const [rows, setRows] = useState<AdminRow[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState<'admin' | 'supervisor'>('admin')
  const [addLoading, setAddLoading] = useState(false)

  const load = async () => {
    const { data: adminsData, error: e1 } = await supabase
      .from('admins')
      .select('id, user_id, role, created_at')
      .order('created_at', { ascending: false })
    if (e1) {
      toast.error('تعذر تحميل الفريق')
      return
    }
    const list = (adminsData ?? []) as { id: string; user_id: string; role: string; created_at: string }[]
    if (list.length === 0) {
      setRows([])
      return
    }
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', list.map((a) => a.user_id))
    const byId = new Map((profilesData ?? []).map((p: { id: string; full_name?: string; email?: string }) => [p.id, p]))
    setRows(
      list.map((a) => ({
        ...a,
        full_name: byId.get(a.user_id)?.full_name ?? null,
        email: byId.get(a.user_id)?.email ?? null,
      }))
    )
  }

  useEffect(() => {
    load()
  }, [])

  const addMember = async () => {
    const email = addEmail.trim().toLowerCase()
    if (!email) {
      toast.error('أدخلي البريد الإلكتروني')
      return
    }
    setAddLoading(true)
    try {
      const { data: prof, error: findErr } = await supabase
        .from('profiles')
        .select('id')
        .ilike('email', email)
        .maybeSingle()
      if (findErr) throw findErr
      if (!prof) {
        toast.error('لا يوجد مستخدم بهذا البريد — يجب التسجيل أولاً')
        return
      }
      const userId = (prof as { id: string }).id
      const { error: upErr } = await supabase.from('profiles').update({ role: addRole }).eq('id', userId)
      if (upErr) throw upErr
      const { error: insErr } = await supabase.from('admins').upsert(
        { user_id: userId, role: addRole },
        { onConflict: 'user_id' }
      )
      if (insErr) throw insErr
      toast.success('تمت إضافة العضو')
      setAddOpen(false)
      setAddEmail('')
      setAddRole('admin')
      load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل الإضافة')
    } finally {
      setAddLoading(false)
    }
  }

  const removeMember = async (r: AdminRow) => {
    if (!isOwner) return
    try {
      const { error: upErr } = await supabase.from('profiles').update({ role: 'user' }).eq('id', r.user_id)
      if (upErr) throw upErr
      const { error: delErr } = await supabase.from('admins').delete().eq('user_id', r.user_id)
      if (delErr) throw delErr
      toast.success('تم حذف العضو')
      load()
    } catch {
      toast.error('فشل الحذف')
    }
  }

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return d
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">الفريق</h1>
        <Button onClick={() => setAddOpen(true)}>إضافة عضو</Button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        عرض المسؤولين والمشرفين. المالك فقط يمكنه حذف الأعضاء.
      </p>
      <div className="mt-6 overflow-x-auto rounded-xl border bg-white dark:bg-card">
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr>
              <th className="p-3 text-start">الاسم</th>
              <th className="p-3">البريد</th>
              <th className="p-3">الدور</th>
              <th className="p-3">تاريخ الإضافة</th>
              {isOwner && <th className="p-3">إجراء</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-3">{r.full_name ?? '—'}</td>
                <td className="p-3">{r.email ?? '—'}</td>
                <td className="p-3 text-center">{r.role === 'owner' ? 'مالك' : r.role === 'admin' ? 'مسؤول' : 'مشرف'}</td>
                <td className="p-3" dir="ltr">
                  {formatDate(r.created_at)}
                </td>
                {isOwner && (
                  <td className="p-3">
                    {r.role !== 'owner' && (
                      <Button size="sm" variant="destructive" onClick={() => void removeMember(r)}>
                        حذف
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="mt-6 text-center text-muted-foreground">لا يوجد أعضاء في الفريق بعد.</p>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة عضو للفريق</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>البريد الإلكتروني</Label>
              <Input
                type="email"
                dir="ltr"
                className="mt-2"
                placeholder="user@example.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
              />
            </div>
            <div>
              <Label>الدور</Label>
              <Select value={addRole} onValueChange={(v) => setAddRole(v as 'admin' | 'supervisor')}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">مسؤول</SelectItem>
                  <SelectItem value="supervisor">مشرف</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>
                إلغاء
              </Button>
              <Button onClick={() => void addMember()} disabled={addLoading}>
                {addLoading ? 'جاري الإضافة...' : 'إضافة'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
