import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fallbackTintFromString, parseHexFromColorLabel } from '@/lib/parseColorHexFromLabel'
import { cn } from '@/lib/utils'

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
  /** Scroll target for «ألوان أخرى» */
  moreColorsSectionId?: string
  className?: string
}

/**
 * Lightweight nail-color preview: tap swatches → mock «polish» row over the user’s hand image (CSS only, no canvas/CV).
 */
export function HandNailPreviewCard({
  lines,
  imageUrl,
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

  useEffect(() => {
    setSelected(0)
  }, [lines])

  if (items.length === 0) return null

  const safeIndex = Math.min(selected, items.length - 1)
  const active = items[safeIndex]

  const bookHref = (() => {
    const short = labelOnly(active.line).slice(0, 48)
    const q = short ? `مناكير ${short}` : 'أظافر مناكير'
    return `/search?sort=nearest&q=${encodeURIComponent(q)}&categoryLabel=${encodeURIComponent('صالون نسائي')}`
  })()

  const scrollMore = () => {
    const el = document.getElementById(moreColorsSectionId)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-[#fff7fb] via-card to-[#fce4ec]/40 p-4 shadow-lg dark:from-rosera-dark dark:via-card dark:to-rosera-dark',
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

      <div className="relative mx-auto max-w-md overflow-hidden rounded-2xl border border-gold/20 bg-black/5 shadow-inner">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className="max-h-64 w-full object-cover object-center"
            decoding="async"
            loading="lazy"
          />
        ) : (
          <div className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-b from-muted/40 to-muted/80 text-body-sm text-muted-foreground">
            معاينة اللون فقط
          </div>
        )}

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

      <p className="mt-2 text-center text-[10px] font-medium text-muted-foreground">
        لمحة أسلوبية — ليس تتبعاً لحدود الأظافر في الصورة
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          className="min-h-[48px] flex-1 rounded-xl bg-gradient-to-l from-[#c026d3] via-primary to-[#db2777] font-bold text-white shadow-md"
          onClick={() => nav(bookHref)}
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
