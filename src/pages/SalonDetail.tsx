import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Star,
  MapPin,
  Phone,
  MessageCircle,
  Clock,
  ChevronDown,
  Heart,
  Share2,
} from 'lucide-react'
import { supabase, type Business, type Service } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { BusinessCard } from '@/components/business/BusinessCard'
import { toast } from 'sonner'
import { formatPrice } from '@/lib/utils'

const catAr: Record<string, string> = {
  salon: 'صالون نسائي 💇‍♀️',
  clinic: 'عيادة تجميل 🏥',
  spa: 'سبا ومساج 💆‍♀️',
  beauty_center: 'مركز تجميل ✨',
}

export default function SalonDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const [b, setB] = useState<Business | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [reviews, setReviews] = useState<{ rating: number; comment: string; profiles?: { full_name?: string }; created_at: string }[]>([])
  const [similar, setSimilar] = useState<Business[]>([])
  const [imgI, setImgI] = useState(0)
  const [hoursOpen, setHoursOpen] = useState(false)
  const [fav, setFav] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    let c = true
    async function load() {
      try {
        const { data: biz, error: e1 } = await supabase.from('businesses').select('*').eq('id', id).single()
        if (e1) throw e1
        if (!c) return
        setB(biz as Business)

        const { data: svc } = await supabase.from('services').select('*').eq('business_id', id).eq('is_active', true)
        if (c) setServices((svc ?? []) as Service[])

        const { data: rev } = await supabase
          .from('reviews')
          .select('rating, comment, created_at, profiles(full_name)')
          .eq('business_id', id)
          .order('created_at', { ascending: false })
          .limit(20)
        if (c) setReviews((rev ?? []) as typeof reviews)

        const B = biz as Business
        let simQ = supabase.from('businesses').select('*').eq('is_active', true).neq('id', id).limit(6)
        if (B.city_id) simQ = simQ.eq('city_id', B.city_id)
        else simQ = simQ.eq('city', B.city)
        const { data: sim } = await simQ
        if (c) setSimilar((sim ?? []) as Business[])

        if (user) {
          const { data: f } = await supabase.from('favorites').select('id').eq('business_id', id).eq('user_id', user.id).maybeSingle()
          if (c) setFav(!!f)
        }
      } catch {
        toast.error('تعذر تحميل الصفحة')
      } finally {
        if (c) setLoading(false)
      }
    }
    void load()
    return () => {
      c = false
    }
  }, [id, user])

  const toggleFav = async () => {
    if (!user || !id) {
      toast.error('سجّلي دخولكِ لإضافة المفضلة')
      nav('/auth')
      return
    }
    try {
      if (fav) {
        await supabase.from('favorites').delete().eq('business_id', id).eq('user_id', user.id)
        setFav(false)
        toast.success('أُزيلت من المفضلة')
      } else {
        await supabase.from('favorites').insert({ business_id: id, user_id: user.id })
        setFav(true)
        toast.success('أُضيفت للمفضلة')
      }
    } catch {
      toast.error('حدث خطأ')
    }
  }

  const share = () => {
    if (navigator.share) void navigator.share({ title: b?.name_ar, url: window.location.href })
    else {
      void navigator.clipboard.writeText(window.location.href)
      toast.success('تم نسخ الرابط')
    }
  }

  if (loading || !b) {
    return (
      <div className="p-4">
        <Skeleton className="aspect-video w-full rounded-2xl" />
        <Skeleton className="mt-4 h-8 w-2/3" />
      </div>
    )
  }

  const imgs = b.images?.length ? b.images : [b.cover_image || 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800']
  const hours = b.opening_hours as Record<string, { open: string; close: string }> | undefined
  const ratingBreakdown = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => r.rating === star).length
    const pct = reviews.length ? (count / reviews.length) * 100 : 0
    return { star, pct }
  })

  const displayReviews = reviews

  return (
    <div className="min-h-dvh bg-rosera-light pb-32 dark:bg-rosera-dark">
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        <motion.img
          key={imgI}
          initial={{ opacity: 0.8 }}
          animate={{ opacity: 1 }}
          src={imgs[imgI % imgs.length]}
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute bottom-0 start-0 end-0 flex justify-center gap-2 pb-4">
          {imgs.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setImgI(i)}
              className={`h-2 rounded-full transition-all ${i === imgI ? 'w-8 bg-white' : 'w-2 bg-white/50'}`}
            />
          ))}
        </div>
        <Link
          to="/"
          className="absolute top-4 start-4 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
        >
          ←
        </Link>
      </div>

      <div className="mx-auto max-w-lg px-4 -mt-6 relative z-10">
        <div className="rounded-2xl border bg-white p-5 shadow-card dark:bg-card">
          <h1 className="text-2xl font-extrabold">{b.name_ar}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1 text-gold">
              <Star className="h-5 w-5 fill-gold" />
              <strong>{Number(b.average_rating ?? 0).toFixed(1)}</strong>
              <span className="text-rosera-gray">({b.total_reviews ?? 0} تقييم)</span>
            </span>
            <Badge className="bg-gradient-to-l from-[#9C27B0]/15 to-[#E91E8C]/15 text-foreground">
              {b.category_label || catAr[b.category] || b.category}
            </Badge>
          </div>
          <div className="mt-4 flex items-start gap-2 text-rosera-gray">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p>{b.address_ar || b.city}</p>
              <button
                type="button"
                className="mt-1 text-sm font-semibold text-primary"
                onClick={() => nav('/map')}
              >
                فتح في الخريطة
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setHoursOpen(!hoursOpen)}
            className="mt-4 flex w-full items-center justify-between rounded-xl bg-muted/50 p-3"
          >
            <span className="flex items-center gap-2 font-semibold">
              <Clock className="h-5 w-5 text-primary" />
              أوقات الدوام
            </span>
            <ChevronDown className={`transition ${hoursOpen ? 'rotate-180' : ''}`} />
          </button>
          {hoursOpen && hours && (
            <ul className="mt-2 space-y-1 text-sm pe-4">
              {Object.entries(hours).map(([d, t]) => (
                <li key={d} className="flex justify-between">
                  <span>{d}</span>
                  <span dir="ltr">
                    {t.open} – {t.close}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex gap-3">
            {b.phone && (
              <a href={`tel:${b.phone}`} className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-primary py-3 font-semibold text-primary">
                <Phone className="h-5 w-5" />
                اتصال
              </a>
            )}
            {(b.whatsapp || b.phone) && (
              <a
                href={(() => {
                  const raw = (b.whatsapp || b.phone || '').replace(/\D/g, '')
                  if (raw.startsWith('966')) return `https://wa.me/${raw}`
                  if (raw.startsWith('5') && raw.length === 9) return `https://wa.me/966${raw}`
                  if (raw.startsWith('05')) return `https://wa.me/966${raw.slice(1)}`
                  return `https://wa.me/${raw}`
                })()}
                target="_blank"
                rel="noreferrer"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 py-3 font-semibold text-white"
              >
                <MessageCircle className="h-5 w-5" />
                واتساب
              </a>
            )}
          </div>
        </div>

        {b.description_ar && (
          <section className="mt-8">
            <h2 className="text-lg font-bold">عن المنشأة</h2>
            <p className="mt-2 leading-relaxed text-rosera-gray">{b.description_ar}</p>
          </section>
        )}

        {b.latitude != null && b.longitude != null && (
          <section className="mt-8">
            <h2 className="text-lg font-bold">الموقع على الخريطة</h2>
            <div className="mt-3 h-52 overflow-hidden rounded-2xl border border-primary/15 shadow-lg ring-1 ring-black/5">
              <iframe
                title="خريطة الصالون"
                width="100%"
                height="100%"
                className="min-h-[208px]"
                style={{ border: 0 }}
                loading="lazy"
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${b.longitude - 0.03}%2C${b.latitude - 0.03}%2C${b.longitude + 0.03}%2C${b.latitude + 0.03}&layer=mapnik&marker=${b.latitude}%2C${b.longitude}`}
              />
            </div>
            <a
              href={`https://www.google.com/maps?q=${b.latitude},${b.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm font-bold text-primary"
            >
              فتح في خرائط جوجل ↗
            </a>
          </section>
        )}

        <section className="mt-8">
          <h2 className="text-lg font-bold">الخدمات</h2>
          <div className="mt-4 space-y-3">
            {['hair', 'nails', 'skin', 'massage', 'makeup', 'bridal'].map((cat) => {
              const sv = services.filter((s) => s.category === cat)
              if (!sv.length) return null
              const labels: Record<string, string> = {
                hair: 'شعر',
                nails: 'أظافر',
                skin: 'بشرة',
                massage: 'مساج',
                makeup: 'مكياج',
                bridal: 'عرائس',
              }
              return (
                <div key={cat}>
                  <h3 className="mb-2 font-semibold text-primary">{labels[cat]}</h3>
                  {sv.map((s) => (
                    <div
                      key={s.id}
                      className="mb-2 flex items-center justify-between rounded-xl border bg-white p-4 dark:bg-card"
                    >
                      <div>
                        <p className="font-bold">{s.name_ar}</p>
                        <p className="text-sm text-rosera-gray">
                          {formatPrice(Number(s.price))} · {s.duration_minutes} د
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!user) {
                            toast.error('سجّلي دخولكِ للحجز')
                            nav('/auth')
                            return
                          }
                          nav(`/booking/${b.id}`, { state: { preselect: s.id } })
                        }}
                      >
                        احجزي
                      </Button>
                    </div>
                  ))}
                </div>
              )
            })}
            {services.filter((s) => !['hair', 'nails', 'skin', 'massage', 'makeup', 'bridal'].includes(s.category)).map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-xl border bg-white p-4 dark:bg-card">
                <div>
                  <p className="font-bold">{s.name_ar}</p>
                  <p className="text-sm text-rosera-gray">
                    {formatPrice(Number(s.price))} · {s.duration_minutes} د
                  </p>
                </div>
                <Button size="sm" onClick={() => nav(`/booking/${b.id}`, { state: { preselect: s.id } })}>
                  احجزي
                </Button>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-bold">التقييمات</h2>
          <div className="mt-4 space-y-2">
            {ratingBreakdown.map(({ star, pct }) => (
              <div key={star} className="flex items-center gap-2 text-sm">
                <span>{star}★</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-4">
            {displayReviews.length === 0 ? (
              <p className="rounded-xl border border-dashed border-primary/20 bg-white/50 p-6 text-center text-rosera-gray dark:bg-card/50">
                لا تقييمات بعد — كني أول من يقيّم بعد زيارتكِ
              </p>
            ) : (
              displayReviews.map((r, i) => (
                <div key={i} className="rounded-xl border bg-white p-4 dark:bg-card">
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
                      {(r.profiles?.full_name || 'ع')[0]}
                    </div>
                    <div>
                      <p className="font-semibold">{r.profiles?.full_name || 'عميلة'}</p>
                      <div className="flex text-gold">
                        {Array.from({ length: r.rating }).map((_, j) => (
                          <Star key={j} className="h-4 w-4 fill-gold" />
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className="mt-2 text-rosera-gray">{r.comment}</p>
                </div>
              ))
            )}
          </div>
          <Button variant="outline" className="mt-4 w-full">
            اكتبي تقييمك
          </Button>
        </section>

        {similar.length > 0 && (
          <section className="mt-10 pb-8">
            <h2 className="text-lg font-bold">صالونات مشابهة</h2>
            <div className="mt-4 flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {similar.map((x) => (
                <div key={x.id} className="w-[180px] shrink-0">
                  <BusinessCard b={x} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="fixed bottom-20 start-0 end-0 z-30 border-t bg-white/95 p-4 backdrop-blur dark:bg-card/95">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Button size="icon" variant="outline" onClick={toggleFav}>
            <Heart className={`h-6 w-6 ${fav ? 'fill-accent text-accent' : ''}`} />
          </Button>
          <Button size="icon" variant="outline" onClick={share}>
            <Share2 className="h-6 w-6" />
          </Button>
          <Button
            className="flex-1 gap-2 text-lg font-bold"
            onClick={() => {
              if (!user) {
                nav('/auth')
                return
              }
              nav(`/booking/${b.id}`)
            }}
          >
            احجزي الآن 💜
          </Button>
        </div>
      </div>
    </div>
  )
}
