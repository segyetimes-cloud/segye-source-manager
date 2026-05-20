// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// GET /api/reports/[id] — 단건 + 수정이력 포함
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const supabaseAny = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data, error }, { data: revisions }] = await Promise.all([
    supabaseAny
      .from('information_reports')
      .select(`
        *,
        profiles!author_id(full_name, department),
        report_sources(source_id, sources!source_id(id, full_name, current_organization))
      `)
      .eq('id', id)
      .eq('is_deleted', false)
      .single(),
    supabaseAny
      .from('report_revisions')
      .select('id, author_id, content, created_at, profiles!author_id(full_name, department)')
      .eq('report_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 열람 권한 체크
  const { data: viewer } = await supabaseAny
    .from('profiles').select('role, department').eq('id', user.id).single()
  const viewerIsDesk = ['admin', 'section_editor', 'editor', 'publisher', 'superadmin'].includes(viewer?.role ?? '')
  const isAuthor = data.author_id === user.id
  if (!viewerIsDesk && !isAuthor) {
    if (data.visibility === 'author_only') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (data.visibility === 'desk_above') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (data.visibility === 'team' && viewer?.department !== data.author_department) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  return NextResponse.json({ ...data, revisions: revisions ?? [] })
}

// PUT /api/reports/[id] — 수정 (작성자 or admin/superadmin 허용) + 수정이력 추가
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const supabaseAny = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 현재 사용자 role 확인
  const { data: myProfile } = await supabaseAny
    .from('profiles')
    .select('role, department')
    .eq('id', user.id)
    .single()
  const isDesk = ['admin', 'section_editor', 'editor', 'publisher', 'superadmin'].includes(myProfile?.role ?? '')

  // 기존 보고서 조회
  const { data: existing } = await supabaseAny
    .from('information_reports')
    .select('author_id, content')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.author_id !== user.id && !isDesk) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { title, content, tags, visibility, source_ids, allowed_user_ids } = body

  const { data: report, error } = await supabaseAny
    .from('information_reports')
    .update({
      title: title?.trim(),
      content: content?.trim(),
      tags: tags ?? [],
      visibility,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 내용이 바뀐 경우에만 수정이력 추가
  const newContent = content?.trim() ?? ''
  if (newContent && newContent !== (existing.content ?? '').trim()) {
    await supabaseAny.from('report_revisions').insert({
      report_id: id,
      author_id: user.id,
      content: newContent,
    })
  }

  // 취재원 연결 갱신
  if (Array.isArray(source_ids)) {
    await supabaseAny.from('report_sources').delete().eq('report_id', id)
    if (source_ids.length > 0) {
      const rows = source_ids.map((sid: string) => ({ report_id: id, source_id: sid }))
      await supabaseAny.from('report_sources').insert(rows)
    }
  }

  // 지정 열람자 갱신 (전체 교체)
  if (Array.isArray(allowed_user_ids)) {
    await supabaseAny.from('report_allowed_users').delete().eq('report_id', id)
    if (allowed_user_ids.length > 0) {
      const rows = allowed_user_ids.map((uid: string) => ({
        report_id: id, user_id: uid, granted_by: user.id,
      }))
      await supabaseAny.from('report_allowed_users').insert(rows)
    }
  }

  return NextResponse.json(report)
}

// DELETE /api/reports/[id] — 소프트 삭제 (작성자 or admin/superadmin)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const supabaseAny = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: myProfile } = await supabaseAny
    .from('profiles').select('role').eq('id', user.id).single()
  const isDesk = ['admin', 'section_editor', 'editor', 'publisher', 'superadmin'].includes(myProfile?.role ?? '')

  const { data: existing } = await supabaseAny
    .from('information_reports')
    .select('author_id')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.author_id !== user.id && !isDesk) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabaseAny
    .from('information_reports')
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
