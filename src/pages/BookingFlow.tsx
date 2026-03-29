import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, CalendarDays, Check, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { supabase, type Business, type Service, type StaffMember } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Calendar } from '@/components/ui/calendar'
import { startOfToday } from 'date-fns'
import { formatPrice, cn } from '@/lib/utils'
import { fireBookingConfetti } from '@/lib/bookingConfetti'
import { CountUp } from '@/components/ui/CountUp'
import { toast } from 'sonner'
import PaymentForm, { type PaymentResult } from '@/components/payment/PaymentForm'
import { trackEvent } from '@/lib/analytics'
import { captureBookingFailed, captureProductEvent } from '@/lib/posthog'
import { preferenceMetaFromBusiness } from '@/lib/roseyUserPreference'
import { pickBestActiveOffer, type OfferRow, type SalonActiveOffer } from '@/lib/offers'
import { platformCommissionSar } from '@/lib/bookingCommission'
import { pickDefaultServiceIdForBooking } from '@/lib/salonRosyRecommendation'
import { colors } from '@/theme/tokens'

function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

const timeSlots: string[] = []
for (let h = 10; h <= 22; h++) {
  for (let m = 0; m < 60; m += 30) {
    if (h === 22 && m > 0) break
    timeSlots.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`)
  }
}

/** 3 مراحل للمستخدم: تفاصيل الحجز → الموعد → التأكيد والدفع */
const BOOKING_PHASES = [
  { label: 'الخدمة والفريق', desc: 'اختيار الخدمة والموظف' },
  { label: 'الموعد', desc: 'التاريخ والوقت' },
  { label: 'التأكيد والدفع', desc: 'مراجعة وإتمام' },
] as const

function bookingPhaseFromStep(step: number): 1 | 2 | 3 {
  if (step <= 2) return 1
  if (step === 3) return 2
  return 3
}

/** خطوة ظاهرة (1…N) — الدفع مدمج في خطوة التأكيد (بعد الموعد مباشرة) */
function displayStepIndex(step: number, hasStaffTeam: boolean): { current: number; total: number } {
  if (hasStaffTeam) return { current: step, total: 4 }
  const map: Record<number, number> = { 1: 1, 3: 2, 4: 3 }
  return { current: map[step] ?? step, total: 3 }
}

const PAYMENT_MODE_FREE =
  ((import.meta.env.VITE_PAYMENT_MODE as string) || '').trim().toLowerCase() === 'free'

const BOOKING_PAY_OPTIONS: { id: 'mada' | 'visa' | 'apple'; label: string }[] = [
  { id: 'mada', label: 'مدى' },
  { id: 'visa', label: 'فيزا / ماستركارد' },
  { id: 'apple', label: 'Apple Pay' },
]

const BOOKING_SERVICE_GROUPS = ['hair', 'nails', 'skin', 'massage', 'makeup', 'bridal'] as const
const BOOKING_SERVICE_GROUP_LABELS: Record<string, string> = {
  hair: 'شعر',
  nails: 'أظافر',
  skin: 'بشرة',
  massage: 'مساج',
  makeup: 'مكياج',
  bridal: 'عرائس',
}

function groupBookingServices(list: Service[]): { label: string; items: Service[] }[] {
  const known = new Set<string>([...BOOKING_SERVICE_GROUPS])
  const out: { label: string; items: Service[] }[] = []
  for (const cat of BOOKING_SERVICE_GROUPS) {
    const items = list.filter((s) => s.category === cat)
    if (items.length) out.push({ label: BOOKING_SERVICE_GROUP_LABELS[cat] ?? cat, items })
  }
  const rest = list.filter((s) => !known.has(s.category))
  if (rest.length) {
    out.push({
      label: 'خدمات أخرى',
      items: [...rest].sort((a, b) => a.name_ar.localeCompare(b.name_ar, 'ar')),
    })
  }
  return out
}

export default function BookingFlow() {
  const { salonId: salonIdRaw } = useParams()
  const salonId = salonIdRaw?.trim() || undefined
  const nav = useNavigate()
  const [searchParams] = useSearchParams()
  const loc = useLocation() as {
    state?: {
      preselect?: string
      suggestedDate?: string
      suggestedSlots?: string[]
      initialStep?: 1 | 2 | 3 | 4 | 5
      /** من زر «احجزي بالسعر الجديد» في روزي — يُطبَّق فقط إن سمح الصالون */
      rosyNegotiation?: { discountPercent: number }
      /** من معاينة ألوان الأظافر في Rosy Vision */
      rosyNailColor?: string
      rosyNailHex?: string
    }
  }
  const fromRosy = searchParams.get('source') === 'rosy'
  const { user } = useAuth()
  const [step, setStep] = useState(1)
  const [b, setB] = useState<Business | null>(null)
  const [services, setServices] = useState<Service[]>([])
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  /** null = لم يختر موظفاً (مسموح) */
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const [date, setDate] = useState(() => addDays(new Date(), 1).toISOString().slice(0, 10))
  const [time, setTime] = useState('10:00')
  const [success, setSuccess] = useState(false)
  const [bookingRef, setBookingRef] = useState<string | null>(null)
  const [successPlatformFeeSar, setSuccessPlatformFeeSar] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  /** حتى اكتمال جلب الصالون + الخدمات — يمنع عرض خطوة خدمات فارغة قبل انتهاء الطلب */
  const [salonDataReady, setSalonDataReady] = useState(false)
  const [salonLoadFailed, setSalonLoadFailed] = useState(false)
  /** رابط /booking بدون معرّف صالون صالح */
  const [bookingMissingSalonParam, setBookingMissingSalonParam] = useState(false)
  const [servicesFetchFailed, setServicesFetchFailed] = useState(false)
  const [refetchingServices, setRefetchingServices] = useState(false)
  const [staffFetchFailed, setStaffFetchFailed] = useState(false)
  const [refetchingStaff, setRefetchingStaff] = useState(false)
  const [pendingRefId, setPendingRefId] = useState<string | null>(null)
  const [salonGateway, setSalonGateway] = useState<'moyasar' | 'cash' | 'disabled'>('moyasar')
  const [bookingPayMethod, setBookingPayMethod] = useState<'mada' | 'visa' | 'apple'>('mada')
  const [salonOffer, setSalonOffer] = useState<SalonActiveOffer | null>(null)
  /** فشل إنشاء حجز pending قبل Moyasar (من خطوة الموعد) */
  const [paymentPrepError, setPaymentPrepError] = useState<string | null>(null)
  const bookingServiceScrollDoneRef = useRef(false)
  const rosyQuickStepRef = useRef(false)
  const bookingStartedTrackedRef = useRef(false)
  const bookingCompleteTrackedRef = useRef(false)
  const bookingConfettiFiredRef = useRef(false)

  const selectedIdsKey = useMemo(() => [...selectedIds].sort().join(','), [selectedIds])

  useEffect(() => {
    setStep(1)
    setPendingRefId(null)
  }, [salonId])

  useEffect(() => {
    if (step < 1 || step > 4) setStep(1)
  }, [step])

  useEffect(() => {
    if (!user) {
      toast.error('سجّلي دخولكِ للحجز')
      nav('/auth')
      return
    }
    if (!salonId) {
      setBookingMissingSalonParam(true)
      setSalonDataReady(true)
      setSalonLoadFailed(false)
      setB(null)
      setServices([])
      return
    }
    setBookingMissingSalonParam(false)
    let c = true
    setSalonDataReady(false)
    setSalonLoadFailed(false)
    setServicesFetchFailed(false)
    setStaffFetchFailed(false)
    async function load() {
      let advanceReady = true
      try {
        const { data: biz, error: bizErr } = await supabase.from('businesses').select('*').eq('id', salonId).single()
        if (bizErr) throw bizErr
        const bizRow = biz as Business | null
        if (bizRow?.is_demo) {
          advanceReady = false
          toast.error('لا يمكن الحجز في عروض تجريبية')
          nav('/search', { replace: true })
          return
        }

        const { data: svc, error: svcErr } = await supabase
          .from('services')
          .select('*')
          .eq('business_id', salonId)
          .order('name_ar', { ascending: true })
        let list: Service[] = []
        if (svcErr) {
          console.error('[BookingFlow] services', svcErr)
          setServicesFetchFailed(true)
          captureBookingFailed('services_load', { salon_id: salonId })
          toast.error('تعذر تحميل الخدمات — يمكنكِ إعادة المحاولة')
        } else {
          setServicesFetchFailed(false)
          const raw = (svc ?? []) as Service[]
          list = raw
            .filter((s) => s.is_active !== false && s.is_demo !== true)
            .sort((a, b) => a.name_ar.localeCompare(b.name_ar, 'ar'))
        }

        let staffRows: StaffMember[] = []
        let staffErr = false
        const { data: stf, error: stfErr } = await supabase
          .from('staff')
          .select('id, salon_id, name, name_ar, specialty, specialty_ar, rating, image_url, sort_order')
          .eq('salon_id', salonId)
          .order('sort_order', { ascending: true })
        if (stfErr) {
          console.error('[BookingFlow] staff', stfErr)
          staffErr = true
        } else if (stf) staffRows = stf as StaffMember[]

        const { data: offRows } = await supabase
          .from('offers')
          .select('id, business_id, discount_percentage, title, title_ar, start_date, end_date, is_active')
          .eq('business_id', salonId)
          .eq('is_active', true)
        if (!c) return
        setB(bizRow)
        setServices(list)
        setStaffList(staffRows)
        setStaffFetchFailed(staffErr)
        setSelectedStaffId(null)
        setSalonOffer(pickBestActiveOffer((offRows ?? []) as OfferRow[]))
        const pre = loc.state?.preselect?.trim()
        const defaultSvcId = pickDefaultServiceIdForBooking(list)
        if (pre && list.some((s) => s.id === pre && s.business_id === salonId)) {
          setSelectedIds(new Set([pre]))
        } else if (defaultSvcId) {
          setSelectedIds(new Set([defaultSvcId]))
        } else {
          setSelectedIds(new Set())
        }
        const sd = loc.state?.suggestedDate
        if (sd && /^\d{4}-\d{2}-\d{2}$/.test(sd)) setDate(sd)
        const sugSlots = loc.state?.suggestedSlots
        if (sugSlots?.length && typeof sugSlots[0] === 'string') setTime(sugSlots[0])

        let gateway: 'moyasar' | 'cash' | 'disabled' = 'moyasar'
        const { data: ss, error: ssErr } = await supabase
          .from('salon_settings')
          .select('payment_method')
          .eq('business_id', salonId)
          .maybeSingle()
        if (!c) return
        if (!ssErr && ss?.payment_method) {
          const m = ss.payment_method as string
          if (m === 'cash' || m === 'disabled' || m === 'moyasar') gateway = m
        }
        setSalonGateway(gateway)
      } catch {
        setSalonLoadFailed(true)
        setB(null)
        setServices([])
        captureBookingFailed('salon_load', { salon_id: salonId })
        toast.error('تعذر تحميل بيانات الصالون')
      } finally {
        if (c && advanceReady) setSalonDataReady(true)
      }
    }
    void load()
    return () => {
      c = false
    }
  }, [salonId, user, nav, loc.state?.preselect, loc.state?.suggestedDate, loc.state?.suggestedSlots, loc.state?.initialStep])

  const refetchServices = useCallback(async () => {
    if (!salonId) return
    setServicesFetchFailed(false)
    setRefetchingServices(true)
    try {
      const { data: svc, error: svcErr } = await supabase
        .from('services')
        .select('*')
        .eq('business_id', salonId)
        .order('name_ar', { ascending: true })
      if (svcErr) throw svcErr
      const raw = (svc ?? []) as Service[]
      const list = raw
        .filter((s) => s.is_active !== false && s.is_demo !== true)
        .sort((a, b) => a.name_ar.localeCompare(b.name_ar, 'ar'))
      setServices(list)
      setSelectedIds((prev) => {
        const next = new Set(
          [...prev].filter((id) => list.some((s) => s.id === id && s.business_id === salonId)),
        )
        if (next.size === 0 && list.length > 0) {
          const def = pickDefaultServiceIdForBooking(list)
          if (def) next.add(def)
        }
        return next
      })
    } catch (e) {
      console.error('[BookingFlow] refetch services', e)
      setServicesFetchFailed(true)
      captureBookingFailed('services_refetch', { salon_id: salonId })
      toast.error('تعذر تحميل الخدمات — يمكنكِ إعادة المحاولة')
    } finally {
      setRefetchingServices(false)
    }
  }, [salonId])

  const refetchStaff = useCallback(async () => {
    if (!salonId) return
    setStaffFetchFailed(false)
    setRefetchingStaff(true)
    try {
      const { data: stf, error: stfErr } = await supabase
        .from('staff')
        .select('id, salon_id, name, name_ar, specialty, specialty_ar, rating, image_url, sort_order')
        .eq('salon_id', salonId)
        .order('sort_order', { ascending: true })
      if (stfErr) throw stfErr
      setStaffList((stf ?? []) as StaffMember[])
      setStaffFetchFailed(false)
    } catch (e) {
      console.error('[BookingFlow] refetch staff', e)
      setStaffFetchFailed(true)
      toast.error('تعذر تحميل الفريق — أعيدي المحاولة أو تابعي بدون تفضيل')
    } finally {
      setRefetchingStaff(false)
    }
  }, [salonId])

  useEffect(() => {
    rosyQuickStepRef.current = false
    bookingStartedTrackedRef.current = false
    /** New salon / new flow — allow confetti once when this booking completes */
    bookingConfettiFiredRef.current = false
  }, [salonId])

  useEffect(() => {
    if (!salonId || !b?.id || bookingStartedTrackedRef.current) return
    bookingStartedTrackedRef.current = true
    captureProductEvent('booking_started', { from_rosy: fromRosy })
  }, [salonId, b?.id, fromRosy])

  useEffect(() => {
    if (!success || bookingCompleteTrackedRef.current) return
    bookingCompleteTrackedRef.current = true
    captureProductEvent('booking_completed', {
      from_rosy: fromRosy,
      gateway: salonGateway,
    })
  }, [success, fromRosy, salonGateway])

  useEffect(() => {
    if (!success) return
    if (bookingConfettiFiredRef.current) return
    bookingConfettiFiredRef.current = true
    const id = requestAnimationFrame(() => fireBookingConfetti())
    return () => cancelAnimationFrame(id)
  }, [success])

  const rosyNailColorLabel = loc.state?.rosyNailColor?.trim() || ''
  const rosyNailHex = loc.state?.rosyNailHex?.trim() || ''

  /** تمييز الخدمة الممرَّرة من صفحة الصالون / روزي (preselect) */
  const highlightServiceId = useMemo(() => {
    const pre = loc.state?.preselect?.trim()
    if (!pre || !salonId) return null
    if (services.some((s) => s.id === pre && s.business_id === salonId)) return pre
    return null
  }, [loc.state?.preselect, services, salonId])

  useEffect(() => {
    bookingServiceScrollDoneRef.current = false
  }, [salonId, loc.state?.preselect])

  /** تمرير إلى قائمة الخدمات ثم إلى الصف المختار — بدون حلقات ثقيلة */
  useEffect(() => {
    if (!salonDataReady || services.length === 0 || bookingServiceScrollDoneRef.current) return
    const pre = loc.state?.preselect?.trim()
    const firstSelected = [...selectedIds][0]
    const scrollToId =
      pre && services.some((s) => s.id === pre) ? pre : firstSelected && services.some((s) => s.id === firstSelected) ? firstSelected : null
    if (!scrollToId) return
    bookingServiceScrollDoneRef.current = true
    const t0 = window.setTimeout(() => {
      document.getElementById('rosey-booking-services')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, fromRosy ? 120 : 80)
    const t1 = window.setTimeout(() => {
      document.getElementById(`booking-service-${scrollToId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, fromRosy ? 420 : 320)
    return () => {
      window.clearTimeout(t0)
      window.clearTimeout(t1)
    }
  }, [salonDataReady, services.length, fromRosy, loc.state?.preselect, selectedIdsKey, services, selectedIds])

  useEffect(() => {
    const raw = loc.state?.initialStep
    const target = raw === 2 ? 3 : raw
    if (target !== 3) return
    if (rosyQuickStepRef.current) return
    if (servicesFetchFailed || services.length === 0 || selectedIds.size === 0) return
    const hasValid = services.some((s) => s.business_id === salonId && selectedIds.has(s.id))
    if (!hasValid) return
    rosyQuickStepRef.current = true
    setStep(3)
  }, [loc.state?.initialStep, services.length, selectedIds, services, salonId, servicesFetchFailed])

  const selectedServices = useMemo(() => {
    if (!salonId) return []
    return services.filter((s) => s.business_id === salonId && selectedIds.has(s.id))
  }, [services, selectedIds, salonId])

  const selectedStaff = useMemo(() => {
    if (!selectedStaffId) return null
    return staffList.find((s) => s.id === selectedStaffId && s.salon_id === salonId) ?? null
  }, [staffList, selectedStaffId, salonId])

  /** خطوة الموظف تظهر إن وُجد فريق أو عند فشل جلب الفريق (لإظهار إعادة المحاولة) */
  const showsStaffStep = staffList.length > 0 || staffFetchFailed
  const bookingPhase = bookingPhaseFromStep(step)
  const { current: displayStepNum, total: displayStepTotal } = displayStepIndex(step, showsStaffStep)

  const serviceGroups = useMemo(() => groupBookingServices(services), [services])
  /** إن فشل التجميع لأي سبب — نعرض القائمة كاملة بدل شاشة فارغة */
  const serviceGroupsForUi = useMemo(() => {
    if (services.length === 0) return []
    if (serviceGroups.length > 0) return serviceGroups
    return [
      {
        label: 'الخدمات',
        items: [...services].sort((a, b) => a.name_ar.localeCompare(b.name_ar, 'ar')),
      },
    ]
  }, [services, serviceGroups])

  /** لا يُسمَح بالموعد/التأكيد بدون خدمة مختارة صالحة لهذا الصالون */
  useEffect(() => {
    if (step <= 1) return
    if (servicesFetchFailed || selectedServices.length === 0) setStep(1)
  }, [step, selectedServices.length, servicesFetchFailed])

  const toggleService = (id: string) => {
    if (!salonId) return
    if (!services.some((s) => s.id === id && s.business_id === salonId)) return
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const subtotal = selectedServices.reduce((a, s) => a + Number(s.price), 0)

  useEffect(() => {
    if (step >= 4) return
    setPendingRefId(null)
    setPaymentPrepError(null)
  }, [date, time, selectedIdsKey, selectedStaffId, step])
  const rosyAppliedNegotiationPct = useMemo(() => {
    if (!b?.rosy_discount_allowed) return 0
    const raw = loc.state?.rosyNegotiation?.discountPercent
    if (raw == null) return 0
    const want = Number(raw)
    if (!Number.isFinite(want) || want <= 0) return 0
    const cap = Math.min(15, Math.max(0, Number(b.rosy_max_discount_percent ?? 10)))
    if (cap < 5) return 0
    return Math.min(cap, want)
  }, [b?.rosy_discount_allowed, b?.rosy_max_discount_percent, loc.state?.rosyNegotiation?.discountPercent])

  const finalTotal = useMemo(() => {
    const pct =
      salonOffer && Number.isFinite(salonOffer.discount_percentage)
        ? Math.min(100, Math.max(0, salonOffer.discount_percentage))
        : 0
    let t = subtotal
    if (pct > 0) t = subtotal * (1 - pct / 100)
    t = Math.round(t * 100) / 100
    if (rosyAppliedNegotiationPct > 0) {
      t = Math.round(t * (1 - rosyAppliedNegotiationPct / 100) * 100) / 100
    }
    return t
  }, [subtotal, salonOffer, rosyAppliedNegotiationPct])
  const selectedDay = date ? new Date(date + 'T12:00:00') : undefined

  const insertBooking = async (
    paymentStatus: string,
    paymentId?: string | null,
    paymentAmount?: number,
    paymentMethod = 'moyasar'
  ) => {
    if (!user || !salonId) return null
    if (selectedServices.length === 0) {
      captureBookingFailed('booking_insert_no_service', { salon_id: salonId ?? '' })
      return null
    }
    if (selectedServices.some((s) => s.business_id !== salonId)) {
      captureBookingFailed('booking_insert_service_salon_mismatch', { salon_id: salonId })
      return null
    }
    if (paymentStatus === 'paid' && !(paymentId && String(paymentId).trim())) {
      console.error('[BookingFlow] blocked insert: payment_status=paid requires non-empty payment_id', {
        salonId,
        userId: user.id,
      })
      return null
    }
    const staffRow =
      selectedStaffId && staffList.some((s) => s.id === selectedStaffId && s.salon_id === salonId)
        ? staffList.find((s) => s.id === selectedStaffId) ?? null
        : null

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        user_id: user.id,
        business_id: salonId,
        service_id: selectedServices[0].id,
        service_ids: selectedServices.map((s) => s.id),
        staff_id: staffRow?.id ?? null,
        specialist_name: staffRow ? (staffRow.name_ar || staffRow.name || null) : null,
        booking_date: date,
        booking_time: time,
        total_price: finalTotal,
        status: 'pending',
        payment_status: paymentStatus,
        payment_id: paymentId ?? null,
        payment_amount: paymentAmount ?? finalTotal,
        payment_method: paymentMethod,
        rosey_negotiated_discount_percent: rosyAppliedNegotiationPct > 0 ? rosyAppliedNegotiationPct : null,
      })
      .select('id, commission_amount, platform_fee_percentage')
      .single()
    if (error) throw error
    const row = data as { id: string; commission_amount?: number | null; platform_fee_percentage?: number | null }
    const bookingId = row.id
    for (const s of selectedServices) {
      trackEvent({ user_id: user.id, event_type: 'book', entity_type: 'service', entity_id: s.id })
    }
    trackEvent({ user_id: user.id, event_type: 'book', entity_type: 'business', entity_id: salonId })
    if (b) {
      trackEvent('user_preference', { user_id: user.id, ...preferenceMetaFromBusiness(b, 'book') })
    }
    if (subtotal > finalTotal + 0.005) {
      trackEvent({
        event_type: 'offer_applied',
        entity_type: 'business',
        entity_id: salonId,
        user_id: user.id,
      })
    }
    const fee =
      typeof row.commission_amount === 'number' && Number.isFinite(row.commission_amount)
        ? row.commission_amount
        : platformCommissionSar(finalTotal, typeof row.platform_fee_percentage === 'number' ? row.platform_fee_percentage : undefined)
    return { id: bookingId, platformFeeSar: fee }
  }

  const onPaymentSuccess = async (result: PaymentResult) => {
    if (result.payment_status !== 'free') return
    if (servicesFetchFailed || services.length === 0 || selectedServices.length === 0) {
      toast.error('اختر خدمة واحدة على الأقل من الخطوة الأولى ثم أعيدي الدفع')
      setStep(1)
      return
    }
    setLoading(true)
    try {
      const res = await insertBooking('free', null, finalTotal, 'free')
      if (res) {
        await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', res.id)
        setBookingRef(res.id)
        setSuccessPlatformFeeSar(res.platformFeeSar)
        setSuccess(true)
      } else {
        toast.error('تعذر إتمام الحجز — تأكدي من اختيار خدمة صالحة ثم أعيدي المحاولة')
        setStep(1)
        captureBookingFailed('free_insert_null', { salon_id: salonId ?? '' })
      }
    } catch (e: unknown) {
      captureBookingFailed('free_confirm', salonId ? { salon_id: salonId } : undefined)
      toast.error(e instanceof Error ? e.message : 'فشل الحجز')
    } finally {
      setLoading(false)
    }
  }

  /**
   * بعد اختيار الموعد: الانتقال لخطوة الدفع/التأكيد.
   * — Moyasar (إنتاج): إنشاء حجز pending في DB ثم عرض ويدجت الدفع (يستدعي Moyasar؛ payment_id يُستلم عند النجاح).
   * — التحقق: صفحة /payment/callback تستدعي verify-payment لتأكيد المبلغ وتحديث الحجز مدفوع.
   */
  const advanceFromTimeToCheckout = async () => {
    setPaymentPrepError(null)
    if (servicesFetchFailed || services.length === 0 || selectedServices.length === 0) {
      toast.error('اختر خدمة من القائمة أولاً')
      setStep(1)
      return
    }
    if (!user || !salonId) return

    if (salonGateway === 'moyasar' && !PAYMENT_MODE_FREE) {
      setLoading(true)
      try {
        const res = await insertBooking('pending', null, finalTotal, bookingPayMethod)
        if (res) {
          setPendingRefId(res.id)
          setStep(4)
        } else {
          const msg = 'تعذر تجهيز طلب الدفع — أعيدي المحاولة'
          setPaymentPrepError(msg)
          captureBookingFailed('pending_insert', { salon_id: salonId })
          toast.error(msg)
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'فشل إنشاء الحجز'
        setPaymentPrepError(msg)
        captureBookingFailed('payment_prep', { salon_id: salonId })
        toast.error('تعذر تجهيز الدفع — تحققي من الاتصال وأعيدي المحاولة')
      } finally {
        setLoading(false)
      }
      return
    }

    setStep(4)
  }

  const confirmCashAtSalon = async () => {
    if (servicesFetchFailed || services.length === 0 || selectedServices.length === 0) {
      toast.error('اختر خدمة من القائمة أولاً')
      setStep(1)
      return
    }
    setLoading(true)
    try {
      const res = await insertBooking('pending', null, finalTotal, 'cash')
      if (res) {
        setBookingRef(res.id)
        setSuccessPlatformFeeSar(res.platformFeeSar)
        setSuccess(true)
      } else {
        toast.error('تعذر إتمام الحجز — اختر خدمة واحدة على الأقل ثم أعيدي التأكيد')
        setStep(1)
        captureBookingFailed('cash_insert_null', { salon_id: salonId ?? '' })
      }
    } catch (e: unknown) {
      captureBookingFailed('cash_confirm', { salon_id: salonId ?? '' })
      toast.error(e instanceof Error ? e.message : 'فشل الحجز')
    } finally {
      setLoading(false)
    }
  }

  const goBack = () => {
    if (step <= 1) {
      nav(-1)
      return
    }
    if (step === 3 && !showsStaffStep) {
      setStep(1)
      return
    }
    setStep(step - 1)
  }

  if (!salonDataReady) {
    return (
      <div className="luxury-page-canvas pb-[calc(7rem+env(safe-area-inset-bottom,0px)+5rem)]">
        <header className="luxury-screen-header z-10">
          <Skeleton className="h-5 w-20 rounded-lg" />
          <Skeleton className="mt-3 h-9 w-[min(100%,20rem)] rounded-xl" />
          <Skeleton className="mt-2 h-4 w-40 rounded-md" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-2 flex-1 rounded-full" />
            <Skeleton className="h-2 flex-1 rounded-full" />
            <Skeleton className="h-2 flex-1 rounded-full" />
          </div>
        </header>
        <div className="mx-auto max-w-lg space-y-4 px-4 py-6">
          <div className="flex gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-2xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-[75%] rounded-lg" />
              <Skeleton className="h-4 w-full rounded-lg" />
            </div>
          </div>
          <p className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
            جاري تحميل الصالون والخدمات…
          </p>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-[4.25rem] w-full rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  if (bookingMissingSalonParam) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6">
        <p className="text-center font-semibold text-foreground">رابط الحجز غير صالح</p>
        <p className="text-center text-sm text-foreground">
          لم يُمرَّر معرّف الصالون بشكل صحيح. افتحي الحجز من صفحة الصالون أو من روزي والتطبيق يعبّي الرابط تلقائياً.
        </p>
        <Button className="rounded-2xl" type="button" variant="default" onClick={() => nav('/search')}>
          استكشفي الصالونات
        </Button>
        <Button className="rounded-2xl" type="button" variant="outline" onClick={() => nav(-1)}>
          رجوع
        </Button>
      </div>
    )
  }

  if (salonLoadFailed || !b) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6">
        <p className="text-center font-semibold text-foreground">تعذر تحميل بيانات الصالون</p>
        <p className="text-center text-sm text-foreground">تحققي من الاتصال وحاولي مرة أخرى، أو ارجعي لاختيار صالون آخر.</p>
        <Button className="rounded-2xl" type="button" variant="outline" onClick={() => nav(-1)}>
          رجوع
        </Button>
      </div>
    )
  }

  if (success) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="flex h-20 w-20 items-center justify-center rounded-full gradient-rosera text-white shadow-lg"
        >
          <Check className="h-10 w-10" strokeWidth={2.5} />
        </motion.div>
        <h2 className="mt-6 text-2xl font-extrabold">تم الحجز</h2>
        <p className="mt-2 text-rosera-gray">
          رقم الحجز: <span className="font-mono font-bold text-foreground">{bookingRef?.slice(0, 8)}</span>
        </p>
        {successPlatformFeeSar != null && successPlatformFeeSar > 0 ? (
          <p className="mt-3 text-center text-base font-bold text-primary">
            رسوم الخدمة:{' '}
            <CountUp value={successPlatformFeeSar} format={(n) => formatPrice(n)} />
          </p>
        ) : null}
        <Button
          className="mt-8 w-full max-w-xs rounded-2xl"
          onClick={() => nav('/home')}
        >
          العودة للرئيسية
        </Button>
      </div>
    )
  }

  return (
    <div className="luxury-page-canvas pb-[calc(7rem+env(safe-area-inset-bottom,0px)+5rem)]">
      <header className="luxury-screen-header z-10">
        <button type="button" onClick={goBack} className="font-semibold text-primary transition-colors hover:text-primary-hover">
          ← رجوع
        </button>
        <h1 className="mt-2 text-heading-3 font-semibold tracking-wide">حجز — {b.name_ar}</h1>
        <p className="mt-1 text-sm text-foreground">
          الخطوة {displayStepNum} من {displayStepTotal} · {BOOKING_PHASES[bookingPhase - 1].label}
        </p>
        <div className="mt-4 space-y-2">
          <div className="flex gap-2">
            {BOOKING_PHASES.map((ph, i) => {
              const idx = i + 1
              const active = bookingPhase >= idx
              return (
                <div
                  key={ph.label}
                  className={cn(
                    'h-2 flex-1 rounded-full transition-all duration-200',
                    active ? 'bg-gradient-to-l from-primary to-gold shadow-sm' : 'bg-muted'
                  )}
                  title={ph.desc}
                />
              )
            })}
          </div>
          <p className="text-xs font-medium text-foreground">{BOOKING_PHASES[bookingPhase - 1].desc}</p>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-6">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key={1}
              id="rosey-booking-services"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="scroll-mt-24 pb-8"
            >
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Sparkles className="h-5 w-5" aria-hidden />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground">اختيار الخدمات</h2>
                    <p className="mt-1 text-sm text-foreground">اختر خدمة واحدة على الأقل للمتابعة — لا يمكن الحجز بدون خدمة.</p>
                  </div>
                </div>

                {fromRosy && rosyNailColorLabel ? (
                  <div
                    className="flex items-center gap-3 rounded-2xl border border-gold/35 bg-gradient-to-l from-amber-50/90 via-card to-primary-subtle/50 p-3 shadow-sm ring-1 ring-gold/20 dark:from-amber-950/30 dark:via-card dark:to-card"
                    role="status"
                  >
                    <span
                      className="h-11 w-11 shrink-0 rounded-xl border-2 border-white shadow-md ring-1 ring-black/10"
                      style={{
                        backgroundColor: rosyNailHex && /^#[0-9A-Fa-f]{6}$/.test(rosyNailHex) ? rosyNailHex : colors.nailFallback,
                      }}
                      aria-hidden
                    />
                    <div className="min-w-0 text-start">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-foreground">لون روزي المختار</p>
                      <p className="truncate text-sm font-extrabold text-foreground">{rosyNailColorLabel}</p>
                      <p className="mt-0.5 text-[11px] text-foreground">تم تمييز خدمة المناكير المقترحة أدناه — يمكنكِ تغييرها.</p>
                    </div>
                  </div>
                ) : null}

                {refetchingServices && services.length === 0 ? (
                  <div className="space-y-3 py-1">
                    <div className="flex items-center justify-center gap-2 rounded-2xl border border-primary/15 bg-card py-4 text-sm font-medium text-foreground">
                      <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" aria-hidden />
                      جاري تحميل الخدمات…
                    </div>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <Skeleton key={i} className="h-[4.25rem] w-full rounded-2xl" />
                    ))}
                  </div>
                ) : null}

                {servicesFetchFailed && services.length === 0 && !refetchingServices ? (
                  <div className="luxury-card border-destructive/20 bg-destructive/[0.06] p-6 text-center">
                    <AlertCircle className="mx-auto h-10 w-10 text-destructive" aria-hidden />
                    <p className="mt-3 font-semibold text-foreground">تعذر تحميل قائمة الخدمات</p>
                    <p className="mt-2 text-sm text-foreground">تحققي من الاتصال ثم أعيدي المحاولة.</p>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                      <Button
                        className="rounded-2xl"
                        type="button"
                        disabled={refetchingServices}
                        onClick={() => void refetchServices()}
                      >
                        {refetchingServices ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                            جاري التحميل…
                          </>
                        ) : (
                          <>
                            <RefreshCw className="h-4 w-4" aria-hidden />
                            إعادة المحاولة
                          </>
                        )}
                      </Button>
                      <Button variant="outline" className="rounded-2xl" type="button" onClick={() => nav(-1)}>
                        رجوع
                      </Button>
                    </div>
                  </div>
                ) : null}

                {!servicesFetchFailed && salonDataReady && services.length === 0 && !refetchingServices ? (
                  <div className="luxury-card flex flex-col items-center p-8 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                      <CalendarDays className="h-7 w-7 text-foreground" aria-hidden />
                    </div>
                    <p className="mt-4 font-semibold text-foreground">لا توجد خدمات للحجز من التطبيق حالياً</p>
                    <p className="mt-2 max-w-sm text-sm text-foreground">
                      الصالون لم يفعّل خدمات حجز نشطة بعد، أو جميعها غير متاحة. يمكنكِ مراجعة تفاصيل الصالون أو اختيار
                      صالون آخر.
                    </p>
                    <div className="mt-6 flex w-full max-w-xs flex-col gap-2 sm:flex-row sm:justify-center">
                      {salonId ? (
                        <Button
                          variant="default"
                          className="rounded-2xl"
                          type="button"
                          onClick={() => nav(`/salon/${salonId}`)}
                        >
                          عرض صفحة الصالون
                        </Button>
                      ) : null}
                      <Button variant="outline" className="rounded-2xl" type="button" onClick={() => nav('/search')}>
                        بحث عن صالون
                      </Button>
                    </div>
                  </div>
                ) : null}

                {refetchingServices && services.length > 0 ? (
                  <div className="flex items-center justify-center gap-2 rounded-2xl border border-primary/15 bg-card py-8 text-sm font-medium text-foreground">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
                    جاري تحديث الخدمات…
                  </div>
                ) : null}

                {services.length > 0 && !refetchingServices ? (
                  <div className="space-y-6">
                    {serviceGroupsForUi.map((group) => (
                      <div key={group.label} className="space-y-3">
                        <h3 className="text-sm font-bold text-primary">{group.label}</h3>
                        <div className="space-y-3">
                          {group.items.map((s) => (
                            <label
                              key={s.id}
                              id={`booking-service-${s.id}`}
                              className={cn(
                                'luxury-card flex cursor-pointer items-start gap-4 p-4 transition-all duration-200',
                                selectedIds.has(s.id) && 'border-primary/40 bg-primary-subtle/50 shadow-md ring-2 ring-primary/25',
                                highlightServiceId === s.id &&
                                  (rosyNailColorLabel
                                    ? 'ring-2 ring-amber-500/70 ring-offset-2 ring-offset-background shadow-lg'
                                    : 'ring-2 ring-primary/50 ring-offset-2 ring-offset-background'),
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={selectedIds.has(s.id)}
                                onChange={() => toggleService(s.id)}
                                className="mt-1 h-5 w-5 shrink-0 rounded border-primary text-primary accent-primary"
                              />
                              <div className="min-w-0 flex-1 space-y-1">
                                <p className="font-bold leading-snug">{s.name_ar}</p>
                                <p className="text-sm text-foreground">
                                  <span className="text-foreground">السعر: </span>
                                  <span className="font-semibold tabular-nums">{formatPrice(Number(s.price))}</span>
                                </p>
                                <p className="text-sm text-foreground">
                                  <span className="text-foreground">المدة: </span>
                                  <span className="font-semibold tabular-nums">{s.duration_minutes} دقيقة</span>
                                </p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              {services.length > 0 && !servicesFetchFailed && !refetchingServices && (
                <div className="sticky bottom-0 z-[5] mt-8 border-t border-border/50 bg-background/95 py-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
                  {selectedServices.length > 0 && (
                    <div className="mb-4 space-y-1 rounded-2xl border border-primary/15 bg-card p-4 shadow-sm">
                      {subtotal > finalTotal + 0.005 ? (
                        <>
                          <p className="text-sm text-foreground line-through">قبل الخصم: {formatPrice(subtotal)}</p>
                          <p className="text-lg font-bold text-primary">بعد العرض: {formatPrice(finalTotal)}</p>
                        </>
                      ) : (
                        <p className="text-lg font-bold text-primary">المجموع: {formatPrice(finalTotal)}</p>
                      )}
                      {rosyAppliedNegotiationPct > 0 ? (
                        <p className="text-xs font-semibold text-primary">
                          خصم روزي {rosyAppliedNegotiationPct}% (يُطبَّق بعد عروض الصالون إن وُجدت)
                        </p>
                      ) : null}
                      <p className="text-xs text-foreground">
                        رسوم خدمة المنصة التقريبية: {formatPrice(platformCommissionSar(finalTotal))} (10٪ من المبلغ)
                      </p>
                    </div>
                  )}
                  <Button
                    className="w-full rounded-2xl shadow-md"
                    disabled={selectedServices.length === 0}
                    onClick={() => {
                      if (selectedServices.length === 0) {
                        toast.error('اختر خدمة واحدة على الأقل للمتابعة')
                        return
                      }
                      if (showsStaffStep) setStep(2)
                      else setStep(3)
                    }}
                  >
                    {showsStaffStep ? 'التالي — اختيار الموظف' : 'التالي — الموعد'}
                  </Button>
                  {selectedServices.length === 0 ? (
                    <p className="mt-2 text-center text-xs text-foreground">اختر خدمة واحدة على الأقل للمتابعة</p>
                  ) : null}
                </div>
              )}
            </motion.div>
          )}

          {step === 2 && (
            <motion.div key={2} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-6 pb-8">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h2 className="text-lg font-bold">اختيار الموظف</h2>
                  <p className="mt-1 text-sm text-foreground">اختياري — يمكنكِ المتابعة بدون تفضيل محدد، أو اختيار أخصائية من الفريق.</p>
                </div>
              </div>

              {staffFetchFailed && !refetchingStaff ? (
                <div className="luxury-card border-amber-200/60 bg-amber-50/80 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <p className="text-sm font-semibold text-foreground">تعذر تحميل قائمة الفريق</p>
                  <p className="mt-1 text-xs text-foreground">يمكنكِ إعادة المحاولة أو المتابعة بخيار «يحدد الصالون».</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 rounded-xl"
                    onClick={() => void refetchStaff()}
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden />
                    إعادة المحاولة
                  </Button>
                </div>
              ) : null}

              {refetchingStaff ? (
                <div className="flex items-center justify-center gap-2 rounded-2xl border border-primary/15 bg-card py-10 text-sm font-medium text-foreground">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden />
                  جاري تحميل الفريق…
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setSelectedStaffId(null)}
                    className={cn(
                      'luxury-card flex w-full items-center gap-3 p-4 text-start transition-all duration-200',
                      selectedStaffId === null
                        ? 'border-primary/40 bg-primary-subtle/60 shadow-md ring-2 ring-primary/20'
                        : 'border-border/50'
                    )}
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-primary/35">
                      {selectedStaffId === null ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
                    </span>
                    <span className="font-semibold">بدون تفضيل — يحدد الصالون</span>
                  </button>
                  {staffList.length === 0 && !staffFetchFailed ? (
                    <p className="rounded-2xl border border-dashed border-border/70 bg-muted/30 px-4 py-6 text-center text-sm text-foreground">
                      لا يوجد فريق مضاف بعد — سيتم تعيين الموظف من الصالون.
                    </p>
                  ) : null}
                  {staffList.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedStaffId(m.id)}
                      className={cn(
                        'luxury-card flex w-full items-center gap-3 p-4 text-start transition-all duration-200',
                        selectedStaffId === m.id
                          ? 'border-primary/40 bg-primary-subtle/60 shadow-md ring-2 ring-primary/20'
                          : 'border-border/50'
                      )}
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-primary/35">
                        {selectedStaffId === m.id ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-muted ring-2 ring-primary/10">
                            {m.image_url ? (
                              <img src={m.image_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                                {(m.name_ar || m.name || '?')[0]}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 text-start">
                            <p className="font-bold">{m.name_ar || m.name}</p>
                            {m.specialty_ar || m.specialty ? (
                              <p className="text-sm text-foreground">{m.specialty_ar || m.specialty}</p>
                            ) : null}
                            {m.rating != null ? (
                              <p className="text-xs font-semibold text-primary">★ {Number(m.rating).toFixed(1)}</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="sticky bottom-0 z-[5] border-t border-border/50 bg-background/95 py-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
                <Button
                  className="w-full rounded-2xl shadow-md"
                  disabled={selectedServices.length === 0 || servicesFetchFailed || refetchingStaff}
                  onClick={() => {
                    if (selectedServices.length === 0) {
                      toast.error('اختر خدمة واحدة على الأقل')
                      setStep(1)
                      return
                    }
                    setStep(3)
                  }}
                >
                  {refetchingStaff ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      جاري التحميل…
                    </>
                  ) : (
                    'التالي — الموعد'
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div key={3} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-6 pb-8">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <CalendarDays className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h2 className="text-lg font-bold">التاريخ والوقت</h2>
                  <p className="mt-1 text-sm text-foreground">اختر اليوم والوقت المناسبين لموعدك.</p>
                </div>
              </div>
              <div className="luxury-card overflow-hidden p-4 sm:p-6">
                <Calendar
                  mode="single"
                  selected={selectedDay}
                  onSelect={(d) => d && setDate(d.toISOString().slice(0, 10))}
                  disabled={{ before: startOfToday() }}
                  className="rounded-xl border-0 bg-transparent"
                />
              </div>
              <div>
                <h3 className="mb-3 font-bold text-foreground">الوقت</h3>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                  {timeSlots.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTime(t)}
                      className={cn(
                        'rounded-2xl border-2 py-2.5 text-sm font-semibold transition-all duration-200',
                        time === t
                          ? 'gradient-rosera border-transparent text-white shadow-md'
                          : 'border-border/60 bg-card text-foreground hover:border-primary/30 hover:bg-primary-subtle/40'
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {paymentPrepError ? (
                <div className="rounded-2xl border border-destructive/25 bg-destructive/10 p-4 text-center text-sm text-destructive">
                  {paymentPrepError}
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 w-full rounded-xl border-destructive/30"
                    disabled={loading}
                    onClick={() => void advanceFromTimeToCheckout()}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        جاري المحاولة…
                      </>
                    ) : (
                      'إعادة المحاولة'
                    )}
                  </Button>
                </div>
              ) : null}
              <div className="sticky bottom-0 z-[5] border-t border-border/50 bg-background/95 py-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/80">
                <Button
                  className="w-full rounded-2xl shadow-md"
                  disabled={selectedServices.length === 0 || servicesFetchFailed || loading}
                  onClick={() => void advanceFromTimeToCheckout()}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      جاري التجهيز…
                    </>
                  ) : salonGateway === 'moyasar' && !PAYMENT_MODE_FREE ? (
                    'التالي — الدفع والتأكيد'
                  ) : (
                    'التالي — التأكيد'
                  )}
                </Button>
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <motion.div key={4} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-6 pb-8">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Check className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h2 className="text-lg font-bold">
                    {salonGateway === 'moyasar' && !PAYMENT_MODE_FREE ? 'التأكيد والدفع' : 'ملخص الحجز'}
                  </h2>
                  <p className="mt-1 text-sm text-foreground">
                    {salonGateway === 'moyasar' && !PAYMENT_MODE_FREE
                      ? 'راجعي الملخص ثم ادفعي عبر Moyasar — بعد التحقق يُؤكَّد الحجز كمدفوع.'
                      : 'راجعي التفاصيل ثم أكملي الدفع أو التأكيد.'}
                  </p>
                </div>
              </div>
              <div className="luxury-card space-y-3 p-6">
                <p className="font-bold text-foreground">{b.name_ar}</p>
                <p className="text-sm text-foreground">{selectedServices.map((s) => s.name_ar).join('، ')}</p>
                {selectedStaff ? (
                  <p className="text-sm">
                    <span className="text-foreground">الموظف: </span>
                    <span className="font-semibold text-foreground">{selectedStaff.name_ar || selectedStaff.name}</span>
                  </p>
                ) : (
                  <p className="text-sm text-foreground">الموظف: يحدد الصالون</p>
                )}
                <p className="font-medium text-foreground">
                  {date} — {time}
                </p>
                <div className="mt-4 space-y-1">
                  {subtotal > finalTotal + 0.005 ? (
                    <>
                      <p className="text-sm text-rosera-gray line-through">{formatPrice(subtotal)}</p>
                      <p className="text-xl font-bold text-primary">{formatPrice(finalTotal)}</p>
                    </>
                  ) : (
                    <p className="text-xl font-bold text-primary">{formatPrice(finalTotal)}</p>
                  )}
                  {rosyAppliedNegotiationPct > 0 ? (
                    <p className="mt-2 text-xs font-semibold text-primary">خصم روزي {rosyAppliedNegotiationPct}%</p>
                  ) : null}
                </div>
              </div>
              {salonGateway === 'moyasar' && !PAYMENT_MODE_FREE ? (
                <div className="luxury-card border-primary/30 bg-gradient-to-b from-primary-subtle/50 to-card p-6 text-center">
                  <p className="text-sm font-medium text-foreground">المبلغ المستحق</p>
                  <p className="mt-2 text-3xl font-extrabold tabular-nums text-primary">{formatPrice(finalTotal)}</p>
                  <p className="mt-2 text-xs text-foreground">الدفع عبر بوابة آمنة — لا نخزّن بيانات البطاقة</p>
                </div>
              ) : null}
              {salonGateway === 'disabled' && (
                <p className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4 text-center text-sm font-semibold text-destructive">
                  الحجز الإلكتروني غير مفعّل لهذا الصالون.
                </p>
              )}
              {salonGateway === 'cash' && (
                <div className="luxury-card space-y-4 border-primary/20 bg-primary-subtle/40 p-6">
                  <p className="text-center font-semibold text-foreground">الدفع عند الزيارة في الصالون</p>
                  <Button
                    className="w-full rounded-2xl shadow-md"
                    disabled={loading || servicesFetchFailed || selectedServices.length === 0}
                    onClick={() => void confirmCashAtSalon()}
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        جاري التأكيد…
                      </>
                    ) : (
                      'تأكيد الحجز'
                    )}
                  </Button>
                </div>
              )}
              {salonGateway === 'moyasar' && (
                <div className="space-y-4">
                  {!PAYMENT_MODE_FREE ? (
                    <div>
                      <p className="mb-2 flex items-center gap-2 text-sm font-bold text-foreground">
                        <Sparkles className="h-4 w-4 text-gold" aria-hidden />
                        طريقة الدفع المفضّلة
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {BOOKING_PAY_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setBookingPayMethod(opt.id)}
                            className={cn(
                              'rounded-2xl border-2 p-3 text-sm font-bold transition-all duration-200',
                              bookingPayMethod === opt.id
                                ? 'border-primary bg-primary/10 shadow-sm'
                                : 'border-primary/15 bg-card hover:border-primary/30'
                            )}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {!PAYMENT_MODE_FREE && !pendingRefId ? (
                    <p className="rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-center text-sm text-destructive">
                      لم يُجهَّز طلب الدفع. ارجعي لخطوة الموعد واضغطي «التالي — الدفع والتأكيد» مرة أخرى.
                    </p>
                  ) : (
                    <PaymentForm
                      key={`${pendingRefId ?? 'trial'}-${bookingPayMethod}`}
                      type="booking"
                      amount={finalTotal}
                      description={`حجز ${b.name_ar}`}
                      refId={PAYMENT_MODE_FREE ? null : pendingRefId}
                      bookingSalonId={salonId ?? null}
                      checkoutPaymentMethod={bookingPayMethod}
                      onSuccess={onPaymentSuccess}
                      onError={(msg) => {
                        console.error('[BookingFlow payment]', msg)
                        captureBookingFailed('payment_widget', salonId ? { salon_id: salonId } : undefined)
                        toast.error(msg)
                      }}
                      disabled={loading || (!PAYMENT_MODE_FREE && !pendingRefId)}
                    />
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
