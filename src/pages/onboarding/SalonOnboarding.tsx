import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Controller,
  FormProvider,
  type Resolver,
  useFieldArray,
  useForm,
  useFormContext,
} from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SalonMapPicker } from '@/components/onboarding/SalonMapPicker'
import { uploadSalonImage } from '@/lib/onboarding/upload'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'rosera_salon_clinic_onboarding_v2'

const DAY_LABELS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

const serviceCategoryZ = z.enum(['hair', 'nails', 'body', 'face', 'bridal', 'general', 'clinic'])

const formSchema = z.object({
  basic: z.object({
    name_ar: z.string().trim().min(2, 'اسم المنشأة مطلوب'),
    description_ar: z.string().optional().default(''),
    category: z.enum(['salon', 'clinic']),
    city: z.string().trim().min(1, 'المدينة مطلوبة'),
    region: z.string().optional().default(''),
    address: z.string().trim().min(3, 'العنوان مطلوب'),
    latitude: z.union([z.number(), z.null()]).refine((n) => n != null && Number.isFinite(n), 'حددي الموقع على الخريطة'),
    longitude: z.union([z.number(), z.null()]).refine((n) => n != null && Number.isFinite(n), 'حددي الموقع على الخريطة'),
    phone: z.string().trim().min(8, 'رقم الجوال مطلوب'),
    instagram: z.string().optional().default(''),
  }),
  hours: z
    .array(
      z.object({
        day: z.number().int().min(0).max(6),
        open: z.string(),
        close: z.string(),
        closed: z.boolean(),
      })
    )
    .length(7)
    .superRefine((rows, ctx) => {
      if (new Set(rows.map((r) => r.day)).size !== 7) ctx.addIssue({ code: 'custom', message: 'أيام ناقصة' })
      if (!rows.some((r) => !r.closed)) ctx.addIssue({ code: 'custom', message: 'فعّلي يوم عمل واحد على الأقل' })
      const t = /^\d{1,2}:\d{2}(:\d{2})?$/
      for (const r of rows) {
        if (r.closed) continue
        if (!t.test(r.open) || !t.test(r.close)) {
          ctx.addIssue({ code: 'custom', message: 'صيغة الوقت غير صالحة' })
          return
        }
      }
    }),
  services: z
    .array(
      z.object({
        id: z.string(),
        name_ar: z.string().trim().min(1, 'اسم الخدمة مطلوب'),
        category: serviceCategoryZ,
        price: z.coerce.number().min(0),
        duration_minutes: z.coerce.number().int().min(5).max(1440),
      })
    )
    .min(1, 'أضيفي خدمة واحدة على الأقل'),
  team: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      specialty: z.string(),
      image_url: z.string(),
    })
  ),
  media: z.object({
    cover: z.string().min(8, 'ارفعي صورة الغلاف'),
    logo: z.string().optional().default(''),
    gallery: z.array(z.object({ id: z.string(), url: z.string() })),
  }),
  settings: z.object({
    confirmation_type: z.enum(['instant', 'manual']),
    payment_mode: z.enum(['moyasar', 'cash', 'both'] as const),
  }),
})

type FormValues = z.infer<typeof formSchema>

function defaultHours() {
  return Array.from({ length: 7 }, (_, day) => ({
    day,
    open: '10:00',
    close: '22:00',
    closed: false,
  }))
}

function defaultValues(): FormValues {
  return {
    basic: {
      name_ar: '',
      description_ar: '',
      category: 'salon',
      city: '',
      region: '',
      address: '',
      latitude: null,
      longitude: null,
      phone: '',
      instagram: '',
    },
    hours: defaultHours(),
    services: [],
    team: [],
    media: { cover: '', logo: '', gallery: [] },
    settings: { confirmation_type: 'manual', payment_mode: 'moyasar' },
  }
}

function loadDraft(): Partial<FormValues> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<FormValues>
    return p && typeof p === 'object' ? p : null
  } catch {
    return null
  }
}

