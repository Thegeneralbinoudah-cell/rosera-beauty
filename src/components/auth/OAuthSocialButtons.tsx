import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { describeOAuthFailure, getOAuthRedirectTo } from '@/lib/oauthAuth'
import { captureProductEvent } from '@/lib/posthog'
import { useI18n } from '@/hooks/useI18n'
import { cn } from '@/lib/utils'

type Props = {
  /** When true, buttons are disabled (e.g. parent form is submitting). */
  disabled?: boolean
  className?: string
}

const oauthOutline =
  'flex h-11 w-full max-w-[280px] shrink-0 items-center justify-center gap-2 rounded-full border border-accent/45 bg-transparent px-4 text-sm font-normal text-primary shadow-none transition-[box-shadow,border-color,background-color,opacity,transform] duration-300 ease-out hover:shadow-[0_0_22px_rgba(201,150,63,0.28)] disabled:cursor-not-allowed disabled:opacity-55 mx-auto'

/**
 * Google: `signInWithOAuth({ provider: 'google' })` → redirect to `/auth/callback`.
 *
 * Apple (web / Capacitor WebView): `signInWithOAuth({ provider: 'apple' })` — same pattern.
 * Native Expo / RN apps with `expo-apple-authentication` or `@invertase/react-native-apple-authentication`
 * should use `supabase.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken })`
 * instead; this Vite client has no native Apple credential, so OAuth redirect is used.
 */
export function OAuthSocialButtons({ disabled = false, className }: Props) {
  const { t } = useI18n()
  const [busy, setBusy] = useState<'google' | 'apple' | null>(null)

  const logOAuthError = (scope: string, err: unknown) => {
    console.error(`[OAuth ${scope}]`, err)
  }

  const onGoogle = async () => {
    captureProductEvent('login_google_clicked', {})
    if (!isSupabaseConfigured) {
      logOAuthError('google', new Error('Supabase not configured'))
      toast.error(t('auth.oauthSupabaseNotConfigured'))
      return
    }
    const redirectTo = getOAuthRedirectTo()
    if (!redirectTo) {
      logOAuthError('google', new Error('Missing redirect URL'))
      toast.error(t('auth.oauthNoRedirect'))
      return
    }
    setBusy('google')
    console.info('[Auth][OAuth] login start', 'google', redirectTo)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          queryParams: {
            prompt: 'select_account',
          },
        },
      })
      if (error) {
        logOAuthError('google', error)
        toast.error(describeOAuthFailure(error) || t('auth.oauthFailed'))
        return
      }
      if (data?.url) {
        console.info('[Auth][OAuth] login redirect', 'google')
        window.location.assign(data.url)
        return
      }
      logOAuthError('google', new Error('No OAuth URL from Supabase'))
      toast.error(t('auth.oauthNoRedirect'))
    } catch (e: unknown) {
      logOAuthError('google', e)
      const network =
        e instanceof TypeError ||
        (e instanceof Error && /network|failed to fetch|load failed/i.test(e.message))
      toast.error(
        network ? t('auth.oauthNetworkError') : describeOAuthFailure(e instanceof Error ? e : String(e)) || t('auth.oauthFailed')
      )
    } finally {
      setBusy(null)
    }
  }

  const onApple = async () => {
    captureProductEvent('login_apple_clicked', {})
    if (!isSupabaseConfigured) {
      logOAuthError('apple', new Error('Supabase not configured'))
      toast.error(t('auth.oauthSupabaseNotConfigured'))
      return
    }
    if (typeof window === 'undefined' || !window.location.origin) {
      logOAuthError('apple', new Error('Missing window.location.origin for Apple redirectTo'))
      toast.error(t('auth.oauthNoRedirect'))
      return
    }
    setBusy('apple')
    const appleRedirectTo = `${window.location.origin}/auth/callback`
    console.info('[Auth][OAuth] login start', 'apple', appleRedirectTo)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: appleRedirectTo,
          skipBrowserRedirect: true,
        },
      })
      if (error) {
        logOAuthError('apple', error)
        toast.error(describeOAuthFailure(error) || t('auth.oauthFailed'))
        return
      }
      if (data?.url) {
        console.info('[Auth][OAuth] login redirect', 'apple')
        window.location.assign(data.url)
        return
      }
      logOAuthError('apple', new Error('No OAuth URL from Supabase'))
      toast.error(t('auth.oauthNoRedirect'))
    } catch (e: unknown) {
      logOAuthError('apple', e)
      const network =
        e instanceof TypeError ||
        (e instanceof Error && /network|failed to fetch|load failed/i.test(e.message))
      toast.error(
        network ? t('auth.oauthNetworkError') : describeOAuthFailure(e instanceof Error ? e : String(e)) || t('auth.oauthFailed')
      )
    } finally {
      setBusy(null)
    }
  }

  const loading = disabled || !!busy

  return (
    <div className={cn('flex w-full flex-col items-stretch gap-3', className)}>
      <button
        type="button"
        onClick={() => void onApple()}
        disabled={loading}
        className={cn(oauthOutline, 'hover:bg-muted/80')}
      >
        {busy === 'apple' ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
        ) : (
          <svg className="h-4 w-4 shrink-0 text-primary" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"
            />
          </svg>
        )}
        <span>{t('auth.continueWithApple')}</span>
      </button>

      <button
        type="button"
        onClick={() => void onGoogle()}
        disabled={loading}
        className={cn(oauthOutline, 'hover:bg-muted/80')}
      >
        {busy === 'google' ? (
          <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden />
        ) : (
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
        )}
        <span>{t('auth.continueWithGoogle')}</span>
      </button>
    </div>
  )
}
