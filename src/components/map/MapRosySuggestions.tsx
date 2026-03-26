import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MapSuggestion } from '@/lib/mapSuggestions'
import { labelForSuggestion } from '@/lib/mapSuggestions'

type Props = {
  suggestions: MapSuggestion[]
  activeId: string | null
  lang: 'ar' | 'en'
  panelTitle: string
  onSelect: (s: MapSuggestion) => void
  onClear: () => void
  className?: string
}

/**
 * شرائح اقتراحات روزي — فوق الفرز؛ لا تُعيد حساب الخريطة عند التمرير.
 */
export function MapRosySuggestions({
  suggestions,
  activeId,
  lang,
  panelTitle,
  onSelect,
  onClear,
  className,
}: Props) {
  if (suggestions.length === 0) return null

  return (
    <div className={cn('w-full', className)} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <div className="mb-1.5 flex items-center gap-1.5 px-0.5">
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
        <span className="text-[11px] font-bold leading-tight text-foreground sm:text-xs">{panelTitle}</span>
        {activeId ? (
          <button
            type="button"
            onClick={onClear}
            className="ms-auto text-[10px] font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline sm:text-[11px]"
          >
            {lang === 'ar' ? 'إلغاء' : 'Clear'}
          </button>
        ) : null}
      </div>
      <div className="scrollbar-hide flex gap-1.5 overflow-x-auto pb-0.5">
        {suggestions.map((s) => {
          const active = activeId === s.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s)}
              className={cn(
                'shrink-0 rounded-full border-2 px-3 py-1.5 text-[10px] font-bold transition-all duration-200 ease-out sm:text-[11px]',
                active
                  ? 'gradient-rosera border-transparent text-white shadow-elevated'
                  : 'border-primary/20 bg-card/95 text-muted-foreground shadow-sm hover:border-primary/35 hover:bg-accent/60 hover:text-foreground dark:bg-card/90'
              )}
            >
              {labelForSuggestion(s, lang)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
