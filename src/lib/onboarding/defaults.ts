import type { DayHour, SalonOnboardingFormValues } from '@/lib/onboarding/types'

export const DAY_LABELS_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']

export function defaultHours(): DayHour[] {
  return Array.from({ length: 7 }, (_, day) => ({
    day,
    open: '10:00',
    close: '22:00',
    closed: false,
  }))
}

export function defaultSalonOnboardingValues(): SalonOnboardingFormValues {
  return {
    basic: {
      name_ar: '',
      description_ar: '',
      category: 'salon',
      category_label: 'صالون تجميل',
      city: '',
      region: 'المنطقة الشرقية',
      address_ar: '',
      latitude: null,
      longitude: null,
      phone: '',
      whatsapp: '',
    },
    hours: defaultHours(),
    services: [],
    team: [],
    media: {
      cover_image: '',
      logo: '',
      portfolio: [],
      photos: [],
    },
    settings: {
      confirmation_type: 'manual',
      booking_payment_mode: 'app',
    },
  }
}
