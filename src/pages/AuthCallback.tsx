import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { ensureUserProfile } from '@/lib/ensureUserProfile'
import { runPostAuthRedirect } from '@/lib/postAuthRedirect'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import {
  describeOAuthFailure,
  extractOAuthCodeFromLocation,
  getSupabaseOAuthProviderRedirectUri,
  isRedirectUriMismatchMessage,
} from '@/lib/oauthAuth'
import { useI18n } from '@/hooks/useI18n'

function parseOAuthErrorFromUrl(): string | null {
  try {
    const q = new URLSearchParams(window.location.search)
    const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : ''
    const hashParams = new URLSearchParams(hash)
    const err = q.get('error') || hashParams.get('error')
    const desc = q.get('error_description') || hashParams.get('error_description')
    if (!err && !desc) return null
    if (desc) {
      try {
        return decodeURIComponent(desc.replace(/\+/g, ' '))
      } catch {
        return desc
      }
    }
    if (err === 'access_denied') return 'تم إلغاء تسجيل الدخول'
    return describeOAuthFailure(err)
  } catch {
    return 'تعذر تسجيل الدخول'
  }
}

export default function AuthCallback() {
  const nav = useNavigate()
  const { refreshProfile } = useAuth()
  const { t } = useI18n()
  const [phase, setPhase] = useState<'working' | 'done'>('working')

  useEffect(() => {
    let cancelled = false
    const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

    ;(async () => {
      console.log('[AUTH CALLBACK] URL:', window.location.href)
      console.log('[AUTH CALLBACK] hash:', window.location.hash)
      console.log('[AUTH CALLBACK] search:', window.location.search)

      const oauthErr = parseOAuthErrorFromUrl()
      if (oauthErr) {
        console.error('[AUTH CALLBACK] final error (OAuth error in URL):', oauthErr)
        if (isRedirectUriMismatchMessage(oauthErr)) {
          const u = getSupabaseOAuthProviderRedirectUri()
          toast.error(u ? t('auth.oauthRedirectUriMismatch', { url: u }) : t('auth.oauthRedirectUriMismatchGeneric'))
        } else {
          toast.error(oauthErr)
        }
        nav('/auth', { replace: true })
        return
      }

      try {
        const code = extractOAuthCodeFromLocation()
        console.info('[AUTH CALLBACK] handling', { hasCode: !!code })

        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
        console.log('[AUTH CALLBACK] getSession (initial)', {
          hasSession: !!sessionData.session?.user,
          sessionError: sessionErr?.message ?? null,
        })

        if (sessionErr && !code) {
          const detail =
            describeOAuthFailure(sessionErr) || sessionErr.message || 'تعذر استعادة الجلسة'
          console.error('[AUTH CALLBACK] final error:', detail)
          toast.error(`${detail} (no authorization code in URL; check Apple Return URL and Supabase Redirect URLs)`)
          nav('/auth', { replace: true })
          return
        }

        let session = sessionData.session
        if (cancelled) return

        if (!session?.user && code) {
          const { data: exchanged, error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code)
          if (exchangeErr) {
            const detail =
              describeOAuthFailure(exchangeErr) ||
              exchangeErr.message ||
              'تعذر إكمال تسجيل الدخول'
            console.error('[AUTH CALLBACK] exchangeCodeForSession error', {
              message: exchangeErr.message,
              name: exchangeErr.name,
              status: exchangeErr.status,
            })
            console.error('[AUTH CALLBACK] final error:', detail)
            toast.error(`${detail} | exchangeCodeForSession failed`)
            nav('/auth', { replace: true })
            return
          }
          session = exchanged.session ?? null
          console.log('[AUTH CALLBACK] after exchangeCodeForSession', {
            hasSession: !!session?.user,
            userId: session?.user?.id ?? null,
          })
        }

        const fetchSessionAgain = async () => {
          const { data, error } = await supabase.auth.getSession()
          if (error) console.warn('[AUTH CALLBACK] getSession retry warning:', error.message)
          return data.session ?? null
        }

        if (!session?.user) {
          session = await fetchSessionAgain()
          console.log('[AUTH CALLBACK] immediate getSession retry', { hasSession: !!session?.user })
        }

        if (!session?.user) {
          await sleep(500)
          if (cancelled) return
          session = await fetchSessionAgain()
          console.log('[AUTH CALLBACK] after 500ms getSession retry', { hasSession: !!session?.user })
        }

        if (!session?.user) {
          await sleep(500)
          if (cancelled) return
          session = await fetchSessionAgain()
          console.log('[AUTH CALLBACK] after second 500ms getSession retry', { hasSession: !!session?.user })
        }

        if (!session?.user) {
          const { data: userData, error: userErr } = await supabase.auth.getUser()
          if (userData.user) {
            const { data: latest } = await supabase.auth.getSession()
            session = latest.session
            console.log('[AUTH CALLBACK] getUser fallback', {
              hasUser: !!userData.user,
              hasSession: !!session?.user,
            })
          } else {
            console.warn('[AUTH CALLBACK] getUser fallback empty:', userErr?.message)
          }
        }

        if (cancelled) return

        const user = session?.user
        if (!user) {
          const detail = `No session after Apple/OAuth callback. hasCode=${String(!!code)} origin=${window.location.origin} — add ${window.location.origin}/auth/callback to Supabase Redirect URLs and ${getSupabaseOAuthProviderRedirectUri() || '(SUPABASE_URL)/auth/v1/callback'} to Apple Return URLs.`
          console.error('[AUTH CALLBACK] final error:', detail)
          toast.error(detail)
          nav('/auth', { replace: true })
          return
        }

        console.log('[AUTH CALLBACK] final success user id:', user.id)
        const profileOk = await ensureUserProfile(user)
        if (!profileOk) {
          toast.error(t('auth.oauthProfileSetupFailed'))
        }

        await refreshProfile()
        if (cancelled) return

        setPhase('done')
        await runPostAuthRedirect(nav)
      } catch (e: unknown) {
        if (cancelled) return
        const msg = e instanceof Error ? describeOAuthFailure(e) : 'حدث خطأ أثناء تسجيل الدخول'
        console.error('[AUTH CALLBACK] final error (exception):', e)
        toast.error(msg)
        nav('/auth', { replace: true })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [nav, refreshProfile, t])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6">
      <Loader2 className="h-10 w-10 animate-spin text-primary" aria-hidden />
      <p className="text-sm font-medium text-foreground">
        {phase === 'working' ? t('auth.oauthCallbackWorking') : t('auth.oauthCallbackRedirecting')}
      </p>
    </div>
  )
}
