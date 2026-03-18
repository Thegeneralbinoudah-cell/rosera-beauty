import { Card } from '@/components/ui/card'

export default function OwnerSchedule() {
  return (
    <div>
      <h1 className="text-2xl font-bold">ساعات العمل والعطل</h1>
      <Card className="mt-6 space-y-4 p-6">
        <p className="text-rosera-gray">السبت – الخميس: 10:00 – 22:00</p>
        <p className="text-rosera-gray">الجمعة: 14:00 – 22:00</p>
        <p className="text-sm text-primary">عدّلي الأوقات من إعدادات المنشأة (قريباً).</p>
      </Card>
    </div>
  )
}
