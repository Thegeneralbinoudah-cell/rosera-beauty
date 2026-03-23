import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { generateGrowthNotificationCopy, notificationTypeForTrigger, type GrowthTriggerType } from '../_shared/growthCopy.ts'
import { buildGrowthContextPack } from '../_shared/growthContext.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-rosera-cron-secret',
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

  try {
    const body = (await req.json()) as {
      trigger_id?: string
      trigger?: {
        id: string
        user_id: string
        trigger_type: string
        metadata?: Record<string, unknown> | null
      }
    }

    let row: { id: string; user_id: string; trigger_type: string; metadata: Record<string, unknown> | null }

    if (body.trigger && body.trigger.id && body.trigger.user_id && body.trigger.trigger_type) {
      row = {
        id: body.trigger.id,
        user_id: body.trigger.user_id,
        trigger_type: body.trigger.trigger_type,
        metadata: body.trigger.metadata ?? {},
      }
    } else if (body.trigger_id) {
      const { data, error } = await sb.from('user_triggers').select('id,user_id,trigger_type,metadata').eq('id', body.trigger_id).maybeSingle()
      if (error || !data) {
        return new Response(JSON.stringify({ error: 'Trigger not found' }), {
          status: 404,
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      }
      row = data as typeof row
    } else {
      return new Response(JSON.stringify({ error: 'Provide trigger_id or trigger object' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const pack = await buildGrowthContextPack(sb, row)
    const { title, body: msg } = await generateGrowthNotificationCopy(pack)
    const notification_type = notificationTypeForTrigger(pack.trigger_type as GrowthTriggerType)

    return new Response(
      JSON.stringify({
        title,
        body: msg,
        notification_type,
        user_id: row.user_id,
        trigger_id: row.id,
        trigger_type: row.trigger_type,
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
