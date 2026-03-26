import { supabase } from '@/lib/supabase'
import {
  isAllowedUserEventsEntityType,
  isAllowedUserEventsEventType,
} from '@/lib/userEventsConstants'

export type UserEventInsertResult =
  | { ok: true }
  | { ok: false; skipped?: 'validation'; reason: string }
  | { ok: false; error: string; code?: string; details?: string }

type InsertPayload = {
  user_id: string
  event_type: string
  entity_type: string
  entity_id: string
  metadata?: Record<string, unknown>
}

function logUserEventFailure(
  payload: InsertPayload,
  err: { message?: string; code?: string; details?: string },
  metaSummary: string
): void {
  console.error('[user_events insert failed]', {
    event_type: payload.event_type,
    entity_type: payload.entity_type,
    entity_id: payload.entity_id,
    metadataSummary: metaSummary,
    supabaseMessage: err.message ?? '(no message)',
    supabaseCode: err.code ?? '(no code)',
    details: err.details,
  })
}

export async function insertUserEventRow(payload: InsertPayload): Promise<UserEventInsertResult> {
  const metaSummary =
    payload.metadata && typeof payload.metadata === 'object'
      ? JSON.stringify(payload.metadata).slice(0, 400)
      : '(none)'

  if (!isAllowedUserEventsEventType(payload.event_type)) {
    const reason = `event_type not allowed by DB: ${payload.event_type}`
    console.warn('[user_events]', reason, { entity_type: payload.entity_type, metadataSummary: metaSummary })
    return { ok: false, skipped: 'validation', reason }
  }
  if (!isAllowedUserEventsEntityType(payload.entity_type)) {
    const reason = `entity_type not allowed by DB: ${payload.entity_type}`
    console.warn('[user_events]', reason, { event_type: payload.event_type, metadataSummary: metaSummary })
    return { ok: false, skipped: 'validation', reason }
  }

  const { error } = await supabase.from('user_events').insert({
    user_id: payload.user_id,
    event_type: payload.event_type,
    entity_type: payload.entity_type,
    entity_id: payload.entity_id,
    ...(payload.metadata && Object.keys(payload.metadata).length ? { metadata: payload.metadata } : {}),
  })

  if (error) {
    logUserEventFailure(payload, error, metaSummary)
    return { ok: false, error: error.message, code: error.code, details: error.details }
  }

  return { ok: true }
}
