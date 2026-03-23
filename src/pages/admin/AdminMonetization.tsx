import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type BizRow = { id: string; name_ar: string; city: string }
type ProdRow = { id: string; name_ar: string }
type BoostRow = {
  id: string
  business_id: string | null
  product_id: string | null
  boost_type: string
  start_date: string
  end_date: string
  boost_score: number
  is_active: boolean
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function AdminMonetization() {
  const [biz, setBiz] = useState<BizRow[]>([])
  const [products, setProducts] = useState<ProdRow[]>([])
  const [recentBoosts, setRecentBoosts] = useState<BoostRow[]>([])
  const [commissionRows, setCommissionRows] = useState<{ commission_amount: number | null; business_id: string }[]>([])

  const [scope, setScope] = useState<'salon' | 'product'>('salon')
  const [businessId, setBusinessId] = useState('')
  const [productId, setProductId] = useState('')
  const [boostType, setBoostType] = useState<'featured' | 'priority'>('priority')
  const [boostScore, setBoostScore] = useState('12')
  const [durationDays, setDurationDays] = useState('14')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const [bRes, pRes, boostRes, bookRes] = await Promise.all([
      supabase.from('businesses').select('id, name_ar, city').eq('is_active', true).eq('is_demo', false).order('name_ar').limit(400),
      supabase.from('products').select('id, name_ar').eq('is_active', true).eq('is_demo', false).order('name_ar').limit(400),
      supabase.from('boosts').select('*').order('created_at', { ascending: false }).limit(15),
      supabase.from('bookings').select('commission_amount, business_id').limit(8000),
    ])
    setBiz((bRes.data ?? []) as BizRow[])
    setProducts((pRes.data ?? []) as ProdRow[])
    setRecentBoosts((boostRes.data ?? []) as BoostRow[])
    setCommissionRows((bookRes.data ?? []) as typeof commissionRows)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    const totalCommission = commissionRows.reduce((a, r) => a + Number(r.commission_amount ?? 0), 0)
    const byBiz = new Map<string, number>()
    for (const r of commissionRows) {
      const v = Number(r.commission_amount ?? 0)
      if (v <= 0) continue
      byBiz.set(r.business_id, (byBiz.get(r.business_id) ?? 0) + v)
    }
    const top = [...byBiz.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
    const t = todayISO()
    const activeBoosts = recentBoosts.filter(
      (x) => x.is_active && x.start_date <= t && x.end_date >= t
    ).length
    return { totalCommission, top, activeBoosts }
  }, [commissionRows, recentBoosts])

  const bizName = (id: string | null) => biz.find((x) => x.id === id)?.name_ar ?? id ?? '—'

  const onSubmitBoost = async (e: React.FormEvent) => {
    e.preventDefault()
    const scoreN = Math.min(25, Math.max(1, Number(boostScore) || 12))
    const daysN = Math.min(365, Math.max(1, Number(durationDays) || 14))
    const start = todayISO()
    const end = new Date()
    end.setDate(end.getDate() + daysN)
    const endStr = end.toISOString().slice(0, 10)

    if (scope === 'salon') {
      if (!businessId) {
        toast.error('اختيار الصالون مطلوب')
        return
      }
      setSaving(true)
      try {
        const { error } = await supabase.from('boosts').insert({
          business_id: businessId,
          product_id: null,
          boost_type: boostType,
          start_date: start,
          end_date: endStr,
          boost_score: scoreN,
          is_active: true,
        })
        if (error) throw error
        toast.success('تم تفعيل الدفع للصالون')
        void load()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'فشل الحفظ')
      } finally {
        setSaving(false)
      }
      return
    }

    if (!productId) {
      toast.error('اختيار المنتج مطلوب')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.from('boosts').insert({
        business_id: businessId || null,
        product_id: productId,
        boost_type: boostType,
        start_date: start,
        end_date: endStr,
        boost_score: scoreN,
        is_active: true,
      })
      if (error) throw error
      toast.success('تم تفعيل الدفع للمنتج')
      void load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'فشل الحفظ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold">التحقق من الإيرادات والدفع</h1>
        <p className="mt-1 text-sm text-rosera-gray">عمولات الحجز، الدفع للظهور، وأعلى الصالونات من العمولة (بدون تعطيل تجربة المستخدم).</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 dark:bg-card">
          <p className="text-xs font-bold text-rosera-gray">إجمالي العمولات (من العيّنة المحمّلة)</p>
          <p className="mt-2 text-2xl font-extrabold text-primary">{stats.totalCommission.toLocaleString('ar-SA')} ر.س</p>
        </div>
        <div className="rounded-xl border bg-white p-4 dark:bg-card">
          <p className="text-xs font-bold text-rosera-gray">دفعات نشطة حالياً</p>
          <p className="mt-2 text-2xl font-extrabold text-[#9C27B0]">{stats.activeBoosts}</p>
        </div>
        <div className="rounded-xl border bg-white p-4 dark:bg-card">
          <p className="text-xs font-bold text-rosera-gray">صفوف الحجز في العيّنة</p>
          <p className="mt-2 text-2xl font-extrabold">{commissionRows.length}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6 dark:bg-card">
        <h2 className="text-lg font-bold">أعلى الصالونات — عمولة المنصّة</h2>
        <ol className="mt-4 list-decimal space-y-2 pe-5 text-sm">
          {stats.top.length === 0 ? (
            <li className="text-rosera-gray">لا بيانات عمولة في العيّنة</li>
          ) : (
            stats.top.map(([id, amt]) => (
              <li key={id} className="flex justify-between gap-2">
                <span>{bizName(id)}</span>
                <span className="font-bold whitespace-nowrap">{amt.toLocaleString('ar-SA')} ر.س</span>
              </li>
            ))
          )}
        </ol>
      </div>

      <form onSubmit={(e) => void onSubmitBoost(e)} className="rounded-xl border bg-white p-6 dark:bg-card">
        <h2 className="text-lg font-bold">تفعيل دفع (بعد استلام الدفع)</h2>
        <p className="mt-1 text-xs text-rosera-gray">
          يُنشئ سجلًا في boosts ويُفعَّل فورًا. لا تكديس: لكل صالون/منتج يُدمَج الأقوى في الترتيب.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>نوع الدفع</Label>
            <Select value={scope} onValueChange={(v: 'salon' | 'product') => setScope(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="salon">صالون (كل الخدمات)</SelectItem>
                <SelectItem value="product">منتج متجر</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>نوع الظهور</Label>
            <Select value={boostType} onValueChange={(v: 'featured' | 'priority') => setBoostType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="priority">أولوية / مُموَّل</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scope === 'salon' ? (
            <div className="space-y-2 sm:col-span-2">
              <Label>الصالون</Label>
              <Select value={businessId} onValueChange={setBusinessId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختيار الصالون" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {biz.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name_ar} — {b.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div className="space-y-2 sm:col-span-2">
                <Label>المنتج</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختيار المنتج" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name_ar}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>صالون مرتبط (اختياري — للتقارير)</Label>
                <Select value={businessId || 'none'} onValueChange={(v) => setBusinessId(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="بدون" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    <SelectItem value="none">— بدون —</SelectItem>
                    {biz.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name_ar}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label>قوة الدفع % (1–25)</Label>
            <Input value={boostScore} onChange={(e) => setBoostScore(e.target.value)} inputMode="numeric" />
          </div>
          <div className="space-y-2">
            <Label>المدة (أيام)</Label>
            <Input value={durationDays} onChange={(e) => setDurationDays(e.target.value)} inputMode="numeric" />
          </div>
        </div>
        <Button type="submit" className="mt-6" disabled={saving}>
          {saving ? 'جاري الحفظ…' : 'حفظ وتفعيل'}
        </Button>
      </form>

      <div className="rounded-xl border bg-white p-6 dark:bg-card">
        <h2 className="text-lg font-bold">آخر الدفعات</h2>
        <ul className="mt-4 space-y-2 text-sm">
          {recentBoosts.length === 0 ? (
            <li className="text-rosera-gray">لا سجلات</li>
          ) : (
            recentBoosts.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 border-b border-border/50 py-2">
                <span>
                  {r.product_id ? `منتج ${r.product_id.slice(0, 8)}…` : bizName(r.business_id)}{' '}
                  <span className="text-rosera-gray">· {r.boost_type}</span>
                </span>
                <span className="text-xs text-rosera-gray">
                  {r.start_date} → {r.end_date} · {r.is_active ? 'نشط' : 'موقوف'} · %{r.boost_score}
                </span>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  )
}
