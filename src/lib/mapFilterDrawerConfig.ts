export type MapFilterDrawerOption = { label: string; value: string }

export type MapFilterDrawerCategory = {
  id: string
  title: string
  options: MapFilterDrawerOption[]
}

export const MAP_FILTER_DRAWER_CONFIGS = {
  highest_rated: {
    id: 'highest_rated',
    title: 'الأعلى تقييمًا',
    options: [
      { label: '⭐ 5 نجوم فقط', value: 'stars_5' },
      { label: '⭐ 4 نجوم فأعلى', value: 'stars_4' },
      { label: '🏆 الأكثر تقييمًا', value: 'most_reviewed' },
    ],
  },
  most_booked: {
    id: 'most_booked',
    title: 'الأكثر حجزًا',
    options: [
      { label: '🔥 الأكثر حجزًا اليوم', value: 'booked_today' },
      { label: '📅 هذا الأسبوع', value: 'booked_week' },
      { label: '📊 هذا الشهر', value: 'booked_month' },
    ],
  },
  nearest: {
    id: 'nearest',
    title: 'الأقرب إليك',
    options: [
      { label: '📍 أقل من 1 كم', value: 'dist_1' },
      { label: '📍 أقل من 3 كم', value: 'dist_3' },
      { label: '📍 أقل من 5 كم', value: 'dist_5' },
    ],
  },
  best_value: {
    id: 'best_value',
    title: 'أفضل قيمة',
    options: [
      { label: '💰 أقل من 100 ريال', value: 'price_low' },
      { label: '💎 100-300 ريال', value: 'price_mid' },
      { label: '👑 أكثر من 300 ريال', value: 'price_high' },
    ],
  },
  quick_book: {
    id: 'quick_book',
    title: 'مناسب لحجز سريع',
    options: [
      { label: '⚡ خلال 30 دقيقة', value: 'book_30min' },
      { label: '🕐 خلال ساعة', value: 'book_1hr' },
      { label: '📅 اليوم فقط', value: 'book_today' },
    ],
  },
  rozy_pick: {
    id: 'rozy_pick',
    title: '✨ ترشيح روزي',
    options: [
      { label: '✨ مقترح بناءً على تاريخك', value: 'ai_personal' },
      { label: '🆕 صالونات جديدة مميزة', value: 'ai_new' },
      { label: '💝 الأعلى رضا', value: 'ai_satisfaction' },
    ],
  },
} as const satisfies Record<string, MapFilterDrawerCategory>

export type MapFilterDrawerCategoryId = keyof typeof MAP_FILTER_DRAWER_CONFIGS

export const MAP_FILTER_DRAWER_CATEGORY_IDS = Object.keys(
  MAP_FILTER_DRAWER_CONFIGS,
) as MapFilterDrawerCategoryId[]
