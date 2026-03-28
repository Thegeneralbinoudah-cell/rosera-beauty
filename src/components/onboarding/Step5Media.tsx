import { useFieldArray, useFormContext } from 'react-hook-form'
import type { SalonOnboardingFormValues } from '@/lib/onboarding/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Upload } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { uploadSalonImage } from '@/lib/onboarding/upload'
import { toast } from 'sonner'
import { useState } from 'react'

export function Step5Media() {
  const { user } = useAuth()
  const { control, register, watch, setValue, formState: { errors } } = useFormContext<SalonOnboardingFormValues>()
  const { fields: pf, append: appendPf, remove: removePf } = useFieldArray({ control, name: 'media.portfolio' })
  const { fields: ph, append: appendPh, remove: removePh } = useFieldArray({ control, name: 'media.photos' })
  const [busy, setBusy] = useState<string | null>(null)

  const cover = watch('media.cover_image')
  const logo = watch('media.logo')

  const runUpload = async (kind: string, file: File, bucket: 'salon-portfolio' | 'salon-photos', path: string) => {
    if (!user?.id) {
      toast.error('سجّلي الدخول لرفع الصور')
      return
    }
    setBusy(kind)
    try {
      const { url } = await uploadSalonImage(file, user.id, bucket, path)
      return url
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'فشل الرفع')
      return null
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4 border-primary/10 p-5 shadow-sm">
        <h2 className="text-lg font-extrabold text-foreground">صورة الغلاف والشعار</h2>
        <div className="space-y-2">
          <Label>غلاف الصالون (مطلوب)</Label>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-primary/20 bg-background px-4 py-2 text-sm font-semibold">
              <Upload className="h-4 w-4" />
              رفع غلاف
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                disabled={busy === 'cover'}
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  const url = await runUpload('cover', f, 'salon-portfolio', 'cover')
                  if (url) {
                    setValue('media.cover_image', url, { shouldValidate: true, shouldDirty: true })
                    toast.success('تم رفع الغلاف')
                  }
                }}
              />
            </label>
            {busy === 'cover' ? <span className="text-xs text-foreground">جاري الرفع…</span> : null}
          </div>
          <Input className="rounded-xl" dir="ltr" readOnly {...register('media.cover_image')} />
          {cover ? (
            <img src={cover} alt="" className="mt-2 max-h-40 w-full rounded-xl object-cover" />
          ) : null}
          {errors.media?.cover_image?.message ? (
            <p className="text-sm text-destructive">{errors.media.cover_image.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>شعار (اختياري)</Label>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-primary/20 bg-background px-4 py-2 text-sm font-semibold">
              <Upload className="h-4 w-4" />
              رفع شعار
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                disabled={busy === 'logo'}
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  const url = await runUpload('logo', f, 'salon-photos', 'logo')
                  if (url) {
                    setValue('media.logo', url, { shouldValidate: true, shouldDirty: true })
                    toast.success('تم رفع الشعار')
                  }
                }}
              />
            </label>
          </div>
          <Input className="rounded-xl" dir="ltr" readOnly {...register('media.logo')} />
          {logo ? <img src={logo} alt="" className="mt-2 h-24 w-24 rounded-xl object-contain" /> : null}
        </div>
      </Card>

      <Card className="space-y-4 border-primary/10 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-foreground">معرض الأعمال</h2>
            <p className="text-sm text-foreground">صور من أعمال الصالون</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() =>
              appendPf({
                id: crypto.randomUUID(),
                url: '',
                sort_order: pf.length,
              })
            }
          >
            <Plus className="ms-1 h-4 w-4" />
            سطر جديد
          </Button>
        </div>
        {pf.map((row, i) => (
          <div key={row.id} className="flex flex-col gap-2 rounded-xl border border-primary/10 p-3 sm:flex-row sm:items-end">
            <input type="hidden" {...register(`media.portfolio.${i}.id`)} />
            <div className="flex-1 space-y-2">
              <Label>رابط أو رفع</Label>
              <Input className="rounded-xl" dir="ltr" {...register(`media.portfolio.${i}.url`)} />
            </div>
            <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-primary/20 px-3 py-2 text-sm font-semibold">
              رفع
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  const url = await runUpload(`pf-${i}`, f, 'salon-portfolio', `portfolio-${i}`)
                  if (url) setValue(`media.portfolio.${i}.url`, url, { shouldValidate: true })
                }}
              />
            </label>
            <Button type="button" variant="ghost" size="icon" onClick={() => removePf(i)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </Card>

      <Card className="space-y-4 border-primary/10 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-foreground">صور إضافية</h2>
            <p className="text-sm text-foreground">للداخل، الاستقبال، إلخ</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={() =>
              appendPh({
                id: crypto.randomUUID(),
                url: '',
                sort_order: ph.length,
              })
            }
          >
            <Plus className="ms-1 h-4 w-4" />
            سطر جديد
          </Button>
        </div>
        {ph.map((row, i) => (
          <div key={row.id} className="flex flex-col gap-2 rounded-xl border border-primary/10 p-3 sm:flex-row sm:items-end">
            <input type="hidden" {...register(`media.photos.${i}.id`)} />
            <div className="flex-1 space-y-2">
              <Label>رابط أو رفع</Label>
              <Input className="rounded-xl" dir="ltr" {...register(`media.photos.${i}.url`)} />
            </div>
            <label className="inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-primary/20 px-3 py-2 text-sm font-semibold">
              رفع
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  const url = await runUpload(`ph-${i}`, f, 'salon-photos', `photo-${i}`)
                  if (url) setValue(`media.photos.${i}.url`, url, { shouldValidate: true })
                }}
              />
            </label>
            <Button type="button" variant="ghost" size="icon" onClick={() => removePh(i)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </Card>
    </div>
  )
}
