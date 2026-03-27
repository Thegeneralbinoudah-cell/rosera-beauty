import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { STORAGE_KEYS } from '@/lib/utils'
import {
  UserPen,
  CalendarHeart,
  Heart,
  PackageCheck,
  Bell,
  Bot,
  ScanFace,
  Sparkles,
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
import { useI18n } from '@/hooks/useI18n'

export default function Profile() {
  const { t } = useI18n()
  const { user, profile, signOut, isAdmin, isBusinessOwner, loading } = useAuth()
  const nav = useNavigate()
  const guest = localStorage.getItem(STORAGE_KEYS.guest) && !user
  const [deleteOpen, setDeleteOpen] = useState(false)
  const items = [
    { to: '/profile/edit', label: t('profile.edit') || 'تعديل الملف الشخصي', icon: UserPen, emoji: '✏️' },
    { to: '/bookings', label: t('profile.bookings') || 'حجوزاتي', icon: CalendarHeart, emoji: '📅' },
    { to: '/orders', label: t('profile.orders') || 'طلباتي وتتبع الشحن', icon: PackageCheck, emoji: '📦' },
    { to: '/favorites', label: t('nav.favorites'), icon: Heart, emoji: '❤️' },
    { to: '/notifications', label: t('profile.notifications') || 'الإشعارات', icon: Bell, emoji: '🔔' },
    { to: '/chat', label: t('profile.ai') || 'روزيرا الذكية', icon: Bot, emoji: '🤖' },
    { to: '/skin-analysis', label: t('profile.skin') || 'كشف البشرة', icon: ScanFace, emoji: '🪞' },
    { to: '/rosy-vision', label: 'روزي فيجن', icon: Sparkles, emoji: '✨' },
    { to: '/invite', label: t('profile.invite') || 'ادعي صديقاتكِ', icon: Crown, emoji: '👑' },
    { to: '/settings', label: t('profile.settings'), icon: Settings, emoji: '⚙️' },
    { to: '/privacy', label: t('authEmail.privacy'), icon: Shield, emoji: '🔒' },
    { to: '/terms', label: t('authEmail.terms'), icon: Shield, emoji: '📜' },
  ]

  if (loading) return <div className="p-8 text-center">...</div>

  if (guest || !user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <span className="text-6xl">👤</span>
        <h1 className="mt-4 text-xl font-bold">{t('profile.guestTitle')}</h1>
        <p className="mt-2 text-rosera-gray">{t('profile.guestSubtitle')}</p>
        <button
          type="button"
          className="mt-6 rounded-2xl gradient-rosera px-8 py-3 font-bold text-primary-foreground transition-transform duration-200 active:scale-95"
          onClick={() => nav('/auth')}
        >
          {t('profile.login')}
        </button>
        <Link to="/settings" className="mt-6 text-accent">
          {t('profile.settings')}
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
        <h1 className="mt-4 text-2xl font-bold">{profile?.full_name || t('profile.defaultName')}</h1>
        <p className="text-sm text-rosera-gray">{profile?.email}</p>
        <p className="text-sm text-rosera-gray">{profile?.phone}</p>
      </div>

      <nav className="mx-auto mt-10 max-w-md space-y-1">
        {items.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center justify-between rounded-xl border bg-card px-4 py-4"
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
            to="/salon/dashboard"
            className="flex items-center justify-between rounded-xl border bg-card px-4 py-4"
          >
            <span className="flex items-center gap-3 font-semibold">
              <Building2 className="h-5 w-5 text-primary" />
              {t('profile.ownerPanel')}
            </span>
            <ChevronLeft className="h-5 w-5 rotate-180 text-rosera-gray" />
          </Link>
        )}
        {isAdmin && (
          <Link
            to="/admin"
            className="flex items-center justify-between rounded-xl border bg-card px-4 py-4"
          >
            <span className="flex items-center gap-3 font-semibold">
              <Shield className="h-5 w-5 text-primary" />
              {t('profile.adminPanel')}
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
          {t('profile.logout')}
        </button>

        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="flex w-full items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-4 font-semibold text-destructive mt-2"
        >
          <Trash2 className="h-5 w-5" />
          {t('profile.delete')}
        </button>
      </nav>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{t('profile.deleteTitle')}</DialogTitle>
            <p className="text-sm text-rosera-gray">
              {t('profile.deleteConfirm')}
            </p>
          </DialogHeader>
          <div className="flex gap-2 justify-end mt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>{t('common.cancel')}</Button>
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
              {t('common.confirmDelete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
