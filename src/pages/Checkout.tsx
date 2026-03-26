import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useCartStore } from '@/stores/cartStore'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatPrice } from '@/lib/utils'
import { toast } from 'sonner'
import PaymentForm, { type PaymentResult } from '@/components/payment/PaymentForm'
import { useI18n } from '@/hooks/useI18n'
import { trackRosyHesitationCheckoutIfAttributed } from '@/lib/roseyHesitationAnalytics'

const SHIPPING = 30
const PAYMENT_OPTIONS: { id: string; labelKey: string; icon: string }[] = [
  { id: 'mada', labelKey: 'checkout.payMada', icon: '💳' },
  { id: 'visa', labelKey: 'checkout.payVisa', icon: '💳' },
  { id: 'apple', labelKey: 'checkout.payApple', icon: '🍎' },
]

export default function Checkout() {
  const { t } = useI18n()
  const { user } = useAuth()
  const nav = useNavigate()
  const { items, total, clear } = useCartStore()
  const [address, setAddress] = useState('')
  const [payment, setPayment] = useState('mada')
  const [loading, setLoading] = useState(false)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [pendingRefId, setPendingRefId] = useState<string | null>(null)

  const subtotal = total()
  const totalWithShipping = subtotal + SHIPPING

  useEffect(() => {
    if (!user) {
      nav('/auth', { replace: true })
      return
    }
    if (items.length === 0 && !orderId) {
      nav('/cart', { replace: true })
    }
  }, [user, items.length, orderId, nav])

  if (!user) return null
  if (items.length === 0 && !orderId) return null

  const createOrder = async (paymentStatus: string, paymentId?: string | null) => {
    if (paymentStatus === 'paid' && !(paymentId && String(paymentId).trim())) {
      console.error('[Checkout] blocked: payment_status=paid requires non-empty payment_id', {
        userId: user!.id,
      })
      throw new Error(t('checkout.confirmFail'))
    }
    const addr = address.trim()
    if (!addr) throw new Error(t('checkout.addressError'))
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .insert({
        user_id: user!.id,
        delivery_address: addr,
        payment_method: payment,
        status: 'pending',
        total: totalWithShipping,
        shipping: SHIPPING,
        payment_status: paymentStatus,
        payment_id: paymentId ?? null,
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
    return oid
  }

  const onPaymentSuccess = async (result: PaymentResult) => {
    if (result.payment_status !== 'free') return
    setLoading(true)
    try {
      const oid = await createOrder('free', null)
      trackRosyHesitationCheckoutIfAttributed(user!.id)
      clear()
      setOrderId(oid)
      toast.success(t('checkout.success'))
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('checkout.confirmFail'))
    } finally {
      setLoading(false)
    }
  }

  const onPaymentPending = async () => {
    const addr = address.trim()
    if (!addr) {
      toast.error(t('checkout.addressError'))
      return
    }
    setLoading(true)
    try {
      const oid = await createOrder('pending', null)
      setPendingRefId(oid)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('checkout.createFail'))
    } finally {
      setLoading(false)
    }
  }

  if (orderId) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 pb-28">
        <div className="text-6xl">✅</div>
        <h2 className="mt-6 text-2xl font-extrabold">{t('checkout.doneTitle')}</h2>
        <p className="mt-2 text-rosera-gray">
          {t('checkout.orderId')} <span className="font-mono font-bold">{orderId.slice(0, 8)}</span>
        </p>
        <Button className="mt-8 rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]" onClick={() => nav('/home')}>
          {t('checkout.backHome')}
        </Button>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-rosera-light pb-28 dark:bg-rosera-dark">
      <header className="sticky top-0 z-10 border-b border-primary/10 bg-white px-4 py-4 dark:bg-card">
        <h1 className="text-xl font-extrabold">{t('checkout.title')}</h1>
      </header>
      <div className="mx-auto max-w-lg space-y-6 px-4 py-6">
        <div>
          <Label>{t('checkout.address')}</Label>
          <Input
            className="mt-2 rounded-2xl"
            placeholder={t('checkout.addressPh')}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <div>
          <Label>{t('checkout.payment')}</Label>
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
                <span className="font-bold">{t(opt.labelKey)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-primary/10 bg-white p-4 dark:bg-card">
          <p className="text-rosera-gray">
            {t('checkout.subtotal')} {formatPrice(subtotal)}
          </p>
          <p className="text-rosera-gray">
            {t('checkout.shipping')} {formatPrice(SHIPPING)}
          </p>
          <p className="mt-2 text-lg font-bold text-primary">
            {t('checkout.total')} {formatPrice(totalWithShipping)}
          </p>
        </div>
        <PaymentForm
          type="order"
          amount={totalWithShipping}
          description={t('checkout.orderDesc', { count: items.length })}
          refId={pendingRefId}
          checkoutPaymentMethod={payment}
          onSuccess={onPaymentSuccess}
          onPending={onPaymentPending}
          onError={(msg) => toast.error(msg)}
          disabled={loading}
        />
      </div>
    </div>
  )
}