function mergeDraft(d: Partial<FormValues> | null): FormValues {
  const b = defaultValues()
  if (!d) return b
  return {
    basic: { ...b.basic, ...d.basic },
    hours: d.hours?.length === 7 ? d.hours.map((h, i) => ({ ...h, day: i })) : b.hours,
    services: Array.isArray(d.services) ? d.services : b.services,
    team: Array.isArray(d.team) ? d.team : b.team,
    media: { ...b.media, ...d.media, gallery: Array.isArray(d.media?.gallery) ? d.media!.gallery : b.media.gallery },
    settings: { ...b.settings, ...d.settings },
  }
}

function saveDraft(v: FormValues) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
  } catch {
    /* quota */
  }
}

function clearDraft() {
  localStorage.removeItem(STORAGE_KEY)
}

function buildOpeningHours(values: FormValues): Record<string, unknown> {
  const oh: Record<string, unknown> = {}
  for (const h of values.hours) {
    const key = String(h.day)
    if (h.closed) oh[key] = { closed: true }
    else oh[key] = { open: h.open.slice(0, 5), close: h.close.slice(0, 5) }
  }
  const team = values.team
    .filter((m) => m.name.trim().length > 0)
    .map((m) => ({
      name: m.name.trim(),
      specialty: (m.specialty ?? '').trim(),
      image_url: (m.image_url ?? '').trim(),
    }))
  oh._rosera_team = team
  oh._rosera_booking = {
    confirmation_type: values.settings.confirmation_type,
    payment_mode: values.settings.payment_mode,
    onboarded_at: new Date().toISOString(),
  }
  return oh
}

function mapPaymentForSalonSettings(mode: FormValues['settings']['payment_mode']): 'moyasar' | 'cash' {
  if (mode === 'cash') return 'cash'
  return 'moyasar'
}

