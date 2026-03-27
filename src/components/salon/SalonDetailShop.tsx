import { useNavigate } from 'react-router-dom'
import { ShoppingBag, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Placeholder «shop» block for salon detail — no product fetch, no salon↔store relation.
 */
export function SalonDetailShop() {
  const navigate = useNavigate()

  return (
    <div className="luxury-card relative overflow-hidden border border-amber-400/25 bg-gradient-to-br from-amber-50/80 via-card to-card p-8 shadow-floating ring-1 ring-amber-400/15 dark:from-amber-950/35 dark:via-card dark:to-card dark:border-amber-500/20">
      <div
        className="pointer-events-none absolute -start-8 -top-8 h-36 w-36 rounded-full bg-amber-300/25 blur-3xl dark:bg-amber-500/12"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-6 end-0 h-32 w-32 rounded-full bg-amber-200/20 blur-2xl dark:bg-amber-600/10"
        aria-hidden
      />

      <div className="relative flex flex-col items-center gap-6 text-center">
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-amber-400/35 bg-gradient-to-br from-amber-100/90 to-card shadow-inner ring-2 ring-amber-400/20 dark:from-amber-900/50 dark:to-card">
          <ShoppingBag className="h-9 w-9 text-amber-700 dark:text-amber-400" strokeWidth={1.6} aria-hidden />
          <Sparkles
            className="absolute -end-1 -top-1 h-5 w-5 text-amber-500 drop-shadow-sm"
            strokeWidth={2}
            aria-hidden
          />
        </div>

        <p className="max-w-sm text-xl font-semibold leading-relaxed text-foreground sm:text-2xl">
          منتجات مختارة قريباً
        </p>

        <Button
          type="button"
          onClick={() => navigate('/store')}
          className="rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-600 to-amber-700 px-8 py-6 text-base font-bold text-white shadow-lg shadow-amber-900/15 ring-1 ring-amber-300/30 hover:from-amber-500 hover:to-amber-600 dark:from-amber-500 dark:to-amber-600 dark:hover:from-amber-400 dark:hover:to-amber-500"
        >
          تصفح المتجر
        </Button>
      </div>
    </div>
  )
}
