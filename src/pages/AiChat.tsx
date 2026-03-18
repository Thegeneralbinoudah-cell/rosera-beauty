import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Send, Mic } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type ChatRow = { id: string; message: string; is_user: boolean; created_at: string }

const QUICK_ACTIONS = [
  { label: 'أقرب صالون', reply: 'أقرب صالون' },
  { label: 'أفضل عرض', reply: 'أفضل عرض' },
  { label: 'نصائح جمال', reply: 'نصائح جمال' },
]

const STATIC_RESPONSES: Record<string, string> = {
  'أقرب صالون': 'افتحي تبويب الخريطة من الشريط السفلي وستجدين زر "الأقرب إليك" لتحديد موقعكِ وعرض أقرب الصالونات مع المسافة. 🌸',
  'أفضل عرض': 'تصفحي قسم "عروض اليوم" على الصفحة الرئيسية، أو ابحثي في البحث عن "عروض" لرؤية أحدث العروض من الصالونات.',
  'نصائح جمال': 'نصيحتي: ترطيب البشرة يومياً، استخدام واقي شمس، وتقليم الأظافر بانتظام. للعناية بالشعر استخدمي زيت أرغان على الأطراف. 💜',
  'مرحبا': 'مرحباً بكِ! أنا روزيرا مساعدتكِ الذكية. كيف أقدر أساعدكِ اليوم؟',
  'اهلا': 'أهلاً وسهلاً! تحبين تبحثين عن صالون، عروض، أو نصائح جمال؟',
}

const DEFAULT_RESPONSE = 'شكراً على رسالتكِ! حالياً أقدر أساعدكِ في: البحث عن أقرب صالون، أفضل العروض، ونصائح جمال. جربي أحد الأزرار السريعة أو اكتبي سؤالكِ. 🌸'

function getBotResponse(text: string): string {
  const t = text.trim().toLowerCase()
  for (const [key, value] of Object.entries(STATIC_RESPONSES)) {
    if (t.includes(key.toLowerCase())) return value
  }
  return DEFAULT_RESPONSE
}

export default function AiChat() {
  const { user } = useAuth()
  const nav = useNavigate()
  const [messages, setMessages] = useState<ChatRow[]>([])
  const [input, setInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)
  }, [messages, typing])

  useEffect(() => {
    if (!user) {
      nav('/auth')
      return
    }
    let c = true
    async function load() {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, message, is_user, created_at')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: true })
      if (error || !c) return
      const rows = (data ?? []).map((r: { id: string; message?: string; response?: string; is_user?: boolean; created_at: string }) => ({
        id: r.id,
        message: r.is_user ? (r.message || '') : (r.response || r.message || ''),
        is_user: r.is_user ?? true,
        created_at: r.created_at,
      })) as ChatRow[]
      setMessages(rows)
      if (rows.length === 0) {
        setMessages([
          {
            id: 'welcome',
            message: 'مرحباً! أنا روزيرا مساعدتكِ الذكية 🌸 كيف أقدر أساعدكِ اليوم؟',
            is_user: false,
            created_at: new Date().toISOString(),
          },
        ])
      }
      setLoading(false)
    }
    void load()
    return () => { c = false }
  }, [user, nav])

  const send = async (text: string) => {
    const msg = text.trim()
    if (!msg || !user) return
    setInput('')
    const userRow: ChatRow = {
      id: crypto.randomUUID(),
      message: msg,
      is_user: true,
      created_at: new Date().toISOString(),
    }
    setMessages((m) => [...m, userRow])
    await supabase.from('chat_messages').insert({
      user_id: user.id,
      message: msg,
      is_user: true,
    })
    setTyping(true)
    await new Promise((r) => setTimeout(r, 800))
    const botText = getBotResponse(msg)
    const botRow: ChatRow = {
      id: crypto.randomUUID(),
      message: botText,
      is_user: false,
      created_at: new Date().toISOString(),
    }
    setMessages((m) => [...m, botRow])
    setTyping(false)
    await supabase.from('chat_messages').insert({
      user_id: user.id,
      message: botText,
      response: botText,
      is_user: false,
    })
  }

  const onQuick = (reply: string) => {
    void send(reply)
  }

  if (!user) return null

  return (
    <div className="flex min-h-dvh flex-col bg-rosera-light pb-28 dark:bg-rosera-dark">
      <header className="sticky top-0 z-10 border-b border-primary/10 bg-white px-4 py-4 dark:bg-card">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#9C27B0] to-[#E91E8C] text-lg font-extrabold text-white">
            ر
          </div>
          <div>
            <h1 className="text-lg font-extrabold">روزيرا الذكية</h1>
            <p className="text-xs text-rosera-gray">مساعدتكِ في الجمال والحجوزات</p>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        {loading ? (
          <p className="text-center text-rosera-gray">جاري التحميل...</p>
        ) : (
          <>
            {messages.map((row) => (
              <div
                key={row.id}
                className={`mb-4 flex ${row.is_user ? 'justify-end' : 'justify-start'}`}
              >
                {!row.is_user && (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#9C27B0] to-[#E91E8C] text-sm font-bold text-white">
                    ر
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    row.is_user
                      ? 'bg-gradient-to-l from-[#9C27B0] to-[#E91E8C] text-white'
                      : 'bg-white dark:bg-card border border-primary/10'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{row.message}</p>
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex justify-start gap-1">
                <div className="rounded-2xl bg-white px-4 py-3 dark:bg-card border border-primary/10">
                  <span className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}
            {messages.length <= 1 && !typing && (
              <div className="mt-4 flex flex-wrap gap-2">
                {QUICK_ACTIONS.map(({ label, reply }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onQuick(reply)}
                    className="rounded-full border border-primary/30 bg-white px-4 py-2 text-sm font-bold text-primary dark:bg-card"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-primary/10 bg-white p-3 dark:bg-card">
        <div className="flex gap-2">
          <Input
            className="flex-1 rounded-2xl"
            placeholder="اكتبي رسالتكِ..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send(input)}
          />
          <Button
            size="icon"
            className="shrink-0 rounded-2xl bg-gradient-to-l from-[#9C27B0] to-[#E91E8C]"
            onClick={() => send(input)}
          >
            <Send className="h-5 w-5" />
          </Button>
          <Button size="icon" variant="outline" className="shrink-0 rounded-2xl">
            <Mic className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
