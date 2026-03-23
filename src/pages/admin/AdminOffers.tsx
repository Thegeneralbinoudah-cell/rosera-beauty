import { useEffect, useState } from 'react'
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
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

type BizOpt = { id: string; name_ar: string }

type OfferListRow = {
  id: string
  business_id: string
  title: string | null
  title_ar: string | null
  discount_percentage: number | null
  start_date: string | null
  end_date: string | null
  is_active: boolean | null
  businesses?: { name_ar: string } | null
}

export default function AdminOffers() {
  const [biz, setBiz] = useState<BizOpt[]>([])
  const [rows, setRows] = useState<OfferListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [businessId, setBusinessId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [discount, setDiscount] = useState('15')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isActive, setIsActive] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const [bRes, oRes] = await Promise.all([
        supabase.from('businesses').select('id, name_ar').eq('is_active', true).order('name_ar').limit(500),
        supabase
          .from('offers')
          .select('id, business_id, title, title_ar, discount_percentage, start_date, end_date, is_active, businesses(name_ar)')
          .order('created_at', { ascending: false })
          .limit(80),
      ])
      if (bRes.error) throw bRes.error
      if (oRes.error) throw oRes.error
      setBiz((bRes.data ?? []) as BizOpt[])
      setRows((oRes.data ?? []) as unknown as OfferListRow[])
    } catch {
      toast.error('تعذر التحميل')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const submit = async () => {
    if (!businessId) {
      toast.error('اختر الصالون')
      return
    }
    const t = title.trim()
    if (!t) {
      toast.error('أدخل عنوان العرض')
      return
    }
    const pct = Number(discount)
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      toast.error('نسبة الخصم بين 1 و 100')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('offers').insert({
        business_id: businessId,
        title: t,
        title_ar: t,
        description: description.trim() || null,
        discount_percentage: Math.round(pct),
        start_date: startDate.trim() || null,
        end_date: endDate.trim() || null,
        is_active: isActive,
      })
      if (error) throw error
      toast.success('تم إضافة العرض')
      setTitle('')
      setDescription('')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[#1F1F1F] dark:text-foreground">العروض والخصومات</h1>
        <p className="mt-1 text-sm text-rosera-gray">إضافة عرض يدوياً لصالون</p>
      </div>

      <Card className="space-y-4 border-primary/10 p-6 shadow-sm">
        <div className="space-y-2">
          <Label>الصالون</Label>
          <Select value={businessId} onValueChange={setBusinessId} disabled={loading}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder={loading ? 'جاري التحميل…' : 'اختر صالوناً'} />
            </SelectTrigger>
            <SelectContent>
              {biz.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name_ar}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="offer-title">العنوان</Label>
          <Input
            id="offer-title"
            className="rounded-xl"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="مثال: خصم نهاية الأسبوع"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="offer-desc">الوصف (اختياري)</Label>
          <Input
            id="offer-desc"
            className="rounded-xl"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="offer-pct">نسبة الخصم %</Label>
          <Input
            id="offer-pct"
            type="number"
            min={1}
            max={100}
            className="rounded-xl"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="offer-start">بداية (اختياري)</Label>
            <Input id="offer-start" type="date" className="rounded-xl" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="offer-end">نهاية (اختياري)</Label>
            <Input id="offer-end" type="date" className="rounded-xl" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl border border-primary/10 px-4 py-3">
          <Label htmlFor="offer-active" className="cursor-pointer">
            عرض نشط
          </Label>
          <Switch id="offer-active" checked={isActive} onCheckedChange={setIsActive} />
        </div>
        <Button
          type="button"
          className="w-full rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]"
          disabled={saving}
          onClick={() => void submit()}
        >
          {saving ? 'جاري الحفظ…' : 'إضافة العرض'}
        </Button>
      </Card>

      <Card className="border-primary/10 p-4 shadow-sm">
        <p className="mb-3 text-sm font-bold">آخر العروض</p>
        {loading ? (
          <p className="text-sm text-rosera-gray">جاري التحميل…</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-rosera-gray">لا توجد عروض</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/10 px-3 py-2"
              >
                <span className="font-semibold">{r.title ?? r.title_ar ?? '—'}</span>
                <span className="text-rosera-gray">
                  {(r.businesses as { name_ar?: string } | null)?.name_ar ?? r.business_id.slice(0, 8)} — {r.discount_percentage}%
                </span>
                <span className={r.is_active ? 'text-green-600' : 'text-rosera-gray'}>{r.is_active ? 'نشط' : 'متوقف'}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
