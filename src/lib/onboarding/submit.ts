import { supabase } from '@/lib/supabase'
import {
  fullOnboardingSchema,
  normalizeSalonOnboardingForm,
  type FullOnboardingInput,
} from '@/lib/onboarding/schema'
import type { SalonOnboardingFormValues } from '@/lib/onboarding/types'

function mapPayload(values: FullOnboardingInput) {
  return {
    basic: {
      name_ar: values.basic.name_ar,
      description_ar: values.basic.description_ar || '',
      category: values.basic.category,
      category_label: values.basic.category_label || '',
      city: values.basic.city,
      region: values.basic.region || '',
      address_ar: values.basic.address_ar,
      latitude: values.basic.latitude,
      longitude: values.basic.longitude,
      phone: values.basic.phone,
      whatsapp: values.basic.whatsapp || '',
    },
    hours: values.hours.map((h) => ({
      day: h.day,
      open: h.closed ? '' : (h.open || '').trim().slice(0, 5),
      close: h.closed ? '' : (h.close || '').trim().slice(0, 5),
      closed: h.closed,
    })),
    services: values.services.map((s) => ({
      name_ar: s.name_ar,
      category: s.category,
      price: s.price,
      duration_minutes: s.duration_minutes,
    })),
    team: values.team.map((t) => ({
      name_ar: t.name_ar,
      role_ar: t.role_ar || '',
      image_url: t.image_url || '',
    })),
    media: {
      cover_image: values.media.cover_image,
      logo: values.media.logo || '',
      portfolio: values.media.portfolio.map((p, i) => ({
        url: p.url,
        sort_order: p.sort_order ?? i,
      })),
      photos: values.media.photos.map((p, i) => ({
        url: p.url,
        sort_order: p.sort_order ?? i,
      })),
    },
    settings: {
      confirmation_type: values.settings.confirmation_type,
      booking_payment_mode: values.settings.booking_payment_mode,
    },
  }
}

export async function submitSalonOnboarding(values: SalonOnboardingFormValues): Promise<string> {
  const normalized = normalizeSalonOnboardingForm(values)
  const parsed = fullOnboardingSchema.safeParse(normalized)
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    throw new Error(first?.message ?? 'بيانات غير صالحة')
  }
  const payload = mapPayload(parsed.data)
  const { data, error } = await supabase.rpc('complete_salon_onboarding', {
    payload,
  })

  if (error) {
    const msg = error.message || ''
    if (msg.includes('name_ar_required')) throw new Error('اسم الصالون مطلوب')
    if (msg.includes('city_required')) throw new Error('المدينة مطلوبة')
    if (msg.includes('services_required')) throw new Error('أضيفي خدمة واحدة على الأقل')
    if (msg.includes('cover_required')) throw new Error('صورة الغلاف مطلوبة')
    if (msg.includes('not_authenticated')) throw new Error('سجّلي الدخول أولاً')
    throw new Error(msg || 'فشل حفظ بيانات الصالون')
  }

  if (typeof data !== 'string' || !data) {
    throw new Error('لم يُرجع الخادم معرف الصالون')
  }

  return data
}
