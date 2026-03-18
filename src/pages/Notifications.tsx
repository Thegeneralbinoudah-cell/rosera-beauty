import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'

const typeConfig: Record<string, { icon: string; label: string; color: string }> = {
  booking: { icon: '✅', label: 'تأكيد حجز', color: 'text-green-600' },
  reminder: { icon: '⏰', label: 'تذكير', color: 'text-amber-600' },
  offer: { icon: '🔥', label: 'عرض خاص', color: 'text-[#E91E8C]' },
  order: { icon: '📦', label: 'تحديث طلب', color: 'text-blue-600' },
  review: { icon: '⭐', label: 'تقييم', color: 'text-[#C9A227]' },
  promo: { icon: '📢', label: 'إعلان', color: 'text-rosera-gray' },
}

export default function Notifications() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [list, setList] = useState<{ id: string; title: string; body: string; type: string; is_read: boolean; created_at: string }[]>([])

  useEffect(() => {
    const uid = user?.id
    if (!uid) {
      nav('/auth')
      return
    }
    let c = true
    async function load() {
      try {
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
        if (error) throw error
        if (c) setList(data ?? [])
      } catch {
        if (c)
          setList([
            { id: '1', title: 'تأكيد حجز', body: 'تم تأكيد موعدكِ لدى صالون لمسات الجمال', type: 'booking', is_read: false, created_at: new Date().toISOString() },
            { id: '2', title: 'تذكير', body: 'موعدكِ غداً الساعة 5 مساءً', type: 'reminder', is_read: true, created_at: new Date().toISOString() },
            { id: '3', title: 'عرض خاص', body: 'خصم 30% على خدمات الشعر هذا الأسبوع', type: 'offer', is_read: false, created_at: new Date().toISOString() },
            { id: '4', title: 'تحديث طلب', body: 'تم شحن طلبكِ من متجر الجمال', type: 'order', is_read: false, created_at: new Date().toISOString() },
          ])
      }
    }
    void load()
    return () => {
      c = false
    }
  }, [user, nav])

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
      <h1 className="text-2xl font-bold">الإشعارات</h1>
      <ul className="mt-6 space-y-3">
        {list.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-primary/20 bg-white/50 p-8 text-center text-rosera-gray dark:bg-card/50">
            لا توجد إشعارات
          </li>
        ) : (
          list.map((n) => {
            const cfg = typeConfig[n.type] || typeConfig.promo
            return (
              <li
                key={n.id}
                className={`flex gap-4 rounded-2xl border bg-white p-4 dark:bg-card ${!n.is_read ? 'border-primary/30 bg-primary/5' : ''}`}
              >
                <div className="relative shrink-0">
                  <span className={`text-2xl ${cfg.color}`}>{cfg.icon}</span>
                  {!n.is_read && (
                    <span className="absolute -top-0.5 -end-0.5 h-2 w-2 rounded-full bg-[#E91E8C]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold">{n.title}</h3>
                  <p className="text-sm text-rosera-gray">{n.body}</p>
                  <p className="mt-1 text-xs text-rosera-gray">{formatTime(n.created_at)}</p>
                </div>
                <button type="button" className="text-rosera-gray text-sm shrink-0" onClick={() => del(n.id)}>
                  حذف
                </button>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
