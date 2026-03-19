import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase, type Profile } from '@/lib/supabase'
import { toast } from 'sonner'

type AuthContextType = {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
  isAdmin: boolean
  isBusinessOwner: boolean
  /** صف admins أو دور admin */
  isPlatformAdmin: boolean
  /** مالك صالون مسجّل في salon_owners أو owner_id */
  isSalonPortal: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [isSalonPortal, setIsSalonPortal] = useState(false)

  const fetchProfile = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).single()
      if (error) throw error
      const p = data as Profile
      if (p.is_suspended) {
        await supabase.auth.signOut()
        setProfile(null)
        toast.error('تم تعليق حسابك. تواصلي مع الدعم.')
        return
      }
      setProfile(p)
    } catch {
      setProfile(null)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) void fetchProfile(s.user.id)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) void fetchProfile(s.user.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [fetchProfile])

  useEffect(() => {
    if (!user?.id) {
      setIsPlatformAdmin(false)
      setIsSalonPortal(false)
      return
    }
    let c = true
    ;(async () => {
      const [{ data: adm }, { data: so }, { data: biz }] = await Promise.all([
        supabase.from('admins').select('id').eq('user_id', user.id).maybeSingle(),
        supabase.from('salon_owners').select('id').eq('user_id', user.id).limit(1).maybeSingle(),
        supabase.from('businesses').select('id').eq('owner_id', user.id).limit(1).maybeSingle(),
      ])
      if (!c) return
      setIsPlatformAdmin(!!adm)
      setIsSalonPortal(!!so || !!biz)
    })()
    return () => {
      c = false
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) return
    const Cap = (typeof window !== 'undefined' &&
      (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor) as
      | { isNativePlatform?: () => boolean }
      | undefined
    if (!Cap?.isNativePlatform?.()) return
    void (async () => {
      try {
        const Push = await import('@capacitor/push-notifications')
        const perm = await Push.PushNotifications.requestPermissions()
        if (perm.receive !== 'granted') return
        await Push.PushNotifications.register()
        Push.PushNotifications.addListener('registration', async (t: { value: string }) => {
          await supabase.from('profiles').update({ push_token: t.value }).eq('id', user.id)
        })
      } catch {
        /* غير متوفر */
      }
    })()
  }, [user?.id])

  const refreshProfile = useCallback(async () => {
    if (user) await fetchProfile(user.id)
  }, [user, fetchProfile])

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      setProfile(null)
      toast.success('تم تسجيل الخروج')
    } catch {
      toast.error('حدث خطأ')
    }
  }

  const email = profile?.email ?? user?.email ?? ''
  const isAdmin = isPlatformAdmin || profile?.role === 'admin' || email === 'admin@rosera.com'
  const isBusinessOwner = profile?.role === 'business_owner' || isSalonPortal

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        refreshProfile,
        signOut,
        isAdmin,
        isBusinessOwner,
        isPlatformAdmin,
        isSalonPortal,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}
