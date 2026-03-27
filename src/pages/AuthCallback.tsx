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

    ;(async () => {
      const oauthErr = parseOAuthErrorFromUrl()
      if (oauthErr) {
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

        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession()
        if (sessionErr && !code) {
          toast.error(describeOAuthFailure(sessionErr) || 'تعذر استعادة الجلسة')
          nav('/auth', { replace: true })
          return
        }

        let session = sessionData.session
        if (cancelled) return

        if (!session?.user && code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            toast.error(describeOAuthFailure(error) || 'تعذر إكمال تسجيل الدخول')
            nav('/auth', { replace: true })
            return
          }
          session = data.session ?? null
        }

        if (!session?.user) {
          const { data: again } = await supabase.auth.getSession()
          session = again.session ?? session
        }

        if (cancelled) return

        const user = session?.user
        if (!user) {
          toast.error(t('auth.oauthCallbackNoSession'))
          nav('/auth', { replace: true })
          return
        }

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
      <p className="text-sm font-medium text-muted-foreground">
        {phase === 'working' ? t('auth.oauthCallbackWorking') : t('auth.oauthCallbackRedirecting')}
      </p>
    </div>
  )
}
