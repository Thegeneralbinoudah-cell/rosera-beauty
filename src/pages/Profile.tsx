import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { STORAGE_KEYS } from '@/lib/utils'
import {
  UserPen,
  CalendarHeart,
  Heart,
  Bell,
  Bot,
  ScanFace,
  Crown,
  Settings,
  Building2,
  Shield,
  LogOut,
  ChevronLeft,
  Trash2,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

const items = [
  { to: '/profile/edit', label: 'تعديل الملف الشخصي', icon: UserPen, emoji: '✏️' },
  { to: '/bookings', label: 'حجوزاتي', icon: CalendarHeart, emoji: '📅' },
  { to: '/favorites', label: 'المفضلة', icon: Heart, emoji: '❤️' },
  { to: '/notifications', label: 'الإشعارات', icon: Bell, emoji: '🔔' },
  { to: '/chat', label: 'روزيرا الذكية', icon: Bot, emoji: '🤖' },
  { to: '/skin-analysis', label: 'كشف البشرة', icon: ScanFace, emoji: '🪞' },
  { to: '/invite', label: 'ادعي صديقاتكِ', icon: Crown, emoji: '👑' },
  { to: '/settings', label: 'الإعدادات', icon: Settings, emoji: '⚙️' },
  { to: '/privacy', label: 'سياسة الخصوصية', icon: Shield, emoji: '🔒' },
  { to: '/terms', label: 'الشروط والأحكام', icon: Shield, emoji: '📜' },
]

export default function Profile() {
  const { user, profile, signOut, isAdmin, isBusinessOwner, loading } = useAuth()
  const nav = useNavigate()
  const guest = localStorage.getItem(STORAGE_KEYS.guest) && !user
  const [deleteOpen, setDeleteOpen] = useState(false)

  if (loading) return <div className="p-8 text-center">...</div>

  if (guest || !user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <span className="text-6xl">👤</span>
        <h1 className="mt-4 text-xl font-bold">ضيفة كريمة</h1>
        <p className="mt-2 text-rosera-gray">سجّلي دخولكِ لحفظ الحجوزات والمفضلة</p>
        <button
          type="button"
          className="mt-6 rounded-xl gradient-rosera px-8 py-3 font-bold text-white"
          onClick={() => nav('/auth')}
        >
          تسجيل الدخول
        </button>
        <Link to="/settings" className="mt-6 text-primary">
          الإعدادات
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-rosera-light px-4 py-8 dark:bg-rosera-dark">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-primary/30 bg-primary/10 text-4xl font-bold text-primary">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
          ) : (
            (profile?.full_name || 'ر')[0]
          )}
        </div>
        <h1 className="mt-4 text-2xl font-bold">{profile?.full_name || 'مستخدمة'}</h1>
        <p className="text-sm text-rosera-gray">{profile?.email}</p>
        <p className="text-sm text-rosera-gray">{profile?.phone}</p>
      </div>

      <nav className="mx-auto mt-10 max-w-md space-y-1">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center justify-between rounded-xl border bg-white px-4 py-4 dark:bg-card"
          >
            <span className="flex items-center gap-3 font-semibold">
              <Icon className="h-5 w-5 text-primary" />
              {label}
            </span>
            <ChevronLeft className="h-5 w-5 text-rosera-gray rotate-180" />
          </Link>
        ))}
        {isBusinessOwner && (
          <Link
            to="/dashboard"
            className="flex items-center justify-between rounded-xl border bg-white px-4 py-4 dark:bg-card"
          >
            <span className="flex items-center gap-3 font-semibold">
              <Building2 className="h-5 w-5 text-primary" />
              لوحة صاحبة المنشأة
            </span>
            <ChevronLeft className="h-5 w-5 rotate-180 text-rosera-gray" />
          </Link>
        )}
        {isAdmin && (
          <Link
            to="/admin"
            className="flex items-center justify-between rounded-xl border bg-white px-4 py-4 dark:bg-card"
          >
            <span className="flex items-center gap-3 font-semibold">
              <Shield className="h-5 w-5 text-primary" />
              لوحة الإدارة
            </span>
            <ChevronLeft className="h-5 w-5 rotate-180 text-rosera-gray" />
          </Link>
        )}
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem(STORAGE_KEYS.guest)
            void signOut()
            nav('/auth')
          }}
          className="flex w-full items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4 font-semibold text-destructive"
        >
          <LogOut className="h-5 w-5" />
          تسجيل الخروج
        </button>

        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4 font-semibold text-destructive mt-2"
        >
          <Trash2 className="h-5 w-5" />
          حذف الحساب
        </button>
      </nav>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>حذف الحساب</DialogTitle>
            <p className="text-sm text-rosera-gray">
              هل أنتِ متأكدة من حذف حسابك؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>إلغاء</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!user) return
                setDeleteOpen(false)
                try {
                  await supabase.from('profiles').delete().eq('id', user.id)
                  await signOut()
                  nav('/auth', { replace: true })
                } catch {
                  toast.error('فشل حذف الحساب')
                }
              }}
            >
              حذف الحساب
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
