import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IconCircle } from '@/components/ui/icon-circle'
import { cn } from '@/lib/utils'
import { trackEvent } from '@/lib/analytics'

export type EmptyStateProps = {
  icon: LucideIcon
  title: string
  subtitle: string
  ctaLabel: string
  onClick: () => void
  /** محتوى إضافي تحت الزر (مثل خيارات روزي) */
  children?: import('react').ReactNode
  className?: string
  /** يُرسل `trackEvent('cta_click', { source, type: 'empty_state' })` قبل onClick */
  analyticsSource?: string
  ctaVariant?: 'default' | 'secondary'
  animate?: boolean
}

/**
 * حالة فارغة موحّدة: إرشاد، دائمًا إجراء، لا شاشات ميتة.
 */
export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  ctaLabel,
  onClick,
  children,
  className,
  analyticsSource,
  ctaVariant = 'default',
  animate = true,
}: EmptyStateProps) {
  const handleClick = () => {
    if (analyticsSource) trackEvent('cta_click', { source: analyticsSource, type: 'empty_state' })
    onClick()
  }

  return (
    <div
      className={cn(
        'mx-auto flex w-full max-w-md flex-col items-center gap-6 rounded-3xl border border-border/45 bg-gradient-to-b from-card via-accent/25 to-primary/[0.09] px-8 py-12 text-center shadow-floating backdrop-blur-sm ring-1 ring-gold/10 transition-all duration-200 ease-out hover:border-primary/28 hover:shadow-floating dark:border-border/70 dark:from-card dark:via-card/95 dark:to-card dark:ring-gold/5',
        animate && 'animate-premium-in',
        className
      )}
    >
      <IconCircle size="md">
        <Icon strokeWidth={1.5} />
      </IconCircle>
      <h2 className="text-heading-2 font-semibold tracking-luxury-tight text-foreground">
        {title}
      </h2>
      <p className="max-w-[22rem] text-body font-medium leading-relaxed tracking-luxury text-foreground">
        {subtitle}
      </p>
      <Button
        type="button"
        variant={ctaVariant}
        className="mt-0 w-full max-w-sm"
        onClick={handleClick}
      >
        {ctaLabel}
      </Button>
      {children ? <div className="w-full">{children}</div> : null}
    </div>
  )
}
