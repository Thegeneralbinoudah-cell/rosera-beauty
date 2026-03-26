import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl bg-muted/70',
        'animate-skeleton-pulse',
        "before:pointer-events-none before:absolute before:inset-0 before:content-[''] before:-translate-x-full before:animate-map-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/35 before:to-transparent",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
