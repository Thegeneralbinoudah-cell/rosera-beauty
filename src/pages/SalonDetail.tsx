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
import { pickDefaultServiceIdForBooking, resolveSalonRosyRecommendation } from '@/lib/salonRosyRecommendation'
import { SalonRosyRecommendationCard } from '@/components/salon/SalonRosyRecommendationCard'
import { colors } from '@/theme/colors'

const catAr: Record<string, string> = {
  salon: 'صالون نسائي',
  clinic: 'عيادة تجميل 🏥',
  spa: 'سبا ومساج 💆‍♀️',
  beauty_center: 'مركز تجميل',
}

type BizRow = Business & {
  sa_cities?: { name_ar: string; sa_regions?: { name_ar: string } | null } | null
}

type DetailTab = 'photos' | 'services' | 'team' | 'rating' | 'about'

const TAB_DEF: { id: DetailTab; label: string }[] = [
  { id: 'photos', label: 'الصور' },
  { id: 'services', label: 'الخدمات' },
  { id: 'team', label: 'الفريق' },
  { id: 'rating', label: 'التقييم' },
  { id: 'about', label: 'نبذة' },
]

const SECTION_SCROLL_MARGIN_CLASS = 'scroll-mt-28'
const EMPTY_SIMILAR_FEATURED = new Set<string>()

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
    state?: { preselect?: string; source?: string; roseySuggestionAr?: string } | null
  }
  const preselectFromNav = loc.state?.preselect?.trim() ?? ''
  const { t } = useI18n()
  const { user } = useAuth()
  const [b, setB] = useState<BizRow | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [team, setTeam] = useState<SalonTeamRow[]>([])
  const [similar, setSimilar] = useState<Business[]>([])
  const [imgI, setImgI] = useState(0)
  const [hoursOpen, setHoursOpen] = useState(false)
  const [fav, setFav] = useState(false)
  const [loading, setLoading] = useState(true)
  const [salonBoost, setSalonBoost] = useState<BoostMeta | null>(null)
  const [featuredAdActive, setFeaturedAdActive] = useState(false)
  const [similarFeaturedIds, setSimilarFeaturedIds] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<DetailTab>('photos')
  const [serviceCat, setServiceCat] = useState<string>('all')
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null)
  const carouselRef = useRef<HTMLDivElement>(null)
  const tabStripRef = useRef<HTMLDivElement>(null)
  const tabBtnRefs = useRef<Partial<Record<DetailTab, HTMLButtonElement | null>>>({})
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
    if (!id) {
      setLoading(false)
      return
    }
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
  }, [id, user, nav])

  useEffect(() => {
    adClickLogged.current = false
  }, [id])

  useEffect(() => {
    if (!id || !featuredAdActive || adClickLogged.current) return
    adClickLogged.current = true
    void supabase.rpc('increment_salon_ad_click', { p_salon_id: id })
  }, [id, featuredAdActive])

  useEffect(() => {
    if (!similar.length) return
    let c = true
    void fetchActiveSalonFeaturedAdSalonIds(similar.map((x) => x.id)).then((s) => {
      if (c) setSimilarFeaturedIds(s)
    })
    return () => {
      c = false
    }
  }, [similar])

  const similarFeaturedDisplay = similar.length === 0 ? EMPTY_SIMILAR_FEATURED : similarFeaturedIds

  useEffect(() => {
    if (!b || !user?.id) return
    const m = preferenceMetaFromBusiness(b, 'salon_page_view')
    trackEvent('user_preference', { user_id: user.id, ...m })
  }, [b, user?.id])

  useEffect(() => {
    if (!b?.id || !user?.id) return
    trackEvent({
      event_type: 'salon_clicks',
      entity_type: 'business',
      entity_id: b.id,
      user_id: user.id,
    })
  }, [b, user?.id])

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

  const roseyRecommendation = useMemo(
    () =>
      resolveSalonRosyRecommendation(services, {
        preselectServiceId: loc.state?.preselect,
        fromRosySource: loc.state?.source === 'rosy',
        customNoteAr: loc.state?.roseySuggestionAr,
      }),
    [services, loc.state?.preselect, loc.state?.source, loc.state?.roseySuggestionAr],
  )

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
      document.getElementById('salon-section-services')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    const scrollT2 = window.setTimeout(() => {
      serviceRowRefs.current[preselectFromNav]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 380)
    const clearH = window.setTimeout(() => setDetailHighlightServiceId(null), 5500)
    return () => {
      window.clearTimeout(scrollT)
      window.clearTimeout(scrollT2)
      window.clearTimeout(clearH)
    }
  }, [id, preselectFromNav, services])

  const goToTab = useCallback((tabId: DetailTab) => {
    setActiveTab(tabId)
    requestAnimationFrame(() => {
      document.getElementById(`salon-section-${tabId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [])

  useEffect(() => {
    tabBtnRefs.current[activeTab]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [activeTab])

  useEffect(() => {
    if (loading || !b) return
    const sectionIds: DetailTab[] = ['photos', 'services', 'team', 'rating', 'about']
    const elements = sectionIds
      .map((sid) => document.getElementById(`salon-section-${sid}`))
      .filter((el): el is HTMLElement => Boolean(el))
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const candidates = entries
          .filter((e) => e.isIntersecting && e.intersectionRatio > 0.1)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const top = candidates[0]
        if (!top?.target?.id) return
        const raw = top.target.id.replace('salon-section-', '')
        if (
          raw === 'photos' ||
          raw === 'services' ||
          raw === 'team' ||
          raw === 'rating' ||
          raw === 'about'
        ) {
          setActiveTab(raw)
        }
      },
      { root: null, rootMargin: '-8% 0px -52% 0px', threshold: [0.1, 0.2, 0.35, 0.5] }
    )
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [b, loading])

  const galleryImgIndex = galleryImgs.length
    ? Math.min(imgI, Math.max(0, galleryImgs.length - 1))
    : 0

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

  const goBooking = (explicitServiceId?: string) => {
    if (!b) return
    if (!user) {
      toast.error('سجّلي دخولكِ للحجز')
      nav('/auth')
      return
    }
    if (services.length === 0) {
      toast.message('لا توجد خدمات للحجز الإلكتروني — نعرض لكِ البحث')
      nav('/search')
      return
    }
    const explicit = explicitServiceId?.trim()
    const resolved =
      explicit && services.some((s) => s.id === explicit)
        ? explicit
        : roseyRecommendation?.service.id ?? pickDefaultServiceIdForBooking(services)
    if (!resolved) {
      toast.message('تعذر تحديد خدمة — جرّبي البحث عن صالون')
      nav('/search')
      return
    }
    nav(`/booking/${b.id}`, { state: { preselect: resolved } })
  }

  if (!id) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 pt-[env(safe-area-inset-top,0px)]">
        <p className="text-center font-semibold text-foreground">رابط الصالون غير صالح</p>
        <p className="text-center text-sm text-foreground">ارجعي للبحث أو اختاري صالوناً من القائمة.</p>
        <Button type="button" className="rounded-2xl" onClick={() => nav('/search')}>
          استكشفي الصالونات
        </Button>
      </div>
    )
  }

  if (loading || !b) {
    return (
      <div className="luxury-bg min-h-dvh p-4">
        <Skeleton className="aspect-video w-full rounded-3xl shadow-floating ring-1 ring-gold/10" />
        <Skeleton className="mt-4 h-8 w-2/3 rounded-3xl" />
      </div>
    )
  }

  const imgs = galleryImgs
  const hours = b.opening_hours as Record<string, { open: string; close: string }> | undefined
  const hoursInfo = salonHoursStatus(hours)
  const rawRating = Number(b.average_rating)
  const summaryRating = Number.isFinite(rawRating) ? rawRating : NaN
  const rawReviewCount = Number(b.total_reviews ?? 0)
  const summaryReviewCount = Number.isFinite(rawReviewCount) ? rawReviewCount : 0
  const roundedStars = Number.isFinite(summaryRating)
    ? Math.min(5, Math.max(0, Math.round(summaryRating)))
    : 0

  const cityLine = b.sa_cities?.name_ar ?? b.city
  const regionLine = b.sa_cities?.sa_regions?.name_ar ?? b.region ?? ''
  const districtLine = b.address_ar?.split('،')[0]?.trim() || b.address_ar || ''

  const distKm =
    userPos && b.latitude != null && b.longitude != null
      ? haversineKm(userPos.lat, userPos.lng, b.latitude, b.longitude)
      : undefined

  return (
    <div className="luxury-bg min-h-dvh pb-36">
      {/* ——— Carousel ——— */}
      <div className="relative w-full overflow-hidden rounded-b-3xl shadow-floating ring-1 ring-gold/20">
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
          <span className="rounded-full border border-white/25 bg-black/50 px-3 py-1 text-xs font-bold text-white shadow-lg ring-1 ring-gold/30 backdrop-blur-md">
            {galleryImgIndex + 1}/{imgs.length}
          </span>
        </div>
        <div className="absolute start-0 top-0 flex w-full items-start justify-between p-3">
          <Link
            to="/"
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-black/45 text-white shadow-lg backdrop-blur-md transition hover:bg-black/55"
          >
            ←
          </Link>
          <div className="pointer-events-auto flex gap-2">
            <button
              type="button"
              aria-label="مفضلة"
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-black/45 text-white shadow-lg backdrop-blur-md transition hover:bg-black/55"
              onClick={toggleFav}
            >
              <Heart className={`h-5 w-5 ${fav ? 'fill-gold text-gold' : ''}`} />
            </button>
            <button
              type="button"
              aria-label="مشاركة"
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/20 bg-black/45 text-white shadow-lg backdrop-blur-md transition hover:bg-black/55"
              onClick={share}
            >
              <Share2 className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="relative z-raised mx-auto max-w-lg px-4 -mt-6 space-y-4">
        <div
          className="luxury-card space-y-4 border-amber-400/25 bg-gradient-to-br from-card via-amber-50/30 p-5 shadow-floating ring-1 ring-gold/15 sm:p-6 dark:from-card dark:via-card dark:to-card dark:border-amber-500/20"
          style={{
            backgroundImage: `linear-gradient(to bottom right, hsl(var(--card)), rgba(254, 243, 199, 0.3), color-mix(in srgb, ${colors.surface} 50%, transparent))`,
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h1 className="text-heading-2 font-semibold text-foreground">{b.name_ar}</h1>
              {b.name_en ? <p className="mt-1 text-sm text-foreground" dir="ltr">{b.name_en}</p> : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {featuredAdActive ? (
                <Badge className="shrink-0 gradient-primary text-[11px] font-extrabold text-white">
                  إعلان
                </Badge>
              ) : null}
              {b.is_featured ? (
                <Badge className="shrink-0 bg-amber-400/95 text-[11px] font-extrabold text-amber-950">صالون مميز</Badge>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
              <Star className="h-4 w-4 fill-amber-400 text-amber-500 drop-shadow-sm" aria-hidden />
              <strong className="font-extrabold tabular-nums">
                {Number.isFinite(summaryRating) ? summaryRating.toFixed(1) : '—'}
              </strong>
              <span className="text-rosera-gray">
                · {summaryReviewCount.toLocaleString('ar-SA')} تقييم
              </span>
            </span>
            {distKm != null ? (
              <Badge variant="secondary" className="font-semibold">
                {distKm.toFixed(1)} {t('common.km')}
              </Badge>
            ) : null}
            <Badge className="bg-gradient-to-br from-primary/15 to-accent/15 text-foreground">
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
              <span className="text-xs text-foreground">{hoursInfo.nextLine}</span>
            ) : null}
            <Badge variant="outline" className="font-bold">
              {services.length} خدمة متاحة
            </Badge>
          </div>

          <button
            type="button"
            onClick={() => setHoursOpen(!hoursOpen)}
            className="flex w-full items-center justify-between rounded-3xl border border-gold/15 bg-gradient-to-r from-muted/60 to-muted/35 p-3 text-sm font-semibold shadow-sm ring-1 ring-gold/10 transition hover:border-gold/25"
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
                className="flex flex-1 items-center justify-center gap-2 rounded-3xl border-2 border-primary/35 bg-gradient-to-br from-card to-primary/[0.04] py-3 text-sm font-semibold text-primary shadow-floating ring-1 ring-gold/15 transition hover:border-primary/50"
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
                className="flex flex-1 items-center justify-center gap-2 rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-600 to-emerald-700 py-3 text-sm font-semibold text-white shadow-floating ring-1 ring-emerald-400/30 transition hover:brightness-105"
              >
                <MessageCircle className="h-4 w-4" />
                واتساب
              </a>
            )}
          </div>
        </div>

        {roseyRecommendation ? (
          <div className="pt-4">
            <SalonRosyRecommendationCard
              serviceName={roseyRecommendation.service.name_ar}
              explanation={roseyRecommendation.explanationAr}
              onBook={() => {
                captureProductEvent('rosy_to_booking', {
                  salon_id: b.id,
                  cta: 'book_now',
                  service_id: roseyRecommendation.service.id,
                })
                captureProductEvent('rosy_to_booking_click', { salon_id: b.id })
                trackEvent('rosy_booking_click', {
                  salonId: b.id,
                  source: 'salon_detail_rosey_card',
                  cta: 'book_now',
                  serviceId: roseyRecommendation.service.id,
                })
                goBooking(roseyRecommendation.service.id)
              }}
            />
          </div>
        ) : null}

        {/* ——— Sticky tabs + scroll-to-section ——— */}
        <div className="sticky top-0 z-sticky-header -mx-2 px-2 py-2 supports-[backdrop-filter]:backdrop-blur-sm">
          <div className="rounded-3xl border border-amber-400/25 bg-gradient-to-b from-background/95 via-card/90 to-background/95 p-1.5 shadow-floating ring-1 ring-gold/15 backdrop-blur-md dark:border-amber-500/20 dark:from-card/95 dark:via-card/90">
            <div ref={tabStripRef} className="-mx-0.5 overflow-x-auto pb-0.5 scrollbar-hide">
              <div className="flex min-w-0 gap-2 px-1">
                {TAB_DEF.map((tab) => (
                  <button
                    key={tab.id}
                    ref={(el) => {
                      tabBtnRefs.current[tab.id] = el
                    }}
                    type="button"
                    onClick={() => goToTab(tab.id)}
                    className={cn(
                      'tab-chip shrink-0 !rounded-2xl border-amber-400/25 shadow-sm',
                      activeTab === tab.id && 'tab-chip--selected shadow-floating ring-1 ring-gold/35',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ——— Sections (scroll targets) ——— */}
        <section
          id="salon-section-photos"
          className={cn('space-y-3 pt-2', SECTION_SCROLL_MARGIN_CLASS)}
          aria-labelledby="salon-section-photos-heading"
        >
          <p id="salon-section-photos-heading" className="text-sm font-semibold tracking-wide text-foreground/80">
            معرض الصور
          </p>
          <div dir="ltr" className="flex snap-x gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {imgs.map((src, i) => (
              <button
                key={i}
                type="button"
                className={`relative shrink-0 snap-start overflow-hidden rounded-3xl border-2 shadow-sm ring-1 ring-gold/10 transition ${i === galleryImgIndex ? 'border-primary shadow-floating ring-primary/25' : 'border-transparent hover:border-gold/20'}`}
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

        <section
          id="salon-section-services"
          className={cn('space-y-4 pt-6', SECTION_SCROLL_MARGIN_CLASS)}
          aria-labelledby="salon-section-services-heading"
        >
          <h2 id="salon-section-services-heading" className="text-lg font-bold text-foreground">
            الخدمات
          </h2>
            <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 scrollbar-hide px-1">
              <button
                type="button"
                onClick={() => setServiceCat('all')}
                className={cn('category-chip !rounded-2xl border-amber-400/20', serviceCat === 'all' && 'category-chip--selected')}
              >
                الكل
              </button>
              {serviceCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setServiceCat(cat)}
                  className={cn('category-chip !rounded-2xl border-amber-400/20', serviceCat === cat && 'category-chip--selected')}
                >
                  {labelForServiceCategory(cat)}
                </button>
              ))}
            </div>
            {filteredServices.length === 0 ? (
              <p className="rounded-3xl border border-dashed border-amber-400/25 bg-gradient-to-br from-card/80 to-muted/30 p-6 text-center text-sm text-foreground shadow-inner ring-1 ring-gold/10">
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
                      'flex items-center justify-between gap-3 rounded-3xl border border-amber-400/15 bg-gradient-to-br from-card to-amber-50/20 p-4 shadow-floating ring-1 ring-gold/10 dark:from-card dark:to-card dark:border-amber-500/15',
                      detailHighlightServiceId === s.id &&
                        'ring-2 ring-primary/65 ring-offset-2 ring-offset-background'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold">{s.name_ar}</p>
                      {s.name_en ? (
                        <p className="text-sm text-foreground" dir="ltr">
                          {s.name_en}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm text-rosera-gray">
                        {formatPrice(Number(s.price))} ر.س · {s.duration_minutes} دقيقة
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0 rounded-2xl border border-primary/20 bg-gradient-to-l from-primary to-gold font-bold shadow-md ring-1 ring-gold/20"
                      onClick={() => goBooking(s.id)}
                    >
                      احجز
                    </Button>
                  </div>
                ))}
              </div>
            )}
        </section>

        <section
          id="salon-section-team"
          className={cn('space-y-3 pt-6', SECTION_SCROLL_MARGIN_CLASS)}
          aria-labelledby="salon-section-team-heading"
        >
          <h2 id="salon-section-team-heading" className="text-lg font-bold text-foreground">
            الفريق
          </h2>
          {team.length === 0 ? (
            <p className="rounded-3xl border border-dashed border-amber-400/25 bg-gradient-to-br from-card/80 to-muted/30 p-6 text-center text-sm text-foreground ring-1 ring-gold/10">
              لم يتم إضافة أعضاء الفريق بعد.
            </p>
          ) : (
            <div className="-mx-1 flex gap-3 overflow-x-auto pb-2 px-1 scrollbar-hide">
              {team.map((m) => (
                <div
                  key={m.id}
                  className="w-[140px] shrink-0 rounded-3xl border border-amber-400/15 bg-gradient-to-b from-card to-amber-50/15 p-3 text-center shadow-floating ring-1 ring-gold/10 dark:from-card dark:to-card dark:border-amber-500/15"
                >
                  <div className="mx-auto h-16 w-16 overflow-hidden rounded-full bg-muted">
                    {m.image_url ? (
                      <img src={m.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-bold text-primary">
                        {m.name_ar?.[0] ?? '؟'}
                      </div>
                    )}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-bold">{m.name_ar ?? ''}</p>
                  {m.role_ar ? <p className="mt-0.5 line-clamp-2 text-xs text-foreground">{m.role_ar}</p> : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          id="salon-section-rating"
          dir="rtl"
          className={cn('pt-6', SECTION_SCROLL_MARGIN_CLASS)}
          aria-labelledby="salon-section-rating-heading"
        >
          <div
            className="luxury-card relative overflow-hidden rounded-3xl border border-amber-400/30 bg-gradient-to-br from-amber-50/90 via-card p-6 shadow-floating ring-1 ring-gold/20 dark:from-amber-950/40 dark:via-card dark:to-card dark:border-amber-500/25"
            style={{
              backgroundImage: `linear-gradient(to bottom right, rgba(255, 251, 235, 0.9), hsl(var(--card)), ${colors.surface})`,
            }}
          >
            <div className="pointer-events-none absolute -start-6 -top-10 h-36 w-36 rounded-full bg-amber-300/30 blur-3xl dark:bg-amber-500/15" aria-hidden />
            <div className="pointer-events-none absolute -end-10 bottom-0 h-28 w-28 rounded-full bg-amber-200/20 blur-2xl dark:bg-amber-600/10" aria-hidden />
            <div className="relative space-y-5 text-center">
              <div>
                <h2 id="salon-section-rating-heading" className="text-xs font-bold uppercase tracking-[0.2em] text-amber-800/80 dark:text-amber-300/90">
                  التقييم
                </h2>
                <p className="mt-1 text-[11px] text-foreground">ملخص من بيانات الصالون — بلا قائمة مراجعات نصية</p>
              </div>
              <div className="flex items-center justify-center gap-1.5 sm:gap-2" aria-hidden>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={cn(
                      'h-10 w-10 sm:h-12 sm:w-12',
                      i <= roundedStars
                        ? 'fill-amber-400 text-amber-500 drop-shadow-[0_2px_8px_rgba(234,179,8,0.45)]'
                        : 'fill-muted/20 text-foreground/30'
                    )}
                  />
                ))}
              </div>
              <p className="text-5xl font-black tabular-nums tracking-tight text-foreground sm:text-6xl">
                {Number.isFinite(summaryRating) ? summaryRating.toFixed(1) : '—'}
              </p>
              <p className="text-base font-semibold text-foreground">
                {summaryReviewCount.toLocaleString('ar-SA')}{' '}
                <span className="font-bold text-amber-800 dark:text-amber-300">تقييم</span>
              </p>
              <p className="mx-auto max-w-sm text-sm leading-relaxed text-foreground">
                {summaryReviewCount === 0
                  ? 'لا يوجد بعد عدد كافٍ من التقييمات المسجّلة لعرض متوسط موثوق.'
                  : 'يُعرض متوسط التقييم وعدد التقييمات الإجمالي فقط — لا تتوفر مراجعات نصية فردية في التطبيق.'}
              </p>
            </div>
          </div>
        </section>

        <section
          id="salon-section-about"
          className={cn('space-y-3 pt-6', SECTION_SCROLL_MARGIN_CLASS)}
          aria-labelledby="salon-section-about-heading"
        >
          <h2 id="salon-section-about-heading" className="text-lg font-bold text-foreground">
            نبذة
          </h2>
          {b.description_ar ? (
            <div className="rounded-3xl border border-amber-400/15 bg-gradient-to-br from-card via-card to-amber-50/20 p-5 shadow-floating ring-1 ring-gold/10 dark:to-card dark:border-amber-500/15">
              <p className="leading-relaxed text-rosera-gray">{b.description_ar}</p>
            </div>
          ) : (
            <p className="rounded-3xl border border-dashed border-amber-400/25 bg-gradient-to-br from-card/80 to-muted/30 p-6 text-center text-sm text-foreground ring-1 ring-gold/10">
              لا توجد نبذة بعد.
            </p>
          )}
        </section>

        {b.latitude != null && b.longitude != null && (
          <section className="mt-8">
            <h2 className="text-lg font-bold">الموقع على الخريطة</h2>
            <div className="mt-3 h-52 overflow-hidden rounded-3xl border border-amber-400/30 shadow-floating ring-1 ring-gold/15">
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
                    <p className="text-center text-sm text-foreground">معاينة الخريطة عبر Google</p>
                    <Button asChild className="rounded-3xl shadow-floating ring-1 ring-gold/20">
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
            <div className="motion-stagger mt-4 flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {similar.map((x) => (
                <div key={x.id} className="w-[180px] shrink-0">
                  <BusinessCard b={x} isFeaturedAd={similarFeaturedDisplay.has(x.id)} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <div
        className="fixed start-0 end-0 z-composer border-t border-amber-400/20 bg-gradient-to-t from-white/98 via-white/95 to-white/90 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.08)] backdrop-blur-md supports-[backdrop-filter]:bg-white/90 dark:border-amber-500/20 dark:from-card/98 dark:via-card/95 dark:to-card/90"
        style={{ bottom: 'calc(4.5rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <Button
            className="min-h-12 flex-1 gap-2 rounded-3xl border border-primary/25 bg-gradient-to-l from-primary via-primary to-amber-600 text-base font-bold text-white shadow-floating ring-1 ring-gold/30 disabled:"
            disabled={services.length === 0}
            onClick={() => goBooking()}
          >
            احجز موعد الآن
          </Button>
          <span className="shrink-0 text-center text-xs font-bold text-foreground sm:text-sm">
            {services.length} خدمة متاحة
          </span>
        </div>
        {services.length === 0 && !loading ? (
          <p className="mx-auto mt-2 max-w-lg px-4 text-center text-xs text-foreground">
            الخدمات غير مفعّلة للحجز الإلكتروني بعد — جرّبي «اتصال» أو «واتساب» أعلاه
          </p>
        ) : null}
      </div>
    </div>
  )
}
