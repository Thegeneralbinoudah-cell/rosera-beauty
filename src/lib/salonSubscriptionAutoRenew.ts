import type { SupabaseClient } from '@supabase/supabase-js'

/** Moyasar: RPC. Stripe: Edge updates cancel_at_period_end + DB auto_renew. */
export async function setSalonSubscriptionAutoRenew(
  supabase: SupabaseClient,
  enabled: boolean,
  billingProvider: string | null | undefined,
  stripeSubscriptionId: string | null | undefined
): Promise<void> {
  if (billingProvider === 'stripe' && stripeSubscriptionId) {
    const { data, error } = await supabase.functions.invoke('stripe-update-salon-auto-renew', {
      body: { enabled },
    })
    const msg = (data as { error?: string })?.error
    if (error || msg) throw new Error(msg || error?.message || 'فشل تحديث Stripe')
    return
  }
  const { error } = await supabase.rpc('set_salon_subscription_auto_renew', { p_enabled: enabled })
  if (error) throw error
}
