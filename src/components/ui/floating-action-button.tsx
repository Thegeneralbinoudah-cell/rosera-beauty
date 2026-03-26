import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const fabVariants = cva(
  'pointer-events-auto fixed z-50 flex touch-manipulation items-center justify-center rounded-full shadow-lg transition-transform duration-normal ease-premium-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.96] motion-reduce:transition-none',
  {
    variants: {
      size: {
        /** Rosy FAB: ≥56×56 (Apple HIG comfort) */
        default: 'h-14 min-h-[56px] w-14 min-w-[56px]',
        sm: 'h-12 min-h-[44px] w-12 min-w-[44px]',
      },
    },
    defaultVariants: { size: 'default' },
  }
)

export interface FloatingActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof fabVariants> {}

export const FloatingActionButton = React.forwardRef<HTMLButtonElement, FloatingActionButtonProps>(
  ({ className, size, type = 'button', ...props }, ref) => (
    <button ref={ref} type={type} className={cn(fabVariants({ size }), className)} {...props} />
  )
)
FloatingActionButton.displayName = 'FloatingActionButton'

export { fabVariants }
