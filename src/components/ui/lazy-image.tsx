import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export type LazyImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  /** أول صورة مرئية (LCP) — بدون lazy */
  priority?: boolean
}

/**
 * صور مع lazy-load افتراضي + decoding async.
 * للصور فوق الطية مرّر priority أو loading="eager".
 */
export const LazyImage = forwardRef<HTMLImageElement, LazyImageProps>(function LazyImage(
  { className, loading, decoding, priority, fetchPriority, ...rest },
  ref
) {
  return (
    <img
      ref={ref}
      className={cn(className)}
      loading={priority ? 'eager' : loading ?? 'lazy'}
      decoding={decoding ?? 'async'}
      fetchPriority={fetchPriority ?? (priority ? 'high' : 'auto')}
      {...rest}
    />
  )
})
