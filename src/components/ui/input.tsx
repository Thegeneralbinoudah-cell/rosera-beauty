import * as React from 'react'
import { cn } from '@/lib/utils'

/** Default — bordered field on dark surfaces */
const inputClassName =
  'flex h-12 w-full rounded-full border border-primary/30 bg-card px-5 py-2 text-body font-light text-foreground shadow-none transition-[box-shadow,border-color] duration-slow ease-out file:border-0 file:bg-transparent file:text-body-sm placeholder:text-muted-foreground/80 hover:border-accent/45 focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-[0.45]'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input type={type} className={cn(inputClassName, className)} ref={ref} {...props} />
  )
)
Input.displayName = 'Input'

export { Input, inputClassName }
