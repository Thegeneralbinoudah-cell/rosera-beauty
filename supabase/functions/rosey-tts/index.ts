/**
 * TTS لروزي عبر ElevenLabs — المفتاح والـ voice_id من أسرار Supabase فقط (لا يُعرَّض للمتصفح).
 * أضيفي: ELEVENLABS_API_KEY و ELEVENLABS_VOICE_ID في Dashboard → Edge Functions → Secrets
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MODEL_ID = 'eleven_multilingual_v2'
const VOICE_SETTINGS = { stability: 0.2, similarity_boost: 1.0 }

const MAX_TEXT_CHARS = 8000

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = (await req.json()) as { text?: unknown }
    const text = typeof body.text === 'string' ? body.text.trim() : ''
    if (!text || text.length > MAX_TEXT_CHARS) {
      return new Response(JSON.stringify({ error: 'invalid text' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = Deno.env.get('ELEVENLABS_API_KEY')?.trim() ?? ''
    const voiceId = Deno.env.get('ELEVENLABS_VOICE_ID')?.trim() ?? ''
    if (!apiKey || !voiceId) {
      console.error('[rosey-tts] missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID')
      return new Response(JSON.stringify({ error: 'tts not configured on server' }), {
        status: 503,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_128`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: {
          stability: VOICE_SETTINGS.stability,
          similarity_boost: VOICE_SETTINGS.similarity_boost,
        },
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('[rosey-tts] elevenlabs error', res.status, errText.slice(0, 500))
      return new Response(JSON.stringify({ error: errText.slice(0, 800) }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    const buf = await res.arrayBuffer()
    if (buf.byteLength < 64) {
      return new Response(JSON.stringify({ error: 'empty audio' }), {
        status: 502,
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    /** application/octet-stream حتى يعيد supabase.functions.invoke الاستجابة كـ Blob (audio/mpeg يُفسَّر كنص ويفسد MP3). */
    return new Response(buf, {
      headers: {
        ...cors,
        'Content-Type': 'application/octet-stream',
      },
    })
  } catch (e) {
    console.error('[rosey-tts]', e)
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
