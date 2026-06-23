import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { can, CAN_VIEW_ALL_REPORTS } from '@/lib/permissions'
import { isDesk } from '@/lib/roles'
import type { Database } from '@/types/database'
import { auditLog } from '@/lib/audit'
import { extractAndStoreRelations } from '@/lib/extractReportRelations'

type ReportUpdate = Database['public']['Tables']['information_reports']['Update']

/**
 * GET    /api/reports/[id] — 보고서 단건 조회
 * PATCH  /api/reports/[id] — 보고서 수정 (작성자 or 데스크)
 * DELETE /api/reports/[id] — 보고서 삭제 (soft-delete, 작성자 or 데스크)
 */

// GET — 단건 조회
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profileRaw } = await supabase
    .from('profiles').select('role, department').eq('id', user.id).single()
  const profile = profileRaw as { role: string; department: string | null } | null

  const { data: reportRaw, error } = await supabase
    .from('information_reports')
    .select(`
      *,
      profiles!author_id(full_name, department),
      report_sources(source_id, sources!source_id(id, full_name, current_organization))
    `)
    .eq('id', id)
    .eq('is_deleted', false)
    .single()

  if (error || !reportRaw) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })

  const report = reportRaw as {
    id: string; author_id: string; author_department: string | null;
    visibility: string; status: string; sensitive_content: string | null;
    [key: string]: unknown
  }

  const isAuthor = report.author_id === user.id
  const canViewAll = can(profile?.role, CAN_VIEW_ALL_REPORTS)  // 부장+ (데스크)
  const isAboveAdmin = ['section_editor', 'editor', 'publisher', 'superadmin'].includes(profile?.role ?? '')
  const vis = report.visibility as string

  // 지정 열람자 확인 (허용된 경우 모든 visibility 허용)
  let isAllowedUser = false
  if (!isAuthor) {
    const { data: allowedRow } = await supabase
      .from('report_allowed_users')
      .select('id')
      .eq('report_id', id)
      .eq('user_id', user.id)
      .maybeSingle()
    isAllowedUser = !!allowedRow
  }

  // 열람 권한 체크
  if (!isAuthor && !isAllowedUser && !canViewAll) {
    if (vis === 'author_only') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (vis === 'desk_above') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (vis === 'my_desk') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (vis === 'team' && profile?.department !== report.author_department) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    // 기자: 승인된 보고서만 열람
    if (report.status !== 'approved' && vis !== 'all') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // my_desk: 부장은 소속 부서 작성자의 보고서만 열람 (부국장 이상은 모두 허용)
  if (vis === 'my_desk' && !isAuthor && !isAllowedUser && !isAboveAdmin) {
    const isSameDeptAdmin = profile?.role === 'admin' && profile?.department === report.author_department
    if (!isSameDeptAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  // 민감정보(sensitive_content)는 작성자 및 데스크(부장 이상)만 열람
  if (!isAuthor && !canViewAll) {
    report.sensitive_content = null
  }

  return NextResponse.json({ report: reportRaw })
}

// PATCH — 보고서 수정
export async function PATCH(
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

  const { data: reportRaw } = await supabase
    .from('information_reports')
    .select('id, author_id, status')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()
  const report = reportRaw as { id: string; author_id: string; status: string } | null
  if (!report) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })

  const isAuthor = report.author_id === user.id
  if (!isAuthor && !isDesk(profile?.role)) {
    return NextResponse.json({ error: '수정 권한이 없습니다.' }, { status: 403 })
  }

  const body = await request.json()
  const { title, content, sensitive_content, tags, visibility, category, source_ids, allowed_user_ids, created_at } = body

  const VALID_CATEGORIES = ['일반','단독','공동취재','인터뷰','배경설명','분석','기타']

  // ── created_at 수정은 superadmin 전용 ───────────────────────────────────────
  if (created_at !== undefined) {
    if (profile?.role !== 'superadmin') {
      return NextResponse.json({ error: '작성 날짜 수정은 최고관리자만 가능합니다.' }, { status: 403 })
    }
    const parsed = new Date(created_at)
    if (isNaN(parsed.getTime())) {
      return NextResponse.json({ error: '날짜 형식이 올바르지 않습니다.' }, { status: 400 })
    }
  }

  const updateData: ReportUpdate = {}
  if (title?.trim())         updateData.title   = title.trim()
  // content는 undefined가 아닌 경우(= 명시적으로 전달된 경우)만 업데이트
  // 빈 문자열도 허용 (본문을 민감정보로 이동한 경우 content='' 가 올 수 있음)
  if (content !== undefined) updateData.content = content?.trim() ?? ''
  if (tags)                 updateData.tags       = tags
  if (visibility)           updateData.visibility = visibility
  if (category)             updateData.category   = VALID_CATEGORIES.includes(category) ? category : '일반'
  if (created_at !== undefined && profile?.role === 'superadmin') {
    (updateData as any).created_at = new Date(created_at).toISOString()
  }
  // sensitive_content: 명시적으로 전달될 때만 업데이트 (빈 문자열은 null로 정규화)
  if (sensitive_content !== undefined) {
    updateData.sensitive_content = sensitive_content?.trim() || null
  }

  // 본문 필드 변경이 없어도 source_ids / allowed_user_ids 만 바꾸는 경우는 허용
  const hasFieldUpdate = Object.keys(updateData).length > 0
  const hasRelationUpdate = Array.isArray(source_ids) || Array.isArray(allowed_user_ids)

  if (!hasFieldUpdate && !hasRelationUpdate) {
    return NextResponse.json({ error: '수정할 내용이 없습니다.' }, { status: 400 })
  }

  if (hasFieldUpdate) {
    // TODO(Task #9): Remove cast when supabase gen types adds proper Relationships
    const { data: updated, error: updateErr } = await (supabase as any)
      .from('information_reports')
      .update(updateData as ReportUpdate)
      .eq('id', id)
      .select()
      .single()

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

    // 수정이력 기록 (content 변경 시만)
    if (content?.trim()) {
      await supabase.from('report_revisions').insert({
        report_id: id,
        author_id: user.id,
        content:   content.trim(),
      })
    }

    void auditLog(supabase, {
      user_id:       user.id,
      user_email:    user.email ?? null,
      action:        'report_update',
      resource_type: 'report',
      resource_id:   id,
      metadata:      { fields: Object.keys(updateData) },
    })

    // 본문 변경 시 응답 후 백그라운드 재추출
    if (content?.trim()) {
      const _id = id
      const _title = updated.title
      const _content = updated.content
      const _sensitive = updated.sensitive_content ?? null
      after(async () => {
        const bgSupabase = await createClient()
        await extractAndStoreRelations(bgSupabase, _id, _title, _content, _sensitive)
      })
    }

    // source_ids / allowed_user_ids 관계 업데이트가 없으면 바로 반환
    if (!hasRelationUpdate) return NextResponse.json({ report: updated })
  }

  // ── 취재원 연결 업데이트 ──────────────────────────────────────────────────────
  if (Array.isArray(source_ids)) {
    await supabase.from('report_sources').delete().eq('report_id', id)
    if ((source_ids as string[]).length > 0) {
      const { error: srcErr } = await supabase.from('report_sources').insert(
        (source_ids as string[]).map(sid => ({ report_id: id, source_id: sid }))
      )
      if (srcErr) return NextResponse.json({ error: srcErr.message }, { status: 500 })
    }
  }

  // ── 지정 열람자 업데이트 ──────────────────────────────────────────────────────
  if (Array.isArray(allowed_user_ids)) {
    await supabase.from('report_allowed_users').delete().eq('report_id', id)
    if ((allowed_user_ids as string[]).length > 0) {
      const { error: auErr } = await supabase.from('report_allowed_users').insert(
        (allowed_user_ids as string[]).map(uid => ({
          report_id:  id,
          user_id:    uid,
          granted_by: user.id,
        }))
      )
      if (auErr) return NextResponse.json({ error: auErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}

// DELETE — soft-delete
export async function DELETE(
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

  const { data: reportRaw } = await supabase
    .from('information_reports')
    .select('id, author_id')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()
  const report = reportRaw as { id: string; author_id: string } | null
  if (!report) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })

  const isAuthor = report.author_id === user.id
  if (!isAuthor && !isDesk(profile?.role)) {
    return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 })
  }

  // TODO(Task #9): Remove cast when supabase gen types adds proper Relationships
  const { error: delErr } = await (supabase as any)
    .from('information_reports')
    .update({ is_deleted: true } as ReportUpdate)
    .eq('id', id)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  void auditLog(supabase, {
    user_id:       user.id,
    user_email:    user.email ?? null,
    action:        'report_delete',
    resource_type: 'report',
    resource_id:   id,
    metadata:      {},
  })

  return NextResponse.json({ success: true })
}
