import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Star, Minus, Plus } from 'lucide-react'
import { supabase, type Product } from '@/lib/supabase'
import { useCartStore } from '@/stores/cartStore'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function ProductDetail() {
  const { productId } = useParams()
  const [product, setProduct] = useState<Product | null>(null)
  const [similar, setSimilar] = useState<Product[]>([])
  const [qty, setQty] = useState(1)
  const { add } = useCartStore()

  useEffect(() => {
    if (!productId) return
    let c = true
    async function load() {
      const { data: p, error } = await supabase.from('products').select('*').eq('id', productId).single()
      if (error || !c) return
      setProduct(p as Product)
      const cat = (p as Product).category
      const { data: sim } = await supabase.from('products').select('*').eq('category', cat).neq('id', productId).limit(4)
      if (c) setSimilar((sim ?? []) as Product[])
    }
    void load()
    return () => { c = false }
  }, [productId])

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

  if (!product) return <div className="p-8 text-center">جاري التحميل...</div>

  return (
    <div className="min-h-dvh bg-rosera-light pb-28 dark:bg-rosera-dark">
      <div className="aspect-square w-full overflow-hidden bg-white dark:bg-card">
        <img src={product.image_url || ''} alt="" className="h-full w-full object-cover" />
      </div>
      <div className="mx-auto max-w-lg px-4 py-6">
        <h1 className="text-2xl font-extrabold">{product.name_ar}</h1>
        <p className="text-rosera-gray">{product.brand_ar}</p>
        <div className="mt-2 flex items-center gap-2">
          <Star className="h-5 w-5 fill-[#C9A227] text-[#C9A227]" />
          <span className="font-bold">{Number(product.rating || 0).toFixed(1)}</span>
          <span className="text-sm text-rosera-gray">({product.review_count ?? 0})</span>
        </div>
        <p className="mt-4 text-3xl font-extrabold text-primary">{Number(product.price).toLocaleString('ar-SA')} ر.س</p>
        {product.description_ar && (
          <p className="mt-4 leading-relaxed text-rosera-gray">{product.description_ar}</p>
        )}
        <div className="mt-6 flex items-center gap-4">
          <span className="font-bold">الكمية</span>
          <div className="flex items-center gap-2 rounded-xl border bg-white dark:bg-card">
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
          className="mt-8 h-12 w-full rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C] text-base font-bold"
          onClick={addToCart}
        >
          أضيفي للسلة
        </Button>

        {similar.length > 0 && (
          <section className="mt-12">
            <h2 className="text-lg font-bold">منتجات مشابهة</h2>
            <div className="mt-4 grid grid-cols-2 gap-4">
              {similar.map((p) => (
                <Link key={p.id} to={`/product/${p.id}`} className="rounded-2xl border bg-white overflow-hidden dark:bg-card">
                  <div className="aspect-square">
                    <img src={p.image_url || ''} alt="" className="h-full w-full object-cover" />
                  </div>
                  <div className="p-2">
                    <p className="line-clamp-2 text-sm font-bold">{p.name_ar}</p>
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
