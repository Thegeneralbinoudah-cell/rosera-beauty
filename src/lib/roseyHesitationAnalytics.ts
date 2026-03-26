import { trackEvent } from '@/lib/analytics'

/** Last-touch attribution: tone shown in Rosy before store checkout (session). */
export const ROSEY_HESITATION_TONE_SESSION_KEY = 'rosey_last_hesitation_tone'

export type RosyHesitationTone = 'direct' | 'soft' | 'choice'

export function rememberRosyHesitationToneForCheckout(tone: string): void {
  if (!/^(direct|soft|choice)$/.test(tone)) return
  try {
    sessionStorage.setItem(ROSEY_HESITATION_TONE_SESSION_KEY, tone)
  } catch {
    /* ignore */
  }
}

/** Call after a successful store order when checkout may follow Rosy hesitation. */
export function trackRosyHesitationCheckoutIfAttributed(userId: string): void {
  let tone: string | null = null
  try {
    tone = sessionStorage.getItem(ROSEY_HESITATION_TONE_SESSION_KEY)
  } catch {
    /* ignore */
  }
  if (!tone || !/^(direct|soft|choice)$/.test(tone)) return
  trackEvent({
    user_id: userId,
    event_type: 'rosy_hesitation_checkout',
    entity_type: 'preference',
    entity_id: userId,
    metadata: {
      tone,
      checkout_hesitation_tone: tone,
      did_user_checkout: true,
    },
  })
  try {
    sessionStorage.removeItem(ROSEY_HESITATION_TONE_SESSION_KEY)
  } catch {
    /* ignore */
  }
}
