import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'relative inline-flex min-h-[44px] touch-manipulation items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-3xl text-button font-semibold transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-[0.45] disabled:saturate-75 active:scale-[0.98] active:duration-150 active:ease-out [&_svg]:size-4 motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100',
  {
    variants: {
      variant: {
        default:
          'gradient-rosera text-primary-foreground shadow-elevated hover:scale-[1.02] hover:shadow-floating focus-visible:ring-primary/40 [&_svg]:text-primary-foreground',
        secondary:
          'border border-primary/25 bg-primary-subtle/85 text-foreground shadow-sm hover:border-primary/40 hover:bg-accent hover:shadow-md dark:border-primary/30 dark:bg-secondary/80 dark:hover:bg-muted/55',
        outline:
          'border border-primary/28 bg-card/95 text-foreground shadow-sm backdrop-blur-[2px] hover:border-primary/45 hover:bg-accent/55 hover:shadow-md dark:border-primary/35 dark:bg-transparent dark:hover:bg-muted/40',
        ghost:
          'rounded-3xl hover:bg-primary/12 text-foreground dark:hover:bg-muted',
        destructive: 'bg-destructive text-destructive-foreground shadow-subtle hover:opacity-90',
        link: 'h-auto min-h-0 rounded-none text-primary underline-offset-4 hover:underline hover:text-primary-hover active:scale-100 shadow-none dark:text-primary',
      },
      size: {
        default: 'h-12 min-h-[44px] px-6',
        sm: 'h-11 min-h-[44px] rounded-2xl px-4 text-body-sm',
        lg: 'h-12 min-h-[44px] px-8',
        wide: 'h-12 min-h-[44px] w-full max-w-md px-6 sm:mx-auto',
        icon: 'h-12 min-h-[44px] w-12 shrink-0 rounded-2xl',
      },
    },
    compoundVariants: [
      {
        variant: 'link',
        class: 'h-auto min-h-0 w-auto px-0 py-1 font-semibold active:scale-100',
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
