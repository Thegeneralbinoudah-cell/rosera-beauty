import { supabase } from '@/lib/supabase'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function trackEvent(args: {
  event_type: string
  entity_type: string
  entity_id: string
  user_id?: string | null
}): void {
  const user_id = typeof args.user_id === 'string' ? args.user_id.trim() : ''
  const entity_id = typeof args.entity_id === 'string' ? args.entity_id.trim() : ''
  const event_type = typeof args.event_type === 'string' ? args.event_type.trim() : ''
  const entity_type = typeof args.entity_type === 'string' ? args.entity_type.trim() : ''

  if (!user_id || !entity_id || !event_type || !entity_type) return
  if (!UUID_RE.test(user_id) || !UUID_RE.test(entity_id)) return

  if (import.meta.env.DEV) {
    console.info('[Rosera][trackEvent]', { event_type, entity_type, entity_id, user_id })
  }

  try {
    const w = window as Window & { dataLayer?: Record<string, unknown>[] }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ event: event_type, entity_type, entity_id, user_id })
  } catch {
    /* ignore */
  }

  try {
    window.dispatchEvent(
      new CustomEvent('rosera:analytics', {
        detail: { event_type, entity_type, entity_id, user_id, ts: Date.now() },
      })
    )
  } catch {
    /* ignore */
  }

  void supabase
    .from('user_events')
    .insert({
      user_id,
      event_type,
      entity_type,
      entity_id,
    })
    .then(({ error }) => {
      if (error && import.meta.env.DEV) {
        console.warn('[Rosera][trackEvent] insert', error.message)
      }
    })
}
