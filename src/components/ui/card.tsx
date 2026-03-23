import * as React from 'react'
import { cn } from '@/lib/utils'

function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-primary/20 bg-white p-0 text-rosera-text shadow-luxury-sm transition-all duration-200 ease-out hover:border-primary/30 hover:shadow-luxury-md dark:border-border dark:bg-card dark:text-card-foreground dark:hover:shadow-none',
        className
      )}
      {...props}
    />
  )
}
function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-3 p-5', className)} {...props} />
}
function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-title font-bold leading-tight tracking-luxury-tight', className)} {...props} />
  )
}
function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />
}

export { Card, CardHeader, CardTitle, CardContent }
