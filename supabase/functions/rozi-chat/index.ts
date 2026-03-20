const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Msg = { role: 'user' | 'assistant' | 'system'; content: string }

async function openaiComplete(
  apiKey: string,
  messages: unknown[],
  model = 'gpt-4o'
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 1200 }),
  })
  const data = (await res.json()) as {
    error?: { message?: string }
    choices?: { message?: { content?: string } }[]
  }
  if (!res.ok) throw new Error(data.error?.message || `OpenAI ${res.status}`)
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error('Empty OpenAI response')
  return text
}

async function geminiComplete(
  apiKey: string,
  systemText: string,
  userParts: { text?: string; inlineData?: { mimeType: string; data: string } }[]
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemText }] },
      contents: [
        {
          role: 'user',
          parts: userParts,
        },
      ],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1200 },
    }),
  })
  const data = (await res.json()) as {
    error?: { message?: string }
    candidates?: { content?: { parts?: { text?: string }[] } }[]
  }
  if (!res.ok) throw new Error(data.error?.message || `Gemini ${res.status}`)
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('')
  if (!text) throw new Error('Empty Gemini response')
  return text
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
    return new Response(JSON.stringify({ error: 'يجب تسجيل الدخول لاستخدام روزي' }), {
      status: 401,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = (await req.json()) as {
      messages?: Msg[]
      imageBase64?: string
      imageMimeType?: string
      contextBlock?: string
    }

    const history = Array.isArray(body.messages) ? body.messages.filter((m) => m.role !== 'system').slice(-16) : []
    const ctx = typeof body.contextBlock === 'string' ? body.contextBlock : ''

    const system = `أنتِ "روزي"، مساعدة ذكية عربية فقط لتطبيق روزيرا (Rosera) للجمال والصالونات في السعودية.
قواعد:
- تحدثي بالعربية الفصحى المبسطة والودودة للنساء.
- ساعدي في: اختيار صالون مناسب، شرح المنتجات، نصائج جمال عامة، وإرشاد الحجز داخل التطبيق (المستخدمة تفتح صفحة الصالون /salon/{id} ثم "احجزي").
- للمنتجات: وجّهي لمتجر التطبيق /store وروابط /product/{id} عندما تكوني تعرفين المعرف من السياق.
- صورة الوجه: إن وُجدت، حللي البشرة باختصار (نوع تقريبي، احتياجات، اقتراحات علاجات مثل ليزر، فلر، عناية، عيادات) — بدون تشخيص طبي، وذكّري أن النتيجة تقديرية.
- لا تخزني ولا تطلبي حفظ الصور — التحليل فوري فقط.
- لا تختلقي أرقام هواتف أو عناوين غير موجودة في السياق المعطى.

سياق من التطبيق (صالونات ومنتجات مختصرة):
${ctx || '(لا يوجد سياق إضافي)'}`

    const openaiKey = Deno.env.get('OPENAI_API_KEY')?.trim()
    const geminiKey = Deno.env.get('GEMINI_API_KEY')?.trim()

    const lastUser = [...history].reverse().find((m) => m.role === 'user')
    const userText = lastUser?.content ?? ''

    if (openaiKey) {
      const oaMessages: unknown[] = [{ role: 'system', content: system }]
      const h = [...history]
      if (body.imageBase64 && body.imageMimeType && h.length && h[h.length - 1].role === 'user') {
        h.pop()
      }
      for (const m of h) {
        oaMessages.push({ role: m.role, content: m.content })
      }
      if (body.imageBase64 && body.imageMimeType) {
        const dataUrl = `data:${body.imageMimeType};base64,${body.imageBase64}`
        oaMessages.push({
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                userText ||
                'حللي هذه الصورة للبشرة والجمال واقترفي علاجات مناسبة (بدون تشخيص طبي). لا تخزني الصورة.',
            },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        })
      }
      try {
        const reply = await openaiComplete(openaiKey, oaMessages, 'gpt-4o')
        return new Response(JSON.stringify({ reply }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        })
      } catch (e) {
        console.error('OpenAI failed', e)
        if (!geminiKey) throw e
      }
    }

    if (geminiKey) {
      const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = []
      const convo =
        history.map((m) => `${m.role === 'user' ? 'المستخدمة' : 'روزي'}: ${m.content}`).join('\n\n') ||
        '(بداية المحادثة)'
      const baseText = `${convo}\n\nآخر رسالة: ${userText || '(صورة فقط)'}`
      if (body.imageBase64 && body.imageMimeType) {
        parts.push({
          text:
            baseText +
            '\n\n(مرفق: صورة للتحليل — لا تُخزن. حللي البشرة والعلاجات المقترحة بدون تشخيص طبي.)',
        })
        parts.push({
          inlineData: { mimeType: body.imageMimeType, data: body.imageBase64 },
        })
      } else {
        parts.push({ text: baseText })
      }
      const reply = await geminiComplete(geminiKey, system, parts)
      return new Response(JSON.stringify({ reply }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    return new Response(
      JSON.stringify({
        error:
          'لم يُعرّف مفتاح الذكاء الاصطناعي. أضيفي OPENAI_API_KEY أو GEMINI_API_KEY في أسرار Supabase للدالة rozi-chat.',
      }),
      { status: 503, headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'خطأ غير متوقع'
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
