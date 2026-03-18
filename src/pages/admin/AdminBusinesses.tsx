import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function AdminBusinesses() {
  const [rows, setRows] = useState<{ id: string; name_ar: string; city: string; is_active: boolean }[]>([])

  useEffect(() => {
    void supabase
      .from('businesses')
      .select('id, name_ar, city, is_active')
      .then(({ data }) => setRows((data ?? []) as typeof rows))
  }, [])

  const toggle = async (id: string, active: boolean) => {
    try {
      await supabase.from('businesses').update({ is_active: !active }).eq('id', id)
      setRows((r) => r.map((x) => (x.id === id ? { ...x, is_active: !active } : x)))
      toast.success('تم التحديث')
    } catch {
      toast.error('فشل')
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">إدارة المنشآت</h1>
      <div className="mt-6 overflow-x-auto rounded-xl border bg-white dark:bg-card">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="p-3 text-start">الاسم</th>
              <th className="p-3">المدينة</th>
              <th className="p-3">الحالة</th>
              <th className="p-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-3 font-medium">{r.name_ar}</td>
                <td className="p-3 text-center">{r.city}</td>
                <td className="p-3 text-center">{r.is_active ? 'نشط' : 'موقوف'}</td>
                <td className="p-3">
                  <Button size="sm" variant="outline" onClick={() => toggle(r.id, r.is_active)}>
                    {r.is_active ? 'إيقاف' : 'تفعيل'}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
