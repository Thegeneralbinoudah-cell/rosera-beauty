import * as React from 'react'
import { cn } from '@/lib/utils'

/** Dark Empress card — surface, glow shadow, 20px radius */
function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'group/card rounded-[20px] border border-primary/20 bg-card text-card-foreground shadow-[0_8px_32px_rgba(139,26,74,0.18)] transition-[transform,box-shadow,border-color] duration-300 ease-spring-soft will-change-transform',
        'hover:-translate-y-1.5 hover:shadow-[0_16px_48px_rgba(139,26,74,0.28)]',
        'motion-reduce:hover:translate-y-0 motion-reduce:transition-none',
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-2 p-6 pb-0', className)} {...props} />
}

function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        'font-serif text-heading-3 font-normal leading-tight tracking-wide text-foreground',
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pt-4', className)} {...props} />
}

export { Card, CardHeader, CardTitle, CardContent }
