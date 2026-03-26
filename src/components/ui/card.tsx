import * as React from 'react'
import { cn } from '@/lib/utils'

function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-3xl border border-border/45 bg-card text-card-foreground shadow-elevated backdrop-blur-[2px] transition-all duration-200 ease-out',
        'hover:border-primary/28 hover:shadow-floating',
        'dark:border-border/70 dark:bg-card',
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
    <h3 className={cn('text-heading-3 font-semibold leading-tight tracking-luxury-tight text-foreground', className)} {...props} />
  )
}

function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-6 pt-4', className)} {...props} />
}

export { Card, CardHeader, CardTitle, CardContent }
