import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import HelpRewardsClient from '@/components/admin/HelpRewardsClient'

export default async function HelpRewardsPage() {
  const supabase = await createClient()
  const supabaseAny = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabaseAny
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'superadmin'].includes(profile?.role ?? '')) {
    redirect('/dashboard')
  }

  // resolved 된 도움 요청 목록 (최근 50개)
  const { data: helpRequests } = await supabaseAny
    .from('help_requests')
    .select(`
      id, title, request_type, target_name, reward_points, created_at, requester_id,
      accepted_response_id,
      profiles!requester_id(full_name, department),
      help_responses!request_id(id, responder_id, body, is_accepted, profiles!responder_id(full_name, department))
    `)
    .eq('status', 'resolved')
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#CDD5E0' }}>🏆 도움 보너스 포인트</h1>
        <p className="text-sm mt-1" style={{ color: '#687898' }}>
          해결된 도움 요청에 대해 요청자 및 응답자에게 추가 포인트를 지급합니다
        </p>
      </div>
      <HelpRewardsClient requests={(helpRequests ?? []) as any[]} />
    </div>
  )
}
