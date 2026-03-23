import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Bell } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { useI18n } from '@/hooks/useI18n'
import { buildMapExploreUrl } from '@/lib/mapExploreUrl'

type NotifRow = {
  id: string
  title: string
  body: string | null
  type: string | null
  is_read: boolean | null
  created_at: string
}

const typeConfig: Record<string, { icon: string; label: string; color: string }> = {
  booking: { icon: '✅', label: 'تأكيد حجز', color: 'text-green-600' },
  reminder: { icon: '⏰', label: 'تذكير', color: 'text-rose-700' },
  offer: { icon: '🔥', label: 'عرض خاص', color: 'text-[#E91E8C]' },
  order: { icon: '📦', label: 'تحديث طلب', color: 'text-blue-600' },
  review: { icon: '⭐', label: 'تقييم', color: 'text-[#9B2257]' },
  promo: { icon: '📢', label: 'إعلان', color: 'text-rosera-gray' },
  growth_inactive: { icon: '💜', label: 'روزيرا', color: 'text-[#9C27B0]' },
  growth_nudge: { icon: '✨', label: 'اقتراح لكِ', color: 'text-[#E91E8C]' },
  growth_skin: { icon: '🪞', label: 'البشرة', color: 'text-violet-600' },
  growth_offer: { icon: '🔥', label: 'عرض قريب منكِ', color: 'text-[#E91E8C]' },
  growth_promo: { icon: '💜', label: 'روزيرا', color: 'text-[#9C27B0]' },
}

function configForType(t: string | null | undefined) {
  if (!t) return typeConfig.promo
  if (typeConfig[t]) return typeConfig[t]
  if (t.startsWith('growth_')) return typeConfig.growth_promo
  return typeConfig.promo
}

export default function Notifications() {
  const { t } = useI18n()
  const { user } = useAuth()
  const nav = useNavigate()
  const [list, setList] = useState<NotifRow[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    setLoadError(null)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id,title,body,type,is_read,created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      setList((data ?? []) as NotifRow[])
    } catch {
      setList([])
      setLoadError('تعذر تحميل الإشعارات. تحققي من الاتصال وحاولي مجدداً.')
      toast.error('تعذر تحميل الإشعارات')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) {
      nav('/auth')
      return
    }
    void fetchNotifications()
  }, [user?.id, nav, fetchNotifications])

  const unreadCount = useMemo(() => list.filter((n) => !n.is_read).length, [list])

  const markRead = async (id: string) => {
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id)
      if (error) throw error
      setList((l) => l.map((x) => (x.id === id ? { ...x, is_read: true } : x)))
    } catch {
      toast.error('تعذر تحديث الإشعار')
    }
  }

  const markAllRead = async () => {
    if (!user?.id || list.length === 0) return
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id)
      if (error) throw error
      setList((l) => l.map((x) => ({ ...x, is_read: true })))
      toast.success('تم تعليم الكل كمقروء')
    } catch {
      toast.error('تعذر التحديث')
    }
  }

  const del = async (id: string) => {
    try {
      await supabase.from('notifications').delete().eq('id', id)
    } catch {
      /* ignore */
    }
    setList((l) => l.filter((x) => x.id !== id))
    toast.success('حُذفت')
  }

  if (!user) return null

  const formatTime = (d: string) => {
    const x = new Date(d)
    const now = new Date()
    const diff = now.getTime() - x.getTime()
    if (diff < 60000) return 'الآن'
    if (diff < 3600000) return `${Math.floor(diff / 60000)} د`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} س`
    return x.toLocaleDateString('ar-SA')
  }

  return (
    <div className="min-h-dvh bg-rosera-light px-4 py-6 pb-28 dark:bg-rosera-dark">
      <div className="mx-auto flex max-w-lg flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">الإشعارات</h1>
            {!loading && !loadError && list.length > 0 && (
              <p className="mt-1 text-xs text-rosera-gray">
                {unreadCount > 0 ? `${unreadCount} غير مقروء` : 'كل شيء مُطالَع'}
              </p>
            )}
          </div>
          {!loading && !loadError && list.some((n) => !n.is_read) && (
            <Button type="button" variant="outline" size="sm" className="shrink-0 text-xs" onClick={() => void markAllRead()}>
              تعليم الكل كمقروء
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="mt-8 text-center text-rosera-gray">جاري التحميل...</p>
      ) : loadError ? (
        <div className="mx-auto mt-8 max-w-md rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 p-8 text-center">
          <p className="text-sm font-semibold text-destructive">{loadError}</p>
          <Button type="button" variant="outline" className="mt-4" onClick={() => void fetchNotifications()}>
            إعادة المحاولة
          </Button>
        </div>
      ) : (
        <ul className="mx-auto mt-6 max-w-lg space-y-3">
          {list.length === 0 ? (
            <li className="list-none py-4">
              <EmptyState
                icon={Bell}
                title={t('notifications.emptyTitle')}
                subtitle={t('notifications.emptySub')}
                ctaLabel={t('notifications.emptyCta')}
                onClick={() => nav(buildMapExploreUrl())}
                analyticsSource="notifications"
              />
            </li>
          ) : (
            list.map((n) => {
              const cfg = configForType(n.type)
              return (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`flex w-full gap-4 rounded-2xl border bg-white p-4 text-start transition dark:bg-card ${
                      !n.is_read ? 'border-primary/30 bg-primary/5 shadow-sm' : 'border-border/60 hover:border-primary/20'
                    }`}
                    onClick={() => {
                      if (!n.is_read) void markRead(n.id)
                    }}
                  >
                    <div className="relative shrink-0">
                      <span className={`text-2xl ${cfg.color}`}>{cfg.icon}</span>
                      {!n.is_read && (
                        <span className="absolute -top-0.5 -end-0.5 h-2 w-2 rounded-full bg-[#E91E8C]" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-rosera-gray">{cfg.label}</p>
                      <h3 className="font-bold">{n.title}</h3>
                      {n.body ? <p className="text-sm text-rosera-gray">{n.body}</p> : null}
                      <p className="mt-1 text-xs text-rosera-gray">{formatTime(n.created_at)}</p>
                    </div>
                    <span
                      role="button"
                      tabIndex={0}
                      className="text-rosera-gray shrink-0 text-sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        void del(n.id)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          e.stopPropagation()
                          void del(n.id)
                        }
                      }}
                    >
                      حذف
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
