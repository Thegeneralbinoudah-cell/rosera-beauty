import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function AdminReviews() {
  const [rows, setRows] = useState<{ id: string; rating: number; comment: string; is_approved: boolean }[]>([])

  useEffect(() => {
    void supabase.from('reviews').select('id, rating, comment, is_approved').limit(50).then(({ data }) => setRows((data ?? []) as typeof rows))
  }, [])

  const moderate = async (id: string, approved: boolean) => {
    try {
      await supabase.from('reviews').update({ is_approved: approved }).eq('id', id)
      setRows((r) => r.filter((x) => x.id !== id))
      toast.success(approved ? 'تمت الموافقة' : 'مرفوض')
    } catch {
      toast.error('فشل')
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">إدارة التقييمات</h1>
      <div className="mt-6 space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border bg-white p-4 dark:bg-card">
            <p className="font-bold">{r.rating}★</p>
            <p className="text-sm text-rosera-gray">{r.comment}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => moderate(r.id, true)}>
                موافقة
              </Button>
              <Button size="sm" variant="destructive" onClick={() => moderate(r.id, false)}>
                رفض
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
