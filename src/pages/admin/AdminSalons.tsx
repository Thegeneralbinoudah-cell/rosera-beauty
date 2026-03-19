import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

type Row = {
  id: string
  name_ar: string
  city: string
  region: string | null
  is_active: boolean
  is_verified: boolean
  is_featured: boolean
}

export default function AdminSalons() {
  const [rows, setRows] = useState<Row[]>([])
  const [q, setQ] = useState('')
  const [onlyUnverified, setOnlyUnverified] = useState(false)

  const load = () => {
    void supabase
      .from('businesses')
      .select('id, name_ar, city, region, is_active, is_verified, is_featured')
      .order('name_ar')
      .then(({ data }) => setRows((data ?? []) as Row[]))
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    let r = rows
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      r = r.filter((x) => x.name_ar.toLowerCase().includes(s) || x.city.toLowerCase().includes(s))
    }
    if (onlyUnverified) r = r.filter((x) => !x.is_verified)
    return r
  }, [rows, q, onlyUnverified])

  const patch = async (id: string, field: 'is_verified' | 'is_featured' | 'is_active', value: boolean) => {
    try {
      const { error } = await supabase.from('businesses').update({ [field]: value }).eq('id', id)
      if (error) throw error
      setRows((prev) => prev.map((x) => (x.id === id ? { ...x, [field]: value } : x)))
      toast.success('تم التحديث')
    } catch {
      toast.error('فشل التحديث')
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">الصالونات</h1>
      <div className="mt-4 flex flex-wrap gap-3">
        <Input placeholder="بحث بالاسم أو المدينة" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={onlyUnverified} onChange={(e) => setOnlyUnverified(e.target.checked)} />
          غير موثّقة فقط
        </label>
      </div>
      <div className="mt-6 overflow-x-auto rounded-xl border bg-white dark:bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="p-3 text-start">الاسم</th>
              <th className="p-3">المدينة</th>
              <th className="p-3">موثّق</th>
              <th className="p-3">مميّز</th>
              <th className="p-3">نشط</th>
              <th className="p-3">تفاصيل</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-3 font-medium">{r.name_ar}</td>
                <td className="p-3 text-center">{r.city}</td>
                <td className="p-3 text-center">
                  <Button size="sm" variant={r.is_verified ? 'secondary' : 'default'} onClick={() => void patch(r.id, 'is_verified', !r.is_verified)}>
                    {r.is_verified ? 'إلغاء التوثيق' : 'توثيق'}
                  </Button>
                </td>
                <td className="p-3 text-center">
                  <Button size="sm" variant="outline" onClick={() => void patch(r.id, 'is_featured', !r.is_featured)}>
                    {r.is_featured ? 'إلغاء التمييز' : 'تمييز'}
                  </Button>
                </td>
                <td className="p-3 text-center">
                  <Button size="sm" variant="outline" onClick={() => void patch(r.id, 'is_active', !r.is_active)}>
                    {r.is_active ? 'إيقاف' : 'تفعيل'}
                  </Button>
                </td>
                <td className="p-3 text-center">
                  <Link to={`/salon/${r.id}`} className="text-primary underline font-semibold">
                    عرض
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
