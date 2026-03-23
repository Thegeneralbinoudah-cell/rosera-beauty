import { z } from 'zod'
import type { SalonOnboardingFormValues } from '@/lib/onboarding/types'

const serviceCategoryZ = z.enum(['hair', 'nails', 'body', 'face', 'bridal'])

export const dayHourSchema = z.object({
  day: z.number().int().min(0).max(6),
  open: z.string().min(1, { message: 'وقت الفتح مطلوب' }),
  close: z.string().min(1, { message: 'وقت الإغلاق مطلوب' }),
  closed: z.boolean(),
})

export const basicSchema = z.object({
  name_ar: z.string().trim().min(2, { message: 'اسم الصالون مطلوب (حرفان على الأقل)' }),
  description_ar: z.string().optional().default(''),
  category: z.string().trim().min(1, { message: 'التصنيف مطلوب' }),
  category_label: z.string().optional().default(''),
  city: z.string().trim().min(1, { message: 'المدينة مطلوبة' }),
  region: z.string().optional().default(''),
  address_ar: z.string().trim().min(3, { message: 'العنوان مطلوب' }),
  latitude: z
    .union([z.number(), z.null()])
    .refine((n): n is number => n !== null && Number.isFinite(n) && Math.abs(n) <= 90, {
      message: 'حددي الموقع على الخريطة',
    }),
  longitude: z
    .union([z.number(), z.null()])
    .refine((n): n is number => n !== null && Number.isFinite(n) && Math.abs(n) <= 180, {
      message: 'حددي الموقع على الخريطة',
    }),
  phone: z
    .string()
    .trim()
    .min(8, { message: 'رقم الجوال مطلوب' })
    .regex(/^[\d٠-٩+\s-]{8,}$/u, { message: 'صيغة رقم الجوال غير صالحة' }),
  whatsapp: z.string().optional().default(''),
})

export const hoursSchema = z
  .array(dayHourSchema)
  .length(7, { message: 'يجب ضبط أوقات الأسبوع كاملة' })
  .superRefine((rows, ctx) => {
    const days = new Set(rows.map((r) => r.day))
    if (days.size !== 7) {
      ctx.addIssue({ code: 'custom', message: 'أيام مكررة أو ناقصة' })
    }
    const hasOpen = rows.some((r) => !r.closed)
    if (!hasOpen) {
      ctx.addIssue({ code: 'custom', message: 'فعّلي يوم عمل واحداً على الأقل' })
    }
    for (const r of rows) {
      if (r.closed) continue
      const tRe = /^\d{1,2}:\d{2}(:\d{2})?$/
      if (!tRe.test(r.open) || !tRe.test(r.close)) {
        ctx.addIssue({ code: 'custom', message: 'استخدمي صيغة HH:MM للأوقات' })
        return
      }
    }
  })

export const serviceRowSchema = z.object({
  id: z.string(),
  name_ar: z.string().trim().min(1, { message: 'اسم الخدمة مطلوب' }),
  category: serviceCategoryZ,
  price: z.coerce.number().min(0, { message: 'السعر يجب أن يكون صفراً أو أكثر' }),
  duration_minutes: z.coerce
    .number()
    .int()
    .min(5, { message: 'المدة 5 دقائق على الأقل' })
    .max(1440, { message: 'المدة كبيرة جداً' }),
})

export const servicesSchema = z.array(serviceRowSchema).min(1, { message: 'أضيفي خدمة واحدة على الأقل' })

export const teamMemberInputSchema = z.object({
  id: z.string(),
  name_ar: z.string(),
  role_ar: z.string().optional().default(''),
  image_url: z.string().optional().default(''),
})

export const teamStepSchema = z.object({
  team: z.array(teamMemberInputSchema).superRefine((rows, ctx) => {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      const name = (r?.name_ar ?? '').trim()
      const extra = (r?.role_ar ?? '').trim().length > 0 || (r?.image_url ?? '').trim().length > 0
      if (!name && extra) {
        ctx.addIssue({
          code: 'custom',
          path: ['team', i, 'name_ar'],
          message: 'أدخلي اسم العضو أو احذفي الصف',
        })
      }
    }
  }),
})

const mediaItemSchema = z.object({
  id: z.string(),
  url: z.string().optional().default(''),
  sort_order: z.number().int(),
})

