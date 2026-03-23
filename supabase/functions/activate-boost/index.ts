import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-rosera-boost-secret',
}

function authorize(req: Request): boolean {
  const secret = Deno.env.get('ROSERA_BOOST_WEBHOOK_SECRET')?.trim()
  const h = req.headers.get('x-rosera-boost-secret')?.trim()
  if (secret && h === secret) return true
  const auth = req.headers.get('Authorization')
  const srk = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim()
  if (srk && auth === `Bearer ${srk}`) return true
  return false
}

function addDaysISO(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
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
      business_id?: string | null
      product_id?: string | null
      boost_type?: string
      boost_score?: number
      duration_days?: number
    }

    const boost_type = body.boost_type === 'featured' ? 'featured' : 'priority'
    const boost_score = Math.min(25, Math.max(1, Number(body.boost_score ?? 12)))
    const duration_days = Math.min(365, Math.max(1, Number(body.duration_days ?? 14)))
    const start_date = new Date().toISOString().slice(0, 10)
    const end_date = addDaysISO(duration_days)

    const business_id = body.business_id?.trim() || null
    const product_id = body.product_id?.trim() || null

    if (!product_id && !business_id) {
      return new Response(JSON.stringify({ error: 'business_id or product_id required' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const bid = product_id ? business_id : business_id!
    const pid = product_id || null

    const { data, error } = await sb
      .from('boosts')
      .insert({
        business_id: bid,
        product_id: pid,
        boost_type,
        boost_score,
        start_date,
        end_date,
        is_active: true,
      })
      .select('id')
      .single()

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, id: data?.id }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
