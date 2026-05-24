import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import HelpBoard from '@/components/help/HelpBoard'

export default async function HelpPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: requests } = await supabase
    .from('help_requests')
    .select(`
      id, title, body, request_type, target_name, target_org,
      status, reward_points, created_at, requester_id,
      profiles!requester_id(full_name, department),
      help_responses!request_id(count)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  const { data: myResponses } = await supabase
    .from('help_responses')
    .select('request_id')
    .eq('responder_id', user.id)

  const respondedIds: string[] = (myResponses ?? []).map(r => r.request_id)

  interface HelpRequestRow {
    id: string
    title: string
    body: string | null
    request_type: string
    target_name: string | null
    target_org: string | null
    status: 'open' | 'resolved' | 'closed'
    reward_points: number
    created_at: string
    requester_id: string
    profiles: { full_name: string; department: string | null } | null
    help_responses: { count: number }[] | null
  }

  const requestsWithCount = (requests ?? []).map((r: HelpRequestRow) => ({
    ...r,
    response_count: r.help_responses?.[0]?.count ?? 0,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#CDD5E0' }}>🙋 도움 요청</h1>
          <p className="text-sm mt-1" style={{ color: '#687898' }}>
            연락처나 정보가 필요하면 동료에게 요청하세요. 도움을 주면 포인트를 받습니다!
          </p>
        </div>
        <Link
          href="/help/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: 'linear-gradient(135deg, #4A7CC0, #0066CC)', color: 'white' }}>
          + 도움 요청하기
        </Link>
      </div>

      <HelpBoard requests={requestsWithCount} userId={user.id} respondedIds={respondedIds} />
    </div>
  )
}
