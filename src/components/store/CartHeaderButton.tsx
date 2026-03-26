import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ShoppingCart } from 'lucide-react'
import { useCartStore } from '@/stores/cartStore'
import { useI18n } from '@/hooks/useI18n'
import { cn } from '@/lib/utils'

/** أيقونة السلة مع العدّاد ونبض عند إضافة منتج جديد — يُستخدم في المتجر ومحادثة روزي */
export function CartHeaderButton({ className }: { className?: string }) {
  const { t } = useI18n()
  const itemCount = useCartStore((s) => s.items.reduce((acc, i) => acc + i.quantity, 0))
  const pulseKey = useCartStore((s) => s.cartUiPulseKey)
  const [pulsing, setPulsing] = useState(false)

  useEffect(() => {
    if (pulseKey === 0) return
    setPulsing(true)
    const id = window.setTimeout(() => setPulsing(false), 3200)
    return () => window.clearTimeout(id)
  }, [pulseKey])

  return (
    <Link
      to="/cart"
      className={cn(
        'relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#F9A8C9]/35 bg-white/90 text-[#BE185D] shadow-sm backdrop-blur-sm transition-all duration-300 hover:border-[#F9A8C9]/60 hover:shadow-md active:scale-95 dark:border-border dark:bg-card dark:text-primary',
        pulsing &&
          'z-[1] scale-[1.06] border-[#EC4899]/70 shadow-[0_0_0_3px_rgba(244,114,182,0.35),0_8px_24px_rgba(236,72,153,0.25)] ring-2 ring-[#F9A8C9]/90 ring-offset-2 ring-offset-white dark:ring-offset-card',
        className
      )}
      aria-label={t('store.cart')}
    >
      <ShoppingCart
        className={cn('h-5 w-5 transition-transform duration-300', pulsing && 'scale-110')}
        strokeWidth={2.25}
      />
      {itemCount > 0 && (
        <span
          className={cn(
            'absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#F9A8C9] to-[#EC4899] px-1 text-[10px] font-extrabold text-[#374151] shadow-sm transition-transform duration-300',
            pulsing && 'scale-110 animate-pulse'
          )}
        >
          {itemCount > 99 ? '99+' : itemCount}
        </span>
      )}
    </Link>
  )
}
