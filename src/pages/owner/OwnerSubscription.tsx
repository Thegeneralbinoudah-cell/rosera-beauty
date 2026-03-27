import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getMySalonBusinessId } from '@/lib/salonOwner'
import {
  SALON_SUBSCRIPTION_PLANS,
  planPriceSar,
  type SalonSubscriptionPlan,
} from '@/lib/salonSubscriptionPlans'
import { trackEvent } from '@/lib/analytics'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import PaymentForm from '@/components/payment/PaymentForm'
import { setSalonSubscriptionAutoRenew } from '@/lib/salonSubscriptionAutoRenew'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

type SubRow = {
  id: string
  salon_id: string
  plan: string
  status: string
  price: number
  starts_at: string | null
  expires_at: string | null
  created_at: string
  auto_renew: boolean
  payment_method_id: string | null
  last_payment_at: string | null
  billing_provider: string | null
  stripe_subscription_id: string | null
}

const PAYMENT_MODE_FREE = ((import.meta.env.VITE_PAYMENT_MODE as string) || '').trim().toLowerCase() === 'free'

export default function OwnerSubscription() {
  const { user } = useAuth()
  const [salonId, setSalonId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<SubRow | null>(null)
  const [checkoutPlan, setCheckoutPlan] = useState<SalonSubscriptionPlan | null>(null)
  const [pendingSubId, setPendingSubId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const bid = await getMySalonBusinessId(user.id)
      setSalonId(bid)
      if (!bid) {
        setActive(null)
        return
      }
      void supabase.rpc('expire_salon_subscriptions').then(
        () => {},
        () => {}
      )
      const now = new Date().toISOString()
      const { data, error } = await supabase
        .from('salon_subscriptions')
        .select(
          'id, salon_id, plan, status, price, starts_at, expires_at, created_at, auto_renew, payment_method_id, last_payment_at, billing_provider, stripe_subscription_id'
        )
        .eq('salon_id', bid)
        .eq('status', 'active')
        .gt('expires_at', now)
        .order('expires_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      setActive((data as SubRow | null) ?? null)
    } catch (e) {
      console.error(e)
      toast.error('تعذر تحميل الاشتراك')
      setActive(null)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const setAutoRenew = async (enabled: boolean) => {
    try {
      await setSalonSubscriptionAutoRenew(
        supabase,
        enabled,
        active?.billing_provider,
        active?.stripe_subscription_id
      )
      setActive((prev) => (prev ? { ...prev, auto_renew: enabled } : prev))
      toast.success(enabled ? 'تم تفعيل التجديد التلقائي' : 'تم إيقاف التجديد التلقائي')
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'تعذر حفظ الإعداد')
    }
  }

  const startCheckout = async (plan: SalonSubscriptionPlan) => {
    if (!user?.id || !salonId) {
      toast.error('لم يُعثر على صالون مرتبط بحسابك')
      return
    }
    setBusy(true)
    setCheckoutPlan(null)
    setPendingSubId(null)
    try {
      await supabase
        .from('salon_subscriptions')
        .update({ status: 'cancelled' })
        .eq('salon_id', salonId)
        .eq('status', 'pending_payment')

      const price = planPriceSar(plan)
      const { data: row, error } = await supabase
        .from('salon_subscriptions')
        .insert({
          salon_id: salonId,
          plan,
          status: 'pending_payment',
          price,
        })
        .select('id')
        .single()

      if (error) throw error
      const id = (row as { id: string }).id
      setPendingSubId(id)
      setCheckoutPlan(plan)
    } catch (e) {
      console.error(e)
      toast.error('تعذر بدء الدفع')
    } finally {
      setBusy(false)
    }
  }

  const finalizePayment = async (paymentId: string) => {
    if (!pendingSubId || !checkoutPlan || !user?.id || !salonId) return
    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { type: 'subscription', ref: pendingSubId, payment_id: paymentId },
      })
      const err = (data as { error?: string })?.error
      if (error || err) {
        toast.error(err || error?.message || 'فشل التحقق من الدفع')
        return
      }
      const body = data as { previous_plan?: string | null; plan?: string }
      const prev = body.previous_plan
      const isUpgrade =
        typeof prev === 'string' && prev !== checkoutPlan && ['basic', 'pro', 'premium'].includes(prev)

      trackEvent({
        event_type: isUpgrade ? 'subscription_upgraded' : 'subscription_started',
        entity_type: 'business',
        entity_id: salonId,
        user_id: user.id,
        metadata: {
          plan: checkoutPlan,
          ...(typeof prev === 'string' ? { from_plan: prev } : {}),
          subscription_id: pendingSubId,
        },
      })

      toast.success('تم تفعيل الاشتراك بنجاح ✨')
      setCheckoutPlan(null)
      setPendingSubId(null)
      await refresh()
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'حدث خطأ')
    }
  }

  const onPaymentSuccess = async (result: { payment_status: 'free' | 'paid'; payment_id?: string }) => {
    if (result.payment_status === 'free' && PAYMENT_MODE_FREE) {
      await finalizePayment(`free_${pendingSubId}`)
      return
    }
    if (result.payment_id) {
      await finalizePayment(result.payment_id)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        جاري التحميل…
      </div>
    )
  }

  if (!salonId) {
    return (
      <Card className="border-primary/15 p-6 text-center">
        <p className="font-semibold text-foreground">لا يوجد صالون مرتبط بهذا الحساب</p>
        <p className="mt-2 text-sm text-muted-foreground">أكملي ربط الصالون من الإدارة أو التسجيل.</p>
      </Card>
    )
  }

  const plans: SalonSubscriptionPlan[] = ['basic', 'pro', 'premium']

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-foreground">اشتراك الصالون</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          خطط شهرية — تفعيل فوري بعد الدفع عبر Moyasar. عند الدفع بالبطاقة يُحفظ رمز آمن للتجديد الشهري (يتطلب تفعيل التوكن لدى Moyasar).
        </p>
        {active?.billing_provider === 'stripe' ? (
          <p className="mt-3 rounded-xl border border-amber-500/40 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-950 dark:bg-amber-950/30 dark:text-amber-100">
            يرجى إكمال الدفع من لوحة Stripe أو إدارة التجديد من هناك.
          </p>
        ) : null}
      </div>

      <Card className="border-primary/15 p-5">
        <h2 className="text-lg font-bold text-foreground">الخطة الحالية</h2>
        {active ? (
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="gradient-primary">
                {SALON_SUBSCRIPTION_PLANS[active.plan as SalonSubscriptionPlan]?.labelAr ?? active.plan}
              </Badge>
              <span className="text-muted-foreground">{Number(active.price).toFixed(0)} ر.س / شهر</span>
            </div>
            <p className="text-foreground">
              ينتهي في{' '}
              <span className="font-semibold tabular-nums">
                {active.expires_at
                  ? new Date(active.expires_at).toLocaleDateString('ar-SA', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : '—'}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {active.billing_provider === 'stripe'
                ? 'الفوترة عبر Stripe — التجديد الشهري تلقائي ما لم توقفي التجديد من الأسفل.'
                : `بطاقة محفوظة للتجديد: ${active.payment_method_id ? 'نعم ✓' : 'لا — أعيدي الاشتراك بالبطاقة لتفعيل التجديد'}`}
            </p>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/10 bg-muted/30 px-3 py-3">
              <div>
                <Label htmlFor="auto-renew-sub" className="text-sm font-bold text-foreground">
                  تجديد تلقائي
                </Label>
                <p className="text-xs text-muted-foreground">
                  {active.billing_provider === 'stripe'
                    ? 'يُزامَن مع Stripe — الإيقاف يعني عدم التجديد بعد نهاية الفترة الحالية'
                    : 'خصم شهري تلقائي قبل انتهاء الاشتراك'}
                </p>
              </div>
              <Switch
                id="auto-renew-sub"
                checked={active.auto_renew}
                onCheckedChange={(v) => void setAutoRenew(v)}
              />
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">لا يوجد اشتراك نشط — اختاري خطة للبدء</p>
        )}
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        {plans.map((plan) => {
          const cfg = SALON_SUBSCRIPTION_PLANS[plan]
          const isCurrent = active?.plan === plan
          return (
            <Card key={plan} className="flex flex-col border-primary/15 p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-extrabold text-foreground">
                  {cfg.labelAr}
                  {plan === 'premium' ? ' ⭐' : ''}
                </h3>
                {isCurrent ? (
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    الحالية
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-2xl font-black tabular-nums text-primary">{cfg.priceSar} ر.س</p>
              <p className="mt-2 flex-1 text-xs text-muted-foreground">{cfg.hintAr}</p>
              <Button
                className="mt-4 w-full rounded-xl gradient-primary"
                disabled={busy || isCurrent}
                onClick={() => void startCheckout(plan)}
              >
                {isCurrent ? 'مفعّل' : 'ترقية / اشتراك'}
              </Button>
            </Card>
          )
        })}
      </div>

      {checkoutPlan && pendingSubId ? (
        <Card className="border-primary/20 p-5">
          <h2 className="text-lg font-bold text-foreground">إتمام الدفع</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {SALON_SUBSCRIPTION_PLANS[checkoutPlan].labelAr} — {planPriceSar(checkoutPlan)} ر.س
          </p>
          <div className="mt-4">
            <PaymentForm
              type="subscription"
              amount={planPriceSar(checkoutPlan)}
              description={`Rosera اشتراك صالون — ${SALON_SUBSCRIPTION_PLANS[checkoutPlan].labelAr}`}
              refId={pendingSubId}
              disabled={busy}
              onSuccess={(r) => void onPaymentSuccess(r)}
              onError={(m) => toast.error(m)}
            />
          </div>
          <Button variant="ghost" className="mt-3 w-full" onClick={() => (setCheckoutPlan(null), setPendingSubId(null))}>
            إلغاء
          </Button>
        </Card>
      ) : null}
    </div>
  )
}
