import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { MapPin, Heart, Navigation } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { Business } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { resolveBusinessCoverImage } from '@/lib/businessImages'
import { openNativeMapsDirections } from '@/lib/openNativeMapsDirections'
import { useI18n } from '@/hooks/useI18n'
import { usePreferences } from '@/contexts/PreferencesContext'
import { Button } from '@/components/ui/button'
import { LazyImage } from '@/components/ui/lazy-image'
import { formatDistrictCityLine } from '@/lib/locationFormat'
import { LuxuryStarRating } from '@/components/ui/LuxuryStarRating'
import { useMediaQuery } from '@/hooks/useMediaQuery'

/** Desktop: cover image translateY at ~0.5× scroll-derived offset (rAF-batched). */
function SalonCoverParallax({ src, children }: { src: string; children?: ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const isLg = useMediaQuery('(min-width: 1024px)')
  const [y, setY] = useState(0)

  useEffect(() => {
    if (!isLg) return
    let raf = 0
    const tick = () => {
      const el = wrapRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight
      if (rect.bottom < 0 || rect.top > vh) {
        setY(0)
        return
      }
      const center = rect.top + rect.height / 2
      const offset = (center - vh / 2) * 0.08 * 0.5
      setY(-offset)
    }
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(tick)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    tick()
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [isLg])

  return (
    <div ref={wrapRef} className="relative min-h-[12rem] w-full flex-[3] basis-0 overflow-hidden">
      <div
        className="h-full min-h-[12rem] w-full transition-transform duration-300 ease-spring-soft group-hover/card:scale-105 motion-reduce:transition-none motion-reduce:group-hover/card:scale-100"
        style={isLg ? { transform: `translate3d(0, ${y}px, 0)`, willChange: 'transform' } : undefined}
      >
        <LazyImage src={src} alt="" className="h-full min-h-[12rem] w-full object-cover" />
      </div>
      {children}
    </div>
  )
}

export function BusinessCard({
  b,
  className,
  distanceKm,
  showFavorite,
  isSponsored,
  sponsorLabel,
  isFeaturedAd,
}: {
  b: Business
  className?: string
  distanceKm?: number
  showFavorite?: boolean
  /** Active paid boost (salon-wide). */
  isSponsored?: boolean
  sponsorLabel?: 'featured' | 'priority'
  /** Paid featured ad campaign (salon_ads). */
  isFeaturedAd?: boolean
}) {
  const { t } = useI18n()
  const { lang } = usePreferences()
  const { user } = useAuth()
  const nav = useNavigate()
  const img = resolveBusinessCoverImage(b)
  const label = b.category_label || b.category
  const locationLine = formatDistrictCityLine(b.address_ar, b.city)
  const [fav, setFav] = useState(false)

  useEffect(() => {
    if (!user || !showFavorite) return
    let cancelled = false
    void supabase
      .from('favorites')
      .select('id')
      .eq('business_id', b.id)
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setFav(!!data)
      })
    return () => {
      cancelled = true
    }
  }, [user, b.id, showFavorite])

  const toggleFav = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!user) {
      toast.error('سجّلي دخولكِ لإضافة المفضلة')
      nav('/auth')
      return
    }
    try {
      if (fav) {
        await supabase.from('favorites').delete().eq('business_id', b.id).eq('user_id', user.id)
        setFav(false)
        toast.success('أُزيلت من المفضلة')
      } else {
        await supabase.from('favorites').insert({ business_id: b.id, user_id: user.id })
        setFav(true)
        toast.success('أُضيفت للمفضلة')
      }
    } catch {
      toast.error('حدث خطأ')
    }
  }

  return (
    <Card
      role="link"
      tabIndex={0}
      onClick={() => nav(`/salon/${b.id}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          nav(`/salon/${b.id}`)
        }
      }}
      className={cn(
        'flex min-h-[280px] cursor-pointer flex-col overflow-hidden p-0 ring-1 ring-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        isFeaturedAd && 'ring-2 ring-accent/45 ring-offset-2 ring-offset-background',
        className
      )}
    >
      <SalonCoverParallax src={img}>
        <Badge className="absolute top-2 start-2 z-[2] max-w-[85%] truncate text-[10px] font-normal shadow-md">
          {label}
        </Badge>
        {isFeaturedAd && (
          <span className="absolute top-10 start-2 z-[5] rounded-full gradient-primary px-2 py-0.5 text-[9px] font-normal text-primary-foreground shadow-md">
            إعلان
          </span>
        )}
        {b.is_featured && (
          <span className="absolute bottom-2 start-2 z-[2] rounded-full border border-accent/35 bg-card/95 px-2 py-0.5 text-[9px] font-normal text-primary shadow-sm">
            صالون مميز
          </span>
        )}
        {isSponsored && (
          <span
            className={`absolute z-[2] ${b.is_featured ? 'bottom-9' : 'bottom-2'} start-2 rounded-full border border-primary/25 px-2 py-0.5 text-[9px] font-normal shadow-sm ${
              sponsorLabel === 'featured'
                ? 'bg-muted text-primary'
                : 'bg-card/95 text-primary'
            }`}
          >
            {sponsorLabel === 'featured' ? 'Featured' : 'مُموَّل'}
          </span>
        )}
        {showFavorite && (
          <button
            type="button"
            aria-label="مفضلة"
            className="absolute top-2 end-2 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-primary/20 bg-card/95 shadow-md backdrop-blur-sm transition hover:scale-105"
            onClick={toggleFav}
          >
            <Heart
              className={cn('h-5 w-5', fav ? 'fill-accent text-primary' : 'text-foreground')}
            />
          </button>
        )}
      </SalonCoverParallax>
      <div className="flex flex-[2] basis-0 flex-col justify-between p-4">
        <div>
          <h3 dir="auto" className="line-clamp-2 text-start font-serif text-lg font-normal leading-snug text-foreground">
            {b.name_ar}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-light text-foreground">
            <span
              dir="ltr"
              className="flex items-center gap-1.5 tabular-nums text-primary"
              style={{ unicodeBidi: 'isolate' }}
            >
              <LuxuryStarRating rating={Number(b.average_rating ?? 0)} />
              {new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              }).format(Number(b.average_rating ?? 0))}
            </span>
            <span dir="ltr" className="tabular-nums">
              ({b.total_reviews ?? 0})
            </span>
            <span className="flex min-w-0 items-start gap-1">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="min-w-0 whitespace-normal text-[15px] font-light leading-snug text-foreground">
                {locationLine || b.city}
              </span>
            </span>
            {distanceKm != null && <span>{distanceKm.toFixed(1)} كم</span>}
          </div>
        </div>
        <div className="mt-3 grid gap-2.5" onClick={(e) => e.stopPropagation()}>
          <Button
            type="button"
            size="sm"
            className="w-full gap-1.5 text-xs font-normal"
            onClick={(e) => {
              e.stopPropagation()
              e.preventDefault()
              nav(`/booking/${b.id}`)
            }}
          >
            {lang === 'ar' ? 'احجزي الآن' : 'Book now'}
          </Button>
          {b.latitude != null && b.longitude != null && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full gap-1.5 rounded-full text-xs font-normal"
              onClick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                openNativeMapsDirections(b.latitude, b.longitude, b.name_ar ?? undefined)
              }}
            >
              <Navigation className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t('map.directions')}
            </Button>
          )}
        </div>
      </div>
    </Card>
  )
}

export function BusinessRow({ b }: { b: Business }) {
  const nav = useNavigate()
  const { lang } = usePreferences()
  const img = resolveBusinessCoverImage(b)
  const locationLine = formatDistrictCityLine(b.address_ar, b.city)
  return (
    <button
      type="button"
      onClick={() => nav(`/salon/${b.id}`)}
      className="flex w-full gap-3 rounded-[20px] border border-primary/15 bg-card p-4 text-start shadow-[0_8px_32px_rgba(139,26,74,0.15)] transition-shadow hover:shadow-[0_12px_40px_rgba(139,26,74,0.22)]"
    >
      <LazyImage src={img} alt="" className="h-20 w-20 shrink-0 rounded-[14px] object-cover" />
      <div className="min-w-0 flex-1">
        <h3 dir="auto" className="line-clamp-2 text-start font-serif font-normal text-foreground">
          {b.name_ar}
        </h3>
        <p className="whitespace-normal text-[15px] font-light leading-snug text-foreground">
          {locationLine || b.city}
        </p>
        <div
          dir="ltr"
          style={{ unicodeBidi: 'isolate' }}
          className="mt-1 flex items-center gap-1.5 text-sm font-light tabular-nums text-primary"
        >
          <LuxuryStarRating rating={Number(b.average_rating ?? 0)} />
          {new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }).format(Number(b.average_rating ?? 0))}
        </div>
      </div>
    </button>
  )
}
