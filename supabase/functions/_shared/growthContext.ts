import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { GrowthContextPack, GrowthTriggerType } from './growthCopy.ts'

type TriggerRow = {
  id: string
  user_id: string
  trigger_type: string
  metadata: Record<string, unknown> | null
}

function asTriggerType(t: string): GrowthTriggerType {
  if (t === 'inactive' || t === 'viewed_not_booked' || t === 'new_offer' || t === 'skin_followup') return t
  return 'inactive'
}

export async function buildGrowthContextPack(sb: SupabaseClient, row: TriggerRow): Promise<GrowthContextPack> {
  const trigger_type = asTriggerType(row.trigger_type)
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {}

  const { data: prof } = await sb.from('profiles').select('full_name, city').eq('id', row.user_id).maybeSingle()
  const profile = {
    full_name: (prof as { full_name?: string | null } | null)?.full_name ?? null,
    city: (prof as { city?: string | null } | null)?.city ?? null,
  }
  const city = profile.city?.trim() ?? null

  const [skinRes, eventsRes, topsRes] = await Promise.all([
    sb
      .from('skin_analysis')
      .select('skin_type, issues, analysis_result, created_at')
      .eq('user_id', row.user_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from('user_events')
      .select('event_type, entity_type, created_at')
      .eq('user_id', row.user_id)
      .order('created_at', { ascending: false })
      .limit(12),
    city
      ? sb
          .from('businesses')
          .select('name_ar')
          .eq('city', city)
          .eq('is_active', true)
          .eq('is_demo', false)
          .order('average_rating', { ascending: false })
          .limit(2)
      : Promise.resolve({ data: [] as { name_ar: string }[], error: null }),
  ])

  const skin = skinRes.data
  let skin_summary = ''
  if (skin) {
    const s = skin as {
      skin_type?: string | null
      issues?: string[] | null
      analysis_result?: Record<string, unknown> | null
    }
    const ar = s.analysis_result
    const notes = ar && typeof ar.notes_ar === 'string' ? ar.notes_ar.slice(0, 120) : ''
    skin_summary = [s.skin_type, (s.issues || []).slice(0, 3).join('، '), notes].filter(Boolean).join(' — ')
  }

  const events = eventsRes.data
  const evLines = (events ?? [])
    .slice(0, 8)
    .map((e) => `${(e as { event_type: string }).event_type}/${(e as { entity_type: string }).entity_type}`)
    .join(', ')
  const recent_behavior = evLines || 'لا أحداث حديثة في السجل'

  const topRows = (topsRes.data ?? []) as { name_ar: string }[]
  const topNames = topRows.map((b) => b.name_ar).filter(Boolean)
  const ranking_hint =
    topNames.length > 0 ? `صالونات بأعلى تقييم تقريباً في ${profile.city}: ${topNames.join('، ')}` : ''

  return {
    trigger_type,
    metadata,
    profile,
    skin_summary,
    ranking_hint,
    recent_behavior,
  }
}
