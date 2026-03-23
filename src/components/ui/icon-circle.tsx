import * as React from 'react'
import { cn } from '@/lib/utils'

const sizeClass = {
  sm: 'h-10 w-10 [&_svg]:size-5',
  md: 'h-12 w-12 [&_svg]:size-6',
  lg: 'h-14 w-14 [&_svg]:size-7',
} as const

export type IconCircleProps = {
  children: React.ReactNode
  className?: string
  size?: keyof typeof sizeClass
}

/** أيقونة داخل دائرة بخلفية وردية خفيفة — نمط موحّد للواجهة */
export function IconCircle({ children, className, size = 'md' }: IconCircleProps) {
  return (
    <div className={cn('icon-circle-pink', sizeClass[size], className)} aria-hidden>
      {children}
    </div>
  )
}
