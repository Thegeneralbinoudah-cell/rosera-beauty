import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Star, Minus, Plus } from 'lucide-react'
import { supabase, type Product } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { trackEvent } from '@/lib/analytics'
import { useCartStore } from '@/stores/cartStore'
import { Button } from '@/components/ui/button'
import { LazyImage } from '@/components/ui/lazy-image'
import { toast } from 'sonner'
import { fetchActiveProductBoostMeta } from '@/lib/boosts'

export default function ProductDetail() {
  const { user } = useAuth()
  const { productId } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [similar, setSimilar] = useState<Product[]>([])
  const [notFound, setNotFound] = useState(false)
  const [qty, setQty] = useState(1)
  const [productBoost, setProductBoost] = useState<{ boost_type: 'featured' | 'priority' } | null>(null)
  const { add } = useCartStore()

  const [prevProductId, setPrevProductId] = useState(productId)
  if (productId !== prevProductId) {
    setPrevProductId(productId)
    setNotFound(false)
    setProduct(null)
    setProductBoost(null)
  }

  useEffect(() => {
    if (!productId) return
    let c = true
    async function load() {
      try {
        const { data: p, error } = await supabase.from('products').select('*').eq('id', productId).single()
        if (!c) return
        if (error || !p) {
          setNotFound(true)
          return
        }
        const row = p as Product
        if (row.is_demo) {
          setNotFound(true)
          return
        }
        setProduct(row)
        const pm = await fetchActiveProductBoostMeta([row.id])
        if (c) setProductBoost(pm.get(row.id) ?? null)
        const cat = (p as Product).category
        const { data: sim, error: simErr } = await supabase
          .from('products')
          .select('*')
          .eq('category', cat)
          .eq('is_active', true)
          .eq('is_demo', false)
          .neq('id', productId)
          .limit(4)
        if (simErr) {
          console.error(simErr)
        }
        if (c) setSimilar((sim ?? []) as Product[])
      } catch (e) {
        console.error(e)
        if (c) setNotFound(true)
      }
    }
    void load()
    return () => { c = false }
  }, [productId])

  useEffect(() => {
    if (!product?.id || !user?.id) return
    trackEvent({ user_id: user.id, event_type: 'view', entity_type: 'product', entity_id: product.id })
  }, [product?.id, user?.id])

  const addToCart = () => {
    if (!product) return
    add({
      productId: product.id,
      name_ar: product.name_ar,
      brand_ar: product.brand_ar,
      image_url: product.image_url,
      price: Number(product.price),
      quantity: qty,
    })
    toast.success('أُضيف للسلة')
  }

  if (notFound)
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 pb-28">
        <p className="text-xl font-bold text-rosera-gray">المنتج غير موجود</p>
        <Link to="/store" className="font-bold text-primary underline">العودة للمتجر</Link>
      </div>
    )
  if (!product) return <div className="p-8 text-center">جاري التحميل...</div>

  return (
    <div className="min-h-dvh bg-rosera-light pb-28 dark:bg-rosera-dark">
      <div className="relative aspect-square w-full overflow-hidden bg-card">
        <LazyImage
          src={product.image_url || ''}
          alt=""
          className="h-full w-full object-cover"
          priority
        />
        {productBoost && (
          <span className="absolute bottom-3 start-3 rounded-full bg-card/90 px-2.5 py-1 text-[10px] font-extrabold text-primary shadow dark:bg-black/70 dark:text-primary">
            {productBoost.boost_type === 'featured' ? 'Featured' : 'مُموَّل'}
          </span>
        )}
      </div>
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold">{product.name_ar ?? ''}</h1>
          {productBoost?.boost_type === 'featured' && (
            <span className="rounded-full bg-amber-400/90 px-2 py-0.5 text-[9px] font-extrabold text-amber-950">Featured</span>
          )}
        </div>
        <p className="text-rosera-gray">{product.brand_ar ?? ''}</p>
        <div className="mt-2 flex items-center gap-2">
          <Star className="h-5 w-5 fill-primary text-primary" />
          <span className="font-bold">{Number(product.rating || 0).toFixed(1)}</span>
          <span className="text-sm text-rosera-gray">({product.review_count ?? 0})</span>
        </div>
        <p className="mt-4 text-3xl font-extrabold text-primary">{Number(product.price).toLocaleString('ar-SA')} ر.س</p>
        {product.description_ar && (
          <p className="mt-4 leading-relaxed text-rosera-gray">{product.description_ar}</p>
        )}
        <div className="mt-6 flex items-center gap-4">
          <span className="font-bold">الكمية</span>
          <div className="flex items-center gap-2 rounded-xl border bg-card">
            <button type="button" className="p-2" onClick={() => setQty((x) => Math.max(1, x - 1))}>
              <Minus className="h-4 w-4" />
            </button>
            <span className="min-w-[2rem] text-center font-bold">{qty}</span>
            <button type="button" className="p-2" onClick={() => setQty((x) => x + 1)}>
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
        <Button
          className="mt-8 h-12 w-full rounded-2xl gradient-primary text-base font-bold"
          onClick={addToCart}
        >
          أضيفي للسلة
        </Button>

        {similar.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-bold">منتجات مشابهة</h2>
            <div className="mt-4 grid grid-cols-2 gap-4">
              {similar.map((p) => (
                <Link key={p.id} to={`/product/${p.id}`} className="rounded-2xl border bg-card overflow-hidden dark:bg-card">
                  <div className="aspect-square">
                    <LazyImage src={p.image_url || ''} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="p-2">
                    <p className="line-clamp-2 text-sm font-bold">{p.name_ar ?? ''}</p>
                    <p className="text-primary font-bold">{Number(p.price).toLocaleString('ar-SA')} ر.س</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
