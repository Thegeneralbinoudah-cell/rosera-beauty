import type { SupabaseClient } from '@supabase/supabase-js'

// IMPORTANT:
// Admin/staff logic must match public.is_privileged_staff() in DB (migration 063):
// - row in public.admins for auth.uid(), OR
// - profiles.role (case-insensitive) ∈ admin, supervisor, owner, OR
// - profiles.email exactly 'admin@rosera.com' (SQL uses no lower() on email)

export type PrivilegedStaffProfileInput = {
  role?: string | null
  email?: string | null
}

/**
 * Single client-side source of truth aligned with `public.is_privileged_staff()`.
 */
export function isPrivilegedStaffClient(params: {
  isAdminFromAdminsTable?: boolean
  profile?: PrivilegedStaffProfileInput | null
}): boolean {
  if (params.isAdminFromAdminsTable) return true
  const p = params.profile
  if (!p) return false
  const r = (p.role ?? '').toLowerCase().trim()
  if (r === 'admin' || r === 'supervisor' || r === 'owner') return true
  return (p.email ?? '') === 'admin@rosera.com'
}

/** Optional: one round-trip when you only have user id (e.g. redirect before profile context). */
export async function fetchPrivilegedStaffForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const [{ data: adm }, { data: prof }] = await Promise.all([
    supabase.from('admins').select('id').eq('user_id', userId).maybeSingle(),
    supabase.from('profiles').select('role, email').eq('id', userId).maybeSingle(),
  ])
  return isPrivilegedStaffClient({
    isAdminFromAdminsTable: !!adm,
    profile: prof,
  })
}
