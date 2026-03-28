import { useFormContext } from 'react-hook-form'
import type { SalonOnboardingFormValues } from '@/lib/onboarding/types'
import { DAY_LABELS_AR } from '@/lib/onboarding/defaults'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

export function Step2WorkingHours() {
  const { register, watch, setValue, formState: { errors } } = useFormContext<SalonOnboardingFormValues>()
  const hours = watch('hours')

  return (
    <div className="space-y-4">
      <Card className="border-primary/10 p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-extrabold text-foreground">أوقات العمل</h2>
        <p className="mb-4 text-sm text-foreground">فعّلي أيام العمل واضبطي الفتح والإغلاق</p>
        <div className="space-y-4">
          {hours.map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-2xl border border-primary/10 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center justify-between gap-3 sm:min-w-[140px]">
                <span className="font-bold text-foreground">{DAY_LABELS_AR[i]}</span>
                <div className="flex items-center gap-2">
                  <Label htmlFor={`closed-${i}`} className="text-xs text-foreground">
                    مغلق
                  </Label>
                  <Switch
                    id={`closed-${i}`}
                    checked={hours[i]?.closed ?? false}
                    onCheckedChange={(v) => setValue(`hours.${i}.closed`, v)}
                  />
                </div>
              </div>
              {!hours[i]?.closed ? (
                <div className="grid flex-1 grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">من</Label>
                    <Input type="time" className="rounded-xl" {...register(`hours.${i}.open`)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">إلى</Label>
                    <Input type="time" className="rounded-xl" {...register(`hours.${i}.close`)} />
                  </div>
                </div>
              ) : (
                <p className="text-sm text-foreground">مغلق طوال اليوم</p>
              )}
            </div>
          ))}
        </div>
        {errors.hours?.message ? (
          <p className="mt-3 text-sm text-destructive">{String(errors.hours.message)}</p>
        ) : null}
        {errors.hours?.root?.message ? (
          <p className="mt-3 text-sm text-destructive">{String(errors.hours.root.message)}</p>
        ) : null}
      </Card>
    </div>
  )
}
