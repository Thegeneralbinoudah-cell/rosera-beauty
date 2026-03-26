/**
 * Platform owner only: `profiles.role` identifies the platform owner for owner-only admin actions.
 * Not staff/admin: global staff auth uses `isPrivilegedStaffClient()` / DB `is_privileged_staff()`.
 *
 * Uses case-insensitive match on role (same behavior as prior `(profile?.role ?? '').toLowerCase() === 'owner'`).
 */
export function isPlatformOwner(profile?: { role?: string | null } | null): boolean {
  return (profile?.role ?? '').toLowerCase() === 'owner'
}
