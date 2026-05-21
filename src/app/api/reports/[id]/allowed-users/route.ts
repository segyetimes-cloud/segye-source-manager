import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDesk } from '@/lib/roles'

/**
 * GET    /api/reports/[id]/allowed-users — 지정 열람자 목록 조회
 * POST   /api/reports/[id]/allowed-users — 열람자 추가
 * DELETE /api/reports/[id]/allowed-users — 열람자 제거 (body: { user_id })
 */

async function getReportAndCheck(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>, reportId: string, userId: string) {
  const { data: reportRaw } = await supabase
    .from('information_reports')
    .select('id, author_id, visibility')
    .eq('id', reportId)
    .eq('is_deleted', false)
    .single()
  return reportRaw as { id: string; author_id: string; visibility: string } | null
}

// GET — 지정 열람자 목록
export async function GET(
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

  const report = await getReportAndCheck(supabase, id, user.id)
  if (!report) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })

  const isAuthor = report.author_id === user.id
  if (!isAuthor && !isDesk(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: allowedRaw, error } = await supabase
    .from('report_allowed_users')
    .select('user_id, granted_by, created_at, profiles!user_id(full_name, department)')
    .eq('report_id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ allowed: allowedRaw ?? [] })
}

// POST — 열람자 추가
export async function POST(
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

  const report = await getReportAndCheck(supabase, id, user.id)
  if (!report) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })

  const isAuthor = report.author_id === user.id
  if (!isAuthor && !isDesk(profile?.role)) {
    return NextResponse.json({ error: '열람자 관리 권한이 없습니다.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { user_id } = body as { user_id?: string }
  if (!user_id?.trim()) return NextResponse.json({ error: 'user_id가 필요합니다.' }, { status: 400 })

  const { error } = await supabase.from('report_allowed_users').insert({
    report_id:  id,
    user_id:    user_id.trim(),
    granted_by: user.id,
  } as any)

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: '이미 등록된 열람자입니다.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

// DELETE — 열람자 제거
export async function DELETE(
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

  const report = await getReportAndCheck(supabase, id, user.id)
  if (!report) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })

  const isAuthor = report.author_id === user.id
  if (!isAuthor && !isDesk(profile?.role)) {
    return NextResponse.json({ error: '열람자 관리 권한이 없습니다.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const { user_id } = body as { user_id?: string }
  if (!user_id?.trim()) return NextResponse.json({ error: 'user_id가 필요합니다.' }, { status: 400 })

  const { error } = await supabase
    .from('report_allowed_users')
    .delete()
    .eq('report_id', id)
    .eq('user_id', user_id.trim())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
