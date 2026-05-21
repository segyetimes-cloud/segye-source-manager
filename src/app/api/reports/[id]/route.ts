import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { can, CAN_VIEW_ALL_REPORTS } from '@/lib/permissions'
import { isDesk } from '@/lib/roles'
import type { Database } from '@/types/database'

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
    visibility: string; status: string;
    [key: string]: unknown
  }

  const isAuthor = report.author_id === user.id
  const canViewAll = can(profile?.role, CAN_VIEW_ALL_REPORTS)
  const vis = report.visibility as string

  // 열람 권한 체크
  if (!isAuthor && !canViewAll) {
    if (vis === 'author_only') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (vis === 'desk_above') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (vis === 'team' && profile?.department !== report.author_department) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    // 기자: 승인된 보고서만 열람
    if (report.status !== 'approved' && vis !== 'all') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
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
  const { title, content, tags, visibility, category } = body

  const VALID_CATEGORIES = ['일반','단독','공동취재','인터뷰','배경설명','분석','기타']

  const updateData: ReportUpdate = {}
  if (title?.trim())   updateData.title      = title.trim()
  if (content?.trim()) updateData.content    = content.trim()
  if (tags)            updateData.tags       = tags
  if (visibility)      updateData.visibility = visibility
  if (category)        updateData.category   = VALID_CATEGORIES.includes(category) ? category : '일반'

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: '수정할 내용이 없습니다.' }, { status: 400 })
  }

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
    } as any)
  }

  void supabase.from('audit_logs').insert({
    user_id:       user.id,
    user_email:    user.email ?? null,
    action:        'report_update' as any,
    resource_type: 'report',
    resource_id:   id,
    metadata:      { fields: Object.keys(updateData) },
  } as any)

  return NextResponse.json({ report: updated })
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

  void supabase.from('audit_logs').insert({
    user_id:       user.id,
    user_email:    user.email ?? null,
    action:        'report_delete' as any,
    resource_type: 'report',
    resource_id:   id,
    metadata:      {},
  } as any)

  return NextResponse.json({ success: true })
}
