/** بطاقة منتج من متجر روزيرا (من Edge) */
export type RozyProductCard = {
  id: string
  name_ar: string
  price: number
  /** سطر قصير من الوصف أو فائدة */
  benefit: string
  image_url: string | null
  brand_ar?: string | null
  category?: string | null
}

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
  product_id?: string | null
  product_name_ar?: string | null
  product_price?: number | null
  product_image_url?: string | null
  product_brand_ar?: string | null
  kind?:
    | 'book'
    | 'more'
    | 'retry'
    | 'dismiss'
    | 'map'
    | 'salon_upgrade'
    | 'negotiated_book'
    | 'store'
    | 'add_to_cart'
    | 'view_product'
    | 'go_to_checkout'
    /** من روزي → صفحة الصالون مع تمييز خدمة */
    | 'salon_detail'
}
