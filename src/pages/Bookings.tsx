import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, CalendarHeart, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { buildMapExploreUrl } from '@/lib/mapExploreUrl'
import { toast } from 'sonner'
import { useI18n } from '@/hooks/useI18n'

type Row = {
  id: string
  business_id: string
  booking_date: string
  booking_time: string
  status: string
  total_price: number
  businesses: { name_ar: string; cover_image?: string }
  services?: { name_ar: string }
}

export default function Bookings() {
  const { t } = useI18n()
  const { user } = useAuth()
  const nav = useNavigate()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

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
          .from('bookings')
          .select('id, business_id, booking_date, booking_time, status, total_price, businesses(name_ar, cover_image), services(name_ar)')
          .eq('user_id', uid)
          .order('booking_date', { ascending: false })
        if (error) throw error
        if (c) setRows((data ?? []) as unknown as Row[])
      } catch {
        toast.error('تعذر التحميل')
      } finally {
        if (c) setLoading(false)
      }
    }
    void load()
    return () => {
      c = false
    }
  }, [user, nav])

  const filter = (s: string) => rows.filter((r) => r.status === s)

  const cancel = async (id: string) => {
    try {
      const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', id)
      if (error) throw error
      setRows((x) => x.map((r) => (r.id === id ? { ...r, status: 'cancelled' } : r)))
      toast.success('أُلغي الحجز')
    } catch {
      toast.error('فشل الإلغاء')
    }
  }

  if (!user) return null
  if (loading) return <div className="p-8 text-center">جاري التحميل...</div>

  const Card = ({ r }: { r: Row }) => {
    const img = r.businesses?.cover_image || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=200'
    const st =
      r.status === 'confirmed' || r.status === 'pending'
        ? 'قادمة'
        : r.status === 'completed'
          ? 'مكتملة'
          : 'ملغاة'
    const color =
      r.status === 'cancelled' ? 'destructive' : r.status === 'completed' ? 'success' : 'default'
    return (
      <div className="mb-4 flex gap-4 rounded-2xl border bg-card p-4 dark:bg-card">
        <img src={img} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <h3 className="font-bold line-clamp-1">{r.businesses?.name_ar}</h3>
          <p className="text-sm text-rosera-gray">{r.services?.name_ar || 'خدمات متعددة'}</p>
          <p className="mt-1 text-sm">
            {r.booking_date} {r.booking_time}
          </p>
          <Badge
            className={`mt-2 ${color === 'success' ? 'bg-success/15 text-success border-0' : ''} ${color === 'destructive' ? 'bg-destructive/15 text-destructive border-0' : ''}`}
          >
            {st}
          </Badge>
          <div className="mt-2 flex flex-wrap gap-2">
            {(r.status === 'pending' || r.status === 'confirmed') && (
              <Button size="sm" variant="outline" onClick={() => cancel(r.id)}>
                إلغاء
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={() => nav(`/salon/${r.business_id}`)}>
              إعادة حجز
            </Button>
            {r.status === 'completed' && <Button size="sm">تقييم</Button>}
          </div>
        </div>
      </div>
    )
  }

  const goMap = () => nav(buildMapExploreUrl())

  return (
    <div className="min-h-dvh bg-rosera-light px-4 py-6 dark:bg-rosera-dark">
      <h1 className="text-2xl font-bold">حجوزاتي</h1>
      <Tabs defaultValue="up" className="mt-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="up">القادمة</TabsTrigger>
          <TabsTrigger value="done">المكتملة</TabsTrigger>
          <TabsTrigger value="can">الملغاة</TabsTrigger>
        </TabsList>
        <TabsContent value="up">
          {filter('pending').concat(filter('confirmed')).length === 0 ? (
            <div className="py-10">
              <EmptyState
                icon={CalendarHeart}
                title={t('bookings.emptyUpTitle')}
                subtitle={t('bookings.emptyUpSub')}
                ctaLabel={t('bookings.emptyUpCta')}
                onClick={goMap}
                analyticsSource="bookings"
              />
            </div>
          ) : (
            filter('pending')
              .concat(filter('confirmed'))
              .map((r) => <Card key={r.id} r={r} />)
          )}
        </TabsContent>
        <TabsContent value="done">
          {filter('completed').length === 0 ? (
            <div className="py-10">
              <EmptyState
                icon={CheckCircle2}
                title={t('bookings.emptyDoneTitle')}
                subtitle={t('bookings.emptyDoneSub')}
                ctaLabel={t('bookings.emptyDoneCta')}
                onClick={goMap}
                analyticsSource="bookings"
                ctaVariant="secondary"
              />
            </div>
          ) : (
            filter('completed').map((r) => <Card key={r.id} r={r} />)
          )}
        </TabsContent>
        <TabsContent value="can">
          {filter('cancelled').length === 0 ? (
            <div className="py-10">
              <EmptyState
                icon={Ban}
                title={t('bookings.emptyCanTitle')}
                subtitle={t('bookings.emptyCanSub')}
                ctaLabel={t('bookings.emptyCanCta')}
                onClick={goMap}
                analyticsSource="bookings"
                ctaVariant="secondary"
              />
            </div>
          ) : (
            filter('cancelled').map((r) => <Card key={r.id} r={r} />)
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
