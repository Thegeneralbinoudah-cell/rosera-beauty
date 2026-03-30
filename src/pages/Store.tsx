import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  LayoutGrid,
  Bath,
  Sparkles,
  Cpu,
  Droplets,
  Palette,
  Wind,
  Flower2,
  Sparkle,
  Camera,
  Mic,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { supabase, type Product } from '@/lib/supabase'
import { fetchSponsoredProductIds } from '@/lib/boosts'
import { useCartStore } from '@/stores/cartStore'
import { StoreProductCard } from '@/components/store/StoreProductCard'
import { CartHeaderButton } from '@/components/store/CartHeaderButton'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { useI18n } from '@/hooks/useI18n'
import { cn } from '@/lib/utils'
import { buildMapExploreUrl } from '@/lib/mapExploreUrl'
import { trackCategoryFilterSelected } from '@/lib/analytics'
import rozyFabPortrait from '@/assets/rozy.png'

type CatDef = { key: string; tKey: string; Icon: LucideIcon }

/** Values must match `products.category` in the database (Arabic). */
const CATEGORY_DEFS: CatDef[] = [
  { key: '', tKey: 'store.catAll', Icon: LayoutGrid },
  { key: 'عناية بالجسم', tKey: 'store.catBody', Icon: Bath },
  { key: 'سبا', tKey: 'store.catSpa', Icon: Sparkles },
  { key: 'أجهزة تجميل', tKey: 'store.catDevices', Icon: Cpu },
  { key: 'عناية بالبشرة', tKey: 'store.catSkincare', Icon: Droplets },
  { key: 'مكياج', tKey: 'store.catMakeup', Icon: Palette },
  { key: 'عناية بالشعر', tKey: 'store.catHair', Icon: Wind },
  { key: 'عطور', tKey: 'store.catPerfume', Icon: Flower2 },
  { key: 'أظافر', tKey: 'store.catNails', Icon: Sparkle },
]

