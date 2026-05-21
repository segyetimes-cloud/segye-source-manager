import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/points — 내 포인트 내역 + 요약
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [
    { data: summaryRaw },
    { data: transactions },
    { data: leaderboard },
  ] = await Promise.all([
    supabase.from('user_points_summary').select('*').eq('user_id', user.id).single(),
    supabase.from('point_transactions')
      .select('id, point_type, points, description, created_at, related_source_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('user_points_summary')
      .select('user_id, total_points, profiles(full_name, department)')
      .order('total_points', { ascending: false })
      .limit(10),
  ])

  const summary = summaryRaw as { total_points: number } | null

  // 내 순위 계산
  const { count: higherRank } = await supabase
    .from('user_points_summary')
    .select('*', { count: 'exact', head: true })
    .gt('total_points', summary?.total_points ?? 0)

  return NextResponse.json({
    summary: {
      ...summary,
      my_rank: (higherRank ?? 0) + 1,
    },
    transactions,
    leaderboard,
  })
}
