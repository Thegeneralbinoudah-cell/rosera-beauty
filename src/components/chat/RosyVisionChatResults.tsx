import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { VISION_FAIL_AR } from '@/lib/rozyVisionChatInvoke'
import { colors } from '@/theme/tokens'
import type { RozyVisionChatResult } from '@/lib/rozyVisionChatTypes'
import type { RozyVisionResult } from '@/lib/rozyVisionTypes'

function parseHex(s: string): string | null {
  const m = s.match(/#[0-9A-Fa-f]{6}/)
  return m ? m[0].toUpperCase() : null
}

function splitNameReason(s: string): { name: string; reason?: string } {
  const parts = s
    .split(/[—–\-]/)
    .map((x) => x.trim())
    .filter(Boolean)
  if (parts.length >= 2) {
    return { name: parts[0], reason: parts.slice(1).join(' — ') }
  }
  return { name: s }
}

const CUT_EMOJI = ['✨', '💇', '✂️', '🌸'] as const

function UndertoneBadge({ undertone, label }: { undertone: string; label: string }) {
  const tone = undertone.toLowerCase()
  const cls =
    tone === 'warm'
      ? 'border-amber-400/50 bg-amber-100/90 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'
      : tone === 'cool'
        ? 'border-blue-400/45 bg-blue-100/90 text-blue-950 dark:bg-blue-950/40 dark:text-blue-100'
        : tone === 'neutral'
          ? 'border-primary/35 bg-primary-subtle text-foreground dark:bg-primary/25 dark:text-foreground'
          : 'border-border bg-muted text-muted-foreground'
  return (
    <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold', cls)}>{label}</span>
  )
}

function RoutineAccordion({ steps, title }: { steps: string[]; title: string }) {
  return (
    <section className="space-y-2">
      <h4 className="text-sm font-bold text-foreground">{title}</h4>
      <div className="space-y-2">
        {steps.map((step, i) => (
          <details
            key={`${title}-${i}`}
            className="group luxury-card border-primary/12 bg-gradient-to-br from-card to-primary/[0.03] p-0 open:ring-1 open:ring-gold/20"
          >
            <summary className="cursor-pointer list-none rounded-3xl px-4 py-3 text-start text-sm font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                <span>
                  <span className="text-gold">الخطوة {i + 1}</span>
                  <span className="mr-2 font-medium text-muted-foreground">
                    — {step.length > 56 ? `${step.slice(0, 56)}…` : step}
                  </span>
                </span>
                <span className="text-xs text-gold transition group-open:rotate-180" aria-hidden>
                  ▼
                </span>
              </span>
            </summary>
            <div className="border-t border-primary/10 px-4 pb-3 pt-1">
              <p className="text-sm font-medium leading-relaxed text-foreground">{step}</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}

function ConditionBadge({ condition }: { condition: 'normal' | 'needs_care' | 'needs_specialist' }) {
  const map = {
    normal: { label: 'ممتازة', cls: 'border-emerald-400/50 bg-emerald-100/90 text-emerald-950 dark:bg-emerald-950/35 dark:text-emerald-50' },
    needs_care: { label: 'تحتاج عناية', cls: 'border-amber-400/50 bg-amber-100/90 text-amber-950 dark:bg-amber-950/35 dark:text-amber-50' },
    needs_specialist: { label: 'يُنصح بأخصائية', cls: 'border-red-400/50 bg-red-100/90 text-red-950 dark:bg-red-950/35 dark:text-red-50' },
  } as const
  const x = map[condition]
  return (
    <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold', x.cls)}>{x.label}</span>
  )
}

function LegacyHandFace({ result }: { result: RozyVisionResult }) {
  const nav = useNavigate()
  return (
    <div className="space-y-3 text-start">
      <p className="text-sm font-medium leading-relaxed text-foreground">{result.summaryAr}</p>
      {result.recommendedColors.length > 0 ? (
        <div>
          <p className="text-xs font-bold text-primary">ألوان مقترحة</p>
          <ul className="mt-1 list-disc pr-4 text-sm text-muted-foreground">
            {result.recommendedColors.slice(0, 8).map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <Button
        type="button"
        className="w-full rounded-2xl gradient-primary text-primary-foreground shadow-md"
        onClick={() => nav('/map')}
      >
        استكشفي الصالونات على الخريطة ✨
      </Button>
    </div>
  )
}

export function RosyVisionChatResults({ result }: { result: RozyVisionChatResult | null }) {
  const nav = useNavigate()

  if (result == null) {
    return <p className="text-sm font-medium leading-relaxed text-muted-foreground">{VISION_FAIL_AR}</p>
  }

  if (result.mode === 'hand' || result.mode === 'face') {
    return <LegacyHandFace result={result.result} />
  }

  if (result.mode === 'hand_nail') {
    const a = result.advisor_result
    return (
      <div className="space-y-4 text-start" dir="rtl">
        <div className="flex flex-wrap items-center gap-2">
          <UndertoneBadge undertone={a.undertone} label={a.undertone_ar} />
        </div>
        <p className="text-sm font-medium leading-relaxed text-foreground">{a.explanation_ar}</p>
        <div>
          <p className="text-sm font-bold text-foreground">ألوان تناسبك 💅</p>
          <div className="mt-3 flex flex-wrap gap-4">
            {a.nail_colors.map((c, i) => (
              <div key={i} className="flex min-w-[4.5rem] flex-col items-center gap-1.5 text-center">
                <div
                  className="h-10 w-10 shrink-0 rounded-full border-2 border-border/60 shadow-sm ring-2 ring-white"
                  style={{ backgroundColor: c.hex }}
                  title={c.name_en}
                />
                <span className="max-w-[6rem] text-[11px] font-bold leading-tight text-foreground">{c.name_ar}</span>
                <span className="max-w-[6rem] text-[10px] font-medium text-muted-foreground">{c.brand}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">تجنبي هذه الألوان</p>
          <div className="mt-3 flex flex-wrap gap-4">
            {a.avoid_colors.map((line, i) => {
              const { name, reason } = splitNameReason(line)
              const hex = parseHex(line) ?? colors.neutral400
              return (
                <div key={i} className="flex min-w-[4rem] flex-col items-center gap-1 text-center">
                  <div
                    className="h-7 w-7 shrink-0 rounded-full border border-border/50 shadow-inner"
                    style={{ backgroundColor: hex }}
                  />
                  <span className="max-w-[5.5rem] text-[10px] font-semibold leading-tight text-foreground">{name}</span>
                  {reason ? <span className="max-w-[5.5rem] text-[9px] text-muted-foreground">{reason}</span> : null}
                </div>
              )
            })}
          </div>
        </div>
        <Button
          type="button"
          className="w-full rounded-2xl gradient-primary text-primary-foreground shadow-md ring-1 ring-gold/25"
          onClick={() => nav('/map')}
        >
          احجزي جلسة مناكير 💅
        </Button>
      </div>
    )
  }

  if (result.mode === 'hair_color') {
    const a = result.advisor_result
    const summaryLine = `نظرة عامة على إطلالتكِ: بشرة ${a.skin_tone} وعينان ${a.eye_color} — الصبغات أدناه تُنسّق مع نبرتكِ بلمسة فاخرة.`
    return (
      <div className="space-y-4 text-start" dir="rtl">
        <div className="flex flex-wrap gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-muted-foreground">لون البشرة</span>
            <span className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              {a.skin_tone}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-muted-foreground">لون العين</span>
            <span className="rounded-full border border-gold/30 bg-gold-subtle/80 px-3 py-1 text-xs font-bold text-gold-foreground">
              {a.eye_color}
            </span>
          </div>
        </div>
        <p className="text-sm font-medium leading-relaxed text-foreground">{summaryLine}</p>
        <div>
          <p className="text-sm font-bold text-foreground">صبغات تناسبك ✨</p>
          <div className="mt-3 flex flex-wrap gap-5">
            {a.recommended_colors.map((c, i) => (
              <div key={i} className="flex min-w-[5rem] max-w-[10rem] flex-col items-center gap-2 text-center">
                <div
                  className="h-10 w-10 shrink-0 rounded-full border-2 border-border/60 shadow-md ring-2 ring-gold/15"
                  style={{ backgroundColor: c.hex }}
                />
                <span className="text-xs font-bold leading-tight text-foreground">{c.name_ar}</span>
                <div className="flex flex-wrap justify-center gap-1">
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground">
                    {c.technique_ar}
                  </span>
                  <span className="rounded-full border border-gold/35 bg-accent/80 px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                    {c.maintenance_ar}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">تجنبي</p>
          <div className="mt-3 flex flex-wrap gap-4">
            {a.avoid_colors.slice(0, 2).map((line, i) => {
              const { name, reason } = splitNameReason(line)
              const hex = parseHex(line) ?? colors.neutral600
              return (
                <div key={i} className="flex min-w-[4rem] flex-col items-center gap-1 text-center">
                  <div className="h-7 w-7 shrink-0 rounded-full border border-border/60" style={{ backgroundColor: hex }} />
                  <span className="max-w-[6rem] text-[10px] font-semibold text-foreground">{name}</span>
                  {reason ? <span className="max-w-[6rem] text-[9px] text-muted-foreground">{reason}</span> : null}
                </div>
              )
            })}
          </div>
        </div>
        <p className="text-[11px] font-medium leading-relaxed text-muted-foreground">{a.disclaimer_ar}</p>
        <Button
          type="button"
          className="w-full rounded-2xl gradient-primary text-primary-foreground shadow-md ring-1 ring-gold/25"
          onClick={() => nav('/map')}
        >
          احجزي جلسة صبغ 💇‍♀️
        </Button>
      </div>
    )
  }

  if (result.mode === 'haircut') {
    const a = result.advisor_result
    return (
      <div className="space-y-4 text-start" dir="rtl">
        <span className="inline-flex rounded-full border-2 border-primary bg-muted px-4 py-1.5 text-xs font-extrabold text-primary shadow-sm ring-1 ring-gold/15 dark:bg-primary/15 dark:text-primary">
          {a.face_shape_ar}
        </span>
        <p className="text-sm font-medium leading-relaxed text-foreground">
          نسب وجهِكِ تقترب من أسلوب <span className="font-bold text-primary">{a.face_shape_ar}</span> — والقصات أدناه تُبرز ملامحكِ بلمسة أنثوية ناعمة.
        </p>
        <div>
          <p className="text-sm font-bold text-foreground">قصات تناسبك ✂️</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {a.recommended_cuts.map((c, i) => (
              <div
                key={i}
                className="luxury-card border-primary/15 bg-gradient-to-br from-card via-primary/[0.04] to-gold-subtle/30 p-4 ring-1 ring-gold/10"
              >
                <div className="flex items-start gap-2">
                  <span className="text-2xl" aria-hidden>
                    {CUT_EMOJI[i % CUT_EMOJI.length]}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-bold text-foreground">{c.name_ar}</p>
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{c.name_en}</p>
                    <span className="inline-block rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-bold text-primary">
                      {c.length_ar}
                    </span>
                    <p className="text-xs font-medium leading-relaxed text-muted-foreground">{c.description_ar}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">تجنبي</p>
          <ul className="mt-2 space-y-2">
            {a.avoid_cuts.map((x, i) => (
              <li key={i} className="text-xs font-medium text-muted-foreground">
                <span className="font-bold text-foreground">{x.name_ar}</span>
                {x.reason_ar ? <span className="mr-1"> — {x.reason_ar}</span> : null}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border border-amber-400/35 bg-gradient-to-br from-amber-50/95 via-gold-subtle/60 to-card p-4 shadow-inner ring-1 ring-gold/25 dark:from-amber-950/30 dark:via-card dark:to-card">
          <p className="text-xs font-bold text-amber-900 dark:text-amber-100">لمسة إطلالة ذهبية ✨</p>
          <p className="mt-2 text-sm font-medium leading-relaxed text-amber-950/90 dark:text-amber-50/95">{a.styling_tip_ar}</p>
        </div>
        <Button
          type="button"
          className="w-full rounded-2xl gradient-primary text-primary-foreground shadow-md ring-1 ring-gold/25"
          onClick={() => nav('/map')}
        >
          احجزي قصة شعر ✂️
        </Button>
      </div>
    )
  }

  if (result.mode === 'skin_analysis') {
    const a = result.advisor_result
    const skinSummary =
      [a.skin_type, a.concerns.slice(0, 2).join('، ')].filter(Boolean).join(' — ') || 'ملخص بسيط لبشرتِكِ أدناه 💕'
    const hasSalonService = a.clinic_services.some((s) => s.service_type === 'salon')

    return (
      <div className="space-y-4 text-start" dir="rtl">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            {a.skin_type}
          </span>
          <ConditionBadge condition={a.condition} />
        </div>
        <p className="text-sm font-medium leading-relaxed text-foreground">{skinSummary}</p>
        {a.concerns.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {a.concerns.map((c, i) => (
              <span
                key={i}
                className="rounded-full border border-primary/20 bg-gradient-to-r from-muted to-primary/10 px-3 py-1 text-[11px] font-bold text-primary dark:from-primary/15 dark:to-card"
              >
                {c}
              </span>
            ))}
          </div>
        ) : null}

        <RoutineAccordion steps={a.skincare_routine.morning} title="روتينك الصباحي ☀️" />
        <RoutineAccordion steps={a.skincare_routine.evening} title="روتينك المسائي 🌙" />

        <section className="space-y-2">
          <h4 className="text-sm font-bold text-foreground">علاجات موصى بها 🧴</h4>
          <div className="space-y-3">
            {a.treatments.map((t, i) => (
              <div key={i} className="luxury-card border-primary/12 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-foreground">{t.name_ar}</p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-foreground">{t.brand}</span>
                </div>
                <p className="mt-1 text-[11px] font-medium text-muted-foreground">
                  <span className="font-semibold text-foreground">للاهتمام:</span>{' '}
                  {a.concerns[0] ?? 'عناية يومية'}
                </p>
                <p className="mt-2 text-xs font-medium leading-relaxed text-foreground">{t.reason_ar}</p>
              </div>
            ))}
          </div>
        </section>

        {a.clinic_needed && a.clinic_services.length > 0 ? (
          <section className="space-y-2">
            <h4 className="text-sm font-bold text-foreground">خدمات متخصصة 💆‍♀️</h4>
            <div className="space-y-3">
              {a.clinic_services.map((cs, i) => {
                const urgent =
                  cs.service_type === 'clinic' && a.condition === 'needs_specialist'
                    ? 'high'
                    : a.condition === 'needs_specialist'
                      ? 'mid'
                      : a.condition === 'needs_care'
                        ? 'mid'
                        : 'low'
                return (
                <div key={i} className="luxury-card border-primary/15 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-bold text-primary">
                      {cs.service_type === 'salon' ? 'صالون' : 'عيادة'}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold',
                        urgent === 'high'
                          ? 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-100'
                          : urgent === 'mid'
                            ? 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-50'
                            : 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-50',
                      )}
                    >
                      {urgent === 'high' ? 'أولوية عالية' : urgent === 'mid' ? 'موصى به' : 'متابعة'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-bold text-foreground">{cs.name_ar}</p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">{cs.note_ar}</p>
                  {cs.service_type === 'salon' ? (
                    <Button
                      type="button"
                      className="mt-3 w-full rounded-2xl gradient-primary text-primary-foreground"
                      onClick={() => nav('/map')}
                    >
                      احجزي الآن
                    </Button>
                  ) : (
                    <p className="mt-3 text-center text-xs font-semibold text-muted-foreground">راجعي عيادة متخصصة</p>
                  )}
                </div>
                )
              })}
            </div>
          </section>
        ) : null}

        <p className="text-[11px] font-medium leading-relaxed text-muted-foreground">{a.disclaimer_ar}</p>

        {hasSalonService ? (
          <Button
            type="button"
            className="w-full rounded-2xl gradient-primary text-primary-foreground shadow-md ring-1 ring-gold/25"
            onClick={() => nav('/map')}
          >
            احجزي جلسة عناية 💆‍♀️
          </Button>
        ) : null}
      </div>
    )
  }

  return <p className="text-sm text-muted-foreground">{VISION_FAIL_AR}</p>
}