export const mediaSchema = z
  .object({
    cover_image: z
      .string()
      .trim()
      .min(8, { message: 'ارفعي صورة الغلاف' })
      .refine((s) => /^https?:\/\//i.test(s), { message: 'ارفعي صورة الغلاف' }),
    logo: z.string().optional().default(''),
    portfolio: z.array(mediaItemSchema),
    photos: z.array(mediaItemSchema),
  })
  .superRefine((m, ctx) => {
    if (m.logo && m.logo.trim().length > 4 && !/^https?:\/\//i.test(m.logo.trim())) {
      ctx.addIssue({ code: 'custom', path: ['logo'], message: 'رابط الشعار غير صالح' })
    }
    for (let i = 0; i < m.portfolio.length; i++) {
      const u = (m.portfolio[i]?.url ?? '').trim()
      if (u && !/^https?:\/\//i.test(u)) {
        ctx.addIssue({ code: 'custom', path: ['portfolio', i, 'url'], message: 'رابط غير صالح' })
      }
    }
    for (let i = 0; i < m.photos.length; i++) {
      const u = (m.photos[i]?.url ?? '').trim()
      if (u && !/^https?:\/\//i.test(u)) {
        ctx.addIssue({ code: 'custom', path: ['photos', i, 'url'], message: 'رابط غير صالح' })
      }
    }
  })

export const settingsSchema = z.object({
  confirmation_type: z.enum(['instant', 'manual']),
  booking_payment_mode: z.enum(['app', 'venue', 'both']),
})

const finalTeamRowSchema = z.object({
  id: z.string(),
  name_ar: z.string().trim().min(1, { message: 'اسم العضو مطلوب' }),
  role_ar: z.string(),
  image_url: z.string(),
})

export const fullOnboardingSchema = z.object({
  basic: basicSchema,
  hours: hoursSchema,
  services: servicesSchema,
  team: z.array(finalTeamRowSchema),
  media: mediaSchema,
  settings: settingsSchema,
})

export type FullOnboardingInput = z.infer<typeof fullOnboardingSchema>

export function normalizeSalonOnboardingForm(values: SalonOnboardingFormValues): FullOnboardingInput {
  const out = {
    basic: {
      ...values.basic,
      description_ar: values.basic.description_ar ?? '',
      category_label: values.basic.category_label ?? '',
      region: values.basic.region ?? '',
      whatsapp: values.basic.whatsapp ?? '',
      latitude: values.basic.latitude,
      longitude: values.basic.longitude,
    },
    hours: values.hours,
    services: values.services.map((s) => ({
      id: s.id,
      name_ar: s.name_ar,
      category: s.category,
      price: Number(s.price),
      duration_minutes: Number(s.duration_minutes),
    })),
    team: values.team
      .filter((t) => t.name_ar.trim().length > 0)
      .map((t) => ({
        id: t.id,
        name_ar: t.name_ar.trim(),
        role_ar: (t.role_ar ?? '').trim(),
        image_url: (t.image_url ?? '').trim(),
      })),
    media: {
      cover_image: values.media.cover_image.trim(),
      logo: (values.media.logo ?? '').trim(),
      portfolio: values.media.portfolio
        .filter((p) => /^https?:\/\//i.test((p.url ?? '').trim()))
        .map((p, i) => ({
          id: p.id,
          url: (p.url ?? '').trim(),
          sort_order: typeof p.sort_order === 'number' ? p.sort_order : i,
        })),
      photos: values.media.photos
        .filter((p) => /^https?:\/\//i.test((p.url ?? '').trim()))
        .map((p, i) => ({
          id: p.id,
          url: (p.url ?? '').trim(),
          sort_order: typeof p.sort_order === 'number' ? p.sort_order : i,
        })),
    },
    settings: values.settings,
  }
  return out as FullOnboardingInput
}

export function validateOnboardingStep(
  step: number,
  values: SalonOnboardingFormValues
): { ok: true } | { ok: false; message: string } {
  const blocks: Record<number, z.ZodType<unknown>> = {
    1: z.object({ basic: basicSchema }),
    2: z.object({ hours: hoursSchema }),
    3: z.object({ services: servicesSchema }),
    4: teamStepSchema,
    5: z.object({ media: mediaSchema }),
    6: z.object({ settings: settingsSchema }),
  }
  if (step === 7) {
    const normalized = normalizeSalonOnboardingForm(values)
    const r = fullOnboardingSchema.safeParse(normalized)
    if (r.success) return { ok: true }
    const first = r.error.issues[0]
    return { ok: false, message: first?.message ?? 'تحققي من البيانات' }
  }
  const schema = blocks[step]
  if (!schema) return { ok: true }
  const slice =
    step === 1
      ? { basic: values.basic }
      : step === 2
        ? { hours: values.hours }
        : step === 3
          ? { services: values.services }
          : step === 4
            ? { team: values.team }
            : step === 5
              ? { media: values.media }
              : { settings: values.settings }
  const r = schema.safeParse(slice)
  if (r.success) return { ok: true }
  const first = r.error.issues[0]
  return { ok: false, message: first?.message ?? 'تحققي من الحقول' }
}
