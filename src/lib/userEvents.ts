import { supabase } from '@/lib/supabase'

export type UserEventType = 'view' | 'click' | 'book'
export type UserEntityType = 'service' | 'product' | 'business'

/** Fire-and-forget: logs recommendation signals for ranking (RLS: own rows). */
export function trackUserEvent(args: {
  userId: string | null | undefined
  event_type: UserEventType
  entity_type: UserEntityType
  entity_id: string | null | undefined
}): void {
  const { userId, event_type, entity_type, entity_id } = args
  if (!userId || !entity_id) return
  void supabase.from('user_events').insert({
    user_id: userId,
    event_type,
    entity_type,
    entity_id,
  })
}
