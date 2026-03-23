/** بيانات بطاقة صالون في محادثة روزي (من Edge أو التخزين) */
export type RozySalonCard = {
  id: string
  name_ar: string
  average_rating: number | null
  distance_km?: number | null
  cover_image?: string | null
  google_photo_resource?: string | null
}

/** أزرار المتابعة تحت رد المساعد */
export type RozyChatAction = {
  id: string
  label: string
  salon_id?: string | null
  /** لـ negotiated_book: خدمة مقترحة كبداية في مسار الحجز */
  service_id?: string | null
  /** نسبة الخصم الإضافي التي وعدت بها روزي (م clamp من السيرفر حسب حد الصالون) */
  discount_percent?: number | null
  kind?: 'book' | 'more' | 'retry' | 'dismiss' | 'map' | 'salon_upgrade' | 'negotiated_book'
}
