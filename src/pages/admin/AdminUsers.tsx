import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
export default function AdminUsers() {
  const [rows, setRows] = useState<{ id: string; full_name: string; email: string; role: string }[]>([])

  useEffect(() => {
    void supabase.from('profiles').select('id, full_name, email, role').limit(100).then(({ data }) => setRows((data ?? []) as typeof rows))
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold">المستخدمون</h1>
      <div className="mt-6 overflow-x-auto rounded-xl border bg-white dark:bg-card">
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr>
              <th className="p-3 text-start">الاسم</th>
              <th className="p-3">البريد</th>
              <th className="p-3">الدور</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b">
                <td className="p-3">{r.full_name}</td>
                <td className="p-3">{r.email}</td>
                <td className="p-3 text-center">{r.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
