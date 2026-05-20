// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// ── 역할 분류 헬퍼 ────────────────────────────────────────────────────────────
// 전 부서 승인 가능: superadmin, publisher(편집인), editor(국장), section_editor(부국장)
const CROSS_DEPT_ROLES = ['superadmin', 'publisher', 'editor', 'section_editor'] as const
// 소속 부서만 승인 가능: admin(부장)
const DEPT_ADMIN_ROLES = ['admin'] as const

function canApproveAnyDept(role: string) {
  return (CROSS_DEPT_ROLES as readonly string[]).includes(role)
}
function canApproveSameDept(role: string) {
  return (DEPT_ADMIN_ROLES as readonly string[]).includes(role)
}
function hasAnyApprovalRight(role: string) {
  return canApproveAnyDept(role) || canApproveSameDept(role)
}

// GET /api/approvals — 승인권자: 관할 승인 목록 / 일반 기자: 내 요청 목록
export async function GET(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, department')
    .eq('id', user.id)
    .single()

  const role = (profile as any)?.role ?? 'reporter'
  const myDept = (profile as any)?.department ?? null
  const approver = hasAnyApprovalRight(role)

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status') // pending | approved | rejected | all

  let query = supabase
    .from('source_access_approvals')
    .select(`
      id, source_id, requester_id, approver_id, reason, status,
      requested_at, decided_at, expires_at, reject_reason,
      sources!source_id(full_name, current_organization),
      profiles!requester_id(full_name, department)
    `)
    .order('requested_at', { ascending: false })

  if (!approver) {
    // 일반 기자(차장 포함)는 본인 요청만
    query = query.eq('requester_id', user.id)
  } else if (canApproveSameDept(role) && myDept) {
    // 부장: 자기 부서 신청만 조회
    // profiles 조인 필터는 PostgREST에서 직접 지원되지 않으므로
    // requester_ids 먼저 조회 후 in() 필터
    const { data: deptUsers } = await supabase
      .from('profiles')
      .select('id')
      .eq('department', myDept)
    const deptUserIds = (deptUsers ?? []).map((u: any) => u.id as string)
    if (deptUserIds.length > 0) {
      query = query.in('requester_id', deptUserIds)
    } else {
      // 소속 부서 기자 없음 → 빈 결과
      return NextResponse.json([])
    }
  }
  // cross-dept roles: 필터 없이 전체 조회

  if (status && status !== 'all') {
    query = query.eq('status', status)
  } else if (!status) {
    query = query.eq('status', 'pending')
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/approvals — 열람 신청
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { source_id, reason } = body

  if (!source_id || !reason?.trim()) {
    return NextResponse.json({ error: '취재원 ID와 신청 사유가 필요합니다' }, { status: 400 })
  }

  // 이미 pending/approved 요청이 있는지 확인
  const { data: existing } = await supabase
    .from('source_access_approvals')
    .select('id, status, expires_at')
    .eq('source_id', source_id)
    .eq('requester_id', user.id)
    .in('status', ['pending', 'approved'])
    .single()

  if (existing) {
    if (existing.status === 'approved') {
      const expired = existing.expires_at && new Date(existing.expires_at) < new Date()
      if (!expired) {
        return NextResponse.json({ error: '이미 승인된 열람 권한이 있습니다' }, { status: 409 })
      }
    } else {
      return NextResponse.json({ error: '이미 대기 중인 신청이 있습니다' }, { status: 409 })
    }
  }

  const { data: newApproval, error } = await supabase
    .from('source_access_approvals')
    .insert({
      source_id,
      requester_id: user.id,
      reason: reason.trim(),
      status: 'pending',
      approver_id: null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 감사 로그
  await supabase.from('audit_logs').insert({
    user_id: user.id,
    user_email: user.email,
    action: 'view_private',
    resource_type: 'source_access_approvals',
    resource_id: newApproval.id,
    ip_address: request.headers.get('x-forwarded-for') ?? null,
    is_vpn_access: false,
    metadata: { source_id, reason },
  })

  return NextResponse.json(newApproval, { status: 201 })
}

// PATCH /api/approvals/[id] — 관리자: 승인 / 거절
// 이 엔드포인트는 /api/approvals/[id]/route.ts 에서 처리하거나 여기서 query param으로 처리
// 여기서는 body에 { approval_id, action: 'approve' | 'reject', reject_reason? } 방식 사용
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, department')
    .eq('id', user.id)
    .single()

  const role = (profile as any)?.role ?? 'reporter'
  const myDept = (profile as any)?.department ?? null

  if (!hasAnyApprovalRight(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { approval_id, action, reject_reason } = body

  if (!approval_id || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'approval_id와 action(approve|reject)이 필요합니다' }, { status: 400 })
  }

  // 부장(admin): 요청자가 같은 부서인지 확인
  if (canApproveSameDept(role)) {
    const { data: approval } = await supabase
      .from('source_access_approvals')
      .select('requester_id, profiles!requester_id(department)')
      .eq('id', approval_id)
      .single()
    const requesterDept = (approval as any)?.profiles?.department ?? null
    if (!myDept || requesterDept !== myDept) {
      return NextResponse.json(
        { error: '부장은 소속 부서 기자의 신청만 승인·거절할 수 있습니다.' },
        { status: 403 }
      )
    }
  }

  const now = new Date().toISOString()
  // 승인 시 30일 유효기간 부여
  const expiresAt = action === 'approve'
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : null

  const { data: updated, error } = await supabase
    .from('source_access_approvals')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      approver_id: user.id,
      decided_at: now,
      expires_at: expiresAt,
      reject_reason: reject_reason ?? null,
    })
    .eq('id', approval_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 감사 로그
  await supabase.from('audit_logs').insert({
    user_id: user.id,
    user_email: user.email,
    user_role: profile.role,
    action: action === 'approve' ? 'approve' : 'reject',
    resource_type: 'source_access_approvals',
    resource_id: approval_id,
    ip_address: request.headers.get('x-forwarded-for') ?? null,
    is_vpn_access: false,
    metadata: { action, reject_reason },
  })

  // 신청자에게 알림 발송 (service role 사용)
  const serviceClient = createServiceClient() as any
  const sourceName = (updated as any).sources?.full_name ?? '취재원'
  await serviceClient.from('notifications').insert({
    user_id: updated.requester_id,
    type: 'approval_result',
    title: action === 'approve'
      ? `🔓 "${sourceName}" 열람이 승인되었습니다`
      : `❌ "${sourceName}" 열람 신청이 거절되었습니다`,
    body: action === 'reject' && reject_reason ? `사유: ${reject_reason}` : null,
    link_path: action === 'approve' ? `/sources/${updated.source_id}` : null,
    related_id: approval_id,
  })

  // 승인된 경우 포인트 지급
  if (action === 'approve') {
    await serviceClient.from('point_transactions').insert({
      user_id: updated.requester_id,
      point_type: 'contribution_used',
      points: 0,
      related_source_id: updated.source_id,
      description: '민감정보 열람 승인',
    })
  }

  return NextResponse.json(updated)
}
