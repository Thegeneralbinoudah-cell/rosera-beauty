import { useFormContext, Controller } from 'react-hook-form'
import type { SalonOnboardingFormValues } from '@/lib/onboarding/types'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

const CONFIRM_OPTS: { v: SalonOnboardingFormValues['settings']['confirmation_type']; l: string; d: string }[] = [
  { v: 'instant', l: 'تأكيد فوري', d: 'تُسجَّل الحجوزات مباشرة عند الدفع أو التأكيد' },
  { v: 'manual', l: 'تأكيد يدوي', d: 'تراجعين الطلبات قبل اعتمادها' },
]

const PAY_OPTS: { v: SalonOnboardingFormValues['settings']['booking_payment_mode']; l: string; d: string }[] = [
  { v: 'app', l: 'عبر التطبيق', d: 'Moyasar / دفع إلكتروني في Rosera' },
  { v: 'venue', l: 'في الصالون', d: 'الدفع عند الزيارة فقط' },
  { v: 'both', l: 'الخياران', d: 'توفير الدفع أونلاين أو في الموقع حسب إعدادات العرض' },
]

export function Step6Settings() {
  const { control } = useFormContext<SalonOnboardingFormValues>()

  return (
    <div className="space-y-4">
      <Card className="space-y-4 border-primary/10 p-5 shadow-sm">
        <h2 className="text-lg font-extrabold text-foreground">تأكيد الحجوزات</h2>
        <p className="text-sm text-foreground">كيف تودّين معالجة طلبات الحجز الجديدة؟</p>
        <Controller
          control={control}
          name="settings.confirmation_type"
          render={({ field }) => (
            <div className="grid gap-3 sm:grid-cols-2">
              {CONFIRM_OPTS.map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => field.onChange(o.v)}
                  className={cn(
                    'rounded-2xl border-2 p-4 text-start transition-colors',
                    field.value === o.v
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-primary/10 bg-muted/20 hover:border-primary/25'
                  )}
                >
                  <p className="font-extrabold text-foreground">{o.l}</p>
                  <p className="mt-1 text-xs text-foreground">{o.d}</p>
                </button>
              ))}
            </div>
          )}
        />
      </Card>

      <Card className="space-y-4 border-primary/10 p-5 shadow-sm">
        <h2 className="text-lg font-extrabold text-foreground">الدفع</h2>
        <p className="text-sm text-foreground">تفضيلات الدفع الافتراضية للحجوزات</p>
        <Label className="text-foreground">طريقة الدفع</Label>
        <Controller
          control={control}
          name="settings.booking_payment_mode"
          render={({ field }) => (
            <div className="grid gap-3 sm:grid-cols-3">
              {PAY_OPTS.map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => field.onChange(o.v)}
                  className={cn(
                    'rounded-2xl border-2 p-4 text-start transition-colors',
                    field.value === o.v
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-primary/10 bg-muted/20 hover:border-primary/25'
                  )}
                >
                  <p className="font-extrabold text-foreground">{o.l}</p>
                  <p className="mt-1 text-xs text-foreground">{o.d}</p>
                </button>
              ))}
            </div>
          )}
        />
      </Card>
    </div>
  )
}
