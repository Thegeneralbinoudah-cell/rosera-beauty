import { useFormContext } from 'react-hook-form'
import type { SalonOnboardingFormValues } from '@/lib/onboarding/types'
import { DAY_LABELS_AR } from '@/lib/onboarding/defaults'
import { Card } from '@/components/ui/card'

export function Step7Review() {
  const { watch } = useFormContext<SalonOnboardingFormValues>()
  const basic = watch('basic')
  const hours = watch('hours')
  const services = watch('services')
  const team = watch('team')
  const media = watch('media')
  const settings = watch('settings')

  return (
    <div className="space-y-4">
      <Card className="border-primary/10 p-5 shadow-sm">
        <h2 className="text-lg font-extrabold text-foreground">مراجعة البيانات</h2>
        <p className="mt-1 text-sm text-muted-foreground">تأكدي من صحة المعلومات قبل الإرسال</p>
      </Card>

      <Card className="space-y-2 border-primary/10 p-5 text-sm shadow-sm">
        <h3 className="font-extrabold text-primary">الأساسيات</h3>
        <p>
          <span className="text-muted-foreground">الاسم:</span> {basic.name_ar}
        </p>
        <p>
          <span className="text-muted-foreground">المدينة:</span> {basic.city} — {basic.region}
        </p>
        <p>
          <span className="text-muted-foreground">الجوال:</span> {basic.phone}
        </p>
        <p>
          <span className="text-muted-foreground">الموقع:</span>{' '}
          {basic.latitude != null && basic.longitude != null
            ? `${basic.latitude.toFixed(5)}, ${basic.longitude.toFixed(5)}`
            : '—'}
        </p>
      </Card>

      <Card className="space-y-2 border-primary/10 p-5 text-sm shadow-sm">
        <h3 className="font-extrabold text-primary">الأوقات</h3>
        <ul className="space-y-1">
          {hours.map((h, i) => (
            <li key={i}>
              {DAY_LABELS_AR[h.day] ?? i}:{' '}
              {h.closed ? <span className="text-muted-foreground">مغلق</span> : `${h.open} – ${h.close}`}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-2 border-primary/10 p-5 text-sm shadow-sm">
        <h3 className="font-extrabold text-primary">الخدمات ({services.length})</h3>
        <ul className="list-disc space-y-1 pe-5">
          {services.map((s) => (
            <li key={s.id}>
              {s.name_ar} — {s.category} — {s.price} ر.س — {s.duration_minutes} د
            </li>
          ))}
        </ul>
      </Card>

      <Card className="space-y-2 border-primary/10 p-5 text-sm shadow-sm">
        <h3 className="font-extrabold text-primary">الفريق ({team.filter((t) => t.name_ar.trim()).length})</h3>
        {team.filter((t) => t.name_ar.trim()).length === 0 ? (
          <p className="text-muted-foreground">لم يُضف فريق</p>
        ) : (
          <ul className="list-disc space-y-1 pe-5">
            {team
              .filter((t) => t.name_ar.trim())
              .map((t) => (
                <li key={t.id}>
                  {t.name_ar}
                  {t.role_ar ? ` — ${t.role_ar}` : ''}
                </li>
              ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2 border-primary/10 p-5 text-sm shadow-sm">
        <h3 className="font-extrabold text-primary">الوسائط</h3>
        <p>غلاف: {media.cover_image ? 'مرفوع ✓' : '—'}</p>
        <p>شعار: {media.logo ? 'مرفوع ✓' : '—'}</p>
        <p>معرض: {media.portfolio.filter((p) => p.url?.trim()).length} صور</p>
        <p>صور إضافية: {media.photos.filter((p) => p.url?.trim()).length}</p>
      </Card>

      <Card className="space-y-2 border-primary/10 p-5 text-sm shadow-sm">
        <h3 className="font-extrabold text-primary">الإعدادات</h3>
        <p>
          التأكيد: {settings.confirmation_type === 'instant' ? 'فوري' : 'يدوي'}
        </p>
        <p>
          الدفع:{' '}
          {settings.booking_payment_mode === 'app'
            ? 'التطبيق'
            : settings.booking_payment_mode === 'venue'
              ? 'الصالون'
              : 'كلاهما'}
        </p>
      </Card>
    </div>
  )
}
