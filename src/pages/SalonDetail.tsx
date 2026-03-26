import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
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
import { supabase, type Business, type Service, type SalonTeamRow } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { BusinessCard } from '@/components/business/BusinessCard'
import { toast } from 'sonner'
import { formatPrice, haversineKm, cn } from '@/lib/utils'
import { resolveBusinessCoverImage } from '@/lib/businessImages'
import { openNativeMapsDirections } from '@/lib/openNativeMapsDirections'
import { getGoogleMapsApiKey } from '@/lib/googleMapsEnv'
import { useI18n } from '@/hooks/useI18n'
import { fetchActiveBusinessBoostMeta, type BoostMeta } from '@/lib/boosts'
import { captureProductEvent, trackEvent } from '@/lib/analytics'
import { preferenceMetaFromBusiness } from '@/lib/roseyUserPreference'
import { fetchActiveSalonFeaturedAdSalonIds, salonHasActiveFeaturedAd } from '@/lib/salonAds'
import { markGeolocationKnown } from '@/lib/geoSession'
import { salonHoursStatus } from '@/lib/salonHoursStatus'

const catAr: Record<string, string> = {
  salon: 'صالون نسائي 💇‍♀️',
  clinic: 'عيادة تجميل 🏥',
  spa: 'سبا ومساج 💆‍♀️',
  beauty_center: 'مركز تجميل ✨',
}

type BizRow = Business & {
  sa_cities?: { name_ar: string; sa_regions?: { name_ar: string } | null } | null
}

type DetailTab = 'photos' | 'services' | 'team' | 'reviews' | 'prices'

const TAB_DEF: { id: DetailTab; label: string }[] = [
  { id: 'photos', label: 'الصور' },
  { id: 'services', label: 'الخدمات' },
  { id: 'team', label: 'الفريق' },
  { id: 'reviews', label: 'التقييمات' },
  { id: 'prices', label: 'الأسعار' },
]

const SERVICE_CAT_LABEL: Record<string, string> = {
  hair: 'شعر',
  nails: 'أظافر',
  skin: 'بشرة',
  body: 'جسم',
  face: 'وجه',
  massage: 'مساج',
  makeup: 'مكياج',
  bridal: 'عرائس',
}

function labelForServiceCategory(cat: string): string {
  const c = cat?.trim() || ''
  if (!c) return 'عام'
  return SERVICE_CAT_LABEL[c] ?? c
}

