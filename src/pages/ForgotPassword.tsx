import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!email) {
      toast.error('أدخلي البريد')
      return
    }
    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setSent(true)
      toast.success('تم إرسال رابط الاستعادة')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'حدث خطأ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-rosera-light px-6 py-12 dark:bg-rosera-dark">
      <div className="mx-auto max-w-md">
        <Link to="/auth" className="text-sm text-accent">
          ← رجوع
        </Link>
        <h1 className="mt-6 text-2xl font-bold">نسيتِ كلمة المرور؟</h1>
        {sent ? (
          <p className="mt-4 text-success">تحققي من بريدكِ واتبعي الرابط لإعادة التعيين.</p>
        ) : (
          <>
            <div className="mt-8 space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button className="mt-8 w-full" onClick={submit} disabled={loading}>
              أرسلي رابط الاستعادة
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
