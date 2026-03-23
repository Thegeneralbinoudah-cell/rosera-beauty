/**
 * OpenAI copy for growth notifications — keep model/temperature aligned with product tone.
 */
export type GrowthTriggerType = 'inactive' | 'viewed_not_booked' | 'new_offer' | 'skin_followup'

export type GrowthContextPack = {
  trigger_type: GrowthTriggerType
  metadata: Record<string, unknown>
  profile: { full_name: string | null; city: string | null }
  skin_summary: string
  ranking_hint: string
  recent_behavior: string
}

const OPENAI_MODEL = 'gpt-4o-mini'

function readOpenAiApiKey(): string {
  const raw = Deno.env.get('OPENAI_API_KEY')?.trim() || ''
  let k = raw
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim()
  }
  return k.replace(/\r?\n/g, '').replace(/\s+/g, '')
}

export async function generateGrowthNotificationCopy(
  pack: GrowthContextPack
): Promise<{ title: string; body: string }> {
  const apiKey = readOpenAiApiKey()
  if (!apiKey) {
    return {
      title: 'روزيرا 💜',
      body: fallbackBody(pack),
    }
  }

  const sys = `أنتِ مساعدة نمو لتطبيق روزيرا (Rosera) للنساء في السعودية.
اكتبي إشعاراً قصيراً بالعربية فقط: عنوان جذاب (سطر واحد، ≤ 60 حرفاً) ونص ودود (≤ 220 حرفاً).
لا تذكري التشخيص الطبي. شجّعي على الحجز أو العودة للتطبيق بأسلوب دافئ.
أجيبي JSON فقط: {"title":"...","body":"..."}`

  const user = `نوع الزناد: ${pack.trigger_type}
بيانات إضافية (JSON): ${JSON.stringify(pack.metadata)}
الملف: الاسم ${pack.profile.full_name || '—'}، المدينة ${pack.profile.city || '—'}
ملخص بشرة: ${pack.skin_summary || '—'}
توصيات/سياق: ${pack.ranking_hint || '—'}
سلوك حديث: ${pack.recent_behavior || '—'}`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.55,
        max_tokens: 220,
      }),
    })
    const data = (await res.json()) as {
      error?: { message?: string }
      choices?: { message?: { content?: string | null } }[]
    }
    if (!res.ok) throw new Error(data.error?.message || `OpenAI ${res.status}`)
    const raw = data.choices?.[0]?.message?.content
    if (typeof raw !== 'string' || !raw.trim()) throw new Error('empty')
    const j = JSON.parse(raw) as { title?: string; body?: string }
    const title = (j.title || '').trim().slice(0, 80)
    const body = (j.body || '').trim().slice(0, 320)
    if (title.length < 3 || body.length < 8) throw new Error('short')
    return { title, body }
  } catch (e) {
    console.warn('[growthCopy] OpenAI fallback', e)
    return {
      title: 'روزيرا 💜',
      body: fallbackBody(pack),
    }
  }
}

function fallbackBody(p: GrowthContextPack): string {
  const city = p.profile.city || 'منطقتكِ'
  switch (p.trigger_type) {
    case 'inactive':
      return `اشتقنا لكِ! تصفّحي أحدث الصالونات والعروض في ${city} واحجزي بسهولة من روزيرا.`
    case 'viewed_not_booked': {
      const name = typeof p.metadata.service_name === 'string' ? p.metadata.service_name : 'الخدمة'
      return `✨ لاحظنا اهتمامكِ بـ «${name}» — أكملي الحجز الآن من التطبيق واختاري موعداً يناسبكِ.`
    }
    case 'skin_followup':
      return 'حان وقت متابعة بشرتكِ — جدّدي تحليل البشرة في روزيرا واحصلي على توصيات أدق.'
    case 'new_offer': {
      const t = typeof p.metadata.title_ar === 'string' ? p.metadata.title_ar : 'عرض مميز'
      return `🔥 عرض اليوم قريب منكِ: ${t} — ادخلي التطبيق لاكتشاف التفاصيل والحجز.`
    }
    default:
      return 'اكتشفي عروضاً وخدمات جديدة في روزيرا اليوم.'
  }
}

export function notificationTypeForTrigger(t: GrowthTriggerType): string {
  switch (t) {
    case 'inactive':
      return 'growth_inactive'
    case 'viewed_not_booked':
      return 'growth_nudge'
    case 'skin_followup':
      return 'growth_skin'
    case 'new_offer':
      return 'growth_offer'
    default:
      return 'growth_promo'
  }
}
