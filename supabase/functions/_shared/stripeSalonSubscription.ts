import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Minimal Stripe Subscription shape (avoid coupling to Stripe types in shared). */
export type StripeSubscriptionLike = {
  id: string
  customer: string | { id?: string } | null
  metadata: { salon_subscription_id?: string } | null
  current_period_end: number
  current_period_start: number
  cancel_at_period_end: boolean | null
}

function stripeCustomerId(c: StripeSubscriptionLike['customer']): string | null {
  if (typeof c === 'string') return c
  if (c && typeof c === 'object' && typeof c.id === 'string') return c.id
  return null
}

export async function applyStripeSubscriptionAfterPayment(
  sb: SupabaseClient,
  sub: StripeSubscriptionLike
): Promise<void> {
  const ref = sub.metadata?.salon_subscription_id
  if (!ref) {
    console.warn('[stripe-salon] missing salon_subscription_id in subscription metadata')
    return
  }

  const { data: row, error } = await sb
    .from('salon_subscriptions')
    .select('id, salon_id, plan, status, stripe_subscription_id, renewal_failed_count')
    .eq('id', ref)
    .maybeSingle()

  if (error || !row) {
    console.warn('[stripe-salon] subscription row', error?.message)
    return
  }

  const r = row as {
    id: string
    salon_id: string
    plan: string
    status: string
    stripe_subscription_id: string | null
    renewal_failed_count: number | null
  }

  const periodEnd = new Date(sub.current_period_end * 1000).toISOString()
  const periodStart = new Date(sub.current_period_start * 1000).toISOString()
  const nowIso = new Date().toISOString()
  const cust = stripeCustomerId(sub.customer)

  if (r.status === 'pending_payment') {
    await sb.from('salon_subscriptions').update({ status: 'cancelled' }).eq('salon_id', r.salon_id).eq('status', 'active')

    const { error: upErr } = await sb
      .from('salon_subscriptions')
      .update({
        status: 'active',
        starts_at: periodStart,
        expires_at: periodEnd,
        billing_provider: 'stripe',
        stripe_customer_id: cust,
        stripe_subscription_id: sub.id,
        payment_method_id: null,
        last_payment_at: nowIso,
        renewal_failed_count: 0,
        auto_renew: !(sub.cancel_at_period_end ?? false),
      })
      .eq('id', ref)

    if (upErr) console.error('[stripe-salon] activate pending', upErr)
  } else if (r.status === 'active' && r.stripe_subscription_id === sub.id) {
    const { error: upErr } = await sb
      .from('salon_subscriptions')
      .update({
        expires_at: periodEnd,
        last_payment_at: nowIso,
        renewal_failed_count: 0,
        auto_renew: !(sub.cancel_at_period_end ?? false),
        ...(cust ? { stripe_customer_id: cust } : {}),
      })
      .eq('id', ref)

    if (upErr) console.error('[stripe-salon] renewal sync', upErr)
  } else {
    console.warn('[stripe-salon] skip unexpected state', r.status, r.stripe_subscription_id, sub.id)
    return
  }

  const plan = r.plan as string
  const featured = plan === 'premium'
  const { error: bizErr } = await sb.from('businesses').update({ is_featured: featured }).eq('id', r.salon_id)
  if (bizErr) console.error('[stripe-salon] is_featured', bizErr)
}

export async function applyStripeInvoicePaymentFailed(sb: SupabaseClient, sub: StripeSubscriptionLike): Promise<void> {
  const ref = sub.metadata?.salon_subscription_id
  if (!ref) return

  const { data: row } = await sb
    .from('salon_subscriptions')
    .select('id, salon_id, status, renewal_failed_count')
    .eq('id', ref)
    .maybeSingle()

  if (!row) return
  const r = row as { id: string; salon_id: string; status: string; renewal_failed_count: number | null }
  if (r.status !== 'active') return

  const failures = (r.renewal_failed_count ?? 0) + 1
  if (failures >= 3) {
    await sb.from('salon_subscriptions').update({ status: 'expired', renewal_failed_count: failures }).eq('id', r.id)
    await sb.from('businesses').update({ is_featured: false }).eq('id', r.salon_id)
  } else {
    await sb.from('salon_subscriptions').update({ renewal_failed_count: failures }).eq('id', r.id)
  }
}

export async function applyStripeSubscriptionDeleted(sb: SupabaseClient, sub: StripeSubscriptionLike): Promise<void> {
  const ref = sub.metadata?.salon_subscription_id
  if (!ref) return

  const { data: row } = await sb.from('salon_subscriptions').select('id, salon_id, plan').eq('id', ref).maybeSingle()
  if (!row) return

  const r = row as { id: string; salon_id: string; plan: string }
  await sb.from('salon_subscriptions').update({ status: 'expired' }).eq('id', r.id)
  if (r.plan === 'premium') {
    await sb.from('businesses').update({ is_featured: false }).eq('id', r.salon_id)
  }
}

export async function userOwnsSalon(
  sb: SupabaseClient,
  userId: string,
  salonId: string
): Promise<boolean> {
  const { data: so } = await sb
    .from('salon_owners')
    .select('salon_id')
    .eq('user_id', userId)
    .eq('salon_id', salonId)
    .maybeSingle()
  if (so) return true
  const { data: b } = await sb
    .from('businesses')
    .select('id')
    .eq('owner_id', userId)
    .eq('id', salonId)
    .maybeSingle()
  return !!b
}

export async function resolveOwnerSalonId(sb: SupabaseClient, userId: string): Promise<string | null> {
  const { data: so } = await sb.from('salon_owners').select('salon_id').eq('user_id', userId).limit(1).maybeSingle()
  const sid = (so as { salon_id?: string } | null)?.salon_id
  if (sid) return sid
  const { data: b } = await sb.from('businesses').select('id').eq('owner_id', userId).limit(1).maybeSingle()
  return (b as { id?: string } | null)?.id ?? null
}
