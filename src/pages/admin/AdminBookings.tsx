import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminBookings() {
  const [rows, setRows] = useState<
    { id: string; booking_date: string; status: string; businesses: { name_ar: string } }[]
  >([])

  useEffect(() => {
    void supabase
      .from('bookings')
      .select('id, booking_date, status, businesses(name_ar)')
      .order('booking_date', { ascending: false })
      .limit(80)
      .then(({ data }) => setRows((data ?? []) as unknown as typeof rows))
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold">كل الحجوزات</h1>
      <div className="mt-6 space-y-2">
        {rows.map((r) => (
          <div key={r.id} className="flex justify-between rounded-xl border bg-white p-4 dark:bg-card">
            <span className="font-medium">{r.businesses?.name_ar}</span>
            <span>{r.booking_date}</span>
            <span className="text-primary">{r.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
