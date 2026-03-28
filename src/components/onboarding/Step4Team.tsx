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

export function Step4Team() {
  const { user } = useAuth()
  const { control, register, setValue, formState: { errors } } = useFormContext<SalonOnboardingFormValues>()
  const { fields, append, remove } = useFieldArray({ control, name: 'team' })
  const [uploading, setUploading] = useState<string | null>(null)

  const onPickPhoto = async (index: number, file: File | null) => {
    if (!file || !user?.id) {
      if (!user?.id) toast.error('سجّلي الدخول لرفع الصور')
      return
    }
    setUploading(`${index}`)
    try {
      const { url } = await uploadSalonImage(file, user.id, 'salon-photos', `team-${index}`)
      setValue(`team.${index}.image_url`, url, { shouldValidate: true, shouldDirty: true })
      toast.success('تم رفع الصورة')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'فشل الرفع')
    } finally {
      setUploading(null)
    }
  }

  return (
    <Card className="space-y-4 border-primary/10 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-foreground">الفريق</h2>
          <p className="text-sm text-foreground">اختياري — أخصائيات الصالون</p>
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
              role_ar: '',
              image_url: '',
            })
          }
        >
          <Plus className="ms-1 h-4 w-4" />
          عضو جديد
        </Button>
      </div>

      <div className="space-y-4">
        {fields.map((field, i) => (
          <div key={field.id} className="space-y-3 rounded-2xl border border-primary/10 bg-muted/15 p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="text-sm font-bold text-primary">عضو {i + 1}</span>
              <Button type="button" variant="ghost" size="icon" className="text-destructive" onClick={() => remove(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <input type="hidden" {...register(`team.${i}.id`)} />
            <div className="space-y-2">
              <Label>الاسم</Label>
              <Input className="rounded-xl" dir="rtl" {...register(`team.${i}.name_ar`)} />
              {errors.team?.[i]?.name_ar?.message ? (
                <p className="text-sm text-destructive">{errors.team[i]?.name_ar?.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>المسمى الوظيفي</Label>
              <Input className="rounded-xl" dir="rtl" placeholder="مثال: أخصائية شعر" {...register(`team.${i}.role_ar`)} />
            </div>
            <div className="space-y-2">
              <Label>صورة</Label>
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-primary/20 bg-background px-4 py-2 text-sm font-semibold">
                  <Upload className="h-4 w-4" />
                  رفع صورة
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    disabled={uploading === `${i}`}
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      void onPickPhoto(i, f ?? null)
                      e.target.value = ''
                    }}
                  />
                </label>
                {uploading === `${i}` ? <span className="text-xs text-foreground">جاري الرفع…</span> : null}
              </div>
              <Input className="rounded-xl" dir="ltr" readOnly placeholder="رابط الصورة" {...register(`team.${i}.image_url`)} />
            </div>
          </div>
        ))}
      </div>

      {fields.length === 0 ? (
        <p className="text-center text-sm text-foreground">يمكنكِ تخطي هذه الخطوة أو إضافة الفريق لاحقاً</p>
      ) : null}
    </Card>
  )
}
