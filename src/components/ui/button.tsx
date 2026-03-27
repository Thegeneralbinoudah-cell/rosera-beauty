import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { useMagneticOffset } from '@/hooks/useMagneticOffset'
import { useIsDesktop } from '@/hooks/useIsDesktop'

/** Primary pink CTA — original ROSERA theme */
const buttonVariants = cva(
  'relative inline-flex min-h-[44px] touch-manipulation items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-full text-button font-medium transition-[transform,opacity,box-shadow,background-color,border-color] duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-[0.45] [&_svg]:size-4 [&_svg]:stroke-[1.25] [&_svg]:text-primary-foreground',
  {
    variants: {
      variant: {
        default:
          'group border border-primary/35 bg-gradient-to-br from-primary to-primary-hover text-primary-foreground shadow-[0_4px_18px_rgb(244_114_182/0.35),0_2px_8px_rgb(251_191_36/0.15)] hover:shadow-[0_6px_24px_rgb(244_114_182/0.4),0_0_28px_rgb(251_191_36/0.2)] focus-visible:ring-primary [&_svg]:text-primary-foreground',
        secondary:
          'border border-border bg-secondary/80 text-secondary-foreground shadow-none hover:bg-muted active:scale-[0.98]',
        outline:
          'border border-border/80 bg-transparent font-normal text-muted-foreground shadow-none hover:border-primary hover:text-primary',
        ghost: 'rounded-full font-normal text-muted-foreground hover:bg-muted/80 active:scale-[0.98]',
        destructive:
          'border border-destructive/55 bg-destructive/15 font-normal text-destructive-foreground shadow-sm hover:bg-destructive/25 [&_svg]:text-destructive-foreground',
        link: 'h-auto min-h-0 rounded-none border-0 bg-transparent font-normal text-primary underline-offset-4 shadow-none hover:underline hover:opacity-90 active:opacity-100 active:scale-100 [&_svg]:text-primary',
      },
      size: {
        default: 'h-12 min-h-[44px] px-8',
        sm: 'h-11 min-h-[44px] rounded-full px-5 text-body-sm',
        lg: 'h-12 min-h-[44px] px-10',
        wide: 'h-12 min-h-[44px] w-full max-w-md px-6 sm:mx-auto',
        icon: 'h-12 min-h-[44px] w-12 shrink-0 rounded-full',
      },
    },
    compoundVariants: [
      {
        variant: 'link',
        class: 'h-auto min-h-0 w-auto px-0 py-1 active:scale-100',
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
  ({ className, variant, size, asChild = false, children, onPointerDown, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    const showShimmer = variant === 'default' && !asChild
    const isDesktop = useIsDesktop()
    const magneticOn = Boolean(isDesktop && !asChild && variant !== 'link')
    const rippleOn = magneticOn
    const magnetic = useMagneticOffset(magneticOn)

    const [ripples, setRipples] = React.useState<Array<{ id: number; x: number; y: number }>>([])
    const rippleId = React.useRef(0)

    const handlePointerDownRipple = (e: React.PointerEvent<HTMLButtonElement>) => {
      if (rippleOn) {
        const rect = e.currentTarget.getBoundingClientRect()
        const id = ++rippleId.current
        setRipples((s) => [...s, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }])
        window.setTimeout(() => setRipples((s) => s.filter((r) => r.id !== id)), 620)
      }
      onPointerDown?.(e)
    }

    const setRefs = React.useCallback(
      (node: HTMLButtonElement | null) => {
        if (typeof ref === 'function') ref(node)
        else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node
      },
      [ref]
    )

    const innerStyle: React.CSSProperties | undefined = magneticOn
      ? { transform: `translate3d(${magnetic.offset.x}px, ${magnetic.offset.y}px, 0)` }
      : undefined

    if (asChild) {
      return (
        <Comp ref={setRefs} className={cn(buttonVariants({ variant, size, className }))} {...props}>
          {children}
        </Comp>
      )
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={setRefs}
        onPointerDown={rippleOn ? handlePointerDownRipple : onPointerDown}
        onMouseMove={magneticOn ? magnetic.onMouseMove : undefined}
        onMouseLeave={magneticOn ? magnetic.onMouseLeave : undefined}
        {...props}
      >
        {rippleOn &&
          ripples.map((r) => (
            <span
              key={r.id}
              className="luxury-ripple-el pointer-events-none absolute z-[1] rounded-full"
              style={{ left: r.x, top: r.y }}
              aria-hidden
            />
          ))}
        {showShimmer && (
          <span className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]" aria-hidden>
            <span className="absolute inset-0 translate-x-[-120%] bg-gradient-to-r from-transparent via-white/15 to-transparent transition-transform duration-700 ease-spring-soft group-hover:translate-x-[120%] motion-reduce:translate-x-0 motion-reduce:transition-none" />
          </span>
        )}
        {showShimmer ? (
          <span
            className="relative z-[2] inline-flex items-center justify-center gap-2 will-change-transform motion-reduce:transform-none"
            style={innerStyle}
          >
            {children}
          </span>
        ) : (
          <span
            className={cn(
              'relative z-[2] inline-flex items-center justify-center gap-2',
              magneticOn && 'will-change-transform motion-reduce:transform-none'
            )}
            style={innerStyle}
          >
            {children}
          </span>
        )}
      </Comp>
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
