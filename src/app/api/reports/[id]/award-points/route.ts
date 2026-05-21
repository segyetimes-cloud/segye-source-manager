import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { can, CAN_AWARD_POINTS } from '@/lib/permissions'

/**
 * GET  /api/reports/[id]/award-points — 이 보고서에 지급된 포인트 이력 조회
 * POST /api/reports/[id]/award-points — 포인트 지급 (부장 이상만)
 */

// GET — 포인트 지급 이력 (데스크+ 또는 보고서 작성자)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profileRaw } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = profileRaw as { role: string } | null
  const canAward = can(profile?.role, CAN_AWARD_POINTS)

  // 작성자 확인
  const { data: reportRaw } = await supabase
    .from('information_reports')
    .select('author_id')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()
  const report = reportRaw as { author_id: string } | null

  if (!report) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })
  const isAuthor = report.author_id === user.id
  if (!canAward && !isAuthor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: awardsRaw, error } = await supabase
    .from('point_transactions')
    .select('id, points, description, created_at, profiles!user_id(full_name)')
    .eq('related_report_id', id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ awards: awardsRaw ?? [] })
}

// POST — 포인트 지급 (부장 이상 전용)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profileRaw } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = profileRaw as { role: string } | null

  if (!can(profile?.role, CAN_AWARD_POINTS)) {
    return NextResponse.json({ error: '포인트 지급 권한이 없습니다.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { points, memo } = body as { points: unknown; memo?: string }

  const pts = Number(points)
  if (!Number.isInteger(pts) || pts < 1 || pts > 1000) {
    return NextResponse.json({ error: '포인트는 1~1000 사이의 정수여야 합니다.' }, { status: 400 })
  }

  // 보고서 작성자 조회 (포인트 수신자)
  const { data: reportRaw, error: reportErr } = await supabase
    .from('information_reports')
    .select('author_id, status')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()
  if (reportErr || !reportRaw) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })

  const report = reportRaw as { author_id: string; status: string }

  // 자신에게 지급 불가
  if (report.author_id === user.id) {
    return NextResponse.json({ error: '본인 보고서에는 포인트를 지급할 수 없습니다.' }, { status: 400 })
  }

  // point_transactions 삽입 — DB 트리거가 user_points_summary를 자동 갱신
  const { error: logErr } = await supabase.from('point_transactions').insert({
    user_id:           report.author_id,
    points:            pts,
    point_type:        'report_award' as const,
    related_report_id: id,
    related_user_id:   user.id,
    description:       memo?.trim() ?? null,
  })
  if (logErr) return NextResponse.json({ error: logErr.message }, { status: 500 })

  void supabase.from('audit_logs').insert({
    user_id:       user.id,
    user_email:    user.email ?? null,
    action:        'points_award' as any,
    resource_type: 'report',
    resource_id:   id,
    metadata:      { points: pts, recipient: report.author_id, memo: memo ?? null },
  } as any)

  return NextResponse.json({ success: true, points: pts })
}
