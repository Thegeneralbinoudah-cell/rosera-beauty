import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { getMySalonBusinessId } from '@/lib/salonOwner'
import {
  SALON_FEATURED_AD_SAR_PER_DAY,
  featuredAdTotalSar,
} from '@/lib/salonAds'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import PaymentForm from '@/components/payment/PaymentForm'
import { Loader2, Megaphone } from 'lucide-react'
import { toast } from 'sonner'

type AdRow = {
  id: string
  salon_id: string
  budget: number
  day_count: number
  start_date: string | null
  end_date: string | null
  clicks: number
  status: string
  created_at: string
}

const PAYMENT_MODE_FREE = ((import.meta.env.VITE_PAYMENT_MODE as string) || '').trim().toLowerCase() === 'free'

export default function SalonFeaturedAds() {
  const { user } = useAuth()
  const [salonId, setSalonId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState<AdRow | null>(null)
  const [dayCount, setDayCount] = useState(7)
  const [pendingAdId, setPendingAdId] = useState<string | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
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
      void supabase.rpc('expire_salon_ads').then(
        () => {},
        () => {}
      )
      const t = new Date().toISOString().slice(0, 10)
      const { data, error } = await supabase
        .from('salon_ads')
        .select('id, salon_id, budget, day_count, start_date, end_date, clicks, status, created_at')
        .eq('salon_id', bid)
        .eq('status', 'active')
        .lte('start_date', t)
        .gte('end_date', t)
        .order('end_date', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      setActive((data as AdRow | null) ?? null)
    } catch (e) {
      console.error(e)
      toast.error('تعذر تحميل الإعلانات')
      setActive(null)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const startCheckout = async () => {
    if (!user?.id || !salonId) {
      toast.error('لم يُعثر على صالون مرتبط بحسابك')
      return
    }
    const days = Math.max(1, Math.min(60, Math.floor(Number(dayCount) || 1)))
    setBusy(true)
    setCheckoutOpen(false)
    setPendingAdId(null)
    try {
      await supabase.from('salon_ads').update({ status: 'cancelled' }).eq('salon_id', salonId).eq('status', 'pending_payment')

      const budget = featuredAdTotalSar(days)
      const { data: row, error } = await supabase
        .from('salon_ads')
        .insert({
          salon_id: salonId,
          budget,
          day_count: days,
          status: 'pending_payment',
        })
        .select('id')
        .single()

      if (error) throw error
      const id = (row as { id: string }).id
      setPendingAdId(id)
      setCheckoutOpen(true)
    } catch (e) {
      console.error(e)
      toast.error('تعذر بدء الدفع')
    } finally {
      setBusy(false)
    }
  }

  const finalizePayment = async (paymentId: string) => {
    if (!pendingAdId || !user?.id || !salonId) return
    try {
      const { data, error } = await supabase.functions.invoke('verify-payment', {
        body: { type: 'salon_ad', ref: pendingAdId, payment_id: paymentId },
      })
      const err = (data as { error?: string })?.error
      if (error || err) {
        toast.error(err || error?.message || 'فشل التحقق من الدفع')
        return
      }
      toast.success('تم تفعيل الإعلان المميز')
      setCheckoutOpen(false)
      setPendingAdId(null)
      await refresh()
    } catch (e) {
      console.error(e)
      toast.error(e instanceof Error ? e.message : 'حدث خطأ')
    }
  }

  const onPaymentSuccess = async (result: { payment_status: 'free' | 'paid'; payment_id?: string }) => {
    if (result.payment_status === 'free' && PAYMENT_MODE_FREE) {
      await finalizePayment(`free_${pendingAdId}`)
      return
    }
    if (result.payment_id) {
      await finalizePayment(result.payment_id)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        جاري التحميل…
      </div>
    )
  }

  if (!salonId) {
    return (
      <Card className="border-primary/15 p-6 text-center">
        <p className="font-semibold text-foreground">لا يوجد صالون مرتبط بهذا الحساب</p>
        <p className="mt-2 text-sm text-foreground">أكملي ربط الصالون من الإدارة أو التسجيل.</p>
      </Card>
    )
  }

  const days = Math.max(1, Math.min(60, Math.floor(Number(dayCount) || 1)))
  const totalSar = featuredAdTotalSar(days)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-foreground">
          <Megaphone className="h-7 w-7 text-primary" />
          إعلانات مميزة
        </h1>
        <p className="mt-1 text-sm text-foreground">
          ظهور أوضح في القوائم والبحث مع شارة «إعلان» — {SALON_FEATURED_AD_SAR_PER_DAY} ر.س لكل يوم عبر Moyasar
        </p>
      </div>

      <Card className="border-primary/20 bg-gradient-to-br from-primary-subtle/90 to-white p-5 dark:border-border dark:from-primary/15 dark:to-card">
        <h2 className="text-lg font-bold text-foreground">الحملة النشطة</h2>
        {active ? (
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="gradient-primary">إعلان</Badge>
              <span className="text-foreground">
                {Number(active.budget).toFixed(0)} ر.س · {active.day_count} يوم
              </span>
            </div>
            <p className="text-foreground">
              حتى{' '}
              <span className="font-semibold tabular-nums">
                {active.end_date
                  ? new Date(active.end_date + 'T12:00:00.000Z').toLocaleDateString('ar-SA', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : '—'}
              </span>
            </p>
            <p className="text-foreground">نقرات الملف: {active.clicks ?? 0}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-foreground">لا يوجد إعلان مفعّل حالياً — ابدئي بحملة جديدة أدناه</p>
        )}
      </Card>

      <Card className="border-primary/15 p-5">
        <h2 className="text-lg font-bold text-foreground">حملة جديدة</h2>
        <p className="mt-1 text-sm text-foreground">من 1 إلى 60 يوماً — يبدأ العدّ من يوم تأكيد الدفع</p>
        <div className="mt-4 space-y-2">
          <Label htmlFor="ad-days">عدد الأيام</Label>
          <Input
            id="ad-days"
            type="number"
            min={1}
            max={60}
            className="max-w-[10rem] rounded-xl"
            value={dayCount}
            onChange={(e) => setDayCount(Number(e.target.value))}
          />
        </div>
        <p className="mt-3 text-xl font-black tabular-nums text-primary dark:text-primary">
          الإجمالي: {totalSar.toFixed(0)} ر.س
        </p>
        <Button
          className="mt-4 w-full rounded-xl gradient-primary text-primary-foreground hover:opacity-95"
          disabled={busy || checkoutOpen}
          onClick={() => void startCheckout()}
        >
          متابعة للدفع
        </Button>
      </Card>

      {checkoutOpen && pendingAdId ? (
        <Card className="border-primary/20 p-5 dark:border-border">
          <h2 className="text-lg font-bold text-foreground">إتمام الدفع</h2>
          <p className="mt-1 text-sm text-foreground">
            إعلان مميز — {days} يوم — {totalSar.toFixed(0)} ر.س
          </p>
          <div className="mt-4">
            <PaymentForm
              type="salon_ad"
              amount={totalSar}
              description={`Rosera إعلان مميز — ${days} يوم`}
              refId={pendingAdId}
              disabled={busy}
              onSuccess={(r) => void onPaymentSuccess(r)}
              onError={(m) => toast.error(m)}
            />
          </div>
          <Button variant="ghost" className="mt-3 w-full" onClick={() => (setCheckoutOpen(false), setPendingAdId(null))}>
            إلغاء
          </Button>
        </Card>
      ) : null}
    </div>
  )
}
