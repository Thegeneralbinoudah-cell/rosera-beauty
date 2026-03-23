import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-base font-semibold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4',
  {
    variants: {
      variant: {
        default:
          'gradient-rosera text-white hover:brightness-[1.03] active:scale-95 shadow-luxury-sm hover:shadow-luxury-md [&_svg]:text-white',
        secondary:
          'border border-primary/25 bg-luxury-blush/80 text-rosera-text shadow-luxury-sm hover:border-primary/40 hover:bg-luxury-blush hover:shadow-luxury-md dark:bg-card dark:text-foreground dark:border-border dark:hover:bg-muted/50 active:scale-95',
        outline:
          'border-2 border-primary/35 text-rosera-text bg-white/90 hover:bg-luxury-blush/60 dark:border-primary dark:bg-transparent dark:text-foreground dark:hover:bg-muted/30 active:scale-95',
        ghost:
          'rounded-xl hover:bg-primary/15 text-rosera-text dark:text-foreground dark:hover:bg-muted active:scale-95',
        destructive: 'bg-destructive text-white shadow-soft active:scale-95',
        link: 'h-auto min-h-0 rounded-none text-[#BE185D] underline-offset-4 hover:underline active:scale-100 shadow-none',
      },
      size: {
        default: 'h-12 px-6',
        sm: 'h-9 rounded-xl px-4 text-sm',
        lg: 'h-12 px-8 text-base',
        wide: 'h-12 w-full max-w-md px-6 sm:mx-auto',
        icon: 'h-12 w-12 shrink-0 rounded-xl',
      },
    },
    compoundVariants: [
      {
        variant: 'link',
        class: 'w-auto px-0 py-1 text-base font-semibold',
      },
    ],
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
