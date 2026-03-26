import { CalendarHeart, Palette, Sparkles } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { buildMapExploreUrl } from '@/lib/mapExploreUrl'
import { rosyVisionMapSearchQuery } from '@/lib/rosyVisionRecommendations'
import type { RozyVisionMode } from '@/lib/rozyVisionTypes'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics'

type Props = {
  /** Scroll target for «ألوان أكثر» */
  moreColorsSectionId?: string
  className?: string
  /** When set, حجز / خريطة use nail vs hair search context */
  visionMode?: RozyVisionMode | null
  /** From vision salons fetch — direct booking only when both ids exist */
  rozyBookTarget?: { salonId: string; serviceId: string } | null
}

export function VisionResultCtas({
  moreColorsSectionId = 'rozy-vision-colors',
  className,
  visionMode = null,
  rozyBookTarget = null,
}: Props) {
  const nav = useNavigate()

  const q = visionMode ? rosyVisionMapSearchQuery(visionMode) : ''
  const searchHref = visionMode
    ? `/search?sort=nearest&q=${encodeURIComponent(q)}&categoryLabel=${encodeURIComponent('صالون نسائي')}`
    : '/search'
  const mapHref = visionMode
    ? buildMapExploreUrl({
        sortNearest: true,
        searchQuery: q,
        categoryLabel: 'صالون نسائي',
      })
    : '/map'

  const scrollToColors = () => {
    const el = document.getElementById(moreColorsSectionId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      nav('/chat')
    }
  }

  const primaryLabel =
    visionMode === 'hand'
      ? 'احجزي هذا اللوك'
      : visionMode === 'face'
        ? 'احجزي استشارة الشعر'
        : 'احجزي الآن'

  const goPrimary = () => {
    if (rozyBookTarget && visionMode) {
      trackEvent('rosy_booking_click', {
        salonId: rozyBookTarget.salonId,
        serviceId: rozyBookTarget.serviceId,
        source: 'rosy_vision',
        quick: false,
        cta: visionMode === 'hand' ? 'book_look_footer' : 'hair_consult_footer',
      })
      nav(`/booking/${rozyBookTarget.salonId}?source=rosy`, {
        state: { preselect: rozyBookTarget.serviceId },
      })
      return
    }
    nav(searchHref)
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-stretch',
        'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:delay-150',
        className,
      )}
    >
      <Button
        type="button"
        variant="default"
        className={cn(
          'min-h-[48px] flex-1 rounded-xl border-0 font-bold shadow-lg',
          'bg-gradient-to-l from-[#c026d3] via-primary to-[#db2777] text-white',
          'hover:opacity-95 active:scale-[0.99] transition-all duration-300',
          'shadow-[0_8px_24px_-6px_rgba(192,38,211,0.45)]',
        )}
        onClick={goPrimary}
      >
        {primaryLabel}
        <CalendarHeart className="h-5 w-5 shrink-0 opacity-95" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="outline"
        className={cn(
          'min-h-[48px] flex-1 rounded-xl border-2 border-gold/50 bg-gradient-to-b from-gold-subtle/80 to-card font-bold text-foreground',
          'shadow-md hover:border-gold hover:bg-gold-subtle/90 transition-all duration-300',
        )}
        onClick={() => nav(mapHref)}
      >
        اعرضي صالونات
        <Sparkles className="h-5 w-5 shrink-0 text-gold" aria-hidden />
      </Button>
      <Button
        type="button"
        variant="secondary"
        className={cn(
          'min-h-[48px] flex-1 rounded-xl border border-primary/25 bg-primary-subtle/90 font-bold text-primary',
          'hover:bg-primary/10 transition-all duration-300',
        )}
        onClick={scrollToColors}
      >
        ألوان أكثر
        <Palette className="h-5 w-5 shrink-0" aria-hidden />
      </Button>
    </div>
  )
}
