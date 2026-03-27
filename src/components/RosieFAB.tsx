import { useCallback, useEffect, useState } from 'react'
import { useInRouterContext, useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '@/hooks/useI18n'
import { ROSERA_LOGO_SRC } from '@/lib/branding'
/** Bundled portrait (woman, beauty/spa — Unsplash license at source) — always available offline */
import rozyFabPortrait from '@/assets/rozy-fab-portrait.jpg'

const ROSEY_FAB_TIP_KEY = 'rosera_rosy_fab_tip_v1'

export type RosieFABProps = {
  /** Defaults to navigating to `/chat` (Rosy / Ai chat). */
  onPress?: () => void
}

function RosieFABShell({
  onPress,
  onChatRoute,
  onDefaultNavigate,
}: RosieFABProps & {
  onChatRoute: boolean
  onDefaultNavigate: () => void
}) {
  const { t } = useI18n()
  const [imgOk, setImgOk] = useState(true)
  const [showTip, setShowTip] = useState(() => {
    try {
      return localStorage.getItem(ROSEY_FAB_TIP_KEY) !== '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (!showTip) return
    const hide = window.setTimeout(() => {
      setShowTip(false)
      try {
        localStorage.setItem(ROSEY_FAB_TIP_KEY, '1')
      } catch {
        /* ignore */
      }
    }, 6500)
    return () => window.clearTimeout(hide)
  }, [showTip])

  const handleClick = useCallback(() => {
    setShowTip(false)
    try {
      localStorage.setItem(ROSEY_FAB_TIP_KEY, '1')
    } catch {
      /* ignore */
    }
    if (onPress) onPress()
    else onDefaultNavigate()
  }, [onPress, onDefaultNavigate])

  if (onChatRoute) return null

  return (
    <div
      className="pointer-events-none fixed z-[10040]"
      style={{
        bottom: 'calc(5.75rem + env(safe-area-inset-bottom, 0px))',
        insetInlineEnd: 'max(16px, env(safe-area-inset-inline-end, 0px))',
      }}
    >
      {showTip ? (
        <div
          role="status"
          className="pointer-events-none absolute bottom-[calc(100%+10px)] end-0 max-w-[14rem] rounded-sm border border-accent/50 bg-card/95 px-3 py-2 text-center text-xs font-medium text-foreground shadow-floating backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-300"
          dir="rtl"
        >
          تحدثي مع روزي 💬
        </div>
      ) : null}
      <button
        type="button"
        onClick={handleClick}
        aria-label={t('profile.ai')}
        className="pointer-events-auto touch-manipulation animate-rosy-fab-champagne motion-reduce:animate-none"
        style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          padding: 0,
          margin: 0,
          border: '2px solid hsl(var(--primary))',
          backgroundColor: 'var(--color-surface)',
          boxShadow: '0 8px 28px rgba(0,0,0,0.12), 0 0 0 1px rgba(244,114,182,0.2)',
          cursor: 'pointer',
          WebkitTapHighlightColor: 'transparent',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {imgOk ? (
          <img
            src={rozyFabPortrait}
            alt=""
            width={60}
            height={60}
            decoding="async"
            fetchPriority="high"
            onError={() => setImgOk(false)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center 20%',
            }}
          />
        ) : (
          <img
            src={ROSERA_LOGO_SRC}
            alt=""
            width={44}
            height={44}
            decoding="async"
            className="object-contain p-1"
          />
        )}
      </button>
    </div>
  )
}

function RosieFABInRouter(props: RosieFABProps) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const onDefaultNavigate = useCallback(() => {
    navigate('/chat')
  }, [navigate])

  return (
    <RosieFABShell
      {...props}
      onChatRoute={pathname === '/chat'}
      onDefaultNavigate={onDefaultNavigate}
    />
  )
}

function RosieFABOutsideRouter(props: RosieFABProps) {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
  const onDefaultNavigate = useCallback(() => {
    window.location.assign('/chat')
  }, [])

  return (
    <RosieFABShell
      {...props}
      onChatRoute={pathname === '/chat'}
      onDefaultNavigate={onDefaultNavigate}
    />
  )
}

/**
 * Rosie assistant FAB — fixed above bottom nav; champagne border + portrait + idle pulse.
 */
export function RosieFAB(props: RosieFABProps) {
  const inRouter = useInRouterContext()
  if (inRouter) {
    return <RosieFABInRouter {...props} />
  }
  return <RosieFABOutsideRouter {...props} />
}
