import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

export default function PaymentCallback() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'loading' | 'success' | 'fail'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const type = searchParams.get('type')
    const ref = searchParams.get('ref')
    const paymentId = searchParams.get('id')

    if (!type || !ref) {
      setStatus('fail')
      setMessage('رابط غير صالح')
      return
    }

    if (!paymentId) {
      setStatus('fail')
      setMessage('لم يتم استلام معرف الدفع')
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { type, ref, payment_id: paymentId },
        })
        if (cancelled) return
        const err = (data as { error?: string })?.error
        if (error || err) {
          setStatus('fail')
          setMessage(err || error?.message || 'فشل التحقق')
          return
        }
        setStatus('success')
      } catch (e) {
        if (!cancelled) {
          setStatus('fail')
          setMessage(e instanceof Error ? e.message : 'حدث خطأ')
        }
      }
    })()
    return () => { cancelled = true }
  }, [searchParams])

  if (status === 'loading') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg font-semibold">جاري التحقق من الدفع...</p>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle className="h-12 w-12 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-2xl font-extrabold text-foreground">تم الدفع بنجاح</h1>
        <p className="text-center text-muted-foreground">شكراً لكِ. تم تأكيد عملية الدفع.</p>
        <Button asChild className="rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]">
          <Link to="/home">العودة للرئيسية</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
        <XCircle className="h-12 w-12 text-destructive" />
      </div>
      <h1 className="text-2xl font-extrabold text-foreground">فشل الدفع</h1>
      <p className="text-center text-muted-foreground">{message}</p>
      <Button asChild variant="outline" className="rounded-2xl">
        <Link to="/home">العودة للرئيسية</Link>
      </Button>
    </div>
  )
}