async function persistOnboarding(userId: string, values: FormValues): Promise<string> {
  const opening_hours = buildOpeningHours(values)
  const gallery = values.media.gallery.map((g) => g.url.trim()).filter((u) => /^https?:\/\//i.test(u))
  const categoryLabel = values.basic.category === 'clinic' ? 'عيادة' : 'صالون'

  const { data: biz, error: eBiz } = await supabase
    .from('businesses')
    .insert({
      owner_id: userId,
      name_ar: values.basic.name_ar.trim(),
      description_ar: values.basic.description_ar?.trim() || null,
      category: values.basic.category,
      category_label: categoryLabel,
      city: values.basic.city.trim(),
      region: values.basic.region?.trim() || null,
      address_ar: values.basic.address.trim(),
      latitude: values.basic.latitude as number,
      longitude: values.basic.longitude as number,
      phone: values.basic.phone.trim(),
      whatsapp: values.basic.instagram?.trim() || null,
      cover_image: values.media.cover.trim(),
      logo: values.media.logo?.trim() || null,
      images: gallery.length ? gallery : null,
      opening_hours,
      is_active: true,
      is_verified: false,
      is_demo: false,
      source_type: 'manual',
    })
    .select('id')
    .single()

  if (eBiz || !biz?.id) {
    throw new Error(eBiz?.message ?? 'فشل إنشاء المنشأة')
  }

  const businessId = biz.id as string

  const rollback = async () => {
    await supabase.from('businesses').delete().eq('id', businessId)
  }

  try {
    const { error: eOwn } = await supabase.from('salon_owners').insert({
      user_id: userId,
      salon_id: businessId,
      role: 'owner',
    })
    if (eOwn) throw new Error(eOwn.message)

    const serviceRows = values.services.map((s) => ({
      business_id: businessId,
      name_ar: s.name_ar.trim(),
      category: s.category,
      price: s.price,
      duration_minutes: s.duration_minutes,
      is_active: true,
      is_demo: false,
      source_type: 'manual' as const,
    }))

    const { error: eSvc } = await supabase.from('services').insert(serviceRows)
    if (eSvc) throw new Error(eSvc.message)

    const { error: eSet } = await supabase.from('salon_settings').insert({
      business_id: businessId,
      payment_method: mapPaymentForSalonSettings(values.settings.payment_mode),
    })
    if (eSet) throw new Error(eSet.message)

    return businessId
  } catch (e) {
    await rollback()
    throw e instanceof Error ? e : new Error('فشل إكمال التسجيل')
  }
}

const STEPS = [
  'البيانات الأساسية',
  'أوقات العمل',
  'الخدمات',
  'الفريق',
  'الوسائط',
  'الإعدادات',
  'المراجعة',
]

function StepBasic() {
  const { register, watch, setValue, formState } = useFormContext<FormValues>()
  const lat = watch('basic.latitude')
  const lng = watch('basic.longitude')
  const err = formState.errors.basic

  return (
    <div className="space-y-5">
      <Card className="space-y-4 border-primary/10 p-5 shadow-sm">
        <h2 className="text-lg font-extrabold">بيانات الصالون / العيادة</h2>
        <div className="space-y-2">
          <Label>الاسم</Label>
          <Input className="rounded-xl" dir="rtl" {...register('basic.name_ar')} />
          {err?.name_ar && <p className="text-sm text-destructive">{err.name_ar.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>الوصف</Label>
          <textarea className="min-h-[80px] w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" dir="rtl" {...register('basic.description_ar')} />
        </div>
        <div className="space-y-2">
          <Label>النوع</Label>
          <Select
            value={watch('basic.category')}
            onValueChange={(v) => setValue('basic.category', v as 'salon' | 'clinic', { shouldValidate: true })}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="salon">صالون</SelectItem>
              <SelectItem value="clinic">عيادة</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>المدينة</Label>
            <Input className="rounded-xl" dir="rtl" {...register('basic.city')} />
            {err?.city && <p className="text-sm text-destructive">{err.city.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>المنطقة</Label>
            <Input className="rounded-xl" dir="rtl" {...register('basic.region')} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>العنوان</Label>
          <Input className="rounded-xl" dir="rtl" {...register('basic.address')} />
          {err?.address && <p className="text-sm text-destructive">{err.address.message}</p>}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>جوال</Label>
            <Input className="rounded-xl" dir="rtl" type="tel" {...register('basic.phone')} />
            {err?.phone && <p className="text-sm text-destructive">{err.phone.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>إنستغرام (يُحفظ في حقل واتساب بالنظام)</Label>
            <Input className="rounded-xl" dir="ltr" placeholder="https://instagram.com/..." {...register('basic.instagram')} />
          </div>
        </div>
      </Card>
      <Card className="space-y-3 border-primary/10 p-5 shadow-sm">
        <h2 className="text-lg font-extrabold">الموقع</h2>
        <SalonMapPicker
          latitude={lat ?? null}
          longitude={lng ?? null}
          onLocationChange={(la, ln) => {
            setValue('basic.latitude', la, { shouldValidate: true, shouldDirty: true })
            setValue('basic.longitude', ln, { shouldValidate: true, shouldDirty: true })
          }}
        />
        {(err?.latitude?.message || err?.longitude?.message) && (
          <p className="text-sm text-destructive">{err.latitude?.message ?? err.longitude?.message}</p>
        )}
      </Card>
    </div>
  )
}

function StepHours() {
  const { register, watch, setValue, formState } = useFormContext<FormValues>()
  const hours = watch('hours')
  const msg = formState.errors.hours && (formState.errors.hours as { message?: string }).message

  useEffect(() => {
    for (let i = 0; i < 7; i++) {
      setValue(`hours.${i}.day`, i, { shouldValidate: false, shouldDirty: false })
    }
  }, [setValue])

  return (
    <Card className="border-primary/10 p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-extrabold">أوقات العمل</h2>
      <div className="space-y-4">
        {hours.map((_, i) => (
          <div key={i} className="rounded-2xl border border-primary/10 bg-muted/15 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-bold">{DAY_LABELS[i]}</span>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground">مغلق</Label>
                <Switch checked={hours[i]?.closed ?? false} onCheckedChange={(v) => setValue(`hours.${i}.closed`, v)} />
              </div>
            </div>
            {!hours[i]?.closed ? (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">من</Label>
                  <Input type="time" className="mt-1 rounded-xl" {...register(`hours.${i}.open`)} />
                </div>
                <div>
                  <Label className="text-xs">إلى</Label>
                  <Input type="time" className="mt-1 rounded-xl" {...register(`hours.${i}.close`)} />
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">مغلق</p>
            )}
          </div>
        ))}
      </div>
      {msg ? <p className="mt-3 text-sm text-destructive">{String(msg)}</p> : null}
    </Card>
  )
}

const SVC_CAT: { v: z.infer<typeof formSchema>['services'][number]['category']; l: string }[] = [
  { v: 'hair', l: 'شعر' },
  { v: 'nails', l: 'أظافر' },
  { v: 'body', l: 'جسم' },
  { v: 'face', l: 'بشرة' },
  { v: 'bridal', l: 'عروس' },
  { v: 'clinic', l: 'عيادة' },
  { v: 'general', l: 'عام' },
]

function StepServices() {
  const { control, register } = useFormContext<FormValues>()
  const { fields, append, remove } = useFieldArray({ control, name: 'services' })

  return (
    <Card className="space-y-4 border-primary/10 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">الخدمات</h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-xl"
          onClick={() =>
            append({
              id: crypto.randomUUID(),
              name_ar: '',
              category: 'general',
              price: 0,
              duration_minutes: 30,
            })
          }
        >
          <Plus className="ms-1 h-4 w-4" />
          إضافة
        </Button>
      </div>
      {fields.map((f, i) => (
        <div key={f.id} className="space-y-3 rounded-2xl border border-primary/10 p-4">
          <div className="flex justify-between">
            <span className="text-sm font-bold text-primary">خدمة {i + 1}</span>
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <input type="hidden" {...register(`services.${i}.id`)} />
          <div className="space-y-2">
            <Label>الاسم</Label>
            <Input className="rounded-xl" dir="rtl" {...register(`services.${i}.name_ar`)} />
          </div>
          <div className="space-y-2">
            <Label>التصنيف</Label>
            <Controller
              control={control}
              name={`services.${i}.category`}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="اختر التصنيف" />
                  </SelectTrigger>
                  <SelectContent>
                    {SVC_CAT.map((c) => (
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
            <div>
              <Label>السعر</Label>
              <Input type="number" className="rounded-xl" {...register(`services.${i}.price`, { valueAsNumber: true })} />
            </div>
            <div>
              <Label>المدة (د)</Label>
              <Input type="number" className="rounded-xl" {...register(`services.${i}.duration_minutes`, { valueAsNumber: true })} />
            </div>
          </div>
        </div>
      ))}
      {fields.length === 0 ? <p className="text-center text-sm text-muted-foreground">أضيفي خدمة</p> : null}
    </Card>
  )
}

function StepTeam() {
  const { control, register, setValue } = useFormContext<FormValues>()
  const { fields, append, remove } = useFieldArray({ control, name: 'team' })
  const { user } = useAuth()
  const [busy, setBusy] = useState<string | null>(null)

  const upload = async (idx: number, file: File | null) => {
    if (!file || !user?.id) return
    setBusy(`${idx}`)
    try {
      const { url } = await uploadSalonImage(file, user.id, 'salon-photos', `staff-${idx}`)
      setValue(`team.${idx}.image_url`, url, { shouldValidate: true, shouldDirty: true })
      toast.success('تم الرفع')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'فشل الرفع')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card className="space-y-4 border-primary/10 p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-extrabold">الفريق</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          جدول <code className="rounded bg-muted px-1">providers</code> في Rosera مخصص لمزوّدي المنتجات وليس موظفي الصالون؛
          يتم حفظ أعضاء الفريق ضمن <code className="rounded bg-muted px-1">opening_hours._rosera_team</code> مع المنشأة.
        </p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="rounded-xl"
        onClick={() => append({ id: crypto.randomUUID(), name: '', specialty: '', image_url: '' })}
      >
        <Plus className="ms-1 h-4 w-4" />
        عضو
      </Button>
      {fields.map((f, i) => (
        <div key={f.id} className="space-y-3 rounded-2xl border border-primary/10 p-4">
          <div className="flex justify-between">
            <span className="font-bold text-primary">#{i + 1}</span>
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
          <input type="hidden" {...register(`team.${i}.id`)} />
          <div className="space-y-2">
            <Label>الاسم</Label>
            <Input className="rounded-xl" dir="rtl" {...register(`team.${i}.name`)} />
          </div>
          <div className="space-y-2">
            <Label>التخصص</Label>
            <Input className="rounded-xl" dir="rtl" {...register(`team.${i}.specialty`)} />
          </div>
          <div className="space-y-2">
            <Label>صورة</Label>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold">
              رفع
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={busy === `${i}`}
                onChange={(e) => {
                  void upload(i, e.target.files?.[0] ?? null)
                  e.target.value = ''
                }}
              />
            </label>
            <Input className="rounded-xl" dir="ltr" {...register(`team.${i}.image_url`)} />
          </div>
        </div>
      ))}
    </Card>
  )
}

function StepMedia() {
  const { register, watch, setValue, control, formState } = useFormContext<FormValues>()
  const { fields, append, remove } = useFieldArray({ control, name: 'media.gallery' })
  const { user } = useAuth()
  const [busy, setBusy] = useState<string | null>(null)
  const cover = watch('media.cover')
  const logo = watch('media.logo')
  const err = formState.errors.media

  const up = async (kind: string, file: File | null, bucket: 'salon-portfolio' | 'salon-photos', path: string, setter: (u: string) => void) => {
    if (!file || !user?.id) return
    setBusy(kind)
    try {
      const { url } = await uploadSalonImage(file, user.id, bucket, path)
      setter(url)
      toast.success('تم')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'فشل')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-4 border-primary/10 p-5 shadow-sm">
        <h2 className="text-lg font-extrabold">الغلاف والشعار</h2>
        <div className="space-y-2">
          <Label>غلاف (مطلوب)</Label>
          <label className="inline-flex cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold">
            رفع غلاف
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={busy === 'cover'}
              onChange={(e) => {
                void up('cover', e.target.files?.[0] ?? null, 'salon-portfolio', 'cover', (u) =>
                  setValue('media.cover', u, { shouldValidate: true })
                )
                e.target.value = ''
              }}
            />
          </label>
          <Input className="rounded-xl" dir="ltr" readOnly {...register('media.cover')} />
          {cover ? <img src={cover} alt="" className="max-h-40 w-full rounded-xl object-cover" /> : null}
          {err?.cover && <p className="text-sm text-destructive">{err.cover.message}</p>}
        </div>
        <div className="space-y-2">
          <Label>شعار</Label>
          <label className="inline-flex cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold">
            رفع شعار
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={busy === 'logo'}
              onChange={(e) => {
                void up('logo', e.target.files?.[0] ?? null, 'salon-photos', 'logo', (u) =>
                  setValue('media.logo', u, { shouldValidate: true })
                )
                e.target.value = ''
              }}
            />
          </label>
          <Input className="rounded-xl" dir="ltr" readOnly {...register('media.logo')} />
          {logo ? <img src={logo} alt="" className="h-20 w-20 rounded-xl object-contain" /> : null}
        </div>
      </Card>
      <Card className="space-y-3 border-primary/10 p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-extrabold">معرض (images)</h2>
          <Button type="button" size="sm" variant="outline" onClick={() => append({ id: crypto.randomUUID(), url: '' })}>
            <Plus className="ms-1 h-4 w-4" />
            صورة
          </Button>
        </div>
        {fields.map((row, i) => (
          <div key={row.id} className="flex flex-col gap-2 rounded-xl border border-primary/10 p-3 sm:flex-row sm:items-end">
            <input type="hidden" {...register(`media.gallery.${i}.id`)} />
            <Input className="flex-1 rounded-xl" dir="ltr" {...register(`media.gallery.${i}.url`)} />
            <label className="shrink-0 cursor-pointer rounded-xl border px-3 py-2 text-sm font-semibold">
              رفع
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (!file || !user?.id) return
                  void (async () => {
                    setBusy(`g${i}`)
                    try {
                      const { url } = await uploadSalonImage(file, user.id, 'salon-portfolio', `g-${i}`)
                      setValue(`media.gallery.${i}.url`, url)
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'فشل')
                    } finally {
                      setBusy(null)
                    }
                  })()
                }}
              />
            </label>
            <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </Card>
    </div>
  )
}

function StepSettings() {
  const { watch, setValue } = useFormContext<FormValues>()
  const conf = watch('settings.confirmation_type')
  const pay = watch('settings.payment_mode')

  return (
    <div className="space-y-4">
      <Card className="space-y-4 border-primary/10 p-5 shadow-sm">
        <h2 className="text-lg font-extrabold">تأكيد الحجز</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {(
            [
              ['instant', 'فوري', 'تسجيل مباشر بعد الدفع أو التأكيد'],
              ['manual', 'يدوي', 'مراجعة الطلبات قبل الاعتماد'],
            ] as const
          ).map(([v, t, d]) => (
            <button
              key={v}
              type="button"
              onClick={() => setValue('settings.confirmation_type', v)}
              className={cn(
                'rounded-2xl border-2 p-4 text-start',
                conf === v ? 'border-primary bg-primary/5' : 'border-primary/10 bg-muted/10'
              )}
            >
              <p className="font-extrabold">{t}</p>
              <p className="mt-1 text-xs text-muted-foreground">{d}</p>
            </button>
          ))}
        </div>
      </Card>
      <Card className="space-y-4 border-primary/10 p-5 shadow-sm">
        <h2 className="text-lg font-extrabold">الدفع (salon_settings)</h2>
        <p className="text-xs text-muted-foreground">يُحفظ كـ payment_method: moyasar أو cash (وضع «كلاهما» يفعّل Moyasar للتطبيق).</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {(
            [
              ['moyasar', 'عبر التطبيق', 'Moyasar'],
              ['cash', 'في المنشأة', 'كاش'],
              ['both', 'كلاهما', 'Moyasar كافتراضي'],
            ] as const
          ).map(([v, t, sub]) => (
            <button
              key={v}
              type="button"
              onClick={() => setValue('settings.payment_mode', v)}
              className={cn(
                'rounded-2xl border-2 p-4 text-start',
                pay === v ? 'border-primary bg-primary/5' : 'border-primary/10 bg-muted/10'
              )}
            >
              <p className="font-extrabold">{t}</p>
              <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}

function StepReview() {
  const { watch } = useFormContext<FormValues>()
  const v = watch()
  return (
    <div className="space-y-4 text-sm">
      <Card className="border-primary/10 p-5 shadow-sm">
        <h2 className="text-lg font-extrabold">ملخص</h2>
        <p className="mt-2">
          <span className="text-muted-foreground">الاسم:</span> {v.basic.name_ar}
        </p>
        <p>
          <span className="text-muted-foreground">النوع:</span> {v.basic.category === 'clinic' ? 'عيادة' : 'صالون'}
        </p>
        <p>
          <span className="text-muted-foreground">المدينة:</span> {v.basic.city}
        </p>
        <p>
          <span className="text-muted-foreground">خدمات:</span> {v.services.length}
        </p>
        <p>
          <span className="text-muted-foreground">الفريق:</span> {v.team.filter((m) => m.name.trim()).length} (في JSON)
        </p>
        <p>
          <span className="text-muted-foreground">الدفع:</span> {v.settings.payment_mode}
        </p>
      </Card>
    </div>
  )
}

function renderStep(n: number) {
  switch (n) {
    case 1:
      return <StepBasic />
    case 2:
      return <StepHours />
    case 3:
      return <StepServices />
    case 4:
      return <StepTeam />
    case 5:
      return <StepMedia />
    case 6:
      return <StepSettings />
    case 7:
      return <StepReview />
    default:
      return null
  }
}

export default function SalonOnboarding() {
  const nav = useNavigate()
  const { user, loading } = useAuth()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const saveT = useRef<number | undefined>(undefined)

  const merged = useMemo(() => mergeDraft(loadDraft()), [])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema) as Resolver<FormValues>,
    defaultValues: merged,
    mode: 'onChange',
  })

  const { watch, trigger, handleSubmit } = form

  useEffect(() => {
    if (!loading && !user) nav('/auth', { replace: true })
  }, [loading, user, nav])

  useEffect(() => {
    const sub = watch((vals) => {
      window.clearTimeout(saveT.current)
      saveT.current = window.setTimeout(() => saveDraft(vals as FormValues), 400)
    })
    return () => {
      sub.unsubscribe()
      window.clearTimeout(saveT.current)
    }
  }, [watch])

  const fieldsForStep = (s: number): Parameters<typeof trigger>[0] => {
    if (s === 1) return ['basic']
    if (s === 2) return ['hours']
    if (s === 3) return ['services']
    if (s === 4) return ['team']
    if (s === 5) return ['media']
    if (s === 6) return ['settings']
    return undefined
  }

  const submitForm = handleSubmit(async (vals) => {
    if (!user?.id) return
    if (!isSupabaseConfigured) {
      toast.error('اضبطي Supabase')
      return
    }
    setSubmitting(true)
    try {
      const id = await persistOnboarding(user.id, vals)
      clearDraft()
      toast.success('تم إنشاء المنشأة')
      nav(`/salon/${id}`, { replace: true })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'فشل الحفظ')
    } finally {
      setSubmitting(false)
    }
  })

  const next = async () => {
    if (!isSupabaseConfigured) {
      toast.error('اضبطي Supabase')
      return
    }
    const ok = await trigger(fieldsForStep(step))
    if (!ok) {
      toast.error('راجعي الحقول المظللة')
      return
    }
    if (step < 7) setStep((x) => x + 1)
    else await submitForm()
  }

  const progress = Math.round((step / 7) * 100)

  if (loading || !user) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-sm text-muted-foreground">جاري التحميل…</p>
      </div>
    )
  }

  return (
    <FormProvider {...form}>
      <div
        className="min-h-dvh bg-gradient-to-b from-[#fff5fb] via-white to-[#fce4ec]/35 pb-32 dark:from-rosera-dark dark:via-rosera-dark dark:to-rosera-dark"
        dir="rtl"
      >
        <header className="sticky top-0 z-40 border-b border-primary/10 bg-white/90 px-4 py-4 backdrop-blur-xl dark:bg-rosera-dark/90">
          <div className="mx-auto max-w-lg">
            <button
              type="button"
              className="mb-2 flex items-center gap-1 text-sm font-semibold text-primary"
              onClick={() => (step > 1 ? setStep((s) => s - 1) : nav(-1))}
            >
              <ChevronRight className="h-4 w-4 rotate-180" />
              {step > 1 ? 'رجوع' : 'إغلاق'}
            </button>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold text-primary">خطوة {step} من 7</p>
                <h1 className="text-lg font-extrabold">{STEPS[step - 1]}</h1>
              </div>
              <span className="text-sm font-bold text-muted-foreground">{progress}%</span>
            </div>
            <Progress value={progress} className="mt-3 h-2" />
          </div>
        </header>

        <main className="mx-auto max-w-lg px-4 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.2 }}
            >
              {renderStep(step)}
            </motion.div>
          </AnimatePresence>
        </main>

        <div className="fixed bottom-0 inset-x-0 z-50 border-t border-primary/10 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-md dark:bg-rosera-dark/95">
          <div className="mx-auto flex max-w-lg gap-3">
            <Button
              type="button"
              variant="outline"
              className="min-w-[96px] rounded-2xl"
              disabled={step <= 1 || submitting}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
            >
              السابق
            </Button>
            <Button
              type="button"
              className="h-12 flex-1 rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C] font-extrabold"
              disabled={submitting}
              onClick={() => void next()}
            >
              {step === 7 ? (submitting ? 'جاري الحفظ…' : 'تأكيد وإنشاء') : 'التالي'}
            </Button>
          </div>
        </div>
      </div>
    </FormProvider>
  )
}
