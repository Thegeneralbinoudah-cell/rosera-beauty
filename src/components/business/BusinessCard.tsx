import { useEffect, useState } from 'react'
import { Star, MapPin, Heart, Navigation } from 'lucide-react'
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
        'cursor-pointer overflow-hidden ring-1 ring-gold/10 transition-shadow duration-200 hover:shadow-floating focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2',
        isFeaturedAd && 'ring-2 ring-fuchsia-500/55 ring-offset-2 ring-offset-background',
        className
      )}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <LazyImage src={img} alt="" className="h-full w-full object-cover" />
        <Badge className="absolute top-2 start-2 max-w-[85%] truncate text-[10px] font-semibold shadow-md">
          {label}
        </Badge>
        {isFeaturedAd && (
          <span className="absolute top-10 start-2 z-[5] rounded-full bg-gradient-to-l from-fuchsia-600 to-pink-500 px-2 py-0.5 text-[9px] font-extrabold text-white shadow-md">
            إعلان ⭐
          </span>
        )}
        {b.is_featured && (
          <span className="absolute bottom-2 start-2 rounded-full bg-amber-400/95 px-2 py-0.5 text-[9px] font-extrabold text-amber-950 shadow-md">
            ⭐ صالون مميز
          </span>
        )}
        {isSponsored && (
          <span
            className={`absolute ${b.is_featured ? 'bottom-9' : 'bottom-2'} start-2 rounded-full px-2 py-0.5 text-[9px] font-extrabold shadow-md ${
              sponsorLabel === 'featured'
                ? 'bg-amber-400/95 text-amber-950'
                : 'bg-white/90 text-[#9B2257] dark:bg-black/70 dark:text-primary'
            }`}
          >
            {sponsorLabel === 'featured' ? 'Featured' : 'مُموَّل'}
          </span>
        )}
        {showFavorite && (
          <button
            type="button"
            aria-label="مفضلة"
            className="absolute top-2 end-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur-sm transition hover:scale-105 dark:bg-black/50"
            onClick={toggleFav}
          >
            <Heart
              className={cn('h-5 w-5', fav ? 'fill-[#E91E8C] text-[#E91E8C]' : 'text-rosera-gray')}
            />
          </button>
        )}
      </div>
      <div className="p-4">
        <h3
          dir="auto"
          className="line-clamp-2 text-start text-base font-semibold leading-snug text-foreground"
        >
          {b.name_ar}
        </h3>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-medium text-[#374151] dark:text-rosera-gray">
          <span
            dir="ltr"
            className="flex items-center gap-0.5 tabular-nums text-[#9B2257]"
            style={{ unicodeBidi: 'isolate' }}
          >
            <Star className="h-4 w-4 shrink-0 fill-[#9B2257] text-[#9B2257]" aria-hidden />
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
            <span className="min-w-0 whitespace-normal text-[15px] font-medium leading-snug text-gray-700 dark:text-gray-300">
              {locationLine || b.city}
            </span>
          </span>
          {distanceKm != null && <span>{distanceKm.toFixed(1)} كم</span>}
        </div>
        <div className="mt-3 grid gap-2.5" onClick={(e) => e.stopPropagation()}>
          <Button
            type="button"
            size="sm"
            className="w-full gap-1.5 text-xs font-extrabold"
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
              variant="outline"
              className="w-full gap-1.5 rounded-xl text-xs font-semibold"
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
      className="flex w-full gap-3 rounded-2xl border border-border/60 bg-card p-4 text-start shadow-elevated transition-shadow hover:shadow-floating dark:bg-card"
    >
      <LazyImage src={img} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
      <div className="min-w-0 flex-1">
        <h3 dir="auto" className="line-clamp-2 text-start font-semibold text-[#1F1F1F] dark:text-foreground">
          {b.name_ar}
        </h3>
        <p className="whitespace-normal text-[15px] font-medium leading-snug text-gray-700 dark:text-gray-300">
          {locationLine || b.city}
        </p>
        <div
          dir="ltr"
          style={{ unicodeBidi: 'isolate' }}
          className="mt-1 flex items-center gap-1 text-sm font-medium tabular-nums text-[#9B2257]"
        >
          <Star className="h-4 w-4 shrink-0 fill-[#9B2257] text-[#9B2257]" aria-hidden />
          {new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          }).format(Number(b.average_rating ?? 0))}
        </div>
      </div>
    </button>
  )
}
