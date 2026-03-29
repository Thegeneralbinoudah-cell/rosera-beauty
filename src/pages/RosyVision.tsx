import { useState, useCallback, useEffect, useMemo, useRef, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Camera, Hand, UserRound, Loader2, ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import {
  invokeRozyVision,
  MAX_ROZY_VISION_IMAGE_BYTES,
  RozyVisionInvokeAbortedError,
} from '@/lib/rozyVision'
import { captureVisionFailed } from '@/lib/posthog'
import type {
  RozyVisionFaceShape,
  RozyVisionMode,
  RozyVisionResult,
  RozyVisionUndertone,
} from '@/lib/rozyVisionTypes'
import { colors } from '@/theme/colors'
import {
  ConfidenceBadge,
  ColorSwatches,
  HandNailPreviewCard,
  ResultCard,
  RozyVisionRememberCard,
  RosyVisionSalonSuggestions,
  useRosyVisionUserPosition,
  VisionResultCtas,
} from '@/components/rozy-vision'
import { trackRosyVisionProductEvent } from '@/lib/analytics'
import {
  buildPersonalizationHintForVision,
  loadRozyVisionPersonalization,
  persistRozyVisionPersonalization,
  styleKeywordsForRecommendations,
  type RozyVisionPersonalizationV1,
} from '@/lib/rozyVisionPersonalization'
import { cn } from '@/lib/utils'

const undertoneAr: Record<RozyVisionUndertone, string> = {
  warm: 'دافئ',
  cool: 'بارد',
  neutral: 'محايد',
  uncertain: 'غير محدد',
}

const faceShapeAr: Record<RozyVisionFaceShape, string> = {
  oval: 'بيضاوي',
  round: 'مستدير',
  square: 'مربّع',
  heart: 'على شكل قلب',
  uncertain: 'غير محدد',
}

function readFileAsBase64(file: File): Promise<{ base64: string; mime: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const s = reader.result
      if (typeof s !== 'string') {
        reject(new Error('تعذر قراءة الصورة'))
        return
      }
      const comma = s.indexOf(',')
      if (comma < 0) {
        reject(new Error('تعذر ترميز الصورة'))
        return
      }
      resolve({ base64: s.slice(comma + 1), mime: file.type || 'image/jpeg' })
    }
    reader.onerror = () => reject(reader.error ?? new Error('فشل قراءة الملف'))
    reader.readAsDataURL(file)
  })
}

