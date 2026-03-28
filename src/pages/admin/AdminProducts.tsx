import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'

type ProductRow = {
  id: string
  name_ar: string
  brand_ar: string | null
  description_ar: string | null
  category: string
  image_url: string | null
  price: number
  rating: number | null
  review_count: number | null
  is_active: boolean
  is_demo: boolean
  source_type: 'manual' | 'imported' | 'provider_api' | 'legacy_seed'
}

const CATEGORIES = ['عناية بالبشرة', 'مكياج', 'عناية بالشعر', 'عطور', 'أظافر']

const initialForm = {
  name_ar: '',
  brand_ar: '',
  description_ar: '',
  category: 'عناية بالبشرة',
  image_url: '',
  price: '',
}

export default function AdminProducts() {
  const [rows, setRows] = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')

  const [createForm, setCreateForm] = useState(initialForm)
  const [savingCreate, setSavingCreate] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState(initialForm)
  const [savingEdit, setSavingEdit] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('products')
        .select('id, name_ar, brand_ar, description_ar, category, image_url, price, rating, review_count, is_active, is_demo, source_type')
        .order('created_at', { ascending: false })
      if (error) throw error
      setRows((data ?? []) as ProductRow[])
    } catch {
      toast.error('تعذر تحميل المنتجات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const filtered = useMemo(() => {
    let list = rows
    if (statusFilter === 'active') list = list.filter((x) => x.is_active)
    if (statusFilter === 'inactive') list = list.filter((x) => !x.is_active)
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      list = list.filter(
        (x) =>
          x.name_ar.toLowerCase().includes(s) ||
          (x.brand_ar ?? '').toLowerCase().includes(s) ||
          x.category.toLowerCase().includes(s)
      )
    }
    return list
  }, [rows, q, statusFilter])

  const createProduct = async () => {
    if (!createForm.name_ar.trim() || !createForm.price.trim()) {
      toast.error('الاسم والسعر مطلوبان')
      return
    }
    const price = Number(createForm.price)
    if (!Number.isFinite(price) || price <= 0) {
      toast.error('السعر غير صحيح')
      return
    }
    setSavingCreate(true)
    try {
      const payload = {
        name_ar: createForm.name_ar.trim(),
        brand_ar: createForm.brand_ar.trim() || null,
        description_ar: createForm.description_ar.trim() || null,
        category: createForm.category,
        image_url: createForm.image_url.trim() || null,
        price,
        is_active: true,
        is_demo: false,
        source_type: 'manual' as const,
      }
      const { error } = await supabase.from('products').insert(payload)
      if (error) throw error
      toast.success('تمت إضافة المنتج الحقيقي')
      setCreateForm(initialForm)
      await load()
    } catch {
      toast.error('فشلت إضافة المنتج')
    } finally {
      setSavingCreate(false)
    }
  }

  const startEdit = (row: ProductRow) => {
    setEditingId(row.id)
    setEditForm({
      name_ar: row.name_ar,
      brand_ar: row.brand_ar ?? '',
      description_ar: row.description_ar ?? '',
      category: row.category,
      image_url: row.image_url ?? '',
      price: String(row.price),
    })
  }

  const saveEdit = async () => {
    if (!editingId) return
    if (!editForm.name_ar.trim() || !editForm.price.trim()) {
      toast.error('الاسم والسعر مطلوبان')
      return
    }
    const price = Number(editForm.price)
    if (!Number.isFinite(price) || price <= 0) {
      toast.error('السعر غير صحيح')
      return
    }
    setSavingEdit(true)
    try {
      const { error } = await supabase
        .from('products')
        .update({
          name_ar: editForm.name_ar.trim(),
          brand_ar: editForm.brand_ar.trim() || null,
          description_ar: editForm.description_ar.trim() || null,
          category: editForm.category,
          image_url: editForm.image_url.trim() || null,
          price,
        })
        .eq('id', editingId)
      if (error) throw error
      toast.success('تم تحديث المنتج')
      setEditingId(null)
      await load()
    } catch {
      toast.error('فشل التحديث')
    } finally {
      setSavingEdit(false)
    }
  }

  const toggleActive = async (row: ProductRow) => {
    try {
      const { error } = await supabase
        .from('products')
        .update({ is_active: !row.is_active })
        .eq('id', row.id)
      if (error) throw error
      setRows((prev) =>
        prev.map((x) => (x.id === row.id ? { ...x, is_active: !x.is_active } : x))
      )
      toast.success('تم تحديث الحالة')
    } catch {
      toast.error('تعذر تحديث الحالة')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">إدخال المنتجات الحقيقية</h1>
        <p className="mt-2 text-sm text-foreground">
          هذه الشاشة مخصصة لإطلاق منتجات المتجر بشكل حقيقي وربطها بالمزوّدين.
        </p>
      </div>

      <Card className="p-4 md:p-6">
        <h2 className="font-bold text-primary">إضافة منتج جديد</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <Label>اسم المنتج</Label>
            <Input className="mt-2" value={createForm.name_ar} onChange={(e) => setCreateForm((p) => ({ ...p, name_ar: e.target.value }))} />
          </div>
          <div>
            <Label>العلامة التجارية</Label>
            <Input className="mt-2" value={createForm.brand_ar} onChange={(e) => setCreateForm((p) => ({ ...p, brand_ar: e.target.value }))} />
          </div>
          <div>
            <Label>التصنيف</Label>
            <Select value={createForm.category} onValueChange={(v) => setCreateForm((p) => ({ ...p, category: v }))}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>السعر (ر.س)</Label>
            <Input className="mt-2" dir="ltr" value={createForm.price} onChange={(e) => setCreateForm((p) => ({ ...p, price: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <Label>رابط الصورة</Label>
            <Input className="mt-2" dir="ltr" value={createForm.image_url} onChange={(e) => setCreateForm((p) => ({ ...p, image_url: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <Label>الوصف</Label>
            <Input className="mt-2" value={createForm.description_ar} onChange={(e) => setCreateForm((p) => ({ ...p, description_ar: e.target.value }))} />
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={() => void createProduct()} disabled={savingCreate}>
            {savingCreate ? 'جاري الحفظ...' : 'حفظ المنتج'}
          </Button>
        </div>
      </Card>

      <Card className="p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Input placeholder="بحث بالاسم/العلامة/التصنيف" className="max-w-sm" value={q} onChange={(e) => setQ(e.target.value)} />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'active' | 'inactive')}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المنتجات</SelectItem>
              <SelectItem value="active">النشطة فقط</SelectItem>
              <SelectItem value="inactive">غير النشطة</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-rosera-gray">جاري التحميل...</p>
        ) : filtered.length === 0 ? (
          <p className="mt-4 text-sm text-rosera-gray">لا توجد منتجات مطابقة.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="p-3 text-start">الاسم</th>
                  <th className="p-3">التصنيف</th>
                  <th className="p-3">السعر</th>
                  <th className="p-3">المصدر</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b">
                    <td className="p-3 font-semibold">{r.name_ar}</td>
                    <td className="p-3 text-center">{r.category}</td>
                    <td className="p-3 text-center" dir="ltr">{Number(r.price).toLocaleString('en-US')} SAR</td>
                    <td className="p-3 text-center" dir="ltr">{r.source_type}</td>
                    <td className="p-3 text-center">{r.is_active ? 'نشط' : 'متوقف'}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => startEdit(r)}>
                          تعديل
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void toggleActive(r)}>
                          {r.is_active ? 'إيقاف' : 'تفعيل'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editingId && (
        <Card className="p-4 md:p-6">
          <h2 className="font-bold text-primary">تعديل المنتج</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div>
              <Label>اسم المنتج</Label>
              <Input className="mt-2" value={editForm.name_ar} onChange={(e) => setEditForm((p) => ({ ...p, name_ar: e.target.value }))} />
            </div>
            <div>
              <Label>العلامة التجارية</Label>
              <Input className="mt-2" value={editForm.brand_ar} onChange={(e) => setEditForm((p) => ({ ...p, brand_ar: e.target.value }))} />
            </div>
            <div>
              <Label>التصنيف</Label>
              <Select value={editForm.category} onValueChange={(v) => setEditForm((p) => ({ ...p, category: v }))}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>السعر (ر.س)</Label>
              <Input className="mt-2" dir="ltr" value={editForm.price} onChange={(e) => setEditForm((p) => ({ ...p, price: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>رابط الصورة</Label>
              <Input className="mt-2" dir="ltr" value={editForm.image_url} onChange={(e) => setEditForm((p) => ({ ...p, image_url: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <Label>الوصف</Label>
              <Input className="mt-2" value={editForm.description_ar} onChange={(e) => setEditForm((p) => ({ ...p, description_ar: e.target.value }))} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => void saveEdit()} disabled={savingEdit}>
              {savingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات'}
            </Button>
            <Button variant="outline" onClick={() => setEditingId(null)}>
              إلغاء
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}
