/**
 * Store product helpers for rozi-chat (Deno).
 * Keep phrase → category rules aligned with `src/lib/roseyStoreProducts.ts`.
 */

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type RosyStoreProductRow = Record<string, unknown> & {
  id: string
  name_ar: string
  price: number
  category?: string | null
  image_url?: string | null
  brand_ar?: string | null
  description_ar?: string | null
}

/**
 * أول تطابق يفوز — عبارات محددة ثم أنماط أوسع.
 * يطابق أعمدة `products.category` في المتجر.
 */
const PRIMARY_CATEGORY_RULES: Array<{ pattern: RegExp; category: string }> = [
  // بشرتي جافة → عناية بالبشرة (قبل أي قاعدة فيها «شعر» لتفادي التضارب)
  {
    pattern:
      /بشرت[يى]\s*جاف|جاف[ةة]\s*بشر|جفاف|ترطيب|ريتينول|حمض|سيروم|كريم|بشرة|مسام|حبوب|نضارة|حساس|تهيج|واقي\s*شمس|spf|نياسيناميد|ماسك|قناع|قناع\s*طين|ماسكات/i,
    category: 'عناية بالبشرة',
  },
  // أبغى شامبو → عناية بالشعر
  {
    pattern:
      /أبغى\s*شامبو|ابغى\s*شامبو|ابغا\s*شامبو|شامبو|فروة|تساقط|بروتين|كيراتين|زيت\s*شعر|تموج|كيرلي|صبغ|أطراف|عندي\s*تساقط|^شعر\s|^شعري\s/i,
    category: 'عناية بالشعر',
  },
  { pattern: /مكياج|أحمر\s*شفاه|فاونديشن|كونسيلر|آيلاينر|ماسكارا|باليت|هايلايتر/i, category: 'مكياج' },
  { pattern: /عطر|عطور|ماء\s*عطر|بارفان|perfume/i, category: 'عطور' },
  { pattern: /أظافر|اظافر|طلاء|مانيكير|بديكير|جيل\s*أظافر/i, category: 'أظافر' },
  { pattern: /(^|\s)سبا(\s|$)|استحمام|ملح\s*استحمام|حمام\s*زيت|شمعة|تدليك|bath/i, category: 'سبا' },
  {
    pattern: /(^|\s)جسم(\s|$)|لوشن|بودرة|مزيل\s*عرق|كريم\s*جسم|صابون\s*جسم|زيت\s*جسم|عناية\s*بالجسم/i,
    category: 'عناية بالجسم',
  },
  {
    pattern: /دايسون|سيراميك|ليزر\s*منزل|فوريو|جهاز\s*تجميل|styler|مكواة\s*شعر|أداة\s*تصفيف|آي\s*بي\s*إل/i,
    category: 'أجهزة تجميل',
  },
]

const VALID_CATEGORIES = new Set([
  'عناية بالبشرة',
  'مكياج',
  'عناية بالشعر',
  'عطور',
  'أظافر',
  'أجهزة تجميل',
  'سبا',
  'عناية بالجسم',
])

/** خريطة النية: جمل المستخدم → فئة متجر واحدة (أول تطابق). */
export function inferPrimaryStoreCategory(utterance: string): string | null {
  const t = utterance.replace(/\s+/g, ' ').trim()
  if (!t) return null
  for (const { pattern, category } of PRIMARY_CATEGORY_RULES) {
    if (pattern.test(t)) return category
  }
  return null
}

/**
 * استعلام منتجات حسب فئة واحدة — يجلب دفعة للترتيب ثم اختيار متميّز (premium + متوازن).
 */
export async function getProductsByCategory(
  sb: SupabaseClient,
  category: string,
  poolLimit = 12
): Promise<RosyStoreProductRow[]> {
  if (!VALID_CATEGORIES.has(category)) return []
  const { data, error } = await sb
    .from('products')
    .select('*')
    .eq('category', category)
    .eq('is_active', true)
    .eq('is_demo', false)
    .limit(poolLimit)

  if (error) {
    console.warn('[roseyStoreProducts] getProductsByCategory', error.message)
    return []
  }
  return (data ?? []) as RosyStoreProductRow[]
}
