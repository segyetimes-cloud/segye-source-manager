// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/help/[id]/responses — 응답 작성
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: requestId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 요청 확인
  const { data: helpReq } = await supabase
    .from('help_requests')
    .select('id, requester_id, status, reward_points')
    .eq('id', requestId)
    .single()

  if (!helpReq) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (helpReq.status !== 'open') {
    return NextResponse.json({ error: '이미 마감된 요청입니다' }, { status: 400 })
  }
  if (helpReq.requester_id === user.id) {
    return NextResponse.json({ error: '본인 요청에는 응답할 수 없습니다' }, { status: 403 })
  }

  const body = await request.json()
  const { body: responseBody, attached_source_id } = body

  if (!responseBody?.trim()) {
    return NextResponse.json({ error: '응답 내용이 필요합니다' }, { status: 400 })
  }

  const { data: newResponse, error } = await supabase
    .from('help_responses')
    .insert({
      request_id: requestId,
      responder_id: user.id,
      body: responseBody.trim(),
      attached_source_id: attached_source_id ?? null,
      is_accepted: false,
      upvotes: 0,
    })
    .select(`
      *,
      profiles!responder_id(full_name, department)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 응답 작성 포인트 +3
  const serviceClient = createServiceClient()
  await serviceClient.from('point_transactions').insert({
    user_id: user.id,
    point_type: 'help_provided',
    points: 1,
    related_request_id: requestId,
    description: '도움 응답 작성',
  })

  return NextResponse.json(newResponse, { status: 201 })
}

// PATCH /api/help/[id]/responses — 응답 채택
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: requestId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 요청자 확인
  const { data: helpReq } = await supabase
    .from('help_requests')
    .select('requester_id, status, reward_points, accepted_response_id')
    .eq('id', requestId)
    .single()

  if (!helpReq) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (helpReq.requester_id !== user.id) {
    return NextResponse.json({ error: '요청자만 채택할 수 있습니다' }, { status: 403 })
  }
  if (helpReq.accepted_response_id) {
    return NextResponse.json({ error: '이미 채택된 응답이 있습니다' }, { status: 409 })
  }

  const body = await request.json()
  const { response_id } = body
  if (!response_id) return NextResponse.json({ error: 'response_id 필요' }, { status: 400 })

  // 응답 채택 처리
  const { data: response } = await supabase
    .from('help_responses')
    .select('responder_id')
    .eq('id', response_id)
    .eq('request_id', requestId)
    .single()

  if (!response) return NextResponse.json({ error: '응답을 찾을 수 없습니다' }, { status: 404 })

  // 트랜잭션 처리: 응답 채택 + 요청 resolved
  await Promise.all([
    supabase.from('help_responses').update({ is_accepted: true }).eq('id', response_id),
    supabase.from('help_requests').update({
      status: 'resolved',
      accepted_response_id: response_id,
    }).eq('id', requestId),
  ])

  // 채택된 응답자에게 리워드 포인트 지급
  const serviceClient = createServiceClient()
  await serviceClient.from('point_transactions').insert({
    user_id: response.responder_id,
    point_type: 'help_accepted',
    points: helpReq.reward_points,
    related_request_id: requestId,
    related_user_id: user.id,
    description: `도움 응답 채택 (${helpReq.reward_points}pt 리워드)`,
  })

  return NextResponse.json({ ok: true, response_id, reward_points: helpReq.reward_points })
}
