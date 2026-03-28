import * as React from 'react'
import { cn } from '@/lib/utils'

export type SectionHeaderProps = {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
  /** إخفاء الوصف على الشاشات الصغيرة */
  descriptionClassName?: string
}

/**
 * رأس قسم موحّد — عنوان + وصف اختياري + إجراء (زر/رابط).
 */
export function SectionHeader({
  title,
  description,
  action,
  className,
  descriptionClassName,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        'ds-header flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4',
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-1 border-s-4 border-accent ps-3">
        <h2 className="text-heading-2 font-semibold tracking-luxury-tight text-foreground">{title}</h2>
        {description ? (
          <p
            className={cn(
              'max-w-prose text-body text-foreground',
              descriptionClassName
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0 sm:pt-0">{action}</div> : null}
    </div>
  )
}
