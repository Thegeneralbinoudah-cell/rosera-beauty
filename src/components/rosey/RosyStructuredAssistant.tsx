import { MapPin, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { resolveBusinessCoverImage } from '@/lib/businessImages'
import type { RozyChatAction, RozySalonCard } from '@/lib/roseyChatTypes'
import { cn } from '@/lib/utils'
import { useI18n } from '@/hooks/useI18n'

function MiniSalonCard({
  s,
  onBook,
}: {
  s: RozySalonCard
  onBook: () => void
}) {
  const { t } = useI18n()
  const img = resolveBusinessCoverImage(s)
  const ratingLabel =
    s.average_rating != null && s.average_rating > 0
      ? t('aiChat.ratingShort', { n: s.average_rating.toFixed(1) })
      : t('aiChat.ratingUnknown')
  const distLabel =
    s.distance_km != null ? t('aiChat.distanceKm', { n: s.distance_km.toFixed(1) }) : null

  return (
    <div className="overflow-hidden rounded-xl border border-pink-500/20 bg-white shadow-md dark:border-pink-400/20 dark:bg-card">
      <img src={img} alt="" className="aspect-[16/10] w-full object-cover" />
      <div className="space-y-3 p-3">
        <div className="text-start">
          <p className="line-clamp-2 text-sm font-bold leading-snug text-foreground">{s.name_ar}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-0.5">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden />
              {ratingLabel}
            </span>
            {distLabel ? (
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="h-3.5 w-3.5 text-primary/80" aria-hidden />
                {distLabel}
              </span>
            ) : null}
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-11 w-full rounded-xl gradient-primary text-white shadow-sm transition-transform active:scale-95"
          onClick={onBook}
        >
          {t('aiChat.bookNow')}
        </Button>
      </div>
    </div>
  )
}

export function RosyStructuredAssistant({
  salons,
  actions,
  onBookSalon,
  onAction,
}: {
  salons?: RozySalonCard[]
  actions?: RozyChatAction[]
  onBookSalon: (salonId: string) => void
  onAction: (a: RozyChatAction) => void
}) {
  const { t } = useI18n()
  if ((!salons || salons.length === 0) && (!actions || actions.length === 0)) return null

  return (
    <div className="mt-1 w-full space-y-3 border-t border-pink-500/15 pt-3 dark:border-pink-400/10">
      {salons && salons.length > 0 ? (
        <div className="space-y-3">
          <p className="text-start text-xs font-semibold text-muted-foreground">{t('aiChat.pickSalons')}</p>
          {salons.map((s) => (
            <MiniSalonCard key={s.id} s={s} onBook={() => onBookSalon(s.id)} />
          ))}
        </div>
      ) : null}
      {actions && actions.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-center text-xs font-medium text-primary">{t('aiChat.ctaClosing')}</p>
          <div className="flex flex-col gap-2">
            {actions.map((a) => (
              <Button
                key={a.id}
                type="button"
                variant={
                  a.kind === 'book' ||
                  a.kind === 'salon_upgrade' ||
                  a.kind === 'negotiated_book' ||
                  a.kind === 'add_to_cart' ||
                  a.kind === 'go_to_checkout'
                    ? 'default'
                    : a.kind === 'map' ||
                        a.kind === 'store' ||
                        a.kind === 'view_product' ||
                        a.kind === 'salon_detail'
                      ? 'outline'
                      : 'secondary'
                }
                className={cn(
                  'h-11 w-full rounded-xl transition-transform active:scale-95',
                  (a.kind === 'book' ||
                    a.kind === 'salon_upgrade' ||
                    a.kind === 'negotiated_book' ||
                    a.kind === 'add_to_cart' ||
                    a.kind === 'go_to_checkout') &&
                    'gradient-primary text-white shadow-sm hover:opacity-[0.98]',
                  (a.kind === 'map' ||
                    a.kind === 'store' ||
                    a.kind === 'view_product' ||
                    a.kind === 'salon_detail') &&
                    'border-pink-500/25 text-primary hover:bg-pink-50 dark:border-pink-400/20 dark:hover:bg-pink-950/30'
                )}
                onClick={() => onAction(a)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
