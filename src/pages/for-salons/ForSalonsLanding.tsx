import { Link, useNavigate } from 'react-router-dom'
import { Sparkles, Eye, CalendarDays, LayoutDashboard, Gift, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { getMySalonBusinessId } from '@/lib/salonOwner'
import { POST_AUTH_PATH_KEY, openSalonAcquisitionWhatsApp } from '@/lib/salonAcquisition'
import { ROSERA_LOGO_SRC } from '@/lib/branding'
import { toast } from 'sonner'

export default function ForSalonsLanding() {
  const nav = useNavigate()
  const { user, loading } = useAuth()

  const goRegister = async () => {
    if (!user) {
      try {
        sessionStorage.setItem(POST_AUTH_PATH_KEY, '/for-salons/onboard')
      } catch {
        /* ignore */
      }
      nav('/auth')
      return
    }
    try {
      const bid = await getMySalonBusinessId(user.id)
      if (bid) {
        nav('/salon/dashboard', { replace: true })
        return
      }
      nav('/for-salons/onboard')
    } catch (e) {
      console.error(e)
      toast.error('تعذر التحقق من حسابك')
      nav('/for-salons/onboard')
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-background via-white to-primary-subtle/30 dark:from-background dark:via-background dark:to-primary/10" dir="rtl">
      <header className="border-b border-primary/15 bg-card/80 backdrop-blur-md border-border">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link to="/home" className="flex items-center gap-2">
            <img src={ROSERA_LOGO_SRC} alt="" className="h-9 w-9 rounded-xl object-contain" />
            <span className="text-sm font-bold text-primary dark:text-primary">روزيرا للصالونات</span>
          </Link>
          <Button variant="ghost" size="sm" className="text-primary" asChild>
            <Link to="/home">دخول التطبيق</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-10 pb-28">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-subtle to-primary/35 text-primary shadow-lg shadow-primary/20">
            <Sparkles className="h-7 w-7" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-extrabold leading-snug text-foreground sm:text-3xl">
            زيدي حجوزاتك بسهولة ✨
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-foreground">
            انضمي لآلاف العميلات اللي يدورن صالونات موثوقة على روزيرا — تسجيل سريع وظهور فوري.
          </p>
        </div>

        <section className="mt-10 space-y-3">
          {[
            {
              icon: Eye,
              title: 'ظهور للعملاء',
              desc: 'صفحة صالونك في التطبيق والبحث والخريطة.',
            },
            {
              icon: CalendarDays,
              title: 'حجوزات يومية',
              desc: 'استقبلي طلبات الحجز وتنبيهات من عميلات جديدة.',
            },
            {
              icon: LayoutDashboard,
              title: 'إدارة سهلة',
              desc: 'لوحة تحكم للحجوزات والخدمات من الجوال.',
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex gap-4 rounded-2xl border border-primary/15 bg-card p-4 shadow-sm border-border"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary dark:bg-primary/15 dark:text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-foreground">{title}</p>
                <p className="mt-0.5 text-sm text-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-8 rounded-2xl border-2 border-dashed border-primary/35 bg-gradient-to-l from-primary-subtle/90 to-white p-5 dark:border-primary/30 dark:from-primary/15 dark:to-card">
          <div className="flex items-start gap-3">
            <Gift className="mt-0.5 h-6 w-6 shrink-0 text-primary" />
            <div>
              <p className="font-extrabold text-primary dark:text-primary">عرض الترحيب</p>
              <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                <li>• أول شهر اشتراك باقة أساسية — مجاني 🎁</li>
                <li>• بدون عمولة منصة على الحجوزات في أول أسبوع</li>
              </ul>
              <p className="mt-2 text-xs text-foreground">
                التفاصيل الكاملة بعد إكمال التسجيل من صفحة الاشتراك.
              </p>
            </div>
          </div>
        </section>

        <div className="mt-10 flex flex-col gap-3">
          <Button
            type="button"
            size="lg"
            disabled={loading}
            className="h-12 w-full rounded-2xl gradient-primary text-base font-bold text-white shadow-md"
            onClick={() => void goRegister()}
          >
            سجلي صالونك
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-12 w-full rounded-2xl border-green-600/30 font-semibold text-green-800 hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-950/30"
            onClick={() => openSalonAcquisitionWhatsApp()}
          >
            <MessageCircle className="ms-2 h-5 w-5" />
            تواصل معنا واتساب
          </Button>
        </div>

        <p className="mt-8 text-center text-xs text-foreground">
          بالمتابعة أنتِ توافقين على{' '}
          <Link to="/terms" className="font-semibold text-primary underline-offset-2 hover:underline">
            الشروط
          </Link>{' '}
          و{' '}
          <Link to="/privacy" className="font-semibold text-primary underline-offset-2 hover:underline">
            الخصوصية
          </Link>
          .
        </p>
      </main>
    </div>
  )
}
