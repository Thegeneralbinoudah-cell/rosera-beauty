import { ROSERA_LOGO_SRC } from '@/lib/branding'

interface RoseraLogoMarkProps {
  className?: string
  'aria-hidden'?: boolean
}

export function RoseraLogoMark({ className, ...props }: RoseraLogoMarkProps) {
  return (
    <img
      src={ROSERA_LOGO_SRC}
      alt="Rosera"
      className={`rosera-flower-logo ${className ?? ''}`.trim()}
      draggable={false}
      {...props}
    />
  )
}
