import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

/** Shimmer — sweep uses transform (map-shimmer); base on muted surfaces */
function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-muted',
        "before:pointer-events-none before:absolute before:inset-0 before:content-[''] before:-translate-x-full before:animate-map-shimmer before:bg-gradient-to-r before:from-muted before:via-primary/20 before:to-muted",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
