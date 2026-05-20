// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const DESK_ROLES = ['admin', 'section_editor', 'editor', 'publisher', 'superadmin']

// PATCH /api/reports/[id]/review
// body: { action: 'submit' | 'approve' | 'reject', note?: string }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const supabaseAny = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { action, note } = body as { action: 'submit' | 'approve' | 'reject'; note?: string }

  if (!['submit', 'approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'action은 submit | approve | reject 중 하나여야 합니다.' }, { status: 400 })
  }

  // 현재 사용자 프로필
  const { data: myProfile } = await supabaseAny
    .from('profiles').select('role, full_name').eq('id', user.id).single()
  const isDesk = DESK_ROLES.includes(myProfile?.role ?? '')

  // 보고서 조회
  const { data: report } = await supabaseAny
    .from('information_reports')
    .select('id, author_id, title, status')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()

  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // ── submit: 작성자 본인만 ─────────────────────────────────────────────────
  if (action === 'submit') {
    if (report.author_id !== user.id) {
      return NextResponse.json({ error: '작성자 본인만 검토 요청할 수 있습니다.' }, { status: 403 })
    }
    if (report.status !== 'draft') {
      return NextResponse.json({ error: '초안(draft) 상태에서만 검토 요청할 수 있습니다.' }, { status: 409 })
    }

    const { data: updated, error } = await supabaseAny
      .from('information_reports')
      .update({ status: 'submitted', updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(updated)
  }

  // ── approve / reject: 데스크 역할만 ─────────────────────────────────────
  if (!isDesk) {
    return NextResponse.json({ error: '데스크 이상 역할만 승인/반려할 수 있습니다.' }, { status: 403 })
  }

  if (report.status !== 'submitted') {
    return NextResponse.json({ error: '제출(submitted) 상태에서만 승인/반려할 수 있습니다.' }, { status: 409 })
  }

  if (action === 'reject' && !note?.trim()) {
    return NextResponse.json({ error: '반려 사유를 입력해 주세요.' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const newStatus = action === 'approve' ? 'approved' : 'rejected'

  const { data: updated, error } = await supabaseAny
    .from('information_reports')
    .update({
      status: newStatus,
      reviewer_id: user.id,
      reviewed_at: now,
      review_note: note?.trim() ?? null,
      updated_at: now,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 알림 발송 (service role)
  const serviceClient = createServiceClient() as any
  if (action === 'approve') {
    await serviceClient.from('notifications').insert({
      user_id: report.author_id,
      type: 'report_reviewed',
      title: '정보보고가 승인됐습니다',
      body: report.title,
      link_path: `/reports/${id}`,
      related_id: id,
    })
  } else {
    await serviceClient.from('notifications').insert({
      user_id: report.author_id,
      type: 'report_reviewed',
      title: '정보보고가 반려됐습니다',
      body: note?.trim() ?? null,
      link_path: `/reports/${id}`,
      related_id: id,
    })
  }

  return NextResponse.json(updated)
}
