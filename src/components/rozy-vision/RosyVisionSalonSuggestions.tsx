import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, Map, CalendarClock, Sparkles } from 'lucide-react'
import type { RozyVisionMode } from '@/lib/rozyVisionTypes'
import {
  fetchRosyVisionSalonRecommendations,
  pickRozyVisionBookTarget,
  rosyVisionMapSearchQuery,
} from '@/lib/rosyVisionRecommendations'
import { buildMapExploreUrl } from '@/lib/mapExploreUrl'
import { BusinessCard } from '@/components/business/BusinessCard'
import { Button } from '@/components/ui/button'
import { ResultCard } from '@/components/rozy-vision/ResultCard'
import { trackEvent } from '@/lib/analytics'
import { cn } from '@/lib/utils'
import { markGeolocationKnown } from '@/lib/geoSession'

type BookTarget = { salonId: string; serviceId: string }

type Props = {
  mode: RozyVisionMode
  /** Load salons when analysis succeeded */
  enabled: boolean
  userPos: { lat: number; lng: number } | null
  /** Saved style tokens — boosts matching venues */
  boostKeywords?: string[]
  /** First bookable salon+service for CTAs (null = none or loading cleared) */
  onBookTargetChange?: (target: BookTarget | null) => void
}

export function RosyVisionSalonSuggestions({
  mode,
  enabled,
  userPos,
  boostKeywords = [],
  onBookTargetChange,
}: Props) {
  const nav = useNavigate()
  const [loading, setLoading] = useState(false)
  const [biz, setBiz] = useState<Awaited<ReturnType<typeof fetchRosyVisionSalonRecommendations>>['businesses']>(
    [],
  )
  const [services, setServices] = useState<
    Awaited<ReturnType<typeof fetchRosyVisionSalonRecommendations>>['sampleServices']
  >([])

  useEffect(() => {
    if (!enabled) return
    let c = true
    queueMicrotask(() => setLoading(true))
    void fetchRosyVisionSalonRecommendations({ mode, userPos, boostKeywords })
      .then((pack) => {
        if (!c) return
        setBiz(pack.businesses)
        setServices(pack.sampleServices)
      })
      .catch(() => {
        if (!c) return
        setBiz([])
        setServices([])
      })
      .finally(() => {
        if (c) setLoading(false)
      })
    return () => {
      c = false
    }
  }, [enabled, mode, userPos, boostKeywords])

  const bookTarget = useMemo(
    () => (biz.length && services.length ? pickRozyVisionBookTarget(biz, services) : null),
    [biz, services],
  )

  useEffect(() => {
    if (!enabled) {
      onBookTargetChange?.(null)
      return
    }
    if (loading) {
      onBookTargetChange?.(null)
      return
    }
    onBookTargetChange?.(bookTarget)
  }, [enabled, loading, bookTarget, onBookTargetChange])

  const mapHref = buildMapExploreUrl({
    sortNearest: true,
    searchQuery: rosyVisionMapSearchQuery(mode),
    categoryLabel: 'صالون نسائي',
  })

  const searchHref = `/search?sort=nearest&q=${encodeURIComponent(rosyVisionMapSearchQuery(mode))}&categoryLabel=${encodeURIComponent('صالون نسائي')}`

  const primaryCtaLabel = mode === 'hand' ? 'احجزي هذا اللوك' : 'احجزي استشارة الشعر'

  const goDirectBooking = () => {
    if (!bookTarget) {
      if (biz.length === 0) {
        nav(searchHref)
        return
      }
      return
    }
    trackEvent('rosy_booking_click', {
      salonId: bookTarget.salonId,
      serviceId: bookTarget.serviceId,
      source: 'rosy_vision',
      quick: true,
      cta: mode === 'hand' ? 'book_look' : 'hair_consult',
    })
    nav(`/booking/${bookTarget.salonId}?source=rosy`, { state: { preselect: bookTarget.serviceId } })
  }

  const title =
    mode === 'hand' ? 'صالونات أظافر ومناكير قريبة' : 'صالونات شعر وصبغة قريبة'
  const servicesTitle = mode === 'hand' ? 'خدمات أظافر للحجز' : 'خدمات لون وقصّة'
  const noDirectBookCopy =
    mode === 'hand'
      ? 'لم نجد خدمات أظافر/مناكير قابلة للحجز في نتائج «الأقرب» بعد — اختاري صالوناً من القائمة أو البحث.'
      : 'لم نجد خدمات صبغ أو قصّ قابلة للحجز في نتائج «الأقرب» بعد — اختاري صالوناً من القائمة أو البحث.'

  if (!enabled) return null

  return (
    <ResultCard
      variant="luxury"
      className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500"
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-gold" aria-hidden />
          {title}
        </span>
      }
    >
      {biz.length > 0 && !loading && !bookTarget ? (
        <p className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-3 text-center text-body-sm leading-relaxed text-foreground">
          {noDirectBookCopy}
        </p>
      ) : null}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          className={cn(
            'min-h-[48px] flex-1 rounded-xl font-bold shadow-lg',
            'bg-gradient-to-l from-destructive via-primary to-accent text-white',
          )}
          disabled={loading || (biz.length > 0 && !bookTarget)}
          onClick={goDirectBooking}
          title={!bookTarget && biz.length > 0 ? noDirectBookCopy : undefined}
        >
          <CalendarClock className="h-5 w-5 shrink-0" aria-hidden />
          {primaryCtaLabel}
        </Button>
        <Button type="button" variant="outline" className="min-h-[48px] flex-1 rounded-xl border-2 border-gold/45 font-bold" asChild>
          <Link to={mapHref}>
            <Map className="h-5 w-5 shrink-0 text-gold" aria-hidden />
            الخريطة
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-body-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
          جاري البحث عن صالونات…
        </div>
      ) : biz.length === 0 ? (
        <p className="rounded-xl border border-dashed border-primary/25 bg-primary/5 px-3 py-4 text-center text-body-sm text-muted-foreground">
          لم نعثر على صالونات مطابقة حالياً — جرّبي البحث أو الخريطة.
        </p>
      ) : (
        <div className="space-y-4">
          <div className="-mx-1 flex gap-3 overflow-x-auto overflow-y-hidden pb-2 pt-1 scrollbar-hide">
            {biz.map((b) => (
              <div key={b.id} className="w-[min(100%,280px)] shrink-0">
                <BusinessCard b={b} distanceKm={b.distanceKm} showFavorite className="h-full shadow-md" />
              </div>
            ))}
          </div>

          {services.length > 0 ? (
            <div>
              <h4 className="mb-2 text-title-sm font-bold text-primary">{servicesTitle}</h4>
              <ul className="flex flex-wrap gap-2">
                {services.slice(0, 8).map((s) => (
                  <li
                    key={s.id}
                    className="rounded-full border border-gold/30 bg-gold-subtle/50 px-3 py-1.5 text-caption font-medium text-foreground"
                  >
                    {s.name_ar}
                    <span className="text-muted-foreground"> · {s.price} ر.س</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Button variant="secondary" className="w-full rounded-xl font-semibold" asChild>
            <Link to={searchHref}>عرض كل النتائج في البحث</Link>
          </Button>
        </div>
      )}
    </ResultCard>
  )
}

/** Request geo for «nearest» salons on Rosy Vision. */
export function useRosyVisionUserPosition(): { lat: number; lng: number } | null {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null)
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (p) => {
        markGeolocationKnown()
        setPos({ lat: p.coords.latitude, lng: p.coords.longitude })
      },
      () => {},
      { enableHighAccuracy: false, maximumAge: 120_000, timeout: 12_000 },
    )
  }, [])
  return pos
}
