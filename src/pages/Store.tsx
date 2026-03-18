import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, ShoppingCart, Star } from 'lucide-react'
import { supabase, type Product } from '@/lib/supabase'
import { useCartStore } from '@/stores/cartStore'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

const CATEGORIES = [
  { key: '', label: 'الكل' },
  { key: 'عناية بالبشرة', label: 'عناية بالبشرة' },
  { key: 'مكياج', label: 'مكياج' },
  { key: 'عناية بالشعر', label: 'عناية بالشعر' },
  { key: 'عطور', label: 'عطور' },
  { key: 'أظافر', label: 'أظافر' },
]

export default function Store() {
  const [products, setProducts] = useState<Product[]>([])
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  const [loading, setLoading] = useState(true)
  const { add, count } = useCartStore()

  useEffect(() => {
    let c = true
    async function load() {
      try {
        let query = supabase.from('products').select('*').eq('is_active', true)
        if (cat) query = query.eq('category', cat)
        const { data, error } = await query
        if (error) throw error
        if (c) setProducts((data ?? []) as Product[])
      } catch {
        if (c) setProducts([])
      } finally {
        if (c) setLoading(false)
      }
    }
    void load()
    return () => { c = false }
  }, [cat])

  const filtered = q.trim()
    ? products.filter((p) => p.name_ar.includes(q) || (p.brand_ar && p.brand_ar.includes(q)))
    : products

  const addToCart = (p: Product) => {
    add({
      productId: p.id,
      name_ar: p.name_ar,
      brand_ar: p.brand_ar,
      image_url: p.image_url,
      price: Number(p.price),
      quantity: 1,
    })
    toast.success('أُضيف للسلة')
  }

  return (
    <div className="min-h-dvh bg-rosera-light pb-28 dark:bg-rosera-dark">
      <header className="sticky top-0 z-20 border-b border-primary/10 bg-white px-4 py-4 dark:bg-card">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-extrabold">متجر الجمال 🛍️</h1>
          <Link to="/cart" className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShoppingCart className="h-6 w-6" />
            {count() > 0 && (
              <span className="absolute -top-0.5 -end-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#E91E8C] text-[10px] font-bold text-white">
                {count()}
              </span>
            )}
          </Link>
        </div>
        <div className="relative mt-3">
          <Search className="absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-rosera-gray" />
          <Input
            className="rounded-2xl ps-10"
            placeholder="بحث في المتجر..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {CATEGORIES.map(({ key, label }) => (
            <button
              key={key || 'all'}
              type="button"
              onClick={() => setCat(key)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${
                cat === key ? 'bg-gradient-to-l from-[#9C27B0] to-[#E91E8C] text-white' : 'border bg-white dark:bg-card'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-6">
        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-square rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-16 text-center text-rosera-gray">لا توجد منتجات</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filtered.map((p) => (
              <div key={p.id} className="overflow-hidden rounded-2xl border border-primary/10 bg-white shadow-sm dark:bg-card">
                <Link to={`/product/${p.id}`} className="block aspect-square overflow-hidden">
                  <img src={p.image_url || ''} alt="" className="h-full w-full object-cover" />
                </Link>
                <div className="p-3">
                  <Link to={`/product/${p.id}`}>
                    <h3 className="line-clamp-2 font-bold text-sm">{p.name_ar}</h3>
                    <p className="text-xs text-rosera-gray">{p.brand_ar}</p>
                  </Link>
                  <div className="mt-1 flex items-center gap-1">
                    <Star className="h-4 w-4 fill-[#C9A227] text-[#C9A227]" />
                    <span className="text-xs font-bold">{Number(p.rating || 0).toFixed(1)}</span>
                  </div>
                  <p className="mt-1 text-lg font-bold text-primary">{Number(p.price).toLocaleString('ar-SA')} ر.س</p>
                  <Button
                    size="sm"
                    className="mt-2 w-full rounded-xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C] text-xs"
                    onClick={() => addToCart(p)}
                  >
                    أضيفي للسلة
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
