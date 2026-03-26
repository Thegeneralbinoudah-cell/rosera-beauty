import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { resolveBusinessCoverImage, DEFAULT_BUSINESS_COVER_IMAGE } from '@/lib/businessImages'
import { usePreferences } from '@/contexts/PreferencesContext'
import { useAuth } from '@/contexts/AuthContext'
import { trackEvent } from '@/lib/analytics'
import { inferPreferenceServiceKey } from '@/lib/roseyUserPreference'
import { cn } from '@/lib/utils'
import type { SalonActiveOffer } from '@/lib/offers'
import { formatDistrictCityLine } from '@/lib/locationFormat'

export type SalonPremiumCardData = {
  id: string
  name_ar: string
  cover_image?: string | null
  google_photo_resource?: string | null
  images?: string[] | null
  image_url?: string | null
  average_rating?: number | null
  total_reviews?: number | null
  city?: string | null
  address_ar?: string | null
  category?: string | null
  category_label?: string | null
  price_range?: string | null
}

function ratingBadgeTier(rating: number): 'top' | 'recommended' | null {
  if (rating >= 4.5) return 'top'
  if (rating >= 4.2) return 'recommended'
  return null
}

type Props = {
  salon: SalonPremiumCardData
  activeOffer?: SalonActiveOffer | null
  reviewsLabel: string
  badgeTop: string
  badgeRec: string
  bookLabel: string
  showCity?: boolean
  scoreCaption?: string
  isRecommended?: boolean
}

