export type ServiceCategory = 'hair' | 'nails' | 'body' | 'face' | 'bridal'

export type ConfirmationType = 'instant' | 'manual'

export type BookingPaymentMode = 'app' | 'venue' | 'both'

export type DayHour = {
  day: number
  open: string
  close: string
  closed: boolean
}

export type OnboardingService = {
  id: string
  name_ar: string
  category: ServiceCategory
  price: number
  duration_minutes: number
}

export type OnboardingTeamMember = {
  id: string
  name_ar: string
  role_ar: string
  image_url: string
}

export type MediaItem = {
  id: string
  url: string
  sort_order: number
}

export type SalonOnboardingFormValues = {
  basic: {
    name_ar: string
    description_ar: string
    category: string
    category_label: string
    city: string
    region: string
    address_ar: string
    latitude: number | null
    longitude: number | null
    phone: string
    whatsapp: string
  }
  hours: DayHour[]
  services: OnboardingService[]
  team: OnboardingTeamMember[]
  media: {
    cover_image: string
    logo: string
    portfolio: MediaItem[]
    photos: MediaItem[]
  }
  settings: {
    confirmation_type: ConfirmationType
    booking_payment_mode: BookingPaymentMode
  }
}
