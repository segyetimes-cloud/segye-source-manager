import { createClient } from '@/lib/supabase/server'
import AnnouncementsClient from './AnnouncementsClient'

export default async function AnnouncementsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  const isSuperAdmin = (profile as { role: string } | null)?.role === 'superadmin'

  const { data } = await supabase
    .from('announcements')
    .select('id, title, body, is_pinned, created_at, profiles(full_name)')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  return <AnnouncementsClient announcements={data ?? []} isSuperAdmin={isSuperAdmin} />
}
