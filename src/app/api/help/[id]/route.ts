
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'

// GET /api/help/[id] — 도움 요청 상세 + 응답 목록
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: helpReq }, { data: responses }] = await Promise.all([
    supabase
      .from('help_requests')
      .select(`
        *,
        profiles!requester_id(full_name, department)
      `)
      .eq('id', id)
      .single(),
    supabase
      .from('help_responses')
      .select(`
        *,
        profiles!responder_id(full_name, department)
      `)
      .eq('request_id', id)
      .order('is_accepted', { ascending: false })
      .order('upvotes', { ascending: false })
      .order('created_at', { ascending: true }),
  ])

  if (!helpReq) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ ...helpReq, responses: responses ?? [] })
}

// PATCH /api/help/[id] — 상태 변경 (close 등)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: helpReq } = await supabase
    .from('help_requests')
    .select('requester_id')
    .eq('id', id)
    .single()

  if (!helpReq) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = ['admin', 'section_editor', 'editor', 'publisher', 'superadmin'].includes(profile?.role ?? '')
  const isOwner = helpReq.requester_id === user.id

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  type HelpUpdate = Database['public']['Tables']['help_requests']['Update']
  const updates: HelpUpdate = {}
  if ('status' in body) updates.status = body.status as HelpUpdate['status']
  if ('title'  in body) updates.title  = body.title  as string
  if ('body'   in body) updates.body   = body.body   as string | null

  // closed 상태로 변경 시 포인트 환불 처리
  if (updates.status === 'closed') {
    const { data: currentReq } = await supabase
      .from('help_requests')
      .select('status, accepted_response_id, reward_points, requester_id')
      .eq('id', id)
      .single()

    // open 상태에서 마감 + 채택 없음 → 포인트 환불
    if (currentReq?.status === 'open' && !currentReq?.accepted_response_id) {
      await supabase.from('point_transactions').insert({
        user_id: currentReq.requester_id,
        point_type: 'help_provided',
        points: currentReq.reward_points,
        related_request_id: id,
        description: `도움 요청 마감 - 포인트 환불 (${currentReq.reward_points}pt)`,
      })
    }
  }

  const { data, error } = await supabase
    .from('help_requests')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/help/[id] — 도움 요청 삭제 (본인 또는 admin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: helpReq } = await supabase
    .from('help_requests')
    .select('requester_id')
    .eq('id', id)
    .single()

  if (!helpReq) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = ['admin', 'section_editor', 'editor', 'publisher', 'superadmin'].includes(profile?.role ?? '')
  if (helpReq.requester_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase.from('help_requests').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
