import { useCallback, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { MessageCircle, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FloatingActionButton } from '@/components/ui/floating-action-button'
import { useI18n } from '@/hooks/useI18n'
import { useRosyPanel } from '@/contexts/RosyPanelContext'

/** فوق BottomNav — لا يتداخل مع زر الرجوع (أعلى) أو شريط التنقل */
const ROSY_BOTTOM = 'calc(90px + env(safe-area-inset-bottom, 0px))'

const SPARK_ANGLES = [0, 60, 120, 180, 240, 300] as const

function rosyHaptic() {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(10)
    }
  } catch {
    /* ignore */
  }
}

export function RosyFloatingButton() {
  const { t } = useI18n()
  const { setOpen } = useRosyPanel()
  const location = useLocation()
  const onChatRoute = location.pathname === '/chat'
  const [burstId, setBurstId] = useState(0)

  const handleClick = useCallback(() => {
    rosyHaptic()
    setBurstId((n) => n + 1)
    setOpen(true)
  }, [setOpen])

  if (onChatRoute) return null

  return (
    <FloatingActionButton
      onClick={handleClick}
      className={cn('group hover:scale-105')}
      style={{
        bottom: ROSY_BOTTOM,
        insetInlineEnd: 'max(16px, env(safe-area-inset-inline-end, 0px))',
      }}
      aria-label={t('profile.ai')}
    >
      {/* طبقة انفجار النقر — 300ms */}
      {burstId > 0 ? (
        <span
          key={burstId}
          className="pointer-events-none absolute inset-0 flex items-center justify-center motion-reduce:hidden"
          aria-hidden
        >
          <span
            className={cn(
              'absolute h-[78%] w-[78%] rounded-full',
              'bg-[radial-gradient(circle_at_center,rgba(244,114,182,0.55)_0%,rgba(251,191,36,0.2)_45%,transparent_70%)]',
              'shadow-[0_0_24px_rgba(244,114,182,0.5)]',
              'animate-rosy-click-burst'
            )}
          />
          {SPARK_ANGLES.map((deg) => (
            <span
              key={`${burstId}-${deg}`}
              className="pointer-events-none absolute flex h-0 w-0 items-start justify-center"
              style={{ transform: `rotate(${deg}deg)` }}
            >
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full bg-gradient-to-br from-white to-amber-100/90 shadow-sm',
                  'animate-rosy-spark-fly'
                )}
              />
            </span>
          ))}
        </span>
      ) : null}

      {/* جسم الزر: توهج متعدد الطبقات + عوم + تنفس */}
      <span
        className={cn(
          'relative flex h-full w-full items-center justify-center rounded-full',
          'bg-gradient-to-br from-[#f472b6]/95 via-[#f9a8d4]/95 to-[#fbbf24]/95 backdrop-blur-md',
          'shadow-[0_0_20px_rgba(244,114,182,0.4),0_0_40px_rgba(251,191,0.25),0_8px_28px_rgba(190,24,93,0.14)]',
          'ring-2 ring-white/90 dark:ring-white/25',
          /* توهج داخلي وردي ناعم */
          "before:pointer-events-none before:absolute before:inset-[2px] before:rounded-full before:content-[''] before:shadow-[inset_0_0_22px_rgba(244,114,182,0.45),inset_0_-2px_12px_rgba(255,255,255,0.25)]",
          'animate-rosy-float-breathe motion-reduce:animate-none'
        )}
      >
        {/* أيقونة: محادثة + بريق — دوران خفيف عند hover */}
        <span
          className={cn(
            'relative flex items-center justify-center transition-transform duration-300 ease-out',
            'group-hover:-rotate-[3deg]'
          )}
        >
          <MessageCircle
            className="relative z-[1] h-7 w-7 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.12)]"
            strokeWidth={2}
            aria-hidden
          />
          <Sparkles
            className={cn(
              'absolute -right-0.5 -top-1 z-[2] h-4 w-4',
              'text-amber-100 drop-shadow-[0_0_8px_rgba(251,191,36,0.95)]',
              'motion-safe:animate-pulse'
            )}
            strokeWidth={2.2}
            aria-hidden
          />
        </span>
      </span>
    </FloatingActionButton>
  )
}