export default function RosyVision() {
  const { user } = useAuth()
  const nav = useNavigate()
  const mountedRef = useRef(true)
  const invokeAbortRef = useRef<AbortController | null>(null)
  const [mode, setMode] = useState<RozyVisionMode>('hand')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RozyVisionResult | null>(null)
  const [personalization, setPersonalization] = useState<RozyVisionPersonalizationV1 | null>(null)
  const [invokeError, setInvokeError] = useState<string | null>(null)
  /** Nearest salon + matched manicure/hair service for direct booking (set by RosyVisionSalonSuggestions) */
  const [rozyBookTarget, setRozyBookTarget] = useState<{ salonId: string; serviceId: string } | null>(null)
  const userPos = useRosyVisionUserPosition()
  const previewUrlRef = useRef<string | null>(null)

  useEffect(() => {
    previewUrlRef.current = previewUrl
  }, [previewUrl])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      invokeAbortRef.current?.abort()
      const u = previewUrlRef.current
      if (u) {
        URL.revokeObjectURL(u)
        previewUrlRef.current = null
      }
    }
  }, [])

  const boostKeywords = useMemo(
    () => (personalization ? styleKeywordsForRecommendations(personalization) : []),
    [personalization],
  )

  useEffect(() => {
    if (!result?.qualityOk) setRozyBookTarget(null)
  }, [result?.qualityOk])

  useEffect(() => {
    if (!user?.id) {
      setPersonalization(null)
      return
    }
    let c = true
    void loadRozyVisionPersonalization(user.id).then((p) => {
      if (c) setPersonalization(p)
    })
    return () => {
      c = false
    }
  }, [user?.id])

  const onPick = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !f.type.startsWith('image/')) {
      toast.error('اختيار صورة صالحة فقط')
      return
    }
    if (f.size > MAX_ROZY_VISION_IMAGE_BYTES) {
      toast.error('الصورة كبيرة جداً — اختاري ملفاً أصغر (حتى حوالي ٣.٨ ميجابايت)')
      return
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setInvokeError(null)
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
    setResult(null)
  }

  const run = useCallback(async () => {
    if (!user || !file) {
      toast.error('اختيار صورة أولاً')
      return
    }
    invokeAbortRef.current?.abort()
    const ac = new AbortController()
    invokeAbortRef.current = ac
    setLoading(true)
    setResult(null)
    setInvokeError(null)
    setRozyBookTarget(null)
    if (mode === 'hand') {
      trackRosyVisionProductEvent('rosy_hand_analysis_started')
    }
    try {
      const { base64, mime } = await readFileAsBase64(file)
      const pers = personalization ?? (await loadRozyVisionPersonalization(user.id))
      if (!mountedRef.current) return
      const hint = buildPersonalizationHintForVision(pers, mode)
      const r = await invokeRozyVision({
        mode,
        imageBase64: base64,
        imageMimeType: mime,
        signal: ac.signal,
        ...(hint ? { personalizationHint: hint } : {}),
      })
      if (!mountedRef.current) return
      setResult(r)
      if (r.qualityOk) {
        void persistRozyVisionPersonalization(user.id, r).then((out) => {
          if (!mountedRef.current) return
          if (!out.ok) {
            toast.error(`لم نُحفظ تفضيلاتكِ على الحساب: ${out.error}`)
            return
          }
          void loadRozyVisionPersonalization(user.id).then((p) => {
            if (mountedRef.current) setPersonalization(p)
          })
        })
      }
      if (mode === 'hand') {
        trackRosyVisionProductEvent('rosy_hand_analysis_completed', {
          quality_ok: r.qualityOk,
          confidence: r.confidence,
        })
      }
      if (mode === 'face') {
        trackRosyVisionProductEvent('rosy_hair_analysis_completed', {
          quality_ok: r.qualityOk,
          confidence: r.confidence,
        })
      }
      if (!r.qualityOk) {
        toast.message('الصورة تحتاج وضوحاً أعلى — راجعي النصائح أدناه', { duration: 4000 })
      } else {
        toast.success('تم التحليل')
      }
    } catch (err) {
      if (!mountedRef.current) return
      if (err instanceof RozyVisionInvokeAbortedError) return
      const msg = err instanceof Error ? err.message : 'تعذر التحليل'
      captureVisionFailed('invoke', {
        mode,
        err_name: err instanceof Error ? err.name.slice(0, 48) : 'unknown',
      })
      setInvokeError(msg)
      toast.error(msg)
    } finally {
      // Only clear loading if this run is still the active one (avoids stale run after re-analysis).
      if (mountedRef.current && invokeAbortRef.current === ac) setLoading(false)
    }
  }, [user, file, mode, personalization])

  useEffect(() => {
    if (!user) nav('/auth')
  }, [user, nav])

  if (!user) return null

  return (
    <div
      className="min-h-dvh bg-gradient-to-b via-background pb-[calc(7rem+env(safe-area-inset-bottom,0px)+4rem)] pt-[max(1rem,calc(env(safe-area-inset-top,0px)+0.75rem))] ps-[max(1rem,env(safe-area-inset-left,0px))] pe-[max(1rem,env(safe-area-inset-right,0px))] dark:from-rosera-dark dark:via-background dark:to-rosera-dark"
      style={{
        backgroundImage: `linear-gradient(to bottom, ${colors.surface}, hsl(var(--background)), color-mix(in srgb, ${colors.primary} 30%, transparent))`,
      }}
      aria-busy={loading}
    >
      <div className="mx-auto max-w-lg">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="mb-4 inline-flex min-h-[44px] items-center gap-1 text-sm font-semibold text-primary touch-manipulation"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
          رجوع
        </button>

        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/90 to-amber-400/90 text-white shadow-lg">
            <Sparkles className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-foreground">روزي فيجن</h1>
            <p className="text-sm font-medium text-foreground">تحليل ذكي — يد أو وجه</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setMode('hand')
              setResult(null)
              setInvokeError(null)
            }}
            className={cn(
              'flex min-h-[44px] touch-manipulation flex-col items-center gap-2 rounded-2xl border-2 p-4 transition disabled:',
              mode === 'hand'
                ? 'border-primary bg-primary/10 shadow-md'
                : 'border-border bg-card hover:border-primary/40'
            )}
          >
            <Hand className="h-7 w-7 text-primary" aria-hidden />
            <span className="text-sm font-bold">اليد</span>
            <span className="text-center text-[11px] text-foreground">إنديرتون + أظافر</span>
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setMode('face')
              setResult(null)
              setInvokeError(null)
            }}
            className={cn(
              'flex min-h-[44px] touch-manipulation flex-col items-center gap-2 rounded-2xl border-2 p-4 transition disabled:',
              mode === 'face'
                ? 'border-primary bg-primary/10 shadow-md'
                : 'border-border bg-card hover:border-primary/40'
            )}
          >
            <UserRound className="h-7 w-7 text-primary" aria-hidden />
            <span className="text-sm font-bold">الوجه</span>
            <span className="text-center text-[11px] text-foreground">صبغة + قصّات</span>
          </button>
        </div>

        <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/35 bg-card p-8 shadow-sm dark:bg-card/80">
          <input type="file" accept="image/*" className="hidden" onChange={onPick} disabled={loading} />
          <Camera className="mb-2 h-8 w-8 text-primary/80" aria-hidden />
          {previewUrl ? (
            <img src={previewUrl} alt="" className="mt-2 max-h-56 rounded-xl object-contain shadow-md" />
          ) : (
            <span className="text-center text-sm font-medium text-foreground">
              اضغطي لاختيار صورة واضحة
            </span>
          )}
        </label>

        <Button
          className="mt-6 w-full min-h-[44px] touch-manipulation rounded-2xl gradient-primary text-base font-bold"
          disabled={!file || loading}
          onClick={() => void run()}
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              جاري التحليل…
            </>
          ) : (
            'تحليل مع روزي'
          )}
        </Button>

        {invokeError && !result ? (
          <div className="mt-4 space-y-3 rounded-2xl border border-destructive/25 bg-destructive/5 p-4 text-center">
            <p className="text-body-sm font-medium text-destructive">{invokeError}</p>
            <Button
              type="button"
              variant="outline"
              className="w-full min-h-[44px] touch-manipulation"
              disabled={!file || loading}
              onClick={() => void run()}
            >
              إعادة المحاولة
            </Button>
          </div>
        ) : null}

        {result ? (
          <section
            className="motion-stagger mt-8 space-y-5"
            aria-labelledby="rozy-vision-result-heading"
          >
            <ResultCard
              variant="luxury"
              title={
                <span id="rozy-vision-result-heading" className="flex items-center gap-2">
                  نتيجة التحليل
                </span>
              }
              adornment={<ConfidenceBadge confidence={result.confidence} qualityOk={result.qualityOk} />}
            >
              <p className="whitespace-pre-wrap text-body font-medium leading-[1.85] text-foreground">
                {result.summaryAr || '—'}
              </p>
            </ResultCard>

            {mode === 'hand' && result.recommendedColors.length > 0 ? (
              <HandNailPreviewCard
                lines={result.recommendedColors}
                imageUrl={previewUrl}
                bookTarget={result.qualityOk ? rozyBookTarget : null}
              />
            ) : null}

            {personalization ? <RozyVisionRememberCard data={personalization} /> : null}

            {result.retryTips.length > 0 ? (
              <ResultCard variant="soft" className="motion-stagger">
                <h3 className="mb-2 text-title-sm font-bold text-primary">أعدي المحاولة</h3>
                <ul className="space-y-2 pe-1 text-body leading-relaxed text-foreground">
                  {result.retryTips.map((t, i) => (
                    <li
                      key={`retry-${i}-${t.slice(0, 48)}`}
                      className="flex gap-2 rounded-lg bg-primary/5 px-3 py-2 text-body-sm motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
                      style={{ animationDelay: `${i * 70}ms` }}
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gradient-to-br from-primary to-gold" />
                      {t}
                    </li>
                  ))}
                </ul>
              </ResultCard>
            ) : null}

            {result.qualityOk ? (
              <ResultCard variant="soft" title="ملخص سريع">
                <dl className="grid gap-3 text-body sm:grid-cols-2">
                  <div className="rounded-xl border border-primary/10 bg-gradient-to-br from-primary/5 to-gold/5 px-3 py-2">
                    <dt className="text-caption font-semibold text-foreground">الإنديرتون</dt>
                    <dd className="mt-1 text-title-sm font-bold text-foreground">
                      {undertoneAr[result.undertone] ?? undertoneAr.uncertain}
                    </dd>
                  </div>
                  <div className="rounded-xl border border-primary/10 bg-gradient-to-br from-gold/10 to-primary/5 px-3 py-2">
                    <dt className="text-caption font-semibold text-foreground">شكل الوجه</dt>
                    <dd className="mt-1 text-title-sm font-bold text-foreground">
                      {faceShapeAr[result.faceShape] ?? faceShapeAr.uncertain}
                    </dd>
                  </div>
                </dl>
              </ResultCard>
            ) : null}

            <div id="rozy-vision-colors" className="space-y-5 scroll-mt-24">
              {result.recommendedColors.length > 0 ? (
                <ResultCard variant="luxury">
                  <ColorSwatches title="ألوان طلاء مقترحة" lines={result.recommendedColors} />
                </ResultCard>
              ) : null}

              {result.colorsToAvoid.length > 0 ? (
                <ResultCard variant="soft">
                  <ColorSwatches title="ألوان يُفضّل تجنّبها" lines={result.colorsToAvoid} />
                </ResultCard>
              ) : null}

              {result.recommendedHairColors.length > 0 ? (
                <ResultCard variant="luxury">
                  <ColorSwatches title="ألوان شعر مقترحة" lines={result.recommendedHairColors} />
                </ResultCard>
              ) : null}
            </div>

            {result.recommendedHaircuts.length > 0 ? (
              <ResultCard variant="soft" title="قصّات وستايلات">
                <ul className="space-y-2">
                  {result.recommendedHaircuts.map((c, i) => (
                    <li
                      key={`hair-${i}-${c.slice(0, 48)}`}
                      className="flex items-start gap-2 rounded-xl border border-gold/20 bg-gold-subtle/40 px-3 py-2.5 text-body leading-relaxed motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
                      style={{ animationDelay: `${i * 55}ms` }}
                    >
                      <span className="mt-0.5 text-gold">✦</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </ResultCard>
            ) : null}

            {result.cautionNotes.length > 0 ? (
              <ResultCard variant="soft" title="ملاحظات">
                <ul className="space-y-2 text-body-sm leading-relaxed text-foreground">
                  {result.cautionNotes.map((c, i) => (
                    <li
                      key={`caution-${i}-${c.slice(0, 40)}`}
                      className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2"
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              </ResultCard>
            ) : null}

            {result.qualityOk && result.nextActions.length > 0 ? (
              <ResultCard variant="soft" title="خطوات تالية">
                <ul className="space-y-2 text-body-sm leading-relaxed text-foreground">
                  {result.nextActions.map((c, i) => (
                    <li key={`next-${i}-${c.slice(0, 40)}`} className="flex gap-2">
                      <span className="text-primary">→</span>
                      {c}
                    </li>
                  ))}
                </ul>
              </ResultCard>
            ) : null}

            <RosyVisionSalonSuggestions
              mode={mode}
              enabled={Boolean(result.qualityOk)}
              userPos={userPos}
              boostKeywords={boostKeywords}
              onBookTargetChange={setRozyBookTarget}
            />

            <VisionResultCtas visionMode={mode} rozyBookTarget={rozyBookTarget} />

            <details className="rounded-xl border border-border/50 bg-muted/25 p-3 text-caption shadow-sm">
              <summary className="cursor-pointer font-semibold text-foreground">JSON خام (للمطورين)</summary>
              <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </section>
        ) : null}

        <p className="mt-8 text-center text-[11px] font-medium leading-relaxed text-foreground">
          للمساعدة التجميلية فقط — ليس تشخيصاً طبياً. عند الشك، راجعي مختصة.
        </p>
      </div>
    </div>
  )
}
