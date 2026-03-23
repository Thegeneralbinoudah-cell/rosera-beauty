import { useFormContext } from 'react-hook-form'
import type { SalonOnboardingFormValues } from '@/lib/onboarding/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { SalonMapPicker } from '@/components/onboarding/SalonMapPicker'

export function Step1BasicInfo() {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext<SalonOnboardingFormValues>()
  const lat = watch('basic.latitude')
  const lng = watch('basic.longitude')

  return (
    <div className="space-y-5">
      <Card className="space-y-4 border-primary/10 p-5 shadow-sm">
        <h2 className="text-lg font-extrabold text-foreground">البيانات الأساسية</h2>
        <div className="space-y-2">
          <Label htmlFor="name_ar">اسم الصالون</Label>
          <Input
            id="name_ar"
            className="rounded-xl"
            dir="rtl"
            {...register('basic.name_ar')}
          />
          {errors.basic?.name_ar?.message ? (
            <p className="text-sm text-destructive">{errors.basic.name_ar.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="description_ar">وصف مختصر</Label>
          <textarea
            id="description_ar"
            className="min-h-[88px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
            dir="rtl"
            {...register('basic.description_ar')}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="category">نوع النشاط</Label>
            <Input id="category" className="rounded-xl" dir="rtl" {...register('basic.category')} />
            {errors.basic?.category?.message ? (
              <p className="text-sm text-destructive">{errors.basic.category.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="category_label">التصنيف الظاهر</Label>
            <Input id="category_label" className="rounded-xl" dir="rtl" {...register('basic.category_label')} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="city">المدينة</Label>
            <Input id="city" className="rounded-xl" dir="rtl" {...register('basic.city')} />
            {errors.basic?.city?.message ? (
              <p className="text-sm text-destructive">{errors.basic.city.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="region">المنطقة</Label>
            <Input id="region" className="rounded-xl" dir="rtl" {...register('basic.region')} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="address_ar">العنوان التفصيلي</Label>
          <Input id="address_ar" className="rounded-xl" dir="rtl" {...register('basic.address_ar')} />
          {errors.basic?.address_ar?.message ? (
            <p className="text-sm text-destructive">{errors.basic.address_ar.message}</p>
          ) : null}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone">جوال الصالون</Label>
            <Input id="phone" className="rounded-xl" dir="rtl" type="tel" {...register('basic.phone')} />
            {errors.basic?.phone?.message ? (
              <p className="text-sm text-destructive">{errors.basic.phone.message}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="whatsapp">واتساب (اختياري)</Label>
            <Input id="whatsapp" className="rounded-xl" dir="rtl" type="tel" {...register('basic.whatsapp')} />
          </div>
        </div>
      </Card>

      <Card className="space-y-3 border-primary/10 p-5 shadow-sm">
        <h2 className="text-lg font-extrabold text-foreground">الموقع على الخريطة</h2>
        <SalonMapPicker
          latitude={lat ?? null}
          longitude={lng ?? null}
          onLocationChange={(la, ln) => {
            setValue('basic.latitude', la, { shouldValidate: true, shouldDirty: true })
            setValue('basic.longitude', ln, { shouldValidate: true, shouldDirty: true })
          }}
        />
        {errors.basic?.latitude?.message ? (
          <p className="text-sm text-destructive">{errors.basic.latitude.message}</p>
        ) : null}
        {errors.basic?.longitude?.message ? (
          <p className="text-sm text-destructive">{errors.basic.longitude.message}</p>
        ) : null}
      </Card>
    </div>
  )
}
