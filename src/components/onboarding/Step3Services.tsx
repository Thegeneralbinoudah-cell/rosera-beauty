import { useFieldArray, useFormContext, Controller } from 'react-hook-form'
import type { SalonOnboardingFormValues } from '@/lib/onboarding/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'

const CATS: { v: SalonOnboardingFormValues['services'][number]['category']; l: string }[] = [
  { v: 'hair', l: 'شعر' },
  { v: 'nails', l: 'أظافر' },
  { v: 'body', l: 'جسم' },
  { v: 'face', l: 'بشرة / وجه' },
  { v: 'bridal', l: 'عروس' },
]

export function Step3Services() {
  const { control, register, formState: { errors } } = useFormContext<SalonOnboardingFormValues>()
  const { fields, append, remove } = useFieldArray({ control, name: 'services' })

  return (
    <Card className="space-y-4 border-primary/10 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-foreground">الخدمات</h2>
          <p className="text-sm text-foreground">أضيفي الخدمات مع السعر والمدة</p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() =>
            append({
              id: crypto.randomUUID(),
              name_ar: '',
              category: 'hair',
              price: 0,
              duration_minutes: 30,
            })
          }
        >
          <Plus className="ms-1 h-4 w-4" />
          إضافة خدمة
        </Button>
      </div>

      <div className="space-y-4">
        {fields.map((field, i) => (
          <div key={field.id} className="space-y-3 rounded-2xl border border-primary/10 bg-muted/15 p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-bold text-primary">خدمة {i + 1}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-destructive"
                onClick={() => remove(i)}
                aria-label="حذف"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-2">
              <Label>اسم الخدمة</Label>
              <Input className="rounded-xl" dir="rtl" {...register(`services.${i}.name_ar`)} />
              {errors.services?.[i]?.name_ar?.message ? (
                <p className="text-sm text-destructive">{errors.services[i]?.name_ar?.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>التصنيف</Label>
              <input type="hidden" {...register(`services.${i}.id`)} />
              <Controller
                control={control}
                name={`services.${i}.category`}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="rounded-xl" dir="rtl">
                      <SelectValue placeholder="اختر التصنيف" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATS.map((c) => (
                        <SelectItem key={c.v} value={c.v}>
                          {c.l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>السعر (ر.س)</Label>
                <Input
                  type="number"
                  min={0}
                  step={1}
                  className="rounded-xl"
                  {...register(`services.${i}.price`, { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label>المدة (دقيقة)</Label>
                <Input
                  type="number"
                  min={5}
                  max={1440}
                  className="rounded-xl"
                  {...register(`services.${i}.duration_minutes`, { valueAsNumber: true })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {fields.length === 0 ? (
        <p className="text-center text-sm text-foreground">لا توجد خدمات بعد — اضغطي «إضافة خدمة»</p>
      ) : null}
      {errors.services?.message ? (
        <p className="text-sm text-destructive">{String(errors.services.message)}</p>
      ) : null}
      {errors.services?.root?.message ? (
        <p className="text-sm text-destructive">{String(errors.services.root.message)}</p>
      ) : null}
    </Card>
  )
}
