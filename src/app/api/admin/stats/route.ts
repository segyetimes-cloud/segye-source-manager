// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/admin/stats?from=YYYY-MM-DD&to=YYYY-MM-DD
// 관리자용 사용자별 실적 집계
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await (supabase as any).from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'superadmin'].includes((profile as any)?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') // YYYY-MM-DD
  const to = searchParams.get('to')     // YYYY-MM-DD

  const supabaseAny = supabase as any

  // 1. 모든 활성 사용자 목록
  const { data: profiles } = await supabaseAny
    .from('profiles')
    .select('id, full_name, department, desk_name, role, email')
    .eq('is_active', true)
    .order('full_name')

  // 2. 기간 내 취재원 등록 수 (owner_id별)
  let sourcesQuery = supabaseAny
    .from('sources')
    .select('owner_id, created_at, completeness_score')
    .eq('is_deleted', false)
  if (from) sourcesQuery = sourcesQuery.gte('created_at', from + 'T00:00:00')
  if (to)   sourcesQuery = sourcesQuery.lte('created_at', to   + 'T23:59:59')
  const { data: sources } = await sourcesQuery

  // 3. 기간 내 포인트 트랜잭션 (user_id별)
  let pointsQuery = supabaseAny
    .from('point_transactions')
    .select('user_id, points, point_type, created_at')
  if (from) pointsQuery = pointsQuery.gte('created_at', from + 'T00:00:00')
  if (to)   pointsQuery = pointsQuery.lte('created_at', to   + 'T23:59:59')
  const { data: pointTxns } = await pointsQuery

  // 4. 기간 내 수정 이력 (editor_id별)
  let editsQuery = supabaseAny
    .from('source_edit_history')
    .select('editor_id, edited_at')
  if (from) editsQuery = editsQuery.gte('edited_at', from + 'T00:00:00')
  if (to)   editsQuery = editsQuery.lte('edited_at', to   + 'T23:59:59')
  const { data: edits } = await editsQuery

  // 5. 도움 요청 응답 수 (responder_id별)
  let helpQuery = supabaseAny
    .from('help_responses')
    .select('responder_id, created_at')
  if (from) helpQuery = helpQuery.gte('created_at', from + 'T00:00:00')
  if (to)   helpQuery = helpQuery.lte('created_at', to   + 'T23:59:59')
  const { data: helpResps } = await helpQuery

  // 집계
  const srcMap   = new Map<string, number>()
  const ptMap    = new Map<string, number>()
  const editMap  = new Map<string, number>()
  const helpMap  = new Map<string, number>()

  for (const s of (sources ?? [])) {
    srcMap.set(s.owner_id, (srcMap.get(s.owner_id) ?? 0) + 1)
  }
  for (const p of (pointTxns ?? [])) {
    if (p.points > 0) ptMap.set(p.user_id, (ptMap.get(p.user_id) ?? 0) + p.points)
  }
  for (const e of (edits ?? [])) {
    editMap.set(e.editor_id, (editMap.get(e.editor_id) ?? 0) + 1)
  }
  for (const h of (helpResps ?? [])) {
    helpMap.set(h.responder_id, (helpMap.get(h.responder_id) ?? 0) + 1)
  }

  const stats = ((profiles ?? []) as any[]).map(p => ({
    id:          p.id,
    full_name:   p.full_name,
    department:  p.department,
    desk_name:   p.desk_name,
    role:        p.role,
    sources_created: srcMap.get(p.id) ?? 0,
    points_earned:   ptMap.get(p.id)  ?? 0,
    edits_made:      editMap.get(p.id) ?? 0,
    help_responses:  helpMap.get(p.id) ?? 0,
  }))

  return NextResponse.json({ stats, from, to })
}