export default function SalonDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const loc = useLocation() as {
    state?: { preselect?: string; source?: string } | null
  }
  const preselectFromNav = loc.state?.preselect?.trim() ?? ''
  const { t } = useI18n()
  const { user } = useAuth()
  const [b, setB] = useState<BizRow | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [team, setTeam] = useState<SalonTeamRow[]>([])
  const [reviews, setReviews] = useState<
    { rating: number; comment: string; profiles?: { full_name?: string }; created_at: string }[]
  >([])
  const [similar, setSimilar] = useState<Business[]>([])
  const [imgI, setImgI] = useState(0)
  const [hoursOpen, setHoursOpen] = useState(false)
  const [fav, setFav] = useState(false)
  const [loading, setLoading] = useState(true)
  const [salonBoost, setSalonBoost] = useState<BoostMeta | null>(null)
  const [featuredAdActive, setFeaturedAdActive] = useState(false)
  const [similarFeaturedIds, setSimilarFeaturedIds] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<DetailTab>('services')
  const [serviceCat, setServiceCat] = useState<string>('all')
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  const carouselRef = useRef<HTMLDivElement>(null)
  const serviceRowRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const preselectHandledKeyRef = useRef<string>('')
  const [detailHighlightServiceId, setDetailHighlightServiceId] = useState<string | null>(null)
  const adClickLogged = useRef(false)
  const salonOpenTrackedRef = useRef<string | null>(null)

  useEffect(() => {
    salonOpenTrackedRef.current = null
  }, [id])

  useEffect(() => {
    preselectHandledKeyRef.current = ''
    serviceRowRefs.current = {}
  }, [id])

  useEffect(() => {
    if (!id || !b?.id || b.id !== id) return
    if (salonOpenTrackedRef.current === id) return
    salonOpenTrackedRef.current = id
    captureProductEvent('salon_open', { salon_id: id })
  }, [id, b?.id])

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        markGeolocationKnown()
        setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude })
      },
      () => {},
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 120_000 }
    )
  }, [])

  useEffect(() => {
    if (!id) return
    let c = true
    async function load() {
      try {
        setSalonBoost(null)
        setFeaturedAdActive(false)
        const { data: biz, error: e1 } = await supabase
          .from('businesses')
          .select('*, sa_cities(name_ar, sa_regions(name_ar))')
          .eq('id', id)
          .single()
        if (e1) throw e1
        if (!c) return
        const row = biz as BizRow
        if (row.is_demo) {
          toast.error('هذا العرض تجريبي ولم يعد متاحاً')
          nav('/search', { replace: true })
          return
        }
        setB(row)
        const bm = await fetchActiveBusinessBoostMeta([row.id])
        if (c) setSalonBoost(bm.get(row.id) ?? null)

        const hasMainAd = await salonHasActiveFeaturedAd(row.id)
        if (c) setFeaturedAdActive(hasMainAd)

        const { data: svc } = await supabase.from('services').select('*').eq('business_id', id)
        if (c) {
          const raw = (svc ?? []) as Service[]
          setServices(raw.filter((s) => s.is_active !== false && s.is_demo !== true))
        }

        const { data: teamData } = await supabase
          .from('salon_team')
          .select('id, salon_id, name_ar, role_ar, image_url, sort_order')
          .eq('salon_id', id)
          .order('sort_order', { ascending: true })
        if (c) setTeam((teamData ?? []) as SalonTeamRow[])

        const { data: rev, error: revErr } = await supabase
          .from('reviews')
          .select('rating, comment, created_at, user_id')
          .eq('business_id', id)
          .order('created_at', { ascending: false })
          .limit(20)
        if (revErr) throw revErr
        const revRows = (rev ?? []) as { rating: number; comment: string | null; created_at: string; user_id: string }[]
        const uids = [...new Set(revRows.map((r) => r.user_id))]
        const nameByUser = new Map<string, string>()
        if (uids.length) {
          const { data: pub, error: pubErr } = await supabase
            .from('public_profiles')
            .select('id, full_name')
            .in('id', uids)
          if (pubErr) {
            console.error(pubErr)
          } else {
            ;(pub ?? []).forEach((rowP: { id: string; full_name: string | null }) => {
              nameByUser.set(rowP.id, rowP.full_name?.trim() || '')
            })
          }
        }
        const merged = revRows.map((r) => ({
          rating: r.rating,
          comment: r.comment ?? '',
          created_at: r.created_at,
          profiles: { full_name: nameByUser.get(r.user_id) || undefined },
        }))
        if (c) setReviews(merged)

        let simQ = supabase
          .from('businesses')
          .select('*')
          .eq('is_active', true)
          .eq('is_demo', false)
          .neq('id', id)
          .limit(6)
        if (row.city_id) simQ = simQ.eq('city_id', row.city_id)
        else simQ = simQ.eq('city', row.city)
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

  useEffect(() => {
    adClickLogged.current = false
  }, [id])

  useEffect(() => {
    if (!id || !featuredAdActive || adClickLogged.current) return
    adClickLogged.current = true
    void supabase.rpc('increment_salon_ad_click', { p_salon_id: id })
  }, [id, featuredAdActive])

  useEffect(() => {
    if (!similar.length) {
      setSimilarFeaturedIds(new Set())
      return
    }
    let c = true
    void fetchActiveSalonFeaturedAdSalonIds(similar.map((x) => x.id)).then((s) => {
      if (c) setSimilarFeaturedIds(s)
    })
    return () => {
      c = false
    }
  }, [similar])

  useEffect(() => {
    if (!b || !user?.id) return
    const m = preferenceMetaFromBusiness(b, 'salon_page_view')
    trackEvent('user_preference', { user_id: user.id, ...m })
  }, [b?.id, user?.id])

  useEffect(() => {
    if (!b?.id || !user?.id) return
    trackEvent({
      event_type: 'salon_clicks',
      entity_type: 'business',
      entity_id: b.id,
      user_id: user.id,
    })
  }, [b?.id, user?.id])

  const galleryImgs = useMemo(() => {
    if (!b) return [] as string[]
    const primaryCover = resolveBusinessCoverImage(b)
    const imgsRaw = (b.images ?? []).filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    return imgsRaw.length > 0 ? imgsRaw : [primaryCover]
  }, [b])

  const serviceCategories = useMemo(() => {
    const set = new Set<string>()
    services.forEach((s) => set.add(s.category || ''))
    return [...set].filter(Boolean).sort((a, z) => labelForServiceCategory(a).localeCompare(labelForServiceCategory(z), 'ar'))
  }, [services])

  const filteredServices = useMemo(() => {
    if (serviceCat === 'all') return services
    return services.filter((s) => s.category === serviceCat)
  }, [services, serviceCat])

  useEffect(() => {
    if (!preselectFromNav || services.length === 0 || !id) return
    const key = `${id}::${preselectFromNav}`
    if (preselectHandledKeyRef.current === key) return
    const svc = services.find((s) => s.id === preselectFromNav)
    if (!svc) return
    preselectHandledKeyRef.current = key
    setActiveTab('services')
    const cat = svc.category?.trim()
    setServiceCat(cat ? cat : 'all')
    setDetailHighlightServiceId(preselectFromNav)
    const scrollT = window.setTimeout(() => {
      serviceRowRefs.current[preselectFromNav]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 180)
    const clearH = window.setTimeout(() => setDetailHighlightServiceId(null), 5500)
    return () => {
      window.clearTimeout(scrollT)
      window.clearTimeout(clearH)
    }
  }, [id, preselectFromNav, services])

  const pricesSorted = useMemo(() => [...services].sort((a, z) => Number(a.price) - Number(z.price)), [services])

  useEffect(() => {
    if (!galleryImgs.length) return
    setImgI((i) => Math.min(i, galleryImgs.length - 1))
  }, [galleryImgs.length])

  const onCarouselScroll = useCallback(() => {
    const el = carouselRef.current
    if (!el) return
    const slide = el.querySelector('[data-carousel-slide]') as HTMLElement | null
    const w = slide?.offsetWidth ?? el.clientWidth
    if (!w || !galleryImgs.length) return
    const i = Math.round(el.scrollLeft / w)
    setImgI(Math.min(Math.max(0, i), galleryImgs.length - 1))
  }, [galleryImgs.length])

  const scrollCarouselTo = useCallback((index: number) => {
    const el = carouselRef.current
    if (!el) return
    const slide = el.querySelector('[data-carousel-slide]') as HTMLElement | null
    const w = slide?.offsetWidth ?? el.clientWidth
    el.scrollTo({ left: index * w, behavior: 'smooth' })
  }, [])

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
        if (b) {
          trackEvent('user_preference', { user_id: user.id, ...preferenceMetaFromBusiness(b, 'favorite') })
        }
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

  const goBooking = (preselect?: string) => {
    if (!b) return
    if (!user) {
      toast.error('سجّلي دخولكِ للحجز')
      nav('/auth')
      return
    }
    if (services.length === 0) {
      toast.error('لا توجد خدمات مفعّلة للحجز من التطبيق حالياً')
      return
    }
    nav(`/booking/${b.id}`, { state: preselect ? { preselect } : undefined })
  }

  if (loading || !b) {
    return (
      <div className="p-4">
        <Skeleton className="aspect-video w-full rounded-2xl" />
        <Skeleton className="mt-4 h-8 w-2/3" />
      </div>
    )
  }

  const imgs = galleryImgs
  const hours = b.opening_hours as Record<string, { open: string; close: string }> | undefined
  const hoursInfo = salonHoursStatus(hours)
  const ratingBreakdown = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => r.rating === star).length
    const pct = reviews.length ? (count / reviews.length) * 100 : 0
    return { star, pct }
  })
  const displayReviews = reviews

  const cityLine = b.sa_cities?.name_ar ?? b.city
  const regionLine = b.sa_cities?.sa_regions?.name_ar ?? b.region ?? ''
  const districtLine = b.address_ar?.split('،')[0]?.trim() || b.address_ar || ''

  const distKm =
    userPos && b.latitude != null && b.longitude != null
      ? haversineKm(userPos.lat, userPos.lng, b.latitude, b.longitude)
      : undefined

  return (
    <div className="min-h-dvh bg-background pb-36">
      {/* ——— Carousel ——— */}
      <div className="relative w-full">
        <div
          ref={carouselRef}
          onScroll={onCarouselScroll}
          dir="ltr"
          className="flex snap-x snap-mandatory overflow-x-auto scrollbar-hide aspect-[16/10]"
        >
          {imgs.map((src, i) => (
            <div key={i} data-carousel-slide className="h-full w-full shrink-0 snap-center snap-always">
              <motion.img
                initial={{ opacity: 0.85 }}
                animate={{ opacity: 1 }}
                src={src}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute bottom-3 start-0 end-0 flex justify-center">
          <span className="rounded-full bg-black/55 px-3 py-1 text-xs font-bold text-white backdrop-blur-sm">
            {imgI + 1}/{imgs.length}
          </span>
        </div>
        <div className="absolute start-0 top-0 flex w-full items-start justify-between p-3">
          <Link
            to="/"
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
          >
            ←
          </Link>
          <div className="pointer-events-auto flex gap-2">
            <button
              type="button"
              aria-label="مفضلة"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
              onClick={toggleFav}
            >
              <Heart className={`h-5 w-5 ${fav ? 'fill-gold text-gold' : ''}`} />
            </button>
            <button
              type="button"
              aria-label="مشاركة"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
              onClick={share}
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-lg px-4 -mt-6 space-y-4">
        <div className="luxury-card space-y-4 p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-heading-2 font-extrabold text-foreground">{b.name_ar}</h1>
              {b.name_en ? <p className="mt-1 text-sm text-muted-foreground" dir="ltr">{b.name_en}</p> : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {featuredAdActive ? (
                <Badge className="shrink-0 bg-gradient-to-l from-fuchsia-600 to-pink-500 text-[11px] font-extrabold text-white">
                  إعلان ⭐
                </Badge>
              ) : null}
              {b.is_featured ? (
                <Badge className="shrink-0 bg-amber-400/95 text-[11px] font-extrabold text-amber-950">⭐ صالون مميز</Badge>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="flex items-center gap-1 text-[#9B2257]">
              <Star className="h-4 w-4 fill-[#9B2257] text-[#9B2257]" />
              <strong className="font-extrabold">{Number(b.average_rating ?? 0).toFixed(1)}</strong>
              <span className="text-rosera-gray">({b.total_reviews ?? 0})</span>
            </span>
            {distKm != null ? (
              <Badge variant="secondary" className="font-semibold">
                {distKm.toFixed(1)} {t('common.km')}
              </Badge>
            ) : null}
            <Badge className="bg-gradient-to-l from-[#9C27B0]/15 to-[#E91E8C]/15 text-foreground">
              {b.category_label || catAr[b.category] || b.category}
            </Badge>
            {salonBoost && (
              <Badge
                className={
                  salonBoost.boost_type === 'featured'
                    ? 'border-amber-400/60 bg-amber-400/20 text-amber-950'
                    : 'border-primary/30 bg-primary/10 text-primary'
                }
              >
                {salonBoost.boost_type === 'featured' ? 'Featured' : 'مُموَّل'}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-start gap-2 text-sm">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="space-y-0.5 text-rosera-gray">
              {districtLine ? <p className="font-medium text-foreground">{districtLine}</p> : null}
              <p>
                {[cityLine, regionLine].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              className={
                hoursInfo.isOpen
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100'
                  : 'bg-muted text-foreground'
              }
            >
              {hoursInfo.statusLabel}
            </Badge>
            {hoursInfo.nextLine ? (
              <span className="text-xs text-muted-foreground">{hoursInfo.nextLine}</span>
            ) : null}
            <Badge variant="outline" className="font-bold">
              {services.length} خدمة متاحة
            </Badge>
          </div>

          <button
            type="button"
            onClick={() => setHoursOpen(!hoursOpen)}
            className="flex w-full items-center justify-between rounded-xl bg-muted/50 p-3 text-sm font-semibold"
          >
            <span className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              أوقات الدوام الكاملة
            </span>
            <ChevronDown className={`transition ${hoursOpen ? 'rotate-180' : ''}`} />
          </button>
          {hoursOpen && hours && (
            <ul className="space-y-1 pe-4 text-sm">
              {Object.entries(hours).map(([d, slot]) => (
                <li key={d} className="flex justify-between gap-2">
                  <span>{d}</span>
                  <span dir="ltr" className="shrink-0">
                    {slot.open} – {slot.close}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex gap-3">
            {b.phone && (
              <a
                href={`tel:${b.phone}`}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-primary py-3 text-sm font-semibold text-primary"
              >
                <Phone className="h-4 w-4" />
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
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-semibold text-white"
              >
                <MessageCircle className="h-4 w-4" />
                واتساب
              </a>
            )}
          </div>
        </div>

        {/* ——— Tabs ——— */}
        <div className="-mx-1 overflow-x-auto pb-1 scrollbar-hide">
          <div className="flex min-w-0 gap-2 px-1">
            {TAB_DEF.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn('tab-chip', activeTab === tab.id && 'tab-chip--selected')}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ——— Tab panels ——— */}
        {activeTab === 'photos' && (
          <section className="space-y-3">
            <p className="text-sm font-semibold text-muted-foreground">معرض الصور</p>
            <div dir="ltr" className="flex snap-x gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {imgs.map((src, i) => (
                <button
                  key={i}
                  type="button"
                  className={`relative shrink-0 snap-start overflow-hidden rounded-2xl border-2 ${i === imgI ? 'border-primary' : 'border-transparent'}`}
                  style={{ width: 220 }}
                  onClick={() => {
                    setImgI(i)
                    scrollCarouselTo(i)
                  }}
                >
                  <img src={src} alt="" className="h-32 w-full object-cover" />
                </button>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'services' && (
          <section className="space-y-4">
            <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 scrollbar-hide px-1">
              <button
                type="button"
                onClick={() => setServiceCat('all')}
                className={cn('category-chip', serviceCat === 'all' && 'category-chip--selected')}
              >
                الكل
              </button>
              {serviceCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setServiceCat(cat)}
                  className={cn('category-chip', serviceCat === cat && 'category-chip--selected')}
                >
                  {labelForServiceCategory(cat)}
                </button>
              ))}
            </div>
            {filteredServices.length === 0 ? (
              <p className="rounded-xl border border-dashed border-primary/20 bg-card/50 p-6 text-center text-sm text-muted-foreground">
                لا توجد خدمات في هذا التصنيف حالياً.
              </p>
            ) : (
              <div className="space-y-3">
                {filteredServices.map((s) => (
                  <div
                    key={s.id}
                    ref={(el) => {
                      serviceRowRefs.current[s.id] = el
                    }}
                    className={cn(
                      'flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-sm',
                      detailHighlightServiceId === s.id &&
                        'ring-2 ring-[#BE185D]/65 ring-offset-2 ring-offset-background'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{s.name_ar}</p>
                      {s.name_en ? (
                        <p className="text-sm text-muted-foreground" dir="ltr">
                          {s.name_en}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm text-rosera-gray">
                        {formatPrice(Number(s.price))} ر.س · {s.duration_minutes} دقيقة
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0 font-bold"
                      onClick={() => goBooking(s.id)}
                    >
                      احجز
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'team' && (
          <section className="space-y-3">
            {team.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                لم يتم إضافة أعضاء الفريق بعد.
              </p>
            ) : (
              <div className="-mx-1 flex gap-3 overflow-x-auto pb-2 px-1 scrollbar-hide">
                {team.map((m) => (
                  <div
                    key={m.id}
                    className="w-[140px] shrink-0 rounded-2xl border bg-card p-3 text-center shadow-sm"
                  >
                    <div className="mx-auto h-16 w-16 overflow-hidden rounded-full bg-muted">
                      {m.image_url ? (
                        <img src={m.image_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-lg font-bold text-primary">
                          {m.name_ar[0]}
                        </div>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-bold">{m.name_ar}</p>
                    {m.role_ar ? <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{m.role_ar}</p> : null}
                    <div className="mt-2 flex items-center justify-center gap-0.5 text-[#9B2257]">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      <span className="text-xs font-bold">{Number(b.average_rating ?? 0).toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'reviews' && (
          <section className="space-y-5">
            <div className="flex flex-col items-center gap-1 rounded-2xl border bg-card py-6">
              <div className="flex items-center gap-2 text-[#9B2257]">
                <Star className="h-10 w-10 fill-current" />
                <span className="text-4xl font-black">{Number(b.average_rating ?? 0).toFixed(1)}</span>
              </div>
              <p className="text-sm font-semibold text-muted-foreground">{b.total_reviews ?? 0} تقييم</p>
            </div>
            <div className="space-y-2">
              {ratingBreakdown.map(({ star, pct }) => (
                <div key={star} className="flex items-center gap-2 text-sm">
                  <span className="w-8 shrink-0">{star}★</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-[#9B2257]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-4">
              {displayReviews.length === 0 ? (
                <p className="rounded-xl border border-dashed border-primary/20 bg-card/50 p-6 text-center text-rosera-gray">
                  لا تقييمات بعد — كني أول من يقيّم بعد زيارتكِ
                </p>
              ) : (
                displayReviews.map((r, i) => (
                  <div key={i} className="rounded-xl border bg-card p-4">
                    <div className="flex items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 font-bold text-primary">
                        {(r.profiles?.full_name || 'ع')[0]}
                      </div>
                      <div>
                        <p className="font-semibold">{r.profiles?.full_name || 'عميلة'}</p>
                        <div className="flex text-[#9B2257]">
                          {Array.from({ length: r.rating }).map((_, j) => (
                            <Star key={j} className="h-4 w-4 fill-[#9B2257]" />
                          ))}
                        </div>
                      </div>
                    </div>
                    <p className="mt-2 text-rosera-gray">{r.comment}</p>
                  </div>
                ))
              )}
            </div>
            <Button variant="outline" className="w-full">
              اكتبي تقييمك
            </Button>
          </section>
        )}

        {activeTab === 'prices' && (
          <section className="space-y-3">
            <p className="text-sm text-muted-foreground">كل الخدمات مرتبة حسب السعر</p>
            <div className="space-y-2">
              {pricesSorted.length === 0 ? (
                <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">لا توجد أسعار لعرضها.</p>
              ) : (
                pricesSorted.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold">{s.name_ar}</p>
                      {s.name_en ? (
                        <p className="text-xs text-muted-foreground" dir="ltr">
                          {s.name_en}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="font-bold text-primary">{formatPrice(Number(s.price))} ر.س</span>
                      <Button size="sm" variant="secondary" className="font-bold" onClick={() => goBooking(s.id)}>
                        احجز
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {b.description_ar && (
          <section className="mt-6">
            <h2 className="text-lg font-bold">عن المنشأة</h2>
            <p className="mt-2 leading-relaxed text-rosera-gray">{b.description_ar}</p>
          </section>
        )}

        {b.latitude != null && b.longitude != null && (
          <section className="mt-8">
            <h2 className="text-lg font-bold">الموقع على الخريطة</h2>
            <div className="mt-3 h-52 overflow-hidden rounded-2xl border border-primary/15 shadow-lg ring-1 ring-black/5">
              {(() => {
                const gKey = getGoogleMapsApiKey()
                const lat = b.latitude!
                const lng = b.longitude!
                const q = encodeURIComponent(`${lat},${lng}`)
                if (gKey) {
                  return (
                    <iframe
                      title="خريطة الصالون"
                      width="100%"
                      height="100%"
                      className="min-h-[208px]"
                      style={{ border: 0 }}
                      loading="lazy"
                      allowFullScreen
                      referrerPolicy="no-referrer-when-downgrade"
                      src={`https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(gKey)}&q=${q}&zoom=15&maptype=roadmap`}
                    />
                  )
                }
                return (
                  <div className="flex h-full min-h-[208px] flex-col items-center justify-center gap-3 bg-muted/40 px-4">
                    <p className="text-center text-sm text-muted-foreground">معاينة الخريطة عبر Google</p>
                    <Button asChild className="rounded-xl">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${q}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        فتح في خرائط Google
                      </a>
                    </Button>
                  </div>
                )
              })()}
            </div>
            <Button
              type="button"
              variant="link"
              className="mt-2 h-auto p-0 text-sm font-bold text-primary"
              onClick={() => openNativeMapsDirections(b.latitude, b.longitude, b.name_ar ?? undefined)}
            >
              {t('map.directions')} ↗
            </Button>
          </section>
        )}

        {similar.length > 0 && (
          <section className="mt-10 pb-8">
            <h2 className="text-lg font-bold">صالونات مشابهة</h2>
            <div className="mt-4 flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {similar.map((x) => (
                <div key={x.id} className="w-[180px] shrink-0">
                  <BusinessCard b={x} isFeaturedAd={similarFeaturedIds.has(x.id)} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="fixed bottom-20 start-0 end-0 z-30 border-t bg-white/95 p-3 backdrop-blur dark:bg-card/95">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Button
            className="min-h-12 flex-1 gap-2 text-base font-bold"
            disabled={services.length === 0}
            onClick={() => goBooking()}
          >
            احجز موعد الآن
          </Button>
          <span className="shrink-0 text-center text-xs font-bold text-muted-foreground sm:text-sm">
            {services.length} خدمة متاحة
          </span>
        </div>
        {services.length === 0 && !loading ? (
          <p className="mx-auto mt-2 max-w-lg px-4 text-center text-xs text-muted-foreground">
            الخدمات غير مفعّلة للحجز الإلكتروني بعد — جرّبي «اتصال» أو «واتساب» أعلاه
          </p>
        ) : null}
      </div>
    </div>
  )
}
