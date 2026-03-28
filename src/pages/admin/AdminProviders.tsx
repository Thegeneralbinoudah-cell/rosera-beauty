import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
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
import { Card } from '@/components/ui/card'
import { toast } from 'sonner'

type ProviderRow = {
  id: string
  name_ar: string
  contact_name: string | null
  contact_email: string | null
  contact_phone: string | null
  is_active: boolean
  is_verified: boolean
}

type ProductRow = {
  id: string
  name_ar: string
  category: string
  price: number
}

type ProviderProductRow = {
  id: string
  provider_id: string
  product_id: string
  provider_sku: string | null
  stock_qty: number
  cost_price: number | null
  min_lead_time_days: number | null
  max_lead_time_days: number | null
  is_active: boolean
  providers: { name_ar: string } | { name_ar: string }[] | null
  products: { name_ar: string } | { name_ar: string }[] | null
}

const blankProvider = {
  name_ar: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
}

export default function AdminProviders() {
  const [providers, setProviders] = useState<ProviderRow[]>([])
  const [products, setProducts] = useState<ProductRow[]>([])
  const [links, setLinks] = useState<ProviderProductRow[]>([])
  const [loading, setLoading] = useState(true)

  const [providerForm, setProviderForm] = useState(blankProvider)
  const [creatingProvider, setCreatingProvider] = useState(false)

  const [selectedProviderId, setSelectedProviderId] = useState('')
  const [selectedProductId, setSelectedProductId] = useState('')
  const [sku, setSku] = useState('')
  const [stockQty, setStockQty] = useState('0')
  const [costPrice, setCostPrice] = useState('')
  const [minLead, setMinLead] = useState('1')
  const [maxLead, setMaxLead] = useState('5')
  const [savingLink, setSavingLink] = useState(false)
  const [bulkCsv, setBulkCsv] = useState('')
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkSummary, setBulkSummary] = useState<{ ok: number; failed: number; errors: string[] } | null>(null)

  const providerNameById = useMemo(
    () => new Map(providers.map((p) => [p.id, p.name_ar])),
    [providers]
  )
  const productNameById = useMemo(
    () => new Map(products.map((p) => [p.id, p.name_ar])),
    [products]
  )

  const load = async () => {
    setLoading(true)
    try {
      const [provRes, prodRes, linkRes] = await Promise.all([
        supabase
          .from('providers')
          .select('id, name_ar, contact_name, contact_email, contact_phone, is_active, is_verified')
          .order('created_at', { ascending: false }),
        supabase
          .from('products')
          .select('id, name_ar, category, price')
          .eq('is_active', true)
          .eq('is_demo', false)
          .order('created_at', { ascending: false }),
        supabase
          .from('provider_products')
          .select('id, provider_id, product_id, provider_sku, stock_qty, cost_price, min_lead_time_days, max_lead_time_days, is_active, providers(name_ar), products(name_ar)')
          .order('created_at', { ascending: false }),
      ])

      if (provRes.error) throw provRes.error
      if (prodRes.error) throw prodRes.error
      if (linkRes.error) throw linkRes.error

      setProviders((provRes.data ?? []) as ProviderRow[])
      setProducts((prodRes.data ?? []) as ProductRow[])
      setLinks((linkRes.data ?? []) as ProviderProductRow[])
    } catch {
      toast.error('تعذر تحميل بيانات المزوّدين')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const createProvider = async () => {
    const name = providerForm.name_ar.trim()
    if (!name) {
      toast.error('اسم المزوّد مطلوب')
      return
    }
    setCreatingProvider(true)
    try {
      const payload = {
        name_ar: name,
        contact_name: providerForm.contact_name.trim() || null,
        contact_email: providerForm.contact_email.trim() || null,
        contact_phone: providerForm.contact_phone.trim() || null,
      }
      const { error } = await supabase.from('providers').insert(payload)
      if (error) throw error
      toast.success('تمت إضافة المزوّد')
      setProviderForm(blankProvider)
      await load()
    } catch {
      toast.error('فشلت إضافة المزوّد')
    } finally {
      setCreatingProvider(false)
    }
  }

  const toggleProviderFlag = async (
    row: ProviderRow,
    field: 'is_active' | 'is_verified',
    value: boolean
  ) => {
    try {
      const { error } = await supabase.from('providers').update({ [field]: value }).eq('id', row.id)
      if (error) throw error
      setProviders((prev) =>
        prev.map((p) => (p.id === row.id ? { ...p, [field]: value } : p))
      )
      toast.success('تم التحديث')
    } catch {
      toast.error('تعذر تحديث حالة المزوّد')
    }
  }

  const saveProviderProduct = async () => {
    if (!selectedProviderId || !selectedProductId) {
      toast.error('اختاري المزوّد والمنتج أولاً')
      return
    }
    const parsedStock = Number(stockQty)
    if (!Number.isFinite(parsedStock) || parsedStock < 0) {
      toast.error('قيمة المخزون غير صحيحة')
      return
    }
    setSavingLink(true)
    try {
      const payload = {
        provider_id: selectedProviderId,
        product_id: selectedProductId,
        provider_sku: sku.trim() || null,
        stock_qty: parsedStock,
        cost_price: costPrice.trim() ? Number(costPrice) : null,
        min_lead_time_days: minLead.trim() ? Number(minLead) : null,
        max_lead_time_days: maxLead.trim() ? Number(maxLead) : null,
        is_active: true,
      }
      const { error } = await supabase
        .from('provider_products')
        .upsert(payload, { onConflict: 'provider_id,product_id' })
      if (error) throw error
      toast.success('تم حفظ SKU والمخزون والتكلفة')
      await load()
    } catch {
      toast.error('فشل حفظ ربط المنتج بالمزوّد')
    } finally {
      setSavingLink(false)
    }
  }

  const toggleProviderProduct = async (row: ProviderProductRow) => {
    try {
      const { error } = await supabase
        .from('provider_products')
        .update({ is_active: !row.is_active })
        .eq('id', row.id)
      if (error) throw error
      setLinks((prev) =>
        prev.map((x) => (x.id === row.id ? { ...x, is_active: !x.is_active } : x))
      )
      toast.success('تم تحديث ربط المنتج')
    } catch {
      toast.error('تعذر تحديث الربط')
    }
  }

  const runBulkImport = async () => {
    if (!selectedProviderId) {
      toast.error('اختاري المزوّد أولاً قبل الاستيراد الجماعي')
      return
    }
    const lines = bulkCsv
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean)
    if (lines.length <= 1) {
      toast.error('ألصقي CSV يحتوي على رأس + صفوف بيانات')
      return
    }

    const header = lines[0].split(',').map((x) => x.trim())
    const expected = ['product_name_ar', 'provider_sku', 'stock_qty', 'cost_price', 'min_lead_days', 'max_lead_days']
    const missing = expected.filter((k) => !header.includes(k))
    if (missing.length > 0) {
      toast.error(`CSV ناقص أعمدة: ${missing.join(', ')}`)
      return
    }

    const idx = (key: string) => header.indexOf(key)
    const productByName = new Map(products.map((p) => [p.name_ar.trim(), p]))
    let ok = 0
    let failed = 0
    const errors: string[] = []

    setBulkRunning(true)
    setBulkSummary(null)
    try {
      for (let i = 1; i < lines.length; i += 1) {
        const row = lines[i].split(',').map((x) => x.trim())
        const productName = row[idx('product_name_ar')] ?? ''
        const product = productByName.get(productName)
        if (!product) {
          failed += 1
          errors.push(`سطر ${i + 1}: المنتج غير موجود "${productName}"`)
          continue
        }
        const stock = Number(row[idx('stock_qty')] ?? '0')
        const cost = Number(row[idx('cost_price')] ?? '')
        const minDays = Number(row[idx('min_lead_days')] ?? '1')
        const maxDays = Number(row[idx('max_lead_days')] ?? '5')
        if (!Number.isFinite(stock) || stock < 0) {
          failed += 1
          errors.push(`سطر ${i + 1}: stock_qty غير صحيح`)
          continue
        }
        if (!Number.isFinite(minDays) || !Number.isFinite(maxDays) || minDays < 0 || maxDays < minDays) {
          failed += 1
          errors.push(`سطر ${i + 1}: lead days غير صحيحة`)
          continue
        }
        const payload = {
          provider_id: selectedProviderId,
          product_id: product.id,
          provider_sku: row[idx('provider_sku')] || null,
          stock_qty: stock,
          cost_price: Number.isFinite(cost) ? cost : null,
          min_lead_time_days: minDays,
          max_lead_time_days: maxDays,
          is_active: true,
        }
        const { error } = await supabase
          .from('provider_products')
          .upsert(payload, { onConflict: 'provider_id,product_id' })
        if (error) {
          failed += 1
          errors.push(`سطر ${i + 1}: فشل حفظ الربط`)
        } else {
          ok += 1
        }
      }

      setBulkSummary({ ok, failed, errors })
      if (ok > 0) toast.success(`تم حفظ ${ok} صف بنجاح`)
      if (failed > 0) toast.error(`فشل ${failed} صف — راجعي تفاصيل الأخطاء`)
      await load()
    } finally {
      setBulkRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">المزوّدون الحقيقيون</h1>
        <p className="mt-2 text-sm text-foreground">
          إدارة المزوّدين وربط المنتجات بسعر التكلفة والمخزون وSKU.
        </p>
      </div>

      <Card className="p-4 md:p-6">
        <h2 className="font-bold text-primary">إضافة مزوّد</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <Label>اسم المزوّد</Label>
            <Input
              className="mt-2"
              value={providerForm.name_ar}
              onChange={(e) => setProviderForm((p) => ({ ...p, name_ar: e.target.value }))}
              placeholder="مثال: موزع الجمال الشرقي"
            />
          </div>
          <div>
            <Label>اسم جهة التواصل</Label>
            <Input
              className="mt-2"
              value={providerForm.contact_name}
              onChange={(e) => setProviderForm((p) => ({ ...p, contact_name: e.target.value }))}
              placeholder="الاسم"
            />
          </div>
          <div>
            <Label>البريد</Label>
            <Input
              className="mt-2"
              dir="ltr"
              value={providerForm.contact_email}
              onChange={(e) => setProviderForm((p) => ({ ...p, contact_email: e.target.value }))}
              placeholder="provider@example.com"
            />
          </div>
          <div>
            <Label>الجوال</Label>
            <Input
              className="mt-2"
              dir="ltr"
              value={providerForm.contact_phone}
              onChange={(e) => setProviderForm((p) => ({ ...p, contact_phone: e.target.value }))}
              placeholder="05xxxxxxxx"
            />
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={() => void createProvider()} disabled={creatingProvider}>
            {creatingProvider ? 'جاري الإضافة...' : 'إضافة المزوّد'}
          </Button>
        </div>
      </Card>

      <Card className="p-4 md:p-6">
        <h2 className="font-bold text-primary">ربط منتج بمزوّد</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>المزوّد</Label>
            <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="اختاري مزوّد" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name_ar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>المنتج الحقيقي</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger className="mt-2">
                <SelectValue placeholder="اختاري منتج" />
              </SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name_ar}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>SKU لدى المزوّد</Label>
            <Input className="mt-2" dir="ltr" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU-001" />
          </div>
          <div>
            <Label>المخزون</Label>
            <Input className="mt-2" dir="ltr" value={stockQty} onChange={(e) => setStockQty(e.target.value)} placeholder="0" />
          </div>
          <div>
            <Label>تكلفة الشراء (ر.س)</Label>
            <Input className="mt-2" dir="ltr" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="49.00" />
          </div>
          <div>
            <Label>حد أدنى تجهيز (يوم)</Label>
            <Input className="mt-2" dir="ltr" value={minLead} onChange={(e) => setMinLead(e.target.value)} placeholder="1" />
          </div>
          <div>
            <Label>حد أقصى تجهيز (يوم)</Label>
            <Input className="mt-2" dir="ltr" value={maxLead} onChange={(e) => setMaxLead(e.target.value)} placeholder="5" />
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={() => void saveProviderProduct()} disabled={savingLink}>
            {savingLink ? 'جاري الحفظ...' : 'حفظ الربط'}
          </Button>
        </div>
        {products.length === 0 && (
          <p className="mt-3 text-sm text-rose-800 dark:text-rose-400">
            لا توجد منتجات حقيقية بعد. أضيفي منتجات موثّقة أولاً ثم اربطيها بالمزوّد.
          </p>
        )}
      </Card>

      <Card className="p-4 md:p-6">
        <h2 className="font-bold text-primary">استيراد جماعي CSV للربط</h2>
        <p className="mt-2 text-xs text-foreground" dir="ltr">
          header: product_name_ar,provider_sku,stock_qty,cost_price,min_lead_days,max_lead_days
        </p>
        <textarea
          className="mt-3 min-h-40 w-full rounded-xl border bg-background p-3 text-sm"
          dir="ltr"
          placeholder="product_name_ar,provider_sku,stock_qty,cost_price,min_lead_days,max_lead_days"
          value={bulkCsv}
          onChange={(e) => setBulkCsv(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={() => void runBulkImport()} disabled={bulkRunning}>
            {bulkRunning ? 'جاري الاستيراد...' : 'تشغيل الاستيراد الجماعي'}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              setBulkCsv(
                [
                  'product_name_ar,provider_sku,stock_qty,cost_price,min_lead_days,max_lead_days',
                  'سيروم فيتامين سي,SKU-VC-001,120,46,1,3',
                  'أحمر شفاه مات,SKU-LIP-202,80,41,1,2',
                ].join('\n')
              )
            }
          >
            إدراج قالب جاهز
          </Button>
        </div>
        {bulkSummary && (
          <div className="mt-4 rounded-xl border bg-muted/20 p-3 text-sm">
            <p className="font-bold">النتيجة: نجح {bulkSummary.ok} / فشل {bulkSummary.failed}</p>
            {bulkSummary.errors.length > 0 && (
              <ul className="mt-2 max-h-36 list-disc space-y-1 overflow-auto pe-5 text-xs text-destructive">
                {bulkSummary.errors.map((err, i) => (
                  <li key={`${err}-${i}`}>{err}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <Card className="p-4 md:p-6">
        <h2 className="font-bold text-primary">قائمة المزوّدين</h2>
        {loading ? (
          <p className="mt-4 text-sm text-rosera-gray">جاري التحميل...</p>
        ) : providers.length === 0 ? (
          <p className="mt-4 text-sm text-rosera-gray">لا يوجد مزوّدون بعد.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="p-3 text-start">الاسم</th>
                  <th className="p-3">جهة التواصل</th>
                  <th className="p-3">البريد</th>
                  <th className="p-3">الجوال</th>
                  <th className="p-3">موثّق</th>
                  <th className="p-3">نشط</th>
                </tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr key={p.id} className="border-b">
                    <td className="p-3 font-semibold">{p.name_ar}</td>
                    <td className="p-3 text-center">{p.contact_name || '—'}</td>
                    <td className="p-3 text-center" dir="ltr">{p.contact_email || '—'}</td>
                    <td className="p-3 text-center" dir="ltr">{p.contact_phone || '—'}</td>
                    <td className="p-3 text-center">
                      <Button
                        size="sm"
                        variant={p.is_verified ? 'secondary' : 'outline'}
                        onClick={() => void toggleProviderFlag(p, 'is_verified', !p.is_verified)}
                      >
                        {p.is_verified ? 'موثّق' : 'توثيق'}
                      </Button>
                    </td>
                    <td className="p-3 text-center">
                      <Button
                        size="sm"
                        variant={p.is_active ? 'outline' : 'secondary'}
                        onClick={() => void toggleProviderFlag(p, 'is_active', !p.is_active)}
                      >
                        {p.is_active ? 'إيقاف' : 'تفعيل'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="p-4 md:p-6">
        <h2 className="font-bold text-primary">روابط المنتجات مع المزوّدين</h2>
        {links.length === 0 ? (
          <p className="mt-4 text-sm text-rosera-gray">لا يوجد ربط منتجات بعد.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="p-3 text-start">المزوّد</th>
                  <th className="p-3">المنتج</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">المخزون</th>
                  <th className="p-3">التكلفة</th>
                  <th className="p-3">Lead Time</th>
                  <th className="p-3">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {links.map((l) => {
                  const providerName =
                    Array.isArray(l.providers) ? l.providers[0]?.name_ar : l.providers?.name_ar
                  const productName =
                    Array.isArray(l.products) ? l.products[0]?.name_ar : l.products?.name_ar
                  return (
                    <tr key={l.id} className="border-b">
                      <td className="p-3 font-semibold">
                        {providerName || providerNameById.get(l.provider_id) || '—'}
                      </td>
                      <td className="p-3 text-center">
                        {productName || productNameById.get(l.product_id) || '—'}
                      </td>
                      <td className="p-3 text-center" dir="ltr">{l.provider_sku || '—'}</td>
                      <td className="p-3 text-center" dir="ltr">{l.stock_qty}</td>
                      <td className="p-3 text-center" dir="ltr">
                        {l.cost_price == null ? '—' : `${Number(l.cost_price).toLocaleString('en-US')} SAR`}
                      </td>
                      <td className="p-3 text-center" dir="ltr">
                        {l.min_lead_time_days ?? 1}-{l.max_lead_time_days ?? 5} days
                      </td>
                      <td className="p-3 text-center">
                        <Button size="sm" variant="outline" onClick={() => void toggleProviderProduct(l)}>
                          {l.is_active ? 'نشط' : 'متوقف'}
                        </Button>
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
