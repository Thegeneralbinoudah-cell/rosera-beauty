/**
 * Must stay in sync with latest DB CHECK constraints (see supabase/migrations:
 * user_events_event_type_check, user_events_entity_type_check — e.g. 053, 066, 069).
 * Invalid combinations are rejected by Postgres; client validates to avoid silent failures.
 */

export const USER_EVENTS_ENTITY_TYPES = [
  'service',
  'product',
  'business',
  'booking',
  'preference',
] as const

export type UserEventsEntityType = (typeof USER_EVENTS_ENTITY_TYPES)[number]

/** Latest union from migration 066 (rosy hesitation + subscription upsell). */
export const USER_EVENTS_EVENT_TYPES = [
  'view',
  'click',
  'book',
  'view_salon',
  'booking_click',
  'ai_recommended_view',
  'payment_success',
  'offer_applied',
  'user_preference',
  'subscription_started',
  'subscription_upgraded',
  'salon_clicks',
  'rosy_salon_subscription_upsell_click',
  'rosy_hesitation_tone_shown',
  'rosy_hesitation_checkout',
  'pwa_installed',
] as const

export type UserEventsEventType = (typeof USER_EVENTS_EVENT_TYPES)[number]

export function isAllowedUserEventsEntityType(v: string): v is UserEventsEntityType {
  return (USER_EVENTS_ENTITY_TYPES as readonly string[]).includes(v)
}

export function isAllowedUserEventsEventType(v: string): v is UserEventsEventType {
  return (USER_EVENTS_EVENT_TYPES as readonly string[]).includes(v)
}
