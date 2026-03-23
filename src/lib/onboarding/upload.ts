import { supabase } from '@/lib/supabase'

export type SalonImageBucket = 'salon-portfolio' | 'salon-photos'

export async function uploadSalonImage(
  file: File,
  userId: string,
  bucket: SalonImageBucket,
  prefix: string
): Promise<{ url: string; path: string }> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const safePrefix = prefix.replace(/[^a-zA-Z0-9/_-]/g, '_').slice(0, 80)
  const path = `${userId}/onboarding/${safePrefix}-${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || 'image/jpeg',
  })

  if (error) throw new Error(error.message)

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { url: data.publicUrl, path }
}
