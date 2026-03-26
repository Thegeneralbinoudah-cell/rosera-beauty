import type { Business } from '@/lib/supabase'
import type { SalonSubscriptionPlan } from '@/lib/salonSubscriptionPlans'

function planWeight(p: SalonSubscriptionPlan | null | undefined): number {
  if (p === 'premium') return 3
  if (p === 'pro') return 2
  if (p === 'basic') return 1
  return 0
}

/**
 * Score for ordering salons in consumer lists after primary sort (rating / distance / bookings).
 * Aligns with aiRanking monetization boosts: featured flag + B2B plan + volume signal.
 */
export function salonMonetizationListingScore(
  s: Pick<Business, 'is_featured' | 'subscription_plan' | 'total_bookings'>
): number {
  let x = 0
  if (s.is_featured) x += 1_000_000
  x += planWeight(s.subscription_plan) * 100_000
  x += Math.min(99_999, Math.floor(Number(s.total_bookings ?? 0) * 50))
  return x
}

export function compareSalonMonetizationDesc(
  a: Pick<Business, 'is_featured' | 'subscription_plan' | 'total_bookings'>,
  b: Pick<Business, 'is_featured' | 'subscription_plan' | 'total_bookings'>
): number {
  return salonMonetizationListingScore(b) - salonMonetizationListingScore(a)
}
