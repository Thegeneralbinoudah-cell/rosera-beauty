import type { SalonOnboardingFormValues } from '@/lib/onboarding/types'
import { defaultSalonOnboardingValues } from '@/lib/onboarding/defaults'

const STORAGE_KEY = 'rosera_salon_onboarding_v1'

export function loadOnboardingDraft(): Partial<SalonOnboardingFormValues> | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as Partial<SalonOnboardingFormValues>
  } catch {
    return null
  }
}

export function saveOnboardingDraft(values: SalonOnboardingFormValues): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(values))
  } catch {
    /* quota */
  }
}

export function clearOnboardingDraft(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

export function mergeDraftWithDefaults(
  draft: Partial<SalonOnboardingFormValues> | null
): SalonOnboardingFormValues {
  const base = defaultSalonOnboardingValues()
  if (!draft) return base
  return {
    basic: { ...base.basic, ...draft.basic },
    hours:
      draft.hours?.length === 7
        ? draft.hours.map((h, i) => ({ ...h, day: i }))
        : base.hours,
    services: Array.isArray(draft.services) ? draft.services : base.services,
    team: Array.isArray(draft.team) ? draft.team : base.team,
    media: {
      ...base.media,
      ...draft.media,
      portfolio: Array.isArray(draft.media?.portfolio) ? draft.media!.portfolio : base.media.portfolio,
      photos: Array.isArray(draft.media?.photos) ? draft.media!.photos : base.media.photos,
    },
    settings: { ...base.settings, ...draft.settings },
  }
}
