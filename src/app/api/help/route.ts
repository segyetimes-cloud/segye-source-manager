// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/help — 도움 요청 목록
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') ?? 'open'
  const page = parseInt(searchParams.get('page') ?? '1')
  const pageSize = 20

  let query = supabase
    .from('help_requests')
    .select(`
      id, title, body, request_type, target_name, target_org,
      status, reward_points, created_at, requester_id,
      profiles!requester_id(full_name, department)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, count })
}

// POST /api/help — 도움 요청 생성 (포인트 에스크로)
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { title, body: requestBody, request_type, target_source_id, target_name, target_org, reward_points } = body

  if (!title?.trim() || !request_type) {
    return NextResponse.json({ error: '제목과 요청 유형은 필수입니다' }, { status: 400 })
  }

  const points = Math.min(Math.max(Number(reward_points) || 10, 5), 100)

  // 포인트 잔액 확인
  const { data: summary } = await supabase
    .from('user_points_summary')
    .select('total_points')
    .eq('user_id', user.id)
    .single()

  const currentPoints = (summary as any)?.total_points ?? 0
  if (currentPoints < points) {
    return NextResponse.json({
      error: `포인트가 부족합니다 (현재: ${currentPoints}pt, 필요: ${points}pt)`
    }, { status: 400 })
  }

  // 요청 생성
  const { data: newRequest, error } = await supabase
    .from('help_requests')
    .insert({
      requester_id: user.id,
      title: title.trim(),
      body: requestBody?.trim() ?? null,
      request_type,
      target_source_id: target_source_id ?? null,
      target_name: target_name?.trim() ?? null,
      target_org: target_org?.trim() ?? null,
      status: 'open',
      reward_points: points,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 포인트 에스크로 차감 (Service Role)
  const serviceClient = createServiceClient()
  await serviceClient.from('point_transactions').insert({
    user_id: user.id,
    point_type: 'penalty_deduct',
    points: -points,
    related_request_id: newRequest.id,
    description: `도움 요청 포인트 예치 (${points}pt)`,
  })

  return NextResponse.json(newRequest, { status: 201 })
}
