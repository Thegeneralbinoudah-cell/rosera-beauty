import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const OPENAI_MODEL = 'gpt-4o'

type SkinJson = {
  skin_type?: string
  concerns?: string[]
  severity?: string
  recommended_treatments?: string[]
  recommended_services?: string[]
  notes_ar?: string
}

function readOpenAiApiKey(): string {
  const raw = Deno.env.get('OPENAI_API_KEY')?.trim() || ''
  let k = raw
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim()
  }
  return k.replace(/\r?\n/g, '').replace(/\s+/g, '')
}

async function openaiVisionJson(apiKey: string, imageUrl: string): Promise<SkinJson> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a cosmetic/skin-care assistant (NOT a doctor). Analyze the face photo for a beauty app.
Return JSON only with this shape:
{
  "skin_type": "string in Arabic (e.g. دهنية، جافة، مختلطة، عادية)",
  "concerns": ["array of short English keys: acne, dryness, pigmentation, redness, fine_lines, pores, dullness, dark_circles, uneven_tone, dehydration — only what you reasonably infer"],
  "severity": "low" | "medium" | "high" (how noticeable the main concerns are),
  "recommended_treatments": ["2-5 short Arabic phrases: types of salon/clinic treatments, e.g. تنظيف بشرة، ليزر، هيدرافيشال"],
  "recommended_services": ["2-5 Arabic labels matching beauty industry services, e.g. فيشال، ليزر إزالة شعر، ميكرودرمابراشن"],
  "notes_ar": "2-4 sentences in Arabic, friendly, no medical diagnosis, suggest seeing a dermatologist for medical issues"
}
Rules:
- If the image is not a face or unclear, still return JSON with skin_type "غير واضح", concerns [], severity low, and notes_ar explaining.
- Never claim medical diagnosis.
- Keep concerns in English keys as specified for app matching.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this image for the Rosera beauty app. Respond with JSON only.',
            },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.25,
      max_tokens: 800,
    }),
  })

  const data = (await res.json()) as {
    error?: { message?: string }
    choices?: { message?: { content?: string | null } }[]
  }

  if (!res.ok) {
    throw new Error(data.error?.message || `OpenAI ${res.status}`)
  }

  const raw = data.choices?.[0]?.message?.content
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('Empty vision JSON')
  }
  return JSON.parse(raw) as SkinJson
}

function severityToHydration(sev: string | undefined): number {
  const s = (sev || '').toLowerCase()
  if (s === 'high') return 35
  if (s === 'medium') return 55
  return 72
}

function isLikelyOurStorageUrl(url: string, supabaseUrlRaw: string): boolean {
  try {
    const u = new URL(url)
    if (!u.protocol.startsWith('http')) return false
    const base = supabaseUrlRaw.startsWith('http') ? new URL(supabaseUrlRaw) : new URL(`https://${supabaseUrlRaw}`)
    if (u.hostname !== base.hostname) return false
    return u.pathname.includes('/storage/v1/object/public/skin-analysis/')
  } catch {
    return false
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'يجب تسجيل الدخول' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const accessToken = auth.slice(7).trim()
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim()
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')?.trim()
  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(JSON.stringify({ error: 'إعداد Supabase ناقص' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey)
  const { data: userData, error: authErr } = await authClient.auth.getUser(accessToken)
  if (authErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'جلسة غير صالحة' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
  const userId = userData.user.id

  const userSb = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })

  let body: { image_url?: string }
  try {
    body = (await req.json()) as { image_url?: string }
  } catch {
    return new Response(JSON.stringify({ error: 'جسم الطلب غير صالح' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const imageUrl = typeof body.image_url === 'string' ? body.image_url.trim() : ''
  if (!imageUrl) {
    return new Response(JSON.stringify({ error: 'image_url مطلوب' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  if (!isLikelyOurStorageUrl(imageUrl, supabaseUrl)) {
    return new Response(JSON.stringify({ error: 'رابط الصورة غير مقبول — استخدمي رفع روزيرا فقط' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const pathMatch = imageUrl.match(/\/skin-analysis\/([^?]+)/)
    const storagePath = pathMatch ? decodeURIComponent(pathMatch[1]) : ''
    if (storagePath && !storagePath.startsWith(`${userId}/`)) {
      return new Response(JSON.stringify({ error: 'هذه الصورة لا تخص حسابكِ' }), {
        status: 403,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }
  } catch {
    /* ignore path parse */
  }

  const apiKey = readOpenAiApiKey()
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY غير مُعرّف في أسرار الدالة' }), {
      status: 503,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const parsed = await openaiVisionJson(apiKey, imageUrl)
    const concerns = Array.isArray(parsed.concerns) ? parsed.concerns : []
    const treatments = Array.isArray(parsed.recommended_treatments) ? parsed.recommended_treatments : []
    const skinType = typeof parsed.skin_type === 'string' ? parsed.skin_type : null
    const hydration = severityToHydration(parsed.severity)

    const { data: inserted, error: insErr } = await userSb
      .from('skin_analysis')
      .insert({
        user_id: userId,
        image_url: imageUrl,
        skin_type: skinType,
        issues: concerns.length ? concerns : null,
        hydration_level: hydration,
        recommendations: treatments.length ? treatments : null,
        analysis_result: parsed as Record<string, unknown>,
      })
      .select('id')
      .single()

    if (insErr) {
      console.error('[skin-analysis] insert', insErr.message)
      return new Response(JSON.stringify({ error: 'تعذر حفظ التحليل', detail: insErr.message }), {
        status: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        id: inserted?.id,
        result: parsed,
        disclaimer:
          'هذا التحليل تقديري للعناية والجمال وليس استشارة طبية. راجعي طبيبة جلدية عند الحاجة.',
      }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'خطأ غير متوقع'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
