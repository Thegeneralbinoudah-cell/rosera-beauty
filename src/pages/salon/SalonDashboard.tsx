import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, startOfDay } from 'date-fns'
import { ar } from 'date-fns/locale'
import { supabase } from '@/lib/supabase'
import { setSalonSubscriptionAutoRenew } from '@/lib/salonSubscriptionAutoRenew'
import { useAuth } from '@/contexts/AuthContext'
import { getMySalonBusinessId, getMySalonName } from '@/lib/salonOwner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { CalendarHeart, Star, TrendingUp, Wallet, ChevronLeft, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type Upcoming = {
  id: string
  booking_date: string
  booking_time: string
  status: string
  total_price: number | null
  user_id: string
}

export default function SalonDashboard() {
  const { user } = useAuth()
  const [salon, setSalon] = useState<{ id: string; name_ar: string } | null>(null)
  const [totalBookings, setTotalBookings] = useState(0)
  const [revenue, setRevenue] = useState(0)
  const [rating, setRating] = useState(0)
  const [reviewCount, setReviewCount] = useState(0)
  const [upcoming, setUpcoming] = useState<Upcoming[]>([])
  const [clientNames, setClientNames] = useState<Record<string, string>>({})
  const [subAutoRenew, setSubAutoRenew] = useState<boolean | null>(null)
  const [subBillingProvider, setSubBillingProvider] = useState<string>('moyasar')
  const [subStripeId, setSubStripeId] = useState<string | null>(null)
  const [subLoading, setSubLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    let c = true
    async function load() {
      try {
      const s = await getMySalonName(user!.id)
      const bid = s?.id ?? (await getMySalonBusinessId(user!.id))
      if (!c) return
      setSalon(s ?? (bid ? { id: bid, name_ar: 'صالونك' } : null))
      if (!bid) return

      const today = format(startOfDay(new Date()), 'yyyy-MM-dd')

      void supabase.rpc('expire_salon_subscriptions').then(
        () => {},
        () => {}
      )

      const [{ count: total }, { data: revRows }, { data: bz }, { data: upRows }] = await Promise.all([
        supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('business_id', bid),
        supabase.from('bookings').select('total_price').eq('business_id', bid).eq('status', 'completed'),
        supabase.from('businesses').select('average_rating, total_reviews').eq('id', bid).single(),
        supabase
          .from('bookings')
          .select('id, booking_date, booking_time, status, total_price, user_id')
          .eq('business_id', bid)
          .in('status', ['pending', 'confirmed'])
          .gte('booking_date', today)
          .order('booking_date', { ascending: true })
          .order('booking_time', { ascending: true })
          .limit(8),
      ])

      const sum = (revRows ?? []).reduce((a, x: { total_price: number | null }) => a + Number(x.total_price || 0), 0)
      const list = (upRows ?? []) as Upcoming[]

      if (c) {
        setTotalBookings(total ?? 0)
        setRevenue(sum)
        setRating(Number((bz as { average_rating?: number } | null)?.average_rating ?? 0))
        setReviewCount((bz as { total_reviews?: number } | null)?.total_reviews ?? 0)
        setUpcoming(list)
      }

      const uids = [...new Set(list.map((r) => r.user_id))]
      if (uids.length) {
        const { data: p, error: pubErr } = await supabase.from('public_profiles').select('id, full_name').in('id', uids)
        if (pubErr) {
          console.error(pubErr)
        }
        const nm: Record<string, string> = {}
        ;(p ?? []).forEach((x: { id: string; full_name: string | null }) => {
          nm[x.id] = x.full_name?.trim() || 'عميلة'
        })
        if (c) setClientNames(nm)
      } else if (c) setClientNames({})

      const now = new Date().toISOString()
      const { data: subRow, error: subErr } = await supabase
        .from('salon_subscriptions')
        .select('auto_renew, billing_provider, stripe_subscription_id')
        .eq('salon_id', bid)
        .eq('status', 'active')
        .gt('expires_at', now)
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (c) {
        if (subErr) {
          console.warn('salon_subscriptions auto_renew', subErr)
          setSubAutoRenew(null)
          setSubBillingProvider('moyasar')
          setSubStripeId(null)
        } else {
          const ar = (subRow as { auto_renew?: boolean } | null)?.auto_renew
          setSubAutoRenew(typeof ar === 'boolean' ? ar : null)
          const bp = (subRow as { billing_provider?: string | null } | null)?.billing_provider
          setSubBillingProvider(bp && bp.length > 0 ? bp : 'moyasar')
          setSubStripeId((subRow as { stripe_subscription_id?: string | null } | null)?.stripe_subscription_id ?? null)
        }
      }
      } catch (e) {
        console.error(e)
        toast.error('تعذر تحميل لوحة الصالون')
      }
    }
    void load()
    return () => {
      c = false
    }
  }, [user])

  const onToggleAutoRenew = async (enabled: boolean) => {
    setSubLoading(true)
    try {
      await setSalonSubscriptionAutoRenew(supabase, enabled, subBillingProvider, subStripeId)
      setSubAutoRenew(enabled)
      toast.success(enabled ? 'تجديد تلقائي: مفعّل' : 'تجديد تلقائي: متوقف')
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'تعذر حفظ الإعداد')
    } finally {
      setSubLoading(false)
    }
  }

  const statCards = [
    {
      label: 'إجمالي الحجوزات',
      value: totalBookings.toLocaleString('ar-SA'),
      icon: CalendarHeart,
      tone: 'from-primary-subtle/90 to-white dark:from-primary/12 dark:to-card',
    },
    {
      label: 'إيرادات مكتملة',
      value: `${revenue.toLocaleString('ar-SA')} ر.س`,
      icon: Wallet,
      tone: 'from-rose-50 to-white dark:from-rose-950/25 dark:to-card',
    },
    {
      label: 'التقييم',
      value: rating.toFixed(1),
      sub: `${reviewCount} تقييم`,
      icon: Star,
      tone: 'from-primary-subtle/80 to-white dark:from-primary/15 dark:to-card',
    },
    {
      label: 'حجوزات قادمة',
      value: upcoming.length.toLocaleString('ar-SA'),
      icon: TrendingUp,
      tone: 'from-primary-subtle/80 to-white dark:from-primary/15 dark:to-card',
    },
  ]

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 gradient-primary p-5 text-white shadow-lg shadow-primary/25 dark:shadow-none">
        <p className="text-sm font-medium text-white/90">مرحباً بكِ</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight">{salon?.name_ar ?? 'صالونك'}</h1>
        <p className="mt-2 text-sm text-white/85">{format(new Date(), 'EEEE d MMMM yyyy', { locale: ar })}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="rounded-xl border-0 bg-white/95 text-primary hover:bg-white"
            asChild
          >
            <Link to="/salon/profile">ملف الصالون</Link>
          </Button>
          <Button size="sm" variant="secondary" className="rounded-xl border-0 bg-white/20 text-white hover:bg-white/30" asChild>
            <Link to="/salon/bookings">إدارة الحجوزات</Link>
          </Button>
        </div>
      </Card>

      {salon && subAutoRenew !== null ? (
        <Card className="border-primary/15 p-4 dark:border-border">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary dark:bg-primary/15 dark:text-primary">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Label htmlFor="dash-auto-renew" className="text-base font-extrabold text-foreground">
                    تجديد تلقائي للاشتراك
                  </Label>
                  <p className="mt-0.5 text-xs text-foreground">
                    {subBillingProvider === 'stripe'
                      ? 'يُدار عبر Stripe — الإيقاف يوقف التجديد بعد نهاية الفترة الحالية'
                      : 'تجديد شهري تلقائي عند وجود بطاقة محفوظة'}
                  </p>
                </div>
                <Switch
                  id="dash-auto-renew"
                  checked={subAutoRenew}
                  disabled={subLoading}
                  onCheckedChange={(v) => void onToggleAutoRenew(v)}
                />
              </div>
              <Button variant="link" className="mt-1 h-auto p-0 text-xs font-semibold text-primary" asChild>
                <Link to="/salon/subscription">تفاصيل الاشتراك</Link>
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        {statCards.map(({ label, value, sub, icon: Icon, tone }) => (
          <Card
            key={label}
            className={cn(
              'border-primary/15 bg-gradient-to-br p-4 shadow-sm dark:border-border',
              tone
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-foreground">{label}</p>
                <p className="mt-1 text-2xl font-extrabold tabular-nums text-foreground">{value}</p>
                {sub ? <p className="text-xs text-foreground">{sub}</p> : null}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-subtle text-primary dark:bg-primary/15 dark:text-primary">
                <Icon className="h-5 w-5" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="border-primary/15 p-4 dark:border-border">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold text-foreground">الحجوزات القادمة</h2>
          <Button variant="ghost" size="sm" className="gap-1 text-primary" asChild>
            <Link to="/salon/bookings">
              الكل
              <ChevronLeft className="h-4 w-4 rotate-180" />
            </Link>
          </Button>
        </div>
        {upcoming.length === 0 ? (
          <p className="mt-4 py-6 text-center text-sm text-foreground">لا توجد حجوزات قادمة في الظاهر</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {upcoming.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/15 bg-white/80 px-3 py-2.5 dark:border-border dark:bg-card"
              >
                <div>
                  <p className="font-bold text-foreground">{clientNames[b.user_id] ?? 'عميلة'}</p>
                  <p className="text-xs text-foreground" dir="ltr">
                    {b.booking_date} · {String(b.booking_time).slice(0, 5)}
                  </p>
                </div>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold',
                    b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
                  )}
                >
                  {b.status === 'confirmed' ? 'مؤكد' : 'في الانتظار'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
