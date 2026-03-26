import { useMemo } from 'react'
import { fallbackTintFromString, parseHexFromColorLabel } from '@/lib/parseColorHexFromLabel'
import { cn } from '@/lib/utils'

type Props = {
  title: string
  lines: string[]
  id?: string
  className?: string
}

export function ColorSwatches({ title, lines, id, className }: Props) {
  const items = useMemo(
    () =>
      lines.map((line) => ({
        line,
        hex: parseHexFromColorLabel(line) ?? fallbackTintFromString(line),
      })),
    [lines],
  )

  if (lines.length === 0) return null

  return (
    <div id={id} className={cn('space-y-3', className)}>
      <h3 className="text-title-sm font-bold text-transparent bg-clip-text bg-gradient-to-l from-primary to-gold">
        {title}
      </h3>
      <ul className="flex flex-wrap gap-3" role="list">
        {items.map(({ line, hex }, i) => (
          <li
            key={`${line}-${i}`}
            className={cn(
              'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 fill-mode-both',
            )}
            style={{ animationDelay: `${i * 60}ms`, animationDuration: '420ms' }}
          >
            <div className="flex flex-col items-center gap-2">
              <span
                className={cn(
                  'h-14 w-14 rounded-2xl border-2 border-white shadow-md ring-2 ring-primary/10 transition-transform duration-300',
                  'hover:scale-105 hover:shadow-lg hover:ring-gold/30',
                )}
                style={{ backgroundColor: hex }}
                title={line}
                aria-hidden
              />
              <span className="max-w-[7.5rem] text-center text-body-sm font-medium leading-snug text-foreground">
                {line.replace(/\s*\(#?[0-9A-Fa-f]+\)\s*$/i, '').trim() || line}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
