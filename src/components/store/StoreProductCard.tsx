import { Link } from 'react-router-dom'
import { Star, ShoppingBag } from 'lucide-react'
import type { Product } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useI18n } from '@/hooks/useI18n'
import { usePreferences } from '@/contexts/PreferencesContext'

const IMG_FALLBACK =
  'https://images.unsplash.com/photo-1596462502278-27bfdc403543?w=600&q=80&auto=format&fit=crop'

type StoreProductCardProps = {
  product: Product
  sponsored?: boolean
  onAddToCart: (p: Product) => void
  className?: string
}

export function StoreProductCard({ product, sponsored, onAddToCart, className }: StoreProductCardProps) {
  const { t } = useI18n()
  const { lang } = usePreferences()
  const rating = Number(product.rating ?? 0)
  const reviews = product.review_count ?? 0
  const priceStr = Number(product.price).toLocaleString(lang === 'en' ? 'en-US' : 'ar-SA')

  return (
    <article
      className={cn(
        'group flex flex-col overflow-hidden rounded-2xl border border-border/55 bg-card shadow-elevated transition-all duration-300 sm:rounded-3xl hover:border-primary/20 hover:shadow-floating dark:border-border/70 dark:bg-card',
        className
      )}
    >
      <Link
        to={`/product/${product.id}`}
        className="relative block aspect-[4/5] overflow-hidden bg-gradient-to-b from-primary-subtle/80 to-primary-subtle/40"
      >
        <img
          src={product.image_url || IMG_FALLBACK}
          alt=""
          className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
          loading="lazy"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10 opacity-60" />
        {sponsored && (
          <span className="absolute start-3 top-3 rounded-full bg-card/95 px-2.5 py-1 text-[10px] font-bold tracking-wide text-primary shadow-sm backdrop-blur-sm dark:bg-black/75 dark:text-primary">
            {t('store.sponsored')}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-3.5 pt-3">
        {product.brand_ar && (
          <p className="mb-0.5 font-cairo text-[11px] font-semibold uppercase tracking-wider text-primary/80 dark:text-primary/90">
            {product.brand_ar}
          </p>
        )}
        <Link to={`/product/${product.id}`} className="min-h-0 flex-1">
          <h3 className="font-cairo line-clamp-2 text-[15px] font-bold leading-snug text-foreground transition-colors hover:text-primary dark:text-foreground dark:hover:text-primary">
            {product.name_ar}
          </h3>
        </Link>

        <div className="mt-2 flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 rounded-full bg-primary-subtle px-2 py-0.5 dark:bg-muted/80">
            <Star className="h-3.5 w-3.5 fill-primary/35 text-primary/35" strokeWidth={0} aria-hidden />
            <span className="font-cairo text-xs font-bold text-foreground">
              {rating.toFixed(1)}
            </span>
          </div>
          {reviews > 0 && (
            <span className="font-cairo text-[11px] text-muted-foreground">
              ({reviews.toLocaleString(lang === 'en' ? 'en-US' : 'ar-SA')} {t('store.reviews')})
            </span>
          )}
        </div>

        <div className="mt-3 flex items-end justify-between gap-2 border-t border-primary/15 pt-3">
          <p className="font-cairo text-lg font-extrabold tabular-nums text-primary dark:text-primary">
            {priceStr}
            <span className="ms-1 text-xs font-bold text-muted-foreground">
              {t('common.sar')}
            </span>
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          className="mt-3 h-10 w-full gap-2 rounded-2xl text-xs font-bold shadow-sm"
          onClick={() => onAddToCart(product)}
        >
          <ShoppingBag className="h-4 w-4 opacity-90" aria-hidden />
          {t('store.addCart')}
        </Button>
      </div>
    </article>
  )
}
