import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import HelpDetailClient from '@/components/help/HelpDetailClient'

interface Params {
  params: Promise<{ id: string }>
}

export default async function HelpDetailPage({ params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: helpRaw }, { data: responsesRaw }, { data: profileRaw }] = await Promise.all([
    supabase
      .from('help_requests')
      .select(`
        *,
        profiles!requester_id(full_name, department)
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('help_responses')
      .select(`
        *,
        profiles!responder_id(full_name, department)
      `)
      .eq('request_id', id)
      .order('is_accepted', { ascending: false })
      .order('upvotes', { ascending: false })
      .order('created_at', { ascending: true }),
    supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single(),
  ])

  if (!helpRaw) notFound()

  const help = helpRaw as any
  const responses = (responsesRaw ?? []) as any[]
  const profile = profileRaw as { role: string } | null
  const isAdmin = ['admin', 'superadmin'].includes(profile?.role ?? '')

  return (
    <HelpDetailClient
      help={help}
      responses={responses}
      userId={user.id}
      isAdmin={isAdmin}
    />
  )
}
