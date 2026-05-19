import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ApprovalsClient from '@/components/admin/ApprovalsClient'

export default async function AdminApprovalsPage() {
  const supabase = await createClient()
  const supabaseAny = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileRaw } = await supabaseAny
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const profile = profileRaw as { role: string } | null
  if (!['admin', 'superadmin'].includes(profile?.role ?? '')) {
    redirect('/dashboard')
  }

  // pending 먼저, 최신순
  const { data: pendingRaw } = await supabaseAny
    .from('source_access_approvals')
    .select(`
      id, source_id, requester_id, reason, status, requested_at, decided_at, expires_at, reject_reason,
      sources!source_id(full_name, current_organization),
      profiles!requester_id(full_name, department, email)
    `)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })

  const { data: recentRaw } = await supabaseAny
    .from('source_access_approvals')
    .select(`
      id, source_id, requester_id, reason, status, requested_at, decided_at, expires_at, reject_reason,
      sources!source_id(full_name, current_organization),
      profiles!requester_id(full_name, department, email)
    `)
    .in('status', ['approved', 'rejected'])
    .order('decided_at', { ascending: false })
    .limit(50)

  const pending = (pendingRaw ?? []) as any[]
  const recent = (recentRaw ?? []) as any[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#CDD5E0' }}>민감정보 열람 승인</h1>
        <p className="text-sm mt-1" style={{ color: '#687898' }}>
          기자들의 민감정보 열람 요청을 검토하고 승인/거절합니다
        </p>
      </div>
      <ApprovalsClient pending={pending} recent={recent} />
    </div>
  )
}
