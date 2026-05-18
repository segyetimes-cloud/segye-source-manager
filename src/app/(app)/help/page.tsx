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
      profiles!requester_id(full_name, department)
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#E8F0FE' }}>🙋 도움 요청</h1>
          <p className="text-sm mt-1" style={{ color: '#8899BB' }}>
            연락처나 정보가 필요하면 동료에게 요청하세요. 도움을 주면 포인트를 받습니다!
          </p>
        </div>
        <Link
          href="/help/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
          style={{ background: 'linear-gradient(135deg, #1E90FF, #0066CC)', color: 'white' }}>
          + 도움 요청하기
        </Link>
      </div>

      <HelpBoard requests={(requests ?? []) as any[]} userId={user.id} />
    </div>
  )
}
