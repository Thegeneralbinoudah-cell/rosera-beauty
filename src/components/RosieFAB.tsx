import { useCallback, useEffect, useState } from 'react'
import { useInRouterContext, useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '@/hooks/useI18n'
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
    <div className="pointer-events-none fixed z-[10100] bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] end-[max(1rem,env(safe-area-inset-inline-end,0px))]">
      {showTip ? (
        <div
          role="status"
          className="pointer-events-none absolute bottom-[calc(100%+10px)] end-0 max-w-[14rem] rounded-sm border border-border bg-card px-3 py-2 text-center text-xs font-medium text-foreground shadow-floating backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-300"
          dir="rtl"
        >
          تحدثي مع روزي 💬
        </div>
      ) : null}
      <button
        type="button"
        onClick={handleClick}
        aria-label={t('profile.ai')}
        className="pointer-events-auto flex h-[60px] w-[60px] cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-card p-0 shadow-md outline-none [-webkit-tap-highlight-color:transparent] touch-manipulation animate-rosy-fab-champagne motion-reduce:animate-none"
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
            className="h-full w-full object-cover object-[center_20%]"
          />
        ) : (
          <span className="inline-flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-accent/20 text-xl font-bold text-primary">
            R
          </span>
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
      onChatRoute={pathname === '/chat' || pathname.startsWith('/chat/')}
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
      onChatRoute={pathname === '/chat' || pathname.startsWith('/chat/')}
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