export default function Store() {
  const nav = useNavigate()
  const { t } = useI18n()
  const [products, setProducts] = useState<Product[]>([])
  const [sponsoredProductIds, setSponsoredProductIds] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [loading, setLoading] = useState(true)
  const { add } = useCartStore()

  useEffect(() => {
    let c = true
    async function load() {
      setLoading(true)
      try {
        let query = supabase.from('products').select('*').eq('is_active', true).eq('is_demo', false)
        if (cat) query = query.eq('category', cat)
        const { data, error } = await query.order('created_at', { ascending: false })
        if (error) throw error
        const list = (data ?? []) as Product[]
        if (c) setProducts(list)
        if (c && list.length) {
          const sp = await fetchSponsoredProductIds(list.map((p) => p.id))
          if (c) setSponsoredProductIds(sp)
        } else if (c) setSponsoredProductIds(new Set())
      } catch {
        if (c) setProducts([])
      } finally {
        if (c) setLoading(false)
      }
    }
    void load()
    return () => {
      c = false
    }
  }, [cat])

  const filtered = useMemo(() => {
    const qq = q.trim()
    if (!qq) return products
    return products.filter(
      (p) => (p.name_ar ?? '').includes(qq) || (p.brand_ar ?? '').includes(qq)
    )
  }, [products, q])

  const addToCart = (p: Product) => {
    add({
      productId: p.id,
      name_ar: p.name_ar,
      brand_ar: p.brand_ar,
      image_url: p.image_url,
      price: Number(p.price),
      quantity: 1,
    })
    toast.success(t('store.addedToast'))
  }

  const emptyNoDb = !loading && products.length === 0
  const emptyFilter = !loading && products.length > 0 && filtered.length === 0

  return (
    <div className="min-h-dvh bg-background pb-28">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-primary/20 bg-gradient-to-b from-primary-subtle/50 via-white to-background px-4 pb-6 pt-4 dark:from-card dark:via-background dark:to-background dark:border-border">
        <div
          className="pointer-events-none absolute -end-16 -top-20 h-48 w-48 rounded-full bg-primary/25 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -start-10 top-10 h-36 w-36 rounded-full bg-primary/20 blur-2xl"
          aria-hidden
        />

        <div className="relative mx-auto max-w-lg">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 pt-1">
              <p className="font-cairo text-xs font-semibold tracking-wide text-primary/90 dark:text-primary/90">
                Rosera Beauty
              </p>
              <h1 className="font-cairo mt-1 text-2xl font-extrabold tracking-tight text-foreground">
                {t('store.title')}
              </h1>
              <p className="font-cairo mt-1.5 max-w-[260px] text-sm leading-relaxed text-foreground">
                {t('store.subtitle')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => nav('/chat?launch=camera')}
                aria-label="فتح كاميرا روزي"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/35 bg-card text-primary shadow-sm transition-transform active:scale-95"
              >
                <Camera className="h-5 w-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => nav('/chat?launch=voice')}
                aria-label="بدء محادثة صوتية مع روزي"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/35 bg-card text-primary shadow-sm transition-transform active:scale-95"
              >
                <Mic className="h-5 w-5" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => nav('/chat')}
                aria-label="التحدث مع روزي"
                className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-primary/35 bg-card p-0 shadow-sm transition-transform active:scale-95"
              >
                <img
                  src={rozyFabPortrait}
                  alt=""
                  width={44}
                  height={44}
                  decoding="async"
                  className="h-full w-full object-cover object-center"
                />
              </button>
              <CartHeaderButton />
            </div>
          </div>

          <div className="relative mt-5">
            <Search
              className="pointer-events-none absolute start-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-primary/50"
              aria-hidden
            />
            <Input
              className="h-12 rounded-2xl border-primary/25 bg-white/90 pe-4 ps-11 text-[15px] shadow-sm backdrop-blur-sm placeholder:text-foreground focus-visible:border-primary/50 focus-visible:ring-primary/30 dark:bg-card"
              placeholder={t('store.searchPlaceholder')}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="sticky top-0 z-10 border-b border-primary/15 bg-background/95 py-3 backdrop-blur-md dark:border-border dark:bg-card/95">
        <div className="scrollbar-hide flex gap-2 overflow-x-auto px-4 pb-0.5">
          {CATEGORY_DEFS.map(({ key, tKey, Icon }) => {
            const active = cat === key
            return (
              <button
                key={key || 'all'}
                type="button"
                onClick={() => {
                  trackCategoryFilterSelected('store', key || 'all')
                  setCat(key)
                }}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2.5 font-cairo text-sm font-bold transition-all duration-200 active:scale-[0.98]',
                  active
                    ? 'border-transparent gradient-primary text-primary-foreground shadow-soft'
                    : 'border-border bg-white/90 text-foreground hover:border-primary/40 hover:bg-primary-subtle/60 dark:border-border dark:bg-card dark:hover:bg-muted/50'
                )}
              >
                <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary-foreground' : 'opacity-70')} strokeWidth={2.25} />
                {t(tKey)}
              </button>
            )
          })}
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="overflow-hidden rounded-3xl border border-primary/15 bg-white dark:border-border dark:bg-card">
                <Skeleton className="aspect-[4/5] w-full rounded-none" />
                <div className="space-y-2 p-3.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-[80%]" />
                  <Skeleton className="mt-3 h-9 w-full rounded-2xl" />
                </div>
              </div>
            ))}
          </div>
        ) : emptyNoDb ? (
          <EmptyState
            icon={Flower2}
            title={t('store.emptyTitle')}
            subtitle={t('store.emptySub')}
            ctaLabel={t('store.emptyCta')}
            onClick={() => nav(buildMapExploreUrl())}
            analyticsSource="store"
          />
        ) : emptyFilter ? (
          <EmptyState
            icon={Search}
            title={t('store.emptyFilterTitle')}
            subtitle={t('store.emptyFilterSub')}
            ctaLabel={t('store.emptyFilterCta')}
            onClick={() => nav(buildMapExploreUrl())}
            analyticsSource="store_filter"
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {filtered.map((p) => (
              <StoreProductCard
                key={p.id}
                product={p}
                sponsored={sponsoredProductIds.has(p.id)}
                onAddToCart={addToCart}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
