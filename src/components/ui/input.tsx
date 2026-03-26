import * as React from 'react'
import { cn } from '@/lib/utils'

const inputClassName =
  'flex h-12 w-full rounded-2xl border border-input bg-card px-4 py-2 text-body text-foreground shadow-subtle transition-[box-shadow,border-color] duration-normal ease-premium-out file:border-0 file:bg-transparent file:text-body-sm placeholder:text-muted-foreground hover:border-primary/20 focus-visible:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:shadow-medium disabled:cursor-not-allowed disabled:opacity-[0.45]'

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => (
    <input type={type} className={cn(inputClassName, className)} ref={ref} {...props} />
  )
)
Input.displayName = 'Input'

export { Input, inputClassName }
