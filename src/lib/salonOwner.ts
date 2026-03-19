import { supabase } from '@/lib/supabase'

/** معرّف المنشأة: من salon_owners ثم owner_id */
export async function getMySalonBusinessId(userId: string): Promise<string | null> {
  const { data: so } = await supabase
    .from('salon_owners')
    .select('salon_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  if (so?.salon_id) return so.salon_id as string
  const { data: b } = await supabase.from('businesses').select('id').eq('owner_id', userId).maybeSingle()
  return (b as { id?: string } | null)?.id ?? null
}

export async function getMySalonName(userId: string): Promise<{ id: string; name_ar: string } | null> {
  const bid = await getMySalonBusinessId(userId)
  if (!bid) return null
  const { data } = await supabase.from('businesses').select('id, name_ar').eq('id', bid).single()
  return data as { id: string; name_ar: string } | null
}
