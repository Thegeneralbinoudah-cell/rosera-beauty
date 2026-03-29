import { useCallback, useEffect, useState } from 'react'
import { useInRouterContext, useLocation, useNavigate } from 'react-router-dom'
import { Camera, Mic } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
/** Bundled Rosie icon image — always available offline */
import rozyFabPortrait from '@/assets/rozy.png'

const ROSEY_FAB_TIP_KEY = 'rosera_rosy_fab_tip_v1'

export type RosieFABProps = {
  /** Defaults to navigating to `/chat` (Rosy / Ai chat). */
  onPress?: () => void
}

function shouldHideRosieFab(pathname: string): boolean {
  // Explicitly keep Rosie visible across beauty-store experience.
  if (
    pathname === '/store' ||
    pathname.startsWith('/store/') ||
    pathname.startsWith('/product/') ||
    pathname === '/cart' ||
    pathname === '/checkout'
  ) {
    return false
  }

  return (
    pathname === '/chat' ||
    pathname.startsWith('/chat/') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/owner') ||
    pathname.startsWith('/salon')
  )
}

function RosieFABShell({
  onPress,
  onChatRoute,
  onDefaultNavigate,
  showStoreActions,
  onVoiceNavigate,
  onCameraNavigate,
  elevatedForChat,
}: RosieFABProps & {
  onChatRoute: boolean
  onDefaultNavigate: () => void
  showStoreActions: boolean
  onVoiceNavigate: () => void
  onCameraNavigate: () => void
  elevatedForChat: boolean
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

  const handleVoiceClick = useCallback(() => {
    setShowTip(false)
    try {
      localStorage.setItem(ROSEY_FAB_TIP_KEY, '1')
    } catch {
      /* ignore */
    }
    onVoiceNavigate()
  }, [onVoiceNavigate])

  const handleCameraClick = useCallback(() => {
    setShowTip(false)
    try {
      localStorage.setItem(ROSEY_FAB_TIP_KEY, '1')
    } catch {
      /* ignore */
    }
    onCameraNavigate()
  }, [onCameraNavigate])

  if (onChatRoute) return null

  return (
    <div
      className="pointer-events-none fixed z-[10100] end-[max(1rem,env(safe-area-inset-inline-end,0px))]"
      style={{
        bottom: elevatedForChat
          ? 'calc(10.75rem + env(safe-area-inset-bottom, 0px))'
          : 'calc(5.75rem + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {showTip ? (
        <div
          role="status"
          className="pointer-events-none absolute bottom-[calc(100%+10px)] end-0 max-w-[14rem] rounded-sm border border-border bg-card px-3 py-2 text-center text-xs font-medium text-foreground shadow-floating backdrop-blur-sm animate-in fade-in slide-in-from-bottom-2 duration-300"
          dir="rtl"
        >
          تحدثي مع روزي
        </div>
      ) : null}
      {showStoreActions ? (
        <div className="pointer-events-auto mb-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleCameraClick}
            aria-label="تصوير مع روزي"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/30 bg-card text-primary shadow-md transition-transform active:scale-95"
          >
            <Camera className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={handleVoiceClick}
            aria-label="محادثة صوتية مع روزي"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-primary/30 bg-card text-primary shadow-md transition-transform active:scale-95"
          >
            <Mic className="h-5 w-5" aria-hidden />
          </button>
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
            className="h-full w-full object-cover object-center"
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
  const isChatRoute = pathname === '/chat' || pathname.startsWith('/chat/')
  const onStoreRoute = pathname === '/store' || pathname.startsWith('/store/')
  const onDefaultNavigate = useCallback(() => {
    navigate('/chat')
  }, [navigate])
  const onVoiceNavigate = useCallback(() => {
    navigate('/chat?launch=voice')
  }, [navigate])
  const onCameraNavigate = useCallback(() => {
    navigate('/chat?launch=camera')
  }, [navigate])

  return (
    <RosieFABShell
      {...props}
      onChatRoute={shouldHideRosieFab(pathname)}
      onDefaultNavigate={onDefaultNavigate}
      showStoreActions={onStoreRoute}
      onVoiceNavigate={onVoiceNavigate}
      onCameraNavigate={onCameraNavigate}
      elevatedForChat={isChatRoute}
    />
  )
}

function RosieFABOutsideRouter(props: RosieFABProps) {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : ''
  const isChatRoute = pathname === '/chat' || pathname.startsWith('/chat/')
  const onStoreRoute = pathname === '/store' || pathname.startsWith('/store/')
  const onDefaultNavigate = useCallback(() => {
    window.location.assign('/chat')
  }, [])
  const onVoiceNavigate = useCallback(() => {
    window.location.assign('/chat?launch=voice')
  }, [])
  const onCameraNavigate = useCallback(() => {
    window.location.assign('/chat?launch=camera')
  }, [])

  return (
    <RosieFABShell
      {...props}
      onChatRoute={shouldHideRosieFab(pathname)}
      onDefaultNavigate={onDefaultNavigate}
      showStoreActions={onStoreRoute}
      onVoiceNavigate={onVoiceNavigate}
      onCameraNavigate={onCameraNavigate}
      elevatedForChat={isChatRoute}
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