export function SalonPremiumCard({
  salon,
  activeOffer = null,
  reviewsLabel,
  badgeTop,
  badgeRec,
  bookLabel,
  showCity = true,
  scoreCaption,
  isRecommended = false,
}: Props) {
  const nav = useNavigate()
  const { lang } = usePreferences()
  const { user } = useAuth()
  const [imgBroken, setImgBroken] = useState(false)
  const rating =
    typeof salon.average_rating === 'number' && Number.isFinite(salon.average_rating)
      ? salon.average_rating
      : 0
  const reviews =
    typeof salon.total_reviews === 'number' && Number.isFinite(salon.total_reviews)
      ? salon.total_reviews
      : 0
  const badge = ratingBadgeTier(rating)
  const cover = resolveBusinessCoverImage(salon)
  const src = imgBroken ? DEFAULT_BUSINESS_COVER_IMAGE : cover
  const recLabel = lang === 'ar' ? '✨ موصى لك' : '✨ For you'
  const trustLine =
    lang === 'ar'
      ? 'تم اختيار هذا لك بناءً على تفضيلاتك'
      : 'Chosen for you based on your preferences'
  const bookCtaRecommended =
    lang === 'ar' ? 'احجزي الآن ✨ الأفضل لك' : 'Book now ✨ Best for you'
  const salonIdOk = typeof salon.id === 'string' && salon.id.trim().length > 0
  const offerPct =
    activeOffer &&
    typeof activeOffer.discount_percentage === 'number' &&
    Number.isFinite(activeOffer.discount_percentage)
      ? Math.min(100, Math.max(0, Math.round(activeOffer.discount_percentage)))
      : null
  const locationLine = formatDistrictCityLine(salon.address_ar, salon.city)

  const pushPreference = (source: 'salon_card_open' | 'salon_card_book') => {
    if (!user?.id) return
    const svc = inferPreferenceServiceKey({
      category: salon.category ?? '',
      category_label: salon.category_label ?? null,
      name_ar: salon.name_ar,
      name_en: undefined,
      description_ar: undefined,
    })
    trackEvent('user_preference', {
      user_id: user.id,
      source,
      service: svc,
      salon_id: salon.id.trim(),
      price_range: salon.price_range ?? null,
      location: salon.city ?? null,
    })
  }

  const goSalon = () => {
    if (!salonIdOk) return
    const id = salon.id.trim()
    trackEvent({
      event_type: 'view_salon',
      entity_type: 'business',
      entity_id: id,
      user_id: user?.id,
    })
    pushPreference('salon_card_open')
    if (isRecommended) {
      trackEvent({
        event_type: 'ai_recommended_view',
        entity_type: 'business',
        entity_id: id,
        user_id: user?.id,
      })
    }
    nav(`/salon/${id}`)
  }

  const goBook = () => {
    if (!salonIdOk) return
    const id = salon.id.trim()
    trackEvent({
      event_type: 'booking_click',
      entity_type: 'business',
      entity_id: id,
      user_id: user?.id,
    })
    pushPreference('salon_card_book')
    nav(`/booking/${id}`, {
      state: {
        salonName: salon.name_ar,
        rating: salon.average_rating ?? null,
      },
    })
  }

  return (
    <Card
      className={cn(
        'group flex h-full flex-col overflow-hidden rounded-3xl border border-primary/12',
        'origin-center bg-white/95 shadow-floating ring-1 ring-gold/10',
        'animate-in fade-in slide-in-from-bottom-2 fill-mode-both duration-500',
        'transition-[transform,box-shadow] duration-300 ease-out will-change-transform',
        !isRecommended && 'hover:scale-[1.02] hover:shadow-[0_24px_56px_-18px_rgba(156,39,176,0.45)]',
        'dark:border-primary/20 dark:bg-card/95',
        isRecommended &&
          cn(
            'z-[1] scale-[1.02] border-primary/20 sm:scale-[1.04]',
            '[box-shadow:0_26px_60px_-12px_rgba(233,30,140,0.48),0_0_42px_-8px_rgba(156,39,176,0.3),0_0_0_1px_rgba(233,30,140,0.14)]',
            'hover:scale-[1.03] hover:[box-shadow:0_32px_72px_-12px_rgba(233,30,140,0.55),0_0_52px_-6px_rgba(186,104,200,0.38),0_0_0_1px_rgba(233,30,140,0.16)]',
            'sm:hover:scale-[1.05]',
            'ring-2 ring-[#E91E8C]/45 ring-offset-2 ring-offset-[#fff5fb] dark:ring-offset-rosera-dark'
          )
      )}
    >
      <button
        type="button"
        onClick={goSalon}
        disabled={!salonIdOk}
        className="flex min-h-0 flex-1 flex-col text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
      >
        <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden bg-gradient-to-br from-[#fce4ec] to-white">
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover transition duration-500 ease-out group-hover:scale-105"
            loading="lazy"
            decoding="async"
            onError={() => setImgBroken(true)}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/10 transition-opacity duration-300 group-hover:from-black/30" />
          {isRecommended ? (
            <div className="absolute end-3 top-3 z-[1]">
              <Badge
                className={cn(
                  'border-0 bg-gradient-to-br from-[#E91E8C] via-[#f06292] to-[#9C27B0]',
                  'px-2.5 py-1 text-[10px] font-extrabold text-white shadow-lg shadow-[#E91E8C]/25',
                  'backdrop-blur-[2px] transition duration-300 group-hover:shadow-xl group-hover:shadow-[#9C27B0]/30'
                )}
              >
                {recLabel}
              </Badge>
            </div>
          ) : null}
          {badge ? (
            <div className="absolute start-3 top-3 flex flex-wrap gap-1.5">
              {badge === 'top' ? (
                <Badge className="border-0 bg-black/50 text-xs font-bold text-white shadow-md backdrop-blur-md transition duration-300 group-hover:bg-black/55">
                  {badgeTop}
                </Badge>
              ) : (
                <Badge className="border-0 bg-white/95 text-xs font-bold text-[#9C27B0] shadow-md transition duration-300 group-hover:shadow-lg">
                  {badgeRec}
                </Badge>
              )}
            </div>
          ) : null}
          {offerPct != null && offerPct > 0 ? (
            <div className="absolute bottom-3 start-3 end-3 z-[1]">
              <Badge
                className={cn(
                  'w-full justify-center border-0 bg-gradient-to-r from-amber-500 to-orange-500',
                  'py-1.5 text-[10px] font-extrabold text-white shadow-lg'
                )}
              >
                {lang === 'ar'
                  ? `🎁 عرض خاص - خصم ${offerPct}%`
                  : `🎁 Special offer — ${offerPct}% off`}
              </Badge>
            </div>
          ) : null}
        </div>
        <div className="flex min-h-0 flex-1 flex-col space-y-1.5 px-4 pb-3 pt-3">
          <h2 className="line-clamp-2 text-base font-extrabold leading-snug text-[#1F1F1F] dark:text-foreground">
            {salon.name_ar}
          </h2>
          {showCity && (locationLine || salon.city) ? (
            <p className="whitespace-normal text-[15px] font-medium leading-snug text-gray-700 dark:text-gray-300">
              {locationLine || salon.city}
            </p>
          ) : null}
          {scoreCaption ? (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary/80">{scoreCaption}</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold tabular-nums text-[#374151] dark:text-foreground">
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Star className="h-4 w-4 fill-current" aria-hidden />
              {rating.toFixed(1)}
            </span>
            <span className="text-rosera-gray">
              {reviews.toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US')} {reviewsLabel}
            </span>
          </div>
        </div>
      </button>

      <div
        className={cn(
          'mt-auto shrink-0 border-t border-primary/[0.08] bg-white/98 px-4 pb-4 pt-3 backdrop-blur-sm dark:bg-card/98',
          isRecommended && 'border-primary/15 bg-gradient-to-t from-[#fce4ec]/40 to-white dark:from-primary/10 dark:to-card'
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {isRecommended ? (
          <p className="mb-2 text-center text-[10px] font-medium leading-relaxed text-[#6B7280] dark:text-rosera-gray">
            {trustLine}
          </p>
        ) : null}
        <Button
          type="button"
          disabled={!salonIdOk}
          className={cn(
            'h-11 w-full rounded-xl text-sm font-extrabold text-white shadow-md',
            'bg-gradient-to-r from-[#E91E8C] to-[#9C27B0]',
            'transition duration-200 ease-out',
            'hover:scale-[1.02] hover:shadow-lg active:scale-[0.97]',
            'touch-manipulation select-none',
            isRecommended &&
              'h-12 bg-gradient-to-r from-[#d81b60] via-[#E91E8C] to-[#7b1fa2] text-[13px] leading-snug shadow-lg shadow-[#E91E8C]/40 hover:scale-[1.03] hover:shadow-xl active:scale-[0.96] sm:text-[14px]'
          )}
          onClick={goBook}
        >
          {isRecommended ? bookCtaRecommended : bookLabel}
        </Button>
      </div>
    </Card>
  )
}
