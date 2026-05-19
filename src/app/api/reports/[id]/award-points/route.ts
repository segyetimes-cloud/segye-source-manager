// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/reports/[id]/award-points — 데스크가 정보보고 작성자에게 포인트 부여
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const supabaseAny = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 데스크(admin/superadmin)만 허용
  const { data: myProfile } = await supabaseAny
    .from('profiles').select('role, full_name').eq('id', user.id).single()
  if (!['admin', 'superadmin'].includes(myProfile?.role ?? '')) {
    return NextResponse.json({ error: '데스크 이상만 포인트를 부여할 수 있습니다.' }, { status: 403 })
  }

  // 보고서 조회 — 수신자(author) 확인
  const { data: report } = await supabaseAny
    .from('information_reports')
    .select('author_id, title, profiles!author_id(full_name)')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()

  if (!report) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })

  // 자기 자신에게는 부여 불가
  if (report.author_id === user.id) {
    return NextResponse.json({ error: '자신의 보고서에는 포인트를 부여할 수 없습니다.' }, { status: 400 })
  }

  const body = await request.json()
  const { points, memo } = body

  const pts = Math.round(Number(points))
  if (!pts || pts < 1 || pts > 100) {
    return NextResponse.json({ error: '포인트는 1~100 사이 정수여야 합니다.' }, { status: 400 })
  }

  const authorName = (report.profiles as any)?.full_name ?? '기자'
  const desc = memo?.trim()
    ? `[정보보고] ${myProfile.full_name} 데스크 부여 — ${memo.trim()}`
    : `[정보보고] ${myProfile.full_name} 데스크 부여`

  const serviceClient = createServiceClient()
  const { error } = await (serviceClient as any).from('point_transactions').insert({
    user_id: report.author_id,
    point_type: 'report_award',
    points: pts,
    related_report_id: id,
    related_user_id: user.id,
    description: desc,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, points: pts, recipient: authorName })
}

// GET /api/reports/[id]/award-points — 이 보고서에 부여된 포인트 내역 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const supabaseAny = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 데스크만 내역 조회 가능
  const { data: myProfile } = await supabaseAny
    .from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'superadmin'].includes(myProfile?.role ?? '')) {
    return NextResponse.json({ awards: [] })
  }

  const { data: awards } = await supabaseAny
    .from('point_transactions')
    .select('id, points, description, created_at, profiles!related_user_id(full_name)')
    .eq('related_report_id', id)
    .eq('point_type', 'report_award')
    .order('created_at', { ascending: false })

  return NextResponse.json({ awards: awards ?? [] })
}
