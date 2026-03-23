/** Default platform fee % (must match DB default on bookings.platform_fee_percentage). */
export const DEFAULT_PLATFORM_FEE_PERCENT = 10

export function platformCommissionSar(totalSar: number, feePercent = DEFAULT_PLATFORM_FEE_PERCENT): number {
  const p = Math.min(100, Math.max(0, feePercent))
  return Math.round(totalSar * (p / 100) * 100) / 100
}
