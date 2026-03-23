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
        'mx-auto flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-primary/20 bg-gradient-to-b from-white via-luxury-blush/40 to-primary/10 px-6 py-12 text-center shadow-luxury-sm transition-all duration-200 hover:border-primary/30 hover:shadow-luxury-md dark:border-border dark:from-card dark:via-card dark:to-card dark:hover:shadow-none',
        animate && 'animate-premium-in',
        className
      )}
    >
      <IconCircle size="md">
        <Icon strokeWidth={1.65} />
      </IconCircle>
      <h2 className="text-xl font-bold tracking-luxury-tight text-luxury-ink sm:text-2xl dark:text-foreground">
        {title}
      </h2>
      <p className="max-w-[22rem] text-body font-medium leading-relaxed tracking-luxury text-muted-foreground">
        {subtitle}
      </p>
      <Button
        type="button"
        variant={ctaVariant}
        className="mt-2 w-full max-w-sm"
        onClick={handleClick}
      >
        {ctaLabel}
      </Button>
      {children ? <div className="w-full">{children}</div> : null}
    </div>
  )
}
