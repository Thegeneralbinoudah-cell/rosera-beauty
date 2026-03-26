import type { NavigateFunction } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { consumePostAuthPath } from '@/lib/salonAcquisition'
import { isPrivilegedStaffClient } from '@/lib/privilegedStaff'

/**
 * Shared navigation after any successful sign-in (phone OTP, email, OAuth).
 */
export async function runPostAuthRedirect(nav: NavigateFunction): Promise<void> {
  const uid = (await supabase.auth.getUser()).data.user?.id
  const target = sessionStorage.getItem('rosera_verify_target')
  sessionStorage.removeItem('rosera_verify_target')

  if (uid && target === 'owner') {
    const [{ data: so }, { data: biz }] = await Promise.all([
      supabase.from('salon_owners').select('id').eq('user_id', uid).limit(1).maybeSingle(),
      supabase.from('businesses').select('id').eq('owner_id', uid).limit(1).maybeSingle(),
    ])
    if (so || biz) {
      nav('/salon/dashboard', { replace: true })
    } else {
      toast.error('حسابك غير مرتبط بصالون')
      nav('/home', { replace: true })
    }
    return
  }

  if (uid && target === 'admin') {
    const { data: adm } = await supabase.from('admins').select('id').eq('user_id', uid).maybeSingle()
    const { data: profAdm } = await supabase.from('profiles').select('role, email').eq('id', uid).single()
    if (
      isPrivilegedStaffClient({
        isAdminFromAdminsTable: !!adm,
        profile: profAdm as { role?: string; email?: string } | null,
      })
    ) {
      nav('/admin', { replace: true })
    } else {
      toast.error('ليس لديك صلاحية مسؤول')
      nav('/home', { replace: true })
    }
    return
  }

  const postAuth = consumePostAuthPath()
  if (postAuth) {
    nav(postAuth, { replace: true })
    return
  }

  if (uid) {
    const [{ data: adm }, { data: prof }] = await Promise.all([
      supabase.from('admins').select('id').eq('user_id', uid).maybeSingle(),
      supabase.from('profiles').select('full_name, role, email').eq('id', uid).single(),
    ])
    const role = ((prof as { role?: string } | null)?.role ?? 'user').toLowerCase()
    if (role === 'owner') {
      nav('/salon/dashboard', { replace: true })
      return
    }
    if (
      isPrivilegedStaffClient({
        isAdminFromAdminsTable: !!adm,
        profile: prof as { role?: string; email?: string } | null,
      })
    ) {
      nav('/admin', { replace: true })
      return
    }
    if ((prof as { full_name?: string } | null)?.full_name?.trim()) {
      nav('/home', { replace: true })
    } else {
      nav('/complete-profile', { replace: true })
    }
  } else {
    nav('/complete-profile', { replace: true })
  }
}
