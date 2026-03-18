import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCartStore } from '@/stores/cartStore'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatPrice } from '@/lib/utils'
import { toast } from 'sonner'

const SHIPPING = 30
const PAYMENT_OPTIONS = [
  { id: 'mada', label: 'مدى', icon: '💳' },
  { id: 'visa', label: 'فيزا', icon: '💳' },
  { id: 'apple', label: 'Apple Pay', icon: '🍎' },
  { id: 'tamara', label: 'تمارا (تقسيط)', icon: '🔄' },
]

export default function Checkout() {
  const { user } = useAuth()
  const nav = useNavigate()
  const { items, total, clear } = useCartStore()
  const [address, setAddress] = useState('')
  const [payment, setPayment] = useState('mada')
  const [loading, setLoading] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)

  const subtotal = total()
  const totalWithShipping = subtotal + SHIPPING

  if (!user) {
    nav('/auth')
    return null
  }

  if (items.length === 0 && !orderId) {
    nav('/cart')
    return null
  }

  const onConfirm = async () => {
    const addr = address.trim()
    if (!addr) {
      toast.error('أدخلي عنوان التوصيل')
      return
    }
    setLoading(true)
    try {
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          delivery_address: addr,
          payment_method: payment,
          status: 'pending',
          total: totalWithShipping,
          shipping: SHIPPING,
        })
        .select('id')
        .single()
      if (orderErr) throw orderErr
      const oid = (order as { id: string }).id
      for (const item of items) {
        await supabase.from('order_items').insert({
          order_id: oid,
          product_id: item.productId,
          product_name_ar: item.name_ar,
          product_image_url: item.image_url,
          price: item.price,
          quantity: item.quantity,
        })
      }
      clear()
      setOrderId(oid)
      toast.success('تم تأكيد الطلب')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'فشل التأكيد')
    } finally {
      setLoading(false)
    }
  }

  if (orderId) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 pb-28">
        <div className="text-6xl">✅</div>
        <h2 className="mt-6 text-2xl font-extrabold">تم الطلب بنجاح!</h2>
        <p className="mt-2 text-rosera-gray">رقم الطلب: <span className="font-mono font-bold">{orderId.slice(0, 8)}</span></p>
        <Button className="mt-8 rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]" onClick={() => nav('/home')}>
          العودة للرئيسية
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-rosera-light pb-28 dark:bg-rosera-dark">
      <header className="sticky top-0 z-10 border-b border-primary/10 bg-white px-4 py-4 dark:bg-card">
        <h1 className="text-xl font-extrabold">إتمام الطلب</h1>
      </header>
      <div className="mx-auto max-w-lg px-4 py-6 space-y-6">
        <div>
          <Label>عنوان التوصيل</Label>
          <Input
            className="mt-2 rounded-2xl"
            placeholder="المدينة، الحي، الشارع، رقم المنزل"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <div>
          <Label>طريقة الدفع</Label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {PAYMENT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setPayment(opt.id)}
                className={`flex items-center gap-2 rounded-2xl border-2 p-4 text-start ${
                  payment === opt.id ? 'border-primary bg-primary/5' : 'border-primary/10'
                }`}
              >
                <span>{opt.icon}</span>
                <span className="font-bold">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-primary/10 bg-white p-4 dark:bg-card">
          <p className="text-rosera-gray">المجموع الفرعي: {formatPrice(subtotal)}</p>
          <p className="text-rosera-gray">التوصيل: {formatPrice(SHIPPING)}</p>
          <p className="mt-2 text-lg font-bold text-primary">المجموع: {formatPrice(totalWithShipping)}</p>
        </div>
        <Button
          className="w-full h-12 rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C] text-base font-bold"
          disabled={loading}
          onClick={onConfirm}
        >
          تأكيد الطلب
        </Button>
      </div>
    </div>
  )
}
