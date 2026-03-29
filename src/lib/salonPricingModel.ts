/**
 * B2B pricing model — Saudi beauty salons (Rosera).
 * Aligns product, marketing, and future billing (trials, bundles, add-ons).
 */

import { type SalonSubscriptionPlan, SALON_SUBSCRIPTION_PLANS, planPriceSar } from '@/lib/salonSubscriptionPlans'

/** First invoice period at 0 SAR (full plan features; card optional per ops). */
export const SALON_FREE_TRIAL_DAYS = 30

/** 3-month prepay: attractive vs 3× monthly without eroding ARPU long-term. */
export const SALON_QUARTERLY_DISCOUNT_PERCENT = 15

/** One-time welcome after trial signup (first paid month); stack policy: usually NOT with quarterly. */
export const SALON_ONBOARDING_FIRST_MONTH_PERCENT_OFF = 20

/** Boost slot — top-of-feed / sponsored placement (Moyasar or wallet). */
export const SALON_FEATURED_AD_SAR_PER_DAY = 50

export type SalonBillingCycle = 'monthly' | 'quarterly'

export function planPriceForCycle(plan: SalonSubscriptionPlan, cycle: SalonBillingCycle): number {
  const monthly = planPriceSar(plan)
  if (cycle === 'monthly') return monthly
  const gross = monthly * 3
  return Math.round(gross * (1 - SALON_QUARTERLY_DISCOUNT_PERCENT / 100))
}

/** Effective monthly SAR when on quarterly (for “from X ر.س/شهر” copy). */
export function effectiveMonthlySarQuarterly(plan: SalonSubscriptionPlan): number {
  return Math.round(planPriceForCycle(plan, 'quarterly') / 3)
}

export const SALON_PLAN_VALUE_PROPS: Record<
  SalonSubscriptionPlan,
  { bulletsAr: string[]; includesAnalytics: boolean; includesFeaturedBadge: boolean; rankingTier: 'standard' | 'boosted' | 'top' }
> = {
  basic: {
    bulletsAr: ['قائمة عادية في التطبيق', 'مناسب للصالونات الجديدة'],
    includesAnalytics: false,
    includesFeaturedBadge: false,
    rankingTier: 'standard',
  },
  pro: {
    bulletsAr: ['ترتيب أعلى في البحث والتوصيات', 'تحليلات المشاهدات والنقرات'],
    includesAnalytics: true,
    includesFeaturedBadge: false,
    rankingTier: 'boosted',
  },
  premium: {
    bulletsAr: ['شارة صالون مميز', 'أعلى ترتيب وظهور أولوي'],
    includesAnalytics: true,
    includesFeaturedBadge: true,
    rankingTier: 'top',
  },
}

/** Human-readable bundle hints for checkout UI (rounded marketing numbers). */
export function quarterlySavingsHintAr(plan: SalonSubscriptionPlan): string {
  const full = planPriceSar(plan) * 3
  const paid = planPriceForCycle(plan, 'quarterly')
  const saved = full - paid
  return `وفّري حوالي ${saved.toLocaleString('ar-SA')} ر.س مقارنةً بثلاثة أشهر شهرياً`
}

export { SALON_SUBSCRIPTION_PLANS, planPriceSar }
