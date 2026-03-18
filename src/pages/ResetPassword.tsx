import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function ResetPassword() {
  const nav = useNavigate()
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (p1.length < 6) {
      toast.error('كلمة المرور 6 أحرف على الأقل')
      return
    }
    if (p1 !== p2) {
      toast.error('التأكيد غير متطابق')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: p1 })
      if (error) throw error
      toast.success('تم تحديث كلمة المرور')
      nav('/auth', { replace: true })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل التحديث')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-rosera-light px-6 py-12 dark:bg-rosera-dark">
      <div className="mx-auto max-w-md">
        <h1 className="text-2xl font-bold">إعادة تعيين كلمة المرور</h1>
        <div className="mt-8 space-y-4">
          <div>
            <Label>كلمة المرور الجديدة</Label>
            <Input type="password" className="mt-2" value={p1} onChange={(e) => setP1(e.target.value)} />
          </div>
          <div>
            <Label>تأكيد كلمة المرور</Label>
            <Input type="password" className="mt-2" value={p2} onChange={(e) => setP2(e.target.value)} />
          </div>
        </div>
        <Button className="mt-8 w-full" onClick={submit} disabled={loading}>
          حفظ كلمة المرور الجديدة
        </Button>
      </div>
    </div>
  )
}
