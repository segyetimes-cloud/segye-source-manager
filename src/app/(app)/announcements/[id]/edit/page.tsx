import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import AnnouncementEditClient from './AnnouncementEditClient'

export default async function EditAnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if ((profile as { role: string } | null)?.role !== 'superadmin') redirect('/announcements')

  const { data } = await supabase.from('announcements').select('*').eq('id', id).single()
  if (!data) notFound()

  return <AnnouncementEditClient announcement={data as { id: string; title: string; body: string | null; is_pinned: boolean }} />
}
