import * as React from 'react'
import { cn } from '@/lib/utils'
import { inputClassName } from '@/components/ui/input'

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        inputClassName,
        'min-h-[120px] resize-y py-3 leading-relaxed',
        className
      )}
      {...props}
    />
  )
)
Textarea.displayName = 'Textarea'

export { Textarea }
