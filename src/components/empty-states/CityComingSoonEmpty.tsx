import { Link } from 'react-router-dom'
import { MapPinned } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useI18n } from '@/hooks/useI18n'
import { cn } from '@/lib/utils'
import { colors } from '@/theme/colors'

function CitySkylineIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-full max-w-[220px] select-none', className)}
      viewBox="0 0 220 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id="ccse-bg" x1="110" y1="0" x2="110" y2="180" gradientUnits="userSpaceOnUse">
          <stop stopColor={colors.surface} />
          <stop offset="1" stopColor={colors.secondary} />
        </linearGradient>
        <linearGradient id="ccse-bld" x1="0" y1="0" x2="220" y2="180" gradientUnits="userSpaceOnUse">
          <stop stopColor={colors.primary} stopOpacity="0.95" />
          <stop offset="1" stopColor={colors.primary} stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="ccse-accent" x1="160" y1="40" x2="200" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor={colors.secondary} />
          <stop offset="1" stopColor={colors.primary} />
        </linearGradient>
      </defs>
      <ellipse cx="110" cy="100" rx="88" ry="72" fill="url(#ccse-bg)" />
      <ellipse cx="110" cy="118" rx="72" ry="8" fill={colors.primary} fillOpacity="0.12" />

      <g>
        <path
          d="M38 128V88c0-4 3.5-7 8-7h18c4.5 0 8 3 8 7v40H38Z"
          fill="url(#ccse-bld)"
          fillOpacity="0.35"
        />
        <path
          d="M72 128V72c0-5 4-9 9-9h22c5 0 9 4 9 9v56H72Z"
          fill="url(#ccse-bld)"
          fillOpacity="0.5"
        />
        <path
          d="M118 128V62c0-5.5 4.5-10 10-10h24c5.5 0 10 4.5 10 10v66h-44Z"
          fill="url(#ccse-bld)"
          fillOpacity="0.65"
        />
        <path
          d="M168 128V96c0-4 3.5-7 8-7h16c4.5 0 8 3 8 7v32h-32Z"
          fill="url(#ccse-bld)"
          fillOpacity="0.4"
        />
      </g>

      <g fill={colors.error} fillOpacity="0.22">
        <circle cx="84" cy="98" r="2.5" />
        <circle cx="92" cy="98" r="2.5" />
        <circle cx="84" cy="108" r="2.5" />
        <circle cx="92" cy="108" r="2.5" />
        <circle cx="138" cy="88" r="2.5" />
        <circle cx="148" cy="88" r="2.5" />
        <circle cx="138" cy="100" r="2.5" />
        <circle cx="148" cy="100" r="2.5" />
        <circle cx="138" cy="112" r="2.5" />
        <circle cx="148" cy="112" r="2.5" />
      </g>

      <path
        d="M175 52c2.5 0 4.5-2 4.5-4.5S177.5 43 175 43s-4.5 2-4.5 4.5 2 4.5 4.5 4.5Z"
        fill="url(#ccse-accent)"
      />
      <path
        d="M175 38v8M171 42h8"
        stroke={colors.error}
        strokeOpacity="0.35"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M48 46l2 4.5 5 .8-3.6 3.4.9 5-4.4-2.4-4.4 2.4.9-5-3.6-3.4 5-.8 2-4.5Z"
        fill={colors.primary}
        fillOpacity="0.55"
      />
      <path
        d="M188 78l1.6 3.6 3.9.6-2.8 2.7.7 3.9-3.5-1.9-3.5 1.9.7-3.9-2.8-2.7 3.9-.6 1.6-3.6Z"
        fill={colors.secondary}
        fillOpacity="0.9"
      />

      <ellipse cx="110" cy="154" rx="56" ry="3" fill={colors.primary} fillOpacity="0.15" />
    </svg>
  )
}

type CityComingSoonEmptyProps = {
  /** Where the CTA navigates — typically `/region/:id` or `/home` */
  ctaTo: string
  className?: string
}

export function CityComingSoonEmpty({ ctaTo, className }: CityComingSoonEmptyProps) {
  const { t } = useI18n()

  return (
    <div
      className={cn(
        'relative flex flex-col items-center justify-center px-6 py-14 text-center',
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-x-8 top-8 h-40 rounded-[2.5rem] opacity-90"
        style={{ backgroundImage: `linear-gradient(to bottom, ${colors.surface}, white, transparent)` }}
        aria-hidden
      />
      <div className="relative z-[1] mb-6 drop-shadow-sm">
        <CitySkylineIllustration />
      </div>
      <h2 className="font-cairo relative z-[1] max-w-[17rem] text-lg font-semibold leading-relaxed tracking-tight text-foreground">
        {t('city.emptySoon')}
      </h2>
      <p className="font-cairo relative z-[1] mt-2 max-w-[18rem] text-sm leading-relaxed text-muted-foreground">
        {t('city.emptySoonSub')}
      </p>
      <Button
        className="relative z-[1] mt-8 min-w-[12rem] shadow-soft"
        size="lg"
        asChild
      >
        <Link to={ctaTo} className="gap-2">
          <MapPinned className="size-4 opacity-90" aria-hidden />
          {t('city.browseOtherCities')}
        </Link>
      </Button>
    </div>
  )
}
