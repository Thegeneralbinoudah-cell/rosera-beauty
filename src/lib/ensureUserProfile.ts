import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

function randomInviteCode(): string {
  const buf = new Uint8Array(8)
  crypto.getRandomValues(buf)
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 12).toUpperCase()
}

/**
 * Ensures a `profiles` row exists for the auth user (OAuth, OTP, etc.).
 * Idempotent: duplicate key is treated as success.
 */
export async function ensureUserProfile(user: User): Promise<boolean> {
  const { data: existing, error: selErr } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()

  if (selErr) {
    console.error('ensureUserProfile lookup failed:', selErr.message)
    return false
  }
  if (existing?.id) return true

  const email = user.email ?? ''
  const meta = user.user_metadata ?? {}
  const fullName =
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    (typeof meta.user_name === 'string' && meta.user_name.trim()) ||
    (email ? email.split('@')[0] : '') ||
    null

  const { error: insErr } = await supabase.from('profiles').insert({
    id: user.id,
    email: email || null,
    full_name: fullName,
    invite_code: randomInviteCode(),
    role: 'user',
    created_at: new Date().toISOString(),
  })

  if (insErr) {
    if (insErr.code === '23505') return true
    console.error('ensureUserProfile insert failed:', {
      message: insErr.message,
      code: insErr.code,
      details: insErr.details,
      hint: insErr.hint,
      userId: user.id,
    })
    return false
  }

  return true
}
