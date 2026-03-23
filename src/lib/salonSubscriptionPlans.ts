export const SALON_SUBSCRIPTION_PLANS = {
  basic: { priceSar: 199, labelAr: 'أساسي', hintAr: 'ظهور عادي في القائمة' },
  pro: { priceSar: 399, labelAr: 'احترافي', hintAr: 'ترتيب أعلى في البحث والتوصيات' },
  premium: { priceSar: 799, labelAr: 'مميز', hintAr: 'شارة مميزة، أعلى ترتيب، ظهور أولوية' },
} as const

export type SalonSubscriptionPlan = keyof typeof SALON_SUBSCRIPTION_PLANS

export function isSalonSubscriptionPlan(x: string): x is SalonSubscriptionPlan {
  return x === 'basic' || x === 'pro' || x === 'premium'
}

export function planPriceSar(plan: SalonSubscriptionPlan): number {
  return SALON_SUBSCRIPTION_PLANS[plan].priceSar
}
