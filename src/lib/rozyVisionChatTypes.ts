import type { RozyVisionResult } from '@/lib/rozyVisionTypes'

/** Must match `supabase/functions/_shared/rozyVisionAdvisorModes.ts` */
export type HandNailAdvisorResult = {
  advisor_mode: 'hand_nail'
  undertone: 'warm' | 'cool' | 'neutral' | 'unclear'
  undertone_ar: string
  explanation_ar: string
  nail_colors: Array<{
    name_ar: string
    name_en: string
    hex: string
    reason_ar: string
    brand: string
  }>
  avoid_colors: string[]
}

export type HairColorAdvisorResult = {
  advisor_mode: 'hair_color'
  skin_tone: string
  eye_color: string
  recommended_colors: Array<{
    name_ar: string
    name_en: string
    hex: string
    technique_ar: string
    maintenance_ar: string
    why_ar: string
  }>
  avoid_colors: string[]
  disclaimer_ar: string
}

export type HaircutAdvisorResult = {
  advisor_mode: 'haircut'
  face_shape: string
  face_shape_ar: string
  recommended_cuts: Array<{
    name_ar: string
    name_en: string
    description_ar: string
    length_ar: string
  }>
  avoid_cuts: Array<{ name_ar: string; reason_ar: string }>
  styling_tip_ar: string
}

export type SkinAnalysisAdvisorResult = {
  advisor_mode: 'skin_analysis'
  skin_type: string
  concerns: string[]
  condition: 'normal' | 'needs_care' | 'needs_specialist'
  skincare_routine: { morning: string[]; evening: string[] }
  treatments: Array<{
    name_ar: string
    name_en: string
    brand: string
    reason_ar: string
  }>
  clinic_services: Array<{
    name_ar: string
    service_type: 'salon' | 'clinic'
    note_ar: string
  }>
  clinic_needed: boolean
  disclaimer_ar: string
}

/** All modes accepted by `rozi-vision` Edge Function body. */
export type RozyAdvisorMode = 'hand' | 'face' | 'hair_color' | 'haircut' | 'hand_nail' | 'skin_analysis'

/** محادثة روزي — تحليل مستشار فقط (بدون hand/face التقليدي من صفحة روزي فيجن). */
export type RozyVisionChatAdvisorMode = 'hand_nail' | 'hair_color' | 'haircut' | 'skin_analysis'

/**
 * Typed result of `invokeRozyAdvisor` — discriminated by `mode`.
 */
export type RozyVisionChatResult =
  | { mode: 'hand'; result: RozyVisionResult }
  | { mode: 'face'; result: RozyVisionResult }
  | { mode: 'hair_color'; advisor_result: HairColorAdvisorResult }
  | { mode: 'haircut'; advisor_result: HaircutAdvisorResult }
  | { mode: 'hand_nail'; advisor_result: HandNailAdvisorResult }
  | { mode: 'skin_analysis'; advisor_result: SkinAnalysisAdvisorResult }
