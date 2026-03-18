import { Card } from '@/components/ui/card'

export default function AdminAnalytics() {
  return (
    <div>
      <h1 className="text-2xl font-bold">التحليلات</h1>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card className="p-8">
          <h3 className="font-bold">الحجوزات عبر الزمن</h3>
          <div className="mt-6 flex h-40 items-end justify-around gap-2">
            {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
              <div key={i} className="w-8 rounded-t-lg gradient-rosera" style={{ height: `${h}%` }} />
            ))}
          </div>
        </Card>
        <Card className="p-8">
          <h3 className="font-bold">أفضل المدن</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex justify-between">
              <span>الرياض</span>
              <span className="font-bold text-primary">32%</span>
            </li>
            <li className="flex justify-between">
              <span>جدة</span>
              <span className="font-bold text-primary">24%</span>
            </li>
            <li className="flex justify-between">
              <span>الخبر</span>
              <span className="font-bold text-primary">18%</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  )
}
