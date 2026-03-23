import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@17.4.0?target=deno'
import {
  applyStripeInvoicePaymentFailed,
  applyStripeSubscriptionAfterPayment,
  applyStripeSubscriptionDeleted,
} from '../_shared/stripeSalonSubscription.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')?.trim()
  const whSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')?.trim()
  if (!stripeKey || !whSecret) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const stripe = new Stripe(stripeKey, { httpClient: Stripe.createFetchHttpClient() })
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return new Response(JSON.stringify({ error: 'Missing stripe-signature' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, whSecret)
  } catch (e) {
    console.error('[stripe-webhook] signature', e)
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  try {
    switch (event.type) {
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice
        const subRef = invoice.subscription
        const subId = typeof subRef === 'string' ? subRef : subRef?.id
        if (!subId) break
        const sub = await stripe.subscriptions.retrieve(subId)
        if (sub.metadata?.salon_subscription_id) {
          await applyStripeSubscriptionAfterPayment(sb, sub)
        }
        break
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subRef = invoice.subscription
        const subId = typeof subRef === 'string' ? subRef : subRef?.id
        if (!subId) break
        const sub = await stripe.subscriptions.retrieve(subId)
        await applyStripeInvoicePaymentFailed(sb, sub)
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await applyStripeSubscriptionDeleted(sb, sub)
        break
      }
      default:
        break
    }
  } catch (e) {
    console.error('[stripe-webhook] handler', e)
    return new Response(JSON.stringify({ error: 'Handler error' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
