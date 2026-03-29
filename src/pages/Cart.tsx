import { Link } from 'react-router-dom'
import { Trash2, Minus, Plus } from 'lucide-react'
import { useCartStore } from '@/stores/cartStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatPrice } from '@/lib/utils'

const SHIPPING = 30

export default function Cart() {
  const { items, remove, updateQty, total } = useCartStore()
  const subtotal = total()

  if (items.length === 0) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 pb-28">
        <div className="text-7xl font-bold text-primary/35">R</div>
        <h2 className="mt-6 text-xl font-bold">سلتك فارغة</h2>
        <p className="mt-2 text-rosera-gray">أضيفي منتجات من متجر الجمال</p>
        <Button asChild className="mt-8 rounded-2xl gradient-primary">
          <Link to="/store">تسوقي الآن</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-rosera-light pb-32 dark:bg-rosera-dark">
      <header className="sticky top-0 z-10 border-b border-primary/10 bg-card px-4 py-4">
        <h1 className="text-xl font-extrabold">السلة</h1>
      </header>
      <div className="mx-auto max-w-lg px-4 py-6">
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.productId} className="flex gap-4 rounded-2xl border border-primary/10 bg-white p-3 dark:bg-card">
              <img
                src={item.image_url || ''}
                alt=""
                className="h-16 w-16 shrink-0 rounded-xl object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="font-bold line-clamp-2">{item.name_ar}</p>
                <p className="font-bold text-primary">{formatPrice(item.price)}</p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border"
                    onClick={() => updateQty(item.productId, -1)}
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="min-w-[1.5rem] text-center font-bold">{item.quantity}</span>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border"
                    onClick={() => updateQty(item.productId, 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 text-destructive"
                onClick={() => remove(item.productId)}
                aria-label="حذف"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex gap-2">
          <Input className="rounded-2xl flex-1" placeholder="كود الخصم" />
          <Button variant="outline" className="rounded-2xl shrink-0">تطبيق</Button>
        </div>
        <div className="mt-4 rounded-2xl border border-primary/10 bg-card p-4">
          <div className="flex justify-between text-sm">
            <span className="text-rosera-gray">المجموع الفرعي</span>
            <span>{formatPrice(subtotal)}</span>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span className="text-rosera-gray">التوصيل</span>
            <span>{formatPrice(SHIPPING)}</span>
          </div>
          <div className="mt-4 flex justify-between text-lg font-bold">
            <span>المجموع الكلي</span>
            <span className="text-primary">{formatPrice(subtotal + SHIPPING)}</span>
          </div>
        </div>

        <Button asChild className="mt-6 h-12 w-full rounded-2xl gradient-primary text-base font-bold">
          <Link to="/checkout">إتمام الطلب</Link>
        </Button>
      </div>
    </div>
  )
}
