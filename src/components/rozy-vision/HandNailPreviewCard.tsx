import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { trackEvent } from '@/lib/analytics'
import { fallbackTintFromString, parseHexFromColorLabel } from '@/lib/parseColorHexFromLabel'
import { cn } from '@/lib/utils'

export type RosyNailBookTarget = { salonId: string; serviceId: string }

/** Cap at 6 swatches; show all returned lines up to this (typically 4–6 from vision). */
const MAX_SWATCHES = 6

function labelOnly(line: string): string {
  return line.replace(/\s*\(#?[0-9A-Fa-f]+\)\s*$/i, '').trim() || line
}

/** Works for #RRGGBB and hsl() fallbacks — no invalid `hsl(...)55` concatenation */
function nailTintOverlay(hexOrHsl: string): string {
  if (hexOrHsl.startsWith('#')) {
    return `linear-gradient(to top, ${hexOrHsl}aa, ${hexOrHsl}33, transparent)`
  }
  return `linear-gradient(to top, color-mix(in srgb, ${hexOrHsl} 42%, transparent), transparent)`
}

type SwatchItem = { line: string; hex: string }

type Props = {
  /** Recommended polish lines from vision (Arabic + optional hex) */
  lines: string[]
  /** Object URL of the analyzed hand photo */
  imageUrl: string | null
  /** Best nail booking match from RosyVisionSalonSuggestions (nearest + nail service) — when set, primary CTA books directly */
  bookTarget?: RosyNailBookTarget | null
  /** Scroll target for «ألوان أخرى» */
  moreColorsSectionId?: string
  className?: string
}

function HandNailPreviewCardInner({
  lines,
  imageUrl,
  bookTarget = null,
  moreColorsSectionId = 'rozy-vision-colors',
  className,
}: Props) {
  const nav = useNavigate()
  const items: SwatchItem[] = useMemo(() => {
    const slice = lines.slice(0, MAX_SWATCHES)
    return slice.map((line) => ({
      line,
      hex: parseHexFromColorLabel(line) ?? fallbackTintFromString(line),
    }))
  }, [lines])

  const [selected, setSelected] = useState(0)

  if (items.length === 0) return null

  const safeIndex = Math.min(selected, items.length - 1)
  const active = items[safeIndex]

  const searchFallbackHref = (() => {
    const short = labelOnly(active.line).slice(0, 48)
    const q = short ? `مناكير ${short}` : 'أظافر مناكير'
    return `/search?sort=nearest&q=${encodeURIComponent(q)}&categoryLabel=${encodeURIComponent('صالون نسائي')}`
  })()

  const goBookThisColor = () => {
    const colorName = labelOnly(active.line)
    if (bookTarget?.salonId && bookTarget?.serviceId) {
      trackEvent('rosy_booking_click', {
        salonId: bookTarget.salonId,
        serviceId: bookTarget.serviceId,
        source: 'rosy_vision_nail_preview',
        quick: true,
        cta: 'book_look',
      })
      nav(`/booking/${bookTarget.salonId}?source=rosy`, {
        state: {
          preselect: bookTarget.serviceId,
          rosyNailColor: colorName,
          rosyNailHex: active.hex,
        },
      })
      return
    }
    nav(searchFallbackHref)
  }

  const scrollMore = () => {
    const el = document.getElementById(moreColorsSectionId)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div
      dir="rtl"
      className={cn(
        'luxury-card overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-card to-primary/40 p-4 shadow-floating ring-1 ring-gold/10 dark:from-rosera-dark dark:via-card dark:to-rosera-dark',
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="h-5 w-5 shrink-0 text-primary" aria-hidden />
        <h3 className="text-title-sm font-bold text-transparent bg-clip-text bg-gradient-to-l from-primary to-gold">
          ألوان طلاء — لمحة على صورتك
        </h3>
      </div>
      <p className="mb-4 text-body-sm leading-relaxed text-muted-foreground">
        اختاري لوناً للمقارنة — عرض تقديري فني وليس مطابقة دقيقة للأظافر.
      </p>

      {/* Hand image first — one img, CSS overlays only */}
      <div className="relative mx-auto mb-4 max-w-md overflow-hidden rounded-2xl border border-gold/25 bg-black/5 shadow-inner ring-1 ring-gold/15">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="max-h-64 w-full object-cover object-center"
            decoding="async"
            loading="eager"
            fetchPriority="low"
          />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-b from-muted/40 to-muted/80 text-body-sm text-muted-foreground">
            معاينة اللون فقط
          </div>
        )}

        {/* Optional static vignette — no CV */}
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.12)_100%)]"
          aria-hidden
        />

        {/* Soft tint toward nail zone — no pixel painting */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%]"
          style={{ background: nailTintOverlay(active.hex) }}
          aria-hidden
        />

        {/* Mock nail tips — decorative ovals, not segmentation */}
        <div
          className="pointer-events-none absolute bottom-[6%] left-1/2 flex -translate-x-1/2 gap-1.5 px-1 sm:gap-2"
          aria-hidden
        >
          {[0, 1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="h-9 w-7 rounded-b-[45%] rounded-t-[55%] border border-white/35 shadow-md sm:h-10 sm:w-8"
              style={{
                backgroundColor: active.hex,
                opacity: 0.92,
                boxShadow: `0 2px 8px ${active.hex}66`,
              }}
            />
          ))}
        </div>
      </div>

      <div
        className="mb-4 flex flex-wrap gap-2"
        role="tablist"
        aria-label="ألوان طلاء مقترحة"
      >
        {items.map((item, i) => (
          <button
            key={`${item.line}-${i}`}
            type="button"
            role="tab"
            aria-selected={safeIndex === i}
            onClick={() => setSelected(i)}
            className={cn(
              'flex min-h-[44px] min-w-[44px] touch-manipulation items-center gap-2 rounded-2xl border-2 px-2 py-1.5 transition-all',
              safeIndex === i
                ? 'border-primary bg-primary/10 shadow-md ring-2 ring-primary/25'
                : 'border-border/60 bg-card/80 hover:border-primary/40',
            )}
          >
            <span
              className="h-10 w-10 shrink-0 rounded-xl border-2 border-white shadow-sm ring-1 ring-black/5"
              style={{ backgroundColor: item.hex }}
              aria-hidden
            />
            <span className="max-w-[5.5rem] text-start text-[11px] font-semibold leading-tight text-foreground sm:text-body-sm">
              {labelOnly(item.line)}
            </span>
          </button>
        ))}
      </div>

      {/* Selected color preview — DOM only */}
      <div
        className="mb-4 rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.07] via-card to-gold/[0.08] p-4 shadow-[0_0_32px_-8px_rgba(190,24,93,0.2)] ring-1 ring-gold/15"
        role="status"
        aria-live="polite"
      >
        <div className="flex items-center gap-4">
          <div
            className="h-16 w-16 shrink-0 rounded-full border-4 border-white shadow-md ring-2 ring-primary/20"
            style={{ backgroundColor: active.hex }}
            aria-hidden
          />
          <div className="min-w-0 flex-1 text-start">
            <p className="text-lg font-bold leading-snug text-foreground">{labelOnly(active.line)}</p>
            <p className="mt-1 text-body-sm font-semibold text-primary">هذا اللون مناسب لك</p>
          </div>
        </div>
      </div>

      <p className="mb-3 text-center text-[10px] font-medium text-muted-foreground">
        لمحة أسلوبية — ليس تتبعاً لحدود الأظافر في الصورة
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          className="min-h-[48px] flex-1 rounded-xl bg-gradient-to-l from-destructive via-primary to-accent font-bold text-white shadow-md"
          onClick={goBookThisColor}
        >
          احجزي مناكير بهذا اللون
        </Button>
        <Button type="button" variant="outline" className="min-h-[48px] flex-1 rounded-xl font-bold" onClick={scrollMore}>
          ألوان أخرى
        </Button>
      </div>
    </div>
  )
}

/**
 * Lightweight nail-color preview: tap swatches → mock «polish» row over the user’s hand image (CSS only, no canvas/CV).
 */
export function HandNailPreviewCard(props: Props) {
  return <HandNailPreviewCardInner key={props.lines.join('\0')} {...props} />
}
