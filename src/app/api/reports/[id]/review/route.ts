import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { can, CAN_APPROVE_REPORT } from '@/lib/permissions'
import type { Database } from '@/types/database'
import { auditLog } from '@/lib/audit'

type ReportUpdate = Database['public']['Tables']['information_reports']['Update']

/**
 * PATCH /api/reports/[id]/review
 * 보고서 검토 상태 변경
 *
 * action:
 *  - "submit"  — 작성자: 검토 요청 (draft → submitted)
 *  - "approve" — 부국장 이상: 승인 (submitted → approved)
 *  - "reject"  — 부국장 이상: 반려 (submitted → rejected), note 필수
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 현재 사용자 프로필 조회
  const { data: profileRaw } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = profileRaw as { role: string } | null

  // 보고서 현재 상태 조회
  const { data: reportRaw, error: reportErr } = await supabase
    .from('information_reports')
    .select('id, author_id, status')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()
  if (reportErr || !reportRaw) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })

  const report = reportRaw as { id: string; author_id: string; status: string }
  const isAuthor = report.author_id === user.id
  const canApprove = can(profile?.role, CAN_APPROVE_REPORT)

  const body = await request.json().catch(() => ({}))
  const { action, note } = body as { action: 'submit' | 'approve' | 'reject'; note?: string }

  if (!action) return NextResponse.json({ error: 'action이 필요합니다.' }, { status: 400 })

  // ── 상태 전이 검증 ──────────────────────────────────────────────────
  if (action === 'submit') {
    if (!isAuthor) return NextResponse.json({ error: '검토 요청은 작성자만 할 수 있습니다.' }, { status: 403 })
    if (report.status !== 'draft' && report.status !== 'rejected') {
      return NextResponse.json({ error: '임시저장 또는 반려 상태에서만 검토 요청이 가능합니다.' }, { status: 400 })
    }
  } else if (action === 'approve') {
    if (!canApprove) return NextResponse.json({ error: '승인 권한이 없습니다.' }, { status: 403 })
    if (report.status !== 'submitted') {
      return NextResponse.json({ error: '검토 중 상태에서만 승인이 가능합니다.' }, { status: 400 })
    }
  } else if (action === 'reject') {
    if (!canApprove) return NextResponse.json({ error: '반려 권한이 없습니다.' }, { status: 403 })
    if (report.status !== 'submitted') {
      return NextResponse.json({ error: '검토 중 상태에서만 반려가 가능합니다.' }, { status: 400 })
    }
    if (!note?.trim()) return NextResponse.json({ error: '반려 사유를 입력해 주세요.' }, { status: 400 })
  } else {
    return NextResponse.json({ error: '알 수 없는 action입니다.' }, { status: 400 })
  }

  // ── 상태 업데이트 ───────────────────────────────────────────────────
  const statusMap = { submit: 'submitted', approve: 'approved', reject: 'rejected' } as const
  const newStatus = statusMap[action]

  const updatePayload: ReportUpdate = { status: newStatus }
  if (action === 'approve' || action === 'reject') {
    updatePayload.reviewer_id  = user.id
    updatePayload.reviewed_at  = new Date().toISOString()
    updatePayload.review_note  = note?.trim() ?? null
  } else {
    // submit: 이전 반려 메모 초기화
    updatePayload.review_note  = null
  }

  // TODO(Task #9): Remove cast when supabase gen types adds proper Relationships
  const { error: updateErr } = await (supabase as any)
    .from('information_reports')
    .update(updatePayload as ReportUpdate)
    .eq('id', id)
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // 감사 로그
  void auditLog(supabase, {
    user_id:       user.id,
    user_email:    user.email ?? null,
    action:        action === 'submit' ? 'report_submit' : action === 'approve' ? 'report_approve' : 'report_reject',
    resource_type: 'report',
    resource_id:   id,
    metadata:      { note: note ?? null },
  })

  return NextResponse.json({ success: true, status: newStatus })
}
