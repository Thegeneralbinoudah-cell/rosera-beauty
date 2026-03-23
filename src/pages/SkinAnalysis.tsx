import { useState, useEffect, useCallback, useMemo, type ChangeEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { motion } from 'framer-motion'
import { ChevronLeft, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import {
  getUserSkinProfile,
  getRecommendedServices,
  getSkinSearchParamsFromResult,
  type ScoredItem,
  type ServiceForRank,
  type SkinAnalysisResultPayload,
  type UserSkinProfile,
} from '@/lib/personalization'
import { trackUserEvent } from '@/lib/userEvents'
import { getEdgeFunctionErrorMessage, getEdgeFunctionHttpErrorDetail } from '@/lib/edgeInvoke'

const DISCLAIMER =
  'هذا التحليل بالذكاء الاصطناعي تقديري للعناية والجمال فقط، وليس تشخيصاً طبياً ولا يغني عن استشارة طبيبة جلدية.'

function severityToProgress(sev: string | undefined): number {
  const s = (sev || '').toLowerCase()
  if (s === 'high') return 38
  if (s === 'medium') return 58
  return 78
}

export default function SkinAnalysis() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState<SkinAnalysisResultPayload | null>(null)
  const [lastProfile, setLastProfile] = useState<UserSkinProfile | null>(null)
  const [svcPreview, setSvcPreview] = useState<ScoredItem<ServiceForRank>[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
    if (!user?.id) return
    const p = await getUserSkinProfile(user.id)
    setLastProfile(p)
    if (p?.analysis_result && typeof p.analysis_result === 'object') {
      setResult(p.analysis_result as SkinAnalysisResultPayload)
      const svcs = await getRecommendedServices(p, user.id, 6)
      setSvcPreview(svcs)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user) {
      nav('/auth')
      return
    }
    void loadProfile()
  }, [user, nav, loadProfile])

  const searchHref = useMemo(() => {
    const { q, categoryLabel } = getSkinSearchParamsFromResult(result)
    const p = new URLSearchParams()
    p.set('q', q)
    p.set('categoryLabel', categoryLabel)
    return `/search?${p.toString()}`
  }, [result])

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !f.type.startsWith('image/')) {
      toast.error('اختيار صورة صالح فقط')
      return
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(f)
    setPreviewUrl(URL.createObjectURL(f))
    setError(null)
  }

  const runAnalyze = async () => {
    if (!user || !file) return
    setError(null)
    setUploading(true)
    try {
      const extRaw = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const ext = extRaw.replace(/[^a-z0-9]/g, '') || 'jpg'
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from('skin-analysis').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || 'image/jpeg',
      })
      if (upErr) throw upErr

      const { data: pub } = supabase.storage.from('skin-analysis').getPublicUrl(path)
      const imageUrl = pub.publicUrl
      if (!imageUrl) throw new Error('تعذر الحصول على رابط الصورة')

      setUploading(false)
      setAnalyzing(true)

      const { data: sess } = await supabase.auth.refreshSession()
      const token = sess.session?.access_token
      if (!token) throw new Error('انتهت الجلسة — سجّلي دخولكِ من جديد')

      const { data, error: fnErr, response } = await supabase.functions.invoke('skin-analysis', {
        body: { image_url: imageUrl },
        headers: { Authorization: `Bearer ${token}` },
      })

      if (fnErr) {
        const hint = await getEdgeFunctionHttpErrorDetail(fnErr, response ?? null)
        throw new Error(hint || getEdgeFunctionErrorMessage(fnErr as Error, data))
      }

      const payload = data as { result?: SkinAnalysisResultPayload; error?: string; disclaimer?: string } | null
      if (payload?.error) throw new Error(payload.error)
      if (!payload?.result) throw new Error('لا نتيجة من الخادم')

      setResult(payload.result)
      await loadProfile()
      const fresh = await getUserSkinProfile(user.id)
      if (fresh) setSvcPreview(await getRecommendedServices(fresh, user.id, 6))
      toast.success('تم تحليل الصورة وحفظ النتيجة')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'فشل التحليل'
      setError(msg)
      toast.error(msg)
    } finally {
      setUploading(false)
      setAnalyzing(false)
    }
  }

  if (!user) return null

  const busy = uploading || analyzing
  const concerns = result?.concerns ?? []
  const treatments = result?.recommended_treatments ?? []
  const recServices = result?.recommended_services ?? []

  return (
    <div className="min-h-dvh bg-rosera-light px-4 py-8 pb-28 dark:bg-rosera-dark">
      <div className="mx-auto max-w-md">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
          رجوع
        </button>

        <h1 className="text-center text-2xl font-bold">كشف البشرة بالذكاء الاصطناعي 🪞</h1>
        <p className="mt-3 rounded-2xl border border-amber-200/80 bg-amber-50/90 p-3 text-center text-xs font-medium leading-relaxed text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          {DISCLAIMER}
        </p>

        {lastProfile?.created_at && (
          <p className="mt-2 text-center text-[11px] text-rosera-gray">
            آخر تحليل محفوظ: {new Date(lastProfile.created_at).toLocaleString('ar-SA')}
          </p>
        )}

        <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-white p-10 dark:bg-card">
          <input type="file" accept="image/*" capture="user" className="hidden" onChange={onFile} disabled={busy} />
          {previewUrl ? (
            <img src={previewUrl} alt="" className="max-h-52 rounded-xl object-cover shadow-md" />
          ) : (
            <span className="text-center text-rosera-gray">التقطي أو اختاري صورة واضحة للوجه</span>
          )}
        </label>

        {error && (
          <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-center text-sm text-destructive">
            {error}
          </p>
        )}

        <Button className="mt-6 w-full" disabled={!file || busy} onClick={() => void runAnalyze()}>
          {uploading ? 'جاري الرفع…' : analyzing ? 'جاري التحليل…' : 'تحليل'}
        </Button>

        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10 space-y-6 rounded-2xl border bg-white p-6 shadow-sm dark:bg-card"
          >
            <div>
              <h3 className="font-bold text-primary">نوع البشرة (تقديري)</h3>
              <p className="mt-1 text-rosera-gray">{result.skin_type || '—'}</p>
            </div>

            {concerns.length > 0 && (
              <div>
                <h3 className="font-bold text-primary">نقاط الاهتمام</h3>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {concerns.map((c) => (
                    <li
                      key={c}
                      className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h3 className="font-bold text-primary">الشدة التقديرية</h3>
              <p className="mb-1 text-xs text-rosera-gray capitalize">{result.severity || 'low'}</p>
              <Progress value={severityToProgress(result.severity)} className="mt-2" />
            </div>

            {treatments.length > 0 && (
              <div>
                <h3 className="font-bold text-primary">علاجات وعناية مقترحة</h3>
                <ul className="mt-2 list-disc pe-5 text-sm text-rosera-gray">
                  {treatments.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            )}

            {recServices.length > 0 && (
              <div>
                <h3 className="font-bold text-primary">خدمات مناسبة (صالون)</h3>
                <ul className="mt-2 list-disc pe-5 text-sm text-rosera-gray">
                  {recServices.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            )}

            {result.notes_ar && (
              <div>
                <h3 className="font-bold text-primary">ملاحظات</h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-rosera-gray">{result.notes_ar}</p>
              </div>
            )}

            {svcPreview.length > 0 && (
              <div>
                <h3 className="font-bold text-primary">خدمات من قاعدة روزيرا قد تناسبكِ</h3>
                <ul className="mt-3 space-y-3 text-sm text-rosera-gray">
                  {svcPreview.map(({ item: s, reasons, sponsored, sponsorLabel }) => (
                    <li
                      key={s.id}
                      className="rounded-xl border border-primary/15 bg-primary/[0.04] p-3 dark:border-primary/25 dark:bg-primary/10"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-gradient-to-l from-[#9C27B0]/90 to-[#E91E8C]/90 px-2.5 py-0.5 text-[10px] font-bold text-white">
                          موصى به لك
                        </span>
                        {sponsored && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold ${
                              sponsorLabel === 'featured'
                                ? 'bg-amber-400/90 text-amber-950'
                                : 'border border-primary/30 bg-white/80 text-primary dark:bg-card'
                            }`}
                          >
                            {sponsorLabel === 'featured' ? 'Featured' : 'مُموَّل'}
                          </span>
                        )}
                        <Link
                          to={`/booking/${s.business_id}`}
                          state={{ preselect: s.id }}
                          className="font-semibold text-primary underline-offset-2 hover:underline"
                          onClick={() => {
                            trackUserEvent({
                              userId: user.id,
                              event_type: 'click',
                              entity_type: 'service',
                              entity_id: s.id,
                            })
                            trackUserEvent({
                              userId: user.id,
                              event_type: 'click',
                              entity_type: 'business',
                              entity_id: s.business_id,
                            })
                          }}
                        >
                          {s.name_ar}
                        </Link>
                        <span className="text-rosera-gray">— {Number(s.price).toFixed(0)} ر.س</span>
                      </div>
                      {reasons.length > 0 && (
                        <p className="mt-2 text-xs leading-relaxed text-rosera-gray">
                          {reasons.join(' · ')}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Button asChild className="w-full bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]">
                <Link to={searchHref}>احجزي خدمة مناسبة</Link>
              </Button>
              <Button variant="secondary" asChild className="w-full">
                <Link to="/chat" className="inline-flex items-center justify-center gap-2">
                  <Sparkles className="h-4 w-4" aria-hidden />
                  اسألي روزي عن بشرتكِ
                </Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link to="/store">منتجات العناية</Link>
              </Button>
            </div>

            <p className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 text-center text-[11px] font-medium text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100">
              {DISCLAIMER}
            </p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
