import { useState, useRef, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send } from 'lucide-react'
import { motion } from 'framer-motion'

const quick = [
  '🔍 أبغا صالون قريب',
  '💡 رشحي لي صالون شعر',
  '🪞 حللي بشرتي',
  '📅 ساعديني أحجز',
]

export default function AiAssistant() {
  const { user } = useAuth()
  const [msgs, setMsgs] = useState<{ role: 'u' | 'b'; text: string }[]>([
    { role: 'b', text: 'أهلاً! أنا روز، مساعدتك الذكية للجمال والعناية 🌸 كيف أقدر أساعدك؟' },
  ])
  const [input, setInput] = useState('')
  const bottom = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs])

  const reply = async (text: string) => {
    let ans = 'شكراً لسؤالك! جربي البحث عن صالونات من الصفحة الرئيسية أو قسم البحث 🔍'
    const t = text.toLowerCase()
    try {
      if (t.includes('قريب') || t.includes('صالون')) {
        const { data } = await supabase.from('businesses').select('name_ar, city').eq('is_active', true).limit(3)
        if (data?.length)
          ans = `إليك بعض الصالونات: ${data.map((x: { name_ar: string; city: string }) => `${x.name_ar} (${x.city})`).join(' — ')}`
      } else if (t.includes('شعر')) {
        const { data } = await supabase.from('businesses').select('name_ar').eq('category', 'salon').limit(3)
        if (data?.length) ans = `صالونات شعر مقترحة: ${data.map((x: { name_ar: string }) => x.name_ar).join('، ')}`
      } else if (t.includes('بشر') || t.includes('حلل')) {
        ans = 'جربي صفحة كشف البشرة من الملف الشخصي للحصول على تحليل تجريبي 🪞'
      } else if (t.includes('حجز')) {
        ans = 'اختي صالوناً من البحث ثم اضغطي «احجزي الآن» واتبعي الخطوات 📅'
      }
    } catch {
      /* ignore */
    }
    if (user) {
      try {
        await supabase.from('chat_messages').insert({
          user_id: user.id,
          message: text,
          response: ans,
          is_user: true,
        })
      } catch {
        /* ignore */
      }
    }
    setMsgs((m) => [...m, { role: 'b', text: ans }])
  }

  const send = () => {
    const t = input.trim()
    if (!t) return
    setMsgs((m) => [...m, { role: 'u', text: t }])
    setInput('')
    void reply(t)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-rosera-light dark:bg-rosera-dark">
      <header className="border-b bg-white px-4 py-4 dark:bg-card">
        <h1 className="text-center text-xl font-bold text-primary">روز 🌹</h1>
      </header>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex flex-wrap gap-2">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setMsgs((m) => [...m, { role: 'u', text: q }])
                void reply(q)
              }}
              className="rounded-full border border-primary/30 bg-white px-3 py-2 text-sm dark:bg-card"
            >
              {q}
            </button>
          ))}
        </div>
        {msgs.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${msg.role === 'u' ? 'justify-start' : 'justify-end'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.role === 'u' ? 'gradient-rosera text-white rounded-br-md' : 'bg-white shadow dark:bg-card rounded-bl-md'
              }`}
            >
              {msg.text}
            </div>
          </motion.div>
        ))}
        <div ref={bottom} />
      </div>
      <div className="border-t bg-white p-4 dark:bg-card">
        <div className="mx-auto flex max-w-lg gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="اكتبي رسالتك..." />
          <Button size="icon" onClick={send}>
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
