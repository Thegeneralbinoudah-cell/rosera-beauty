import * as React from 'react'
import * as SheetPrimitive from '@radix-ui/react-dialog'
import { cva, type VariantProps } from 'class-variance-authority'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Sheet = SheetPrimitive.Root
const SheetTrigger = SheetPrimitive.Trigger
const SheetClose = SheetPrimitive.Close
const SheetPortal = SheetPrimitive.Portal

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      'fixed inset-0 z-[65] bg-[hsl(var(--overlay-scrim)/0.45)] backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-normal ease-premium-out dark:bg-[hsl(var(--overlay-scrim)/0.55)]',
      className
    )}
    {...props}
    ref={ref}
  />
))
SheetOverlay.displayName = SheetPrimitive.Overlay.displayName

const sheetVariants = cva(
  'fixed z-[65] gap-4 border-border bg-card p-6 shadow-floating duration-normal ease-premium-out data-[state=open]:animate-in data-[state=closed]:animate-out',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 border-b rounded-b-2xl data-[state=open]:slide-in-from-top-4 data-[state=closed]:slide-out-to-top-4',
        bottom:
          'inset-x-0 bottom-0 border-t border-border/60 rounded-t-[1.35rem] max-h-[90vh] overflow-y-auto bg-gradient-to-b from-background to-card shadow-floating data-[state=open]:slide-in-from-bottom-5 data-[state=closed]:slide-out-to-bottom-5 data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0',
        left: 'inset-y-0 start-0 h-full w-3/4 rounded-e-2xl border-e sm:max-w-sm data-[state=open]:slide-in-from-left-4 data-[state=closed]:slide-out-to-left-4',
        right: 'inset-y-0 end-0 h-full w-3/4 rounded-s-2xl border-s sm:max-w-sm data-[state=open]:slide-in-from-right-4 data-[state=closed]:slide-out-to-right-4',
      },
    },
    defaultVariants: { side: 'right' },
  }
)

interface SheetContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetVariants> {}

const SheetContent = React.forwardRef<React.ElementRef<typeof SheetPrimitive.Content>, SheetContentProps>(
  ({ side = 'bottom', className, children, ...props }, ref) => (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content ref={ref} className={cn(sheetVariants({ side }), className)} {...props}>
        <SheetPrimitive.Title className="sr-only">روزيرا</SheetPrimitive.Title>
        {children}
        <SheetPrimitive.Close className="absolute end-4 top-4 rounded-xl p-1.5 text-muted-foreground opacity-80 ring-offset-background transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <X className="h-4 w-4" />
          <span className="sr-only">إغلاق</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPortal>
  )
)
SheetContent.displayName = SheetPrimitive.Content.displayName

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-2 text-center sm:text-start', className)} {...props} />
)

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn('text-heading-3 font-semibold tracking-luxury-tight text-foreground', className)}
    {...props}
  />
))
SheetTitle.displayName = SheetPrimitive.Title.displayName

export { Sheet, SheetPortal, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetTitle }
