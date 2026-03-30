import { supabase } from '@/lib/supabase'

export type RoziEventActionType =
  | 'book'
  | 'salon_detail'
  | 'view_product'
  | 'add_to_cart'
  | 'checkout'

export type RoziEventInsertPayload = {
  user_id: string
  action_type: RoziEventActionType
  entity_id?: string | null
  recommendation_mode?: string | null
  metadata?: Record<string, unknown>
}

/** Fire-and-forget; never throws; does not block UI. */
export function queueRoziEvent(payload: RoziEventInsertPayload): void {
  const uid = payload.user_id?.trim()
  if (!uid) return

  const meta =
    payload.metadata && typeof payload.metadata === 'object' && Object.keys(payload.metadata).length > 0
      ? payload.metadata
      : {}

  const mode =
    payload.recommendation_mode == null
      ? null
      : typeof payload.recommendation_mode === 'string'
        ? payload.recommendation_mode.trim() || null
        : String(payload.recommendation_mode)

  void supabase
    .from('rozi_events')
    .insert({
      user_id: uid,
      action_type: payload.action_type,
      entity_id: payload.entity_id?.trim() || null,
      recommendation_mode: mode,
      metadata: meta,
    })
    .then(({ error }) => {
      if (error) {
        console.error('[rozi_events insert failed]', error.message, error.code)
      }
    })
}
