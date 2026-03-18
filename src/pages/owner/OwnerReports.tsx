import { Card } from '@/components/ui/card'

export default function OwnerReports() {
  return (
    <div>
      <h1 className="text-2xl font-bold">تقارير الإيرادات</h1>
      <Card className="mt-6 p-8">
        <p className="text-rosera-gray">تقرير شهري قريباً — عرض تفصيلي لكل خدمة وحجز.</p>
        <div className="mt-8 flex h-32 items-end gap-2">
          {[30, 50, 40, 70, 55, 80].map((h, i) => (
            <div key={i} className="flex-1 rounded-t-lg bg-primary/60" style={{ height: `${h}%` }} />
          ))}
        </div>
      </Card>
    </div>
  )
}
