import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

export default function SkinAnalysis() {
  const [done, setDone] = useState(false)
  const [img, setImg] = useState<string | null>(null)

  const analyze = () => {
    setDone(true)
  }

  return (
    <div className="min-h-dvh bg-rosera-light px-4 py-8 dark:bg-rosera-dark">
      <h1 className="text-center text-2xl font-bold">كشف البشرة بالذكاء الاصطناعي 🪞</h1>
      <div className="mx-auto mt-8 max-w-md">
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/40 bg-white p-12 dark:bg-card">
          <input
            type="file"
            accept="image/*"
            capture="user"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) setImg(URL.createObjectURL(f))
            }}
          />
          {img ? <img src={img} alt="" className="max-h-48 rounded-xl object-cover" /> : <span className="text-rosera-gray">التقطي أو اختاري صورة للوجه</span>}
        </label>
        <Button className="mt-6 w-full" disabled={!img} onClick={analyze}>
          تحليل
        </Button>

        {done && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-10 space-y-6 rounded-2xl border bg-white p-6 dark:bg-card">
            <div>
              <h3 className="font-bold text-primary">نوع البشرة</h3>
              <p className="text-rosera-gray">مختلطة مع ميل للدهنية في منطقة T</p>
            </div>
            <div>
              <h3 className="font-bold text-primary">ملاحظات</h3>
              <ul className="list-disc pe-5 text-sm text-rosera-gray">
                <li>خفيف حب شباب على الجبهة</li>
                <li>هالات خفيفة تحت العين</li>
                <li>تصبغات خفيفة على الخدين</li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-primary">مستوى الترطيب</h3>
              <Progress value={62} className="mt-2" />
              <p className="mt-1 text-sm text-rosera-gray">62% — يُنصح بمرطب يومي SPF+</p>
            </div>
            <div>
              <h3 className="font-bold text-primary">توصيات</h3>
              <p className="text-sm text-rosera-gray">تنظيف لطيف، سيروم فيتامين ج، وقاية شمسية يومية.</p>
            </div>
            <Link to="/search?category=skincare">
              <Button variant="secondary" className="w-full">
                صالونات العناية بالبشرة
              </Button>
            </Link>
            <Button variant="outline" className="w-full">
              شاركي النتيجة
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  )
}
