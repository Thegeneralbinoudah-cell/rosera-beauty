import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { isPrivilegedStaffClient } from '@/lib/privilegedStaff'

export default function AdminLogin() {
  const nav = useNavigate()
  const { isAdmin, loading, user } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (loading) return
    if (user && isAdmin) nav('/admin', { replace: true })
  }, [loading, user, isAdmin, nav])

  const start = async () => {
    if (!email.trim() || !password) {
      toast.error('أدخلي البريد وكلمة المرور')
      return
    }
    setSubmitting(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw error

      const uid = data.user?.id
      if (!uid) throw new Error('تعذر تحديد المستخدم')

      const [{ data: adm }, { data: prof, error: pErr }] = await Promise.all([
        supabase.from('admins').select('id').eq('user_id', uid).maybeSingle(),
        supabase.from('profiles').select('role, email').eq('id', uid).single(),
      ])
      if (pErr) throw pErr

      if (
        !isPrivilegedStaffClient({
          isAdminFromAdminsTable: !!adm,
          profile: prof as { role?: string; email?: string } | null,
        })
      ) {
        await supabase.auth.signOut()
        toast.error('ليس لديك صلاحية')
        return
      }

      nav('/admin', { replace: true })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل تسجيل الدخول')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || (user && isAdmin)) return null

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center bg-rosera-dark px-6 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]"
      dir="rtl"
    >
      <div className="w-full max-w-md rounded-2xl border border-primary/30 bg-card p-8">
        <h1 className="text-center text-2xl font-extrabold text-primary">دخول المسؤولين</h1>
        <p className="mt-3 text-center text-sm text-muted-foreground">
          تسجيل الدخول بالإيميل للحسابات المصرّح لها فقط.
        </p>
        <div className="mt-6 space-y-3">
          <div>
            <Label>البريد الإلكتروني</Label>
            <Input
              dir="ltr"
              type="email"
              className="mt-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@rosera.com"
            />
          </div>
          <div>
            <Label>كلمة المرور</Label>
            <Input
              type="password"
              className="mt-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
        </div>
        <Button className="mt-8 h-12 w-full rounded-xl font-bold" onClick={() => void start()} disabled={submitting}>
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري الدخول...
            </span>
          ) : (
            'تسجيل الدخول'
          )}
        </Button>
      </div>
    </div>
  )
}
