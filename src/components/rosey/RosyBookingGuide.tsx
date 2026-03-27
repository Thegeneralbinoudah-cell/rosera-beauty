import { useEffect, useState } from 'react'
import { MapPin, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/hooks/useI18n'
import { toast } from 'sonner'
import {
  fetchRosySalonSuggestions,
  fetchRosySalonsByServiceType,
  type RosyPickMode,
  type RosySalonSuggestion,
  type RosyServiceType,
} from '@/lib/roseySalonSuggestions'
import { resolveBusinessCoverImage } from '@/lib/businessImages'
import { cn } from '@/lib/utils'

function SalonPickCard({
  s,
  onBook,
  t,
}: {
  s: RosySalonSuggestion
  onBook: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  const img = resolveBusinessCoverImage(s)
  const ratingLabel =
    s.average_rating != null && s.average_rating > 0
      ? t('aiChat.ratingShort', { n: s.average_rating.toFixed(1) })
      : t('aiChat.ratingUnknown')
  const distLabel =
    s.distance_km != null ? t('aiChat.distanceKm', { n: s.distance_km.toFixed(1) }) : null

  return (
    <div
      className={cn(
        'rounded-2xl border border-primary/15 bg-white p-4 shadow-soft transition-shadow duration-300 hover:shadow-lg dark:border-border dark:bg-card dark:hover:shadow-none',
        'animate-premium-in'
      )}
    >
      <div className="flex gap-4">
        <img
          src={img}
          alt=""
          className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-primary/10"
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 font-bold leading-snug text-foreground">{s.name_ar}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" aria-hidden />
              {ratingLabel}
            </span>
            {distLabel ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-primary/80" aria-hidden />
                {distLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <Button type="button" className="mt-4 w-full" onClick={onBook}>
        {t('aiChat.bookNow')}
      </Button>
    </div>
  )
}

const SERVICE_TYPES: RosyServiceType[] = ['hair', 'nails', 'laser']

/**
 * مساعد حجز محادثي: أقرب / تقييم / خدمة (مع اختيار شعر·أظافر·ليزر) ثم بطاقات و«احجزي الآن».
 */
export function RosyBookingGuide({
  show,
  onBookSalon,
}: {
  show: boolean
  onBookSalon: (salonId: string) => void
}) {
  const { t, lang } = useI18n()
  const [mode, setMode] = useState<RosyPickMode | null>(null)
  const [serviceType, setServiceType] = useState<RosyServiceType | null>(null)
  const [items, setItems] = useState<RosySalonSuggestion[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!show) {
      setMode(null)
      setServiceType(null)
      setItems([])
      setLoading(false)
    }
  }, [show])

  const pickMode = async (m: RosyPickMode) => {
    if (m === 'service') {
      setMode('service')
      setServiceType(null)
      setItems([])
      return
    }
    setMode(m)
    setServiceType(null)
    setLoading(true)
    setItems([])
    try {
      const { items: next, hadLocation } = await fetchRosySalonSuggestions(m)
      setItems(next)
      if (m === 'nearest' && !hadLocation) {
        toast.message(t('aiChat.locationHint'), { duration: 4500 })
      }
      if (next.length === 0) {
        toast.error(lang === 'ar' ? 'لا توجد صالونات متاحة حاليًا' : 'No salons available right now')
      }
    } catch {
      toast.error(lang === 'ar' ? 'تعذر تحميل الصالونات' : 'Could not load salons')
      setMode(null)
    } finally {
      setLoading(false)
    }
  }

  const pickServiceType = async (st: RosyServiceType) => {
    setServiceType(st)
    setLoading(true)
    setItems([])
    try {
      const { items: next } = await fetchRosySalonsByServiceType(st)
      setItems(next)
    } catch {
      toast.error(lang === 'ar' ? 'تعذر تحميل الصالونات' : 'Could not load salons')
      setServiceType(null)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setMode(null)
    setServiceType(null)
    setItems([])
  }

  const svcLabel = (st: RosyServiceType) => {
    if (st === 'hair') return t('aiChat.svcHair')
    if (st === 'nails') return t('aiChat.svcNails')
    return t('aiChat.svcLaser')
  }

  if (!show) return null

  return (
    <div className="space-y-4 text-start animate-premium-in">
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant={mode === 'nearest' ? 'default' : 'secondary'}
          className="min-h-12 rounded-xl px-5"
          disabled={loading}
          onClick={() => void pickMode('nearest')}
        >
          {t('aiChat.optNearest')}
        </Button>
        <Button
          type="button"
          variant={mode === 'rating' ? 'default' : 'secondary'}
          className="min-h-12 rounded-xl px-5"
          disabled={loading}
          onClick={() => void pickMode('rating')}
        >
          {t('aiChat.optRating')}
        </Button>
        <Button
          type="button"
          variant={mode === 'service' ? 'default' : 'secondary'}
          className="min-h-12 rounded-xl px-5"
          disabled={loading}
          onClick={() => pickMode('service')}
        >
          {t('aiChat.optService')}
        </Button>
      </div>

      {mode === 'service' && !serviceType ? (
        <div className="space-y-3 rounded-2xl border border-primary/12 bg-white/90 p-4 shadow-soft dark:border-border dark:bg-card/80">
          <p className="text-sm font-semibold text-foreground">{t('aiChat.servicePickTitle')}</p>
          <div className="flex flex-wrap gap-3">
            {SERVICE_TYPES.map((st) => (
              <Button
                key={st}
                type="button"
                variant="outline"
                className="min-h-12 rounded-xl px-6"
                disabled={loading}
                onClick={() => void pickServiceType(st)}
              >
                {svcLabel(st)}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {mode ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto px-2 py-1 text-xs text-muted-foreground"
          disabled={loading}
          onClick={reset}
        >
          {t('aiChat.changeChoice')}
        </Button>
      ) : null}

      {loading ? (
        <p className="text-sm font-medium text-muted-foreground">{t('aiChat.loadingSalons')}</p>
      ) : items.length > 0 ? (
        <div className="space-y-4">
          <p className="text-sm font-semibold text-foreground">{t('aiChat.pickSalons')}</p>
          {items.map((s) => (
            <SalonPickCard key={s.id} s={s} t={t} onBook={() => onBookSalon(s.id)} />
          ))}
        </div>
      ) : mode === 'service' && serviceType && !loading ? (
        <p className="text-sm leading-relaxed text-muted-foreground">{t('aiChat.serviceNoMatch')}</p>
      ) : null}
    </div>
  )
}
