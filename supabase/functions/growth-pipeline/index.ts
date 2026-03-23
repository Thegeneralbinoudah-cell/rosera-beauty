import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateGrowthNotificationCopy, notificationTypeForTrigger, type GrowthTriggerType } from '../_shared/growthCopy.ts'
import { buildGrowthContextPack } from '../_shared/growthContext.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-rosera-cron-secret',
}

const PRI: Record<string, number> = {
  new_offer: 0,
  viewed_not_booked: 1,
  skin_followup: 2,
  inactive: 3,
}

function authorize(req: Request): boolean {
  const secret = Deno.env.get('ROSERA_CRON_SECRET')?.trim()
  const h = req.headers.get('x-rosera-cron-secret')?.trim()
  if (secret && h === secret) return true
  const auth = req.headers.get('Authorization')
  const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  if (srk && auth === `Bearer ${srk}`) return true
  return false
}

async function invokeSendNotification(
  baseUrl: string,
  serviceKey: string,
  payload: { user_id: string; title: string; body: string; type: string }
): Promise<boolean> {
  const res = await fetch(`${baseUrl.replace(/\/$/, '')}/functions/v1/send-notification`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  return res.ok
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  if (!authorize(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const url = Deno.env.get('SUPABASE_URL')?.trim()
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  if (!url || !key) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const sb = createClient(url, key)

  const { error: expErr } = await sb.rpc('deactivate_expired_boosts')
  if (expErr) console.warn('[growth-pipeline] deactivate_expired_boosts', expErr.message)

  const GROWTH_TYPES = ['growth_inactive', 'growth_nudge', 'growth_skin', 'growth_offer', 'growth_promo']

  const stats = {
    inserted: { inactive: 0, viewed_not_booked: 0, skin_followup: 0, new_offer: 0, skipped_conflict: 0 },
    attempted: 0,
    sent: 0,
    rate_limited_users: 0,
    errors: [] as string[],
  }

  try {
    // --- Phase 1: detect & queue ---
    const { data: inactiveIds, error: e1 } = await sb.rpc('growth_detect_inactive_users')
    if (e1) stats.errors.push(`inactive rpc: ${e1.message}`)
    else {
      for (const uid of (inactiveIds as string[] | null) ?? []) {
        const { error } = await sb.from('user_triggers').insert({
          user_id: uid,
          trigger_type: 'inactive',
          metadata: {},
        })
        if (error) {
          if (error.code === '23505') stats.inserted.skipped_conflict++
          else if (!/duplicate/i.test(error.message)) stats.errors.push(`inactive insert ${uid}: ${error.message}`)
        } else stats.inserted.inactive++
      }
    }

    const { data: views, error: e2 } = await sb.rpc('growth_detect_viewed_not_booked')
    if (e2) stats.errors.push(`view rpc: ${e2.message}`)
    else {
      for (const r of (views as { user_id: string; service_id: string; business_id: string; service_name: string; last_event_at: string }[] | null) ?? []) {
        const { error } = await sb.from('user_triggers').insert({
          user_id: r.user_id,
          trigger_type: 'viewed_not_booked',
          metadata: {
            service_id: r.service_id,
            business_id: r.business_id,
            service_name: r.service_name,
            last_event_at: r.last_event_at,
          },
        })
        if (error) {
          if (error.code === '23505') stats.inserted.skipped_conflict++
          else if (!/duplicate/i.test(error.message)) stats.errors.push(`view insert: ${error.message}`)
        } else stats.inserted.viewed_not_booked++
      }
    }

    const { data: skins, error: e3 } = await sb.rpc('growth_detect_skin_followup')
    if (e3) stats.errors.push(`skin rpc: ${e3.message}`)
    else {
      for (const r of (skins as { user_id: string; analysis_id: string; analyzed_at: string }[] | null) ?? []) {
        const { error } = await sb.from('user_triggers').insert({
          user_id: r.user_id,
          trigger_type: 'skin_followup',
          metadata: { analysis_id: r.analysis_id, analyzed_at: r.analyzed_at },
        })
        if (error) {
          if (error.code === '23505') stats.inserted.skipped_conflict++
          else if (!/duplicate/i.test(error.message)) stats.errors.push(`skin insert: ${error.message}`)
        } else stats.inserted.skin_followup++
      }
    }

    const { data: offers, error: e4 } = await sb.rpc('growth_detect_offer_user_pairs')
    if (e4) stats.errors.push(`offer rpc: ${e4.message}`)
    else {
      for (const r of (offers as {
        user_id: string
        offer_id: string
        business_id: string
        city: string
        title_ar: string | null
        discount_percentage: number | null
      }[] | null) ?? []) {
        const { error } = await sb.from('user_triggers').insert({
          user_id: r.user_id,
          trigger_type: 'new_offer',
          metadata: {
            offer_id: r.offer_id,
            business_id: r.business_id,
            city: r.city,
            title_ar: r.title_ar,
            discount_percentage: r.discount_percentage,
          },
        })
        if (error) {
          if (error.code === '23505') stats.inserted.skipped_conflict++
          else if (!/duplicate/i.test(error.message)) stats.errors.push(`offer insert: ${error.message}`)
        } else stats.inserted.new_offer++
      }
    }

    // --- Phase 2: process queue (max 1 growth notification / user / 24h) ---
    const { data: pending, error: ep } = await sb
      .from('user_triggers')
      .select('id,user_id,trigger_type,metadata,created_at')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(500)

    if (ep) {
      stats.errors.push(`pending select: ${ep.message}`)
    } else {
      const rows = (pending ?? []) as {
        id: string
        user_id: string
        trigger_type: string
        metadata: Record<string, unknown> | null
        created_at: string
      }[]

      const byUser = new Map<string, typeof rows>()
      for (const row of rows) {
        if (!byUser.has(row.user_id)) byUser.set(row.user_id, [])
        byUser.get(row.user_id)!.push(row)
      }

      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

      for (const [, list] of byUser) {
        list.sort((a, b) => (PRI[a.trigger_type] ?? 9) - (PRI[b.trigger_type] ?? 9))
        const pick = list[0]
        if (!pick) continue

        const { count, error: cErr } = await sb
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', pick.user_id)
          .in('type', GROWTH_TYPES)
          .gte('created_at', dayAgo)

        if (cErr) {
          stats.errors.push(`rate count ${pick.user_id}: ${cErr.message}`)
          continue
        }
        if ((count ?? 0) >= 1) {
          stats.rate_limited_users++
          continue
        }

        stats.attempted++

        try {
          const pack = await buildGrowthContextPack(sb, {
            id: pick.id,
            user_id: pick.user_id,
            trigger_type: pick.trigger_type,
            metadata: pick.metadata,
          })
          const { title, body } = await generateGrowthNotificationCopy(pack)
          const nType = notificationTypeForTrigger(pack.trigger_type as GrowthTriggerType)

          const ok = await invokeSendNotification(url, key, {
            user_id: pick.user_id,
            title,
            body,
            type: nType,
          })

          if (!ok) {
            stats.errors.push(`send failed user ${pick.user_id}`)
            continue
          }

          stats.sent++

          const { error: upErr } = await sb.from('user_triggers').update({ processed: true }).eq('id', pick.id)
          if (upErr) stats.errors.push(`mark processed ${pick.id}: ${upErr.message}`)

          // Other pending rows for same user: leave for next day / next cron (rate limited)
        } catch (err) {
          stats.errors.push(`process ${pick.user_id}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, stats }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ ok: false, error: msg, stats }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
