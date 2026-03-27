import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export default function Invite() {
  const { profile } = useAuth()
  const code = profile?.invite_code || 'ROSE2025'
  const link = `${window.location.origin}/auth?ref=${code}`

  const share = (type: 'wa' | 'sms' | 'copy') => {
    const text = `انضمي لروزيرا واحجزي صالونكِ المفضل! ${link}`
    if (type === 'copy') {
      void navigator.clipboard.writeText(link)
      toast.success('تم النسخ')
    } else if (type === 'wa') window.open(`https://wa.me/?text=${encodeURIComponent(text)}`)
    else window.location.href = `sms:?body=${encodeURIComponent(text)}`
  }

  return (
    <div className="min-h-dvh bg-rosera-light px-4 py-8 dark:bg-rosera-dark">
      <h1 className="text-center text-2xl font-bold">ادعي صديقاتكِ 👑</h1>
      <div className="mx-auto mt-10 max-w-md rounded-2xl border bg-card p-8 text-center dark:bg-card">
        <p className="text-rosera-gray">رمز الدعوة الشخصي</p>
        <p className="mt-2 text-3xl font-extrabold tracking-widest text-primary">{code}</p>
        <div className="mt-8 flex flex-col gap-3">
          <Button onClick={() => share('wa')}>واتساب</Button>
          <Button variant="secondary" onClick={() => share('sms')}>
            SMS
          </Button>
          <Button variant="outline" onClick={() => share('copy')}>
            نسخ الرابط
          </Button>
        </div>
        <p className="mt-8 text-sm text-rosera-gray">
          ادعي صديقاتكِ واحصلي على نقاط ومكافآت حصرية عند أول حجز لهن.
        </p>
      </div>
      <div className="mx-auto mt-8 max-w-md">
        <h2 className="font-bold">المدعوات</h2>
        <p className="mt-2 text-sm text-rosera-gray">لا توجد دعوات بعد — شاركي الرمز الآن!</p>
      </div>
    </div>
  )
}
