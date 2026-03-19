import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getMySalonBusinessId } from '@/lib/salonOwner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Svc = {
  id: string
  name_ar: string
  price: number
  duration_minutes: number
  category: string
}

const CATS = [
  { v: 'hair', l: 'شعر' },
  { v: 'nails', l: 'أظافر' },
  { v: 'skin', l: 'بشرة' },
  { v: 'makeup', l: 'مكياج' },
  { v: 'other', l: 'أخرى' },
]

export default function OwnerServices() {
  const { user } = useAuth()
  const [bid, setBid] = useState<string | null>(null)
  const [services, setServices] = useState<Svc[]>([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [duration, setDuration] = useState('30')
  const [category, setCategory] = useState('hair')
  const [edit, setEdit] = useState<Svc | null>(null)
  const [del, setDel] = useState<Svc | null>(null)

  const load = () => {
    if (!bid) return
    void supabase
      .from('services')
      .select('id, name_ar, price, duration_minutes, category')
      .eq('business_id', bid)
      .then(({ data }) => setServices((data ?? []) as Svc[]))
  }

  useEffect(() => {
    if (!user) return
    void getMySalonBusinessId(user.id).then(setBid)
  }, [user])

  useEffect(() => {
    load()
  }, [bid])

  const add = async () => {
    if (!bid || !name.trim()) return
    try {
      const { error } = await supabase.from('services').insert({
        business_id: bid,
        name_ar: name.trim(),
        price: parseFloat(price) || 0,
        duration_minutes: parseInt(duration, 10) || 30,
        category,
      })
      if (error) throw error
      setName('')
      setPrice('')
      toast.success('أُضيفت الخدمة')
      load()
    } catch {
      toast.error('فشل الإضافة')
    }
  }

  const saveEdit = async () => {
    if (!edit) return
    try {
      const { error } = await supabase
        .from('services')
        .update({
          name_ar: edit.name_ar,
          price: edit.price,
          duration_minutes: edit.duration_minutes,
          category: edit.category,
        })
        .eq('id', edit.id)
      if (error) throw error
      toast.success('تم الحفظ')
      setEdit(null)
      load()
    } catch {
      toast.error('فشل الحفظ')
    }
  }

  const confirmDelete = async () => {
    if (!del) return
    try {
      const { error } = await supabase.from('services').delete().eq('id', del.id)
      if (error) throw error
      toast.success('حُذفت الخدمة')
      setDel(null)
      load()
    } catch {
      toast.error('فشل الحذف — قد تكون مرتبطة بحجوزات')
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">إدارة الخدمات</h1>
      <div className="mt-6 space-y-3 rounded-xl border bg-white p-4 dark:bg-card">
        <p className="font-bold text-sm">إضافة خدمة</p>
        <div className="flex flex-wrap gap-2">
          <Input placeholder="اسم الخدمة" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
          <Input placeholder="السعر" type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="w-28" />
          <Input placeholder="المدة (دقيقة)" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} className="w-32" />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATS.map((c) => (
                <SelectItem key={c.v} value={c.v}>
                  {c.l}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => void add()}>إضافة</Button>
        </div>
      </div>
      <ul className="mt-6 space-y-2">
        {services.map((s) => (
          <li
            key={s.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-white p-4 dark:bg-card"
          >
            <div>
              <span className="font-bold">{s.name_ar}</span>
              <span className="me-3 text-sm text-rosera-gray">
                {s.duration_minutes} د — {CATS.find((c) => c.v === s.category)?.l ?? s.category}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-primary">{s.price} ر.س</span>
              <Button size="sm" variant="outline" onClick={() => setEdit({ ...s })}>
                تعديل
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setDel(s)}>
                حذف
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={!!edit} onOpenChange={() => setEdit(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل الخدمة</DialogTitle>
          </DialogHeader>
          {edit && (
            <div className="space-y-3 py-2">
              <Input value={edit.name_ar} onChange={(e) => setEdit({ ...edit, name_ar: e.target.value })} />
              <Input
                type="number"
                value={edit.price}
                onChange={(e) => setEdit({ ...edit, price: parseFloat(e.target.value) || 0 })}
              />
              <Input
                type="number"
                value={edit.duration_minutes}
                onChange={(e) => setEdit({ ...edit, duration_minutes: parseInt(e.target.value, 10) || 30 })}
              />
              <Select value={edit.category} onValueChange={(v) => setEdit({ ...edit, category: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATS.map((c) => (
                    <SelectItem key={c.v} value={c.v}>
                      {c.l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button onClick={() => void saveEdit()}>حفظ</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!del} onOpenChange={() => setDel(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>حذف الخدمة؟</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-rosera-gray">لن يمكن التراجع. تأكدي أن لا حجوزات نشطة عليها.</p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => setDel(null)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={() => void confirmDelete()}>
              حذف نهائي
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
