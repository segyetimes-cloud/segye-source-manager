import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { can, CAN_AWARD_POINTS } from '@/lib/permissions'

/**
 * GET  /api/reports/[id]/copy-log  — 복사 이력 조회 (데스크 이상만)
 * POST /api/reports/[id]/copy-log  — 복사 이벤트 기록 (ReportContentViewer에서 호출)
 */

// GET — 복사 이력 (부장 이상만 열람 가능)
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

  if (!can(profile?.role, CAN_AWARD_POINTS)) {
    return NextResponse.json({ error: '복사 이력 열람 권한이 없습니다.' }, { status: 403 })
  }

  const { data: logsRaw, error } = await supabase
    .from('report_copy_logs')
    .select('id, user_id, copied_length, copied_preview, created_at, profiles!user_id(full_name, department)')
    .eq('report_id', id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: logsRaw ?? [] })
}

// POST — 복사 이벤트 기록 (인증된 사용자 누구나 — 자신의 복사만)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { copied_length, copied_preview } = body as { copied_length?: number; copied_preview?: string }

  // 보고서 존재 확인
  const { data: reportRaw } = await supabase
    .from('information_reports')
    .select('id')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()
  if (!reportRaw) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })

  await supabase.from('report_copy_logs').insert({
    report_id:      id,
    user_id:        user.id,
    copied_length:  typeof copied_length === 'number' ? copied_length : 0,
    copied_preview: typeof copied_preview === 'string' ? copied_preview.slice(0, 100) : null,
  })

  return NextResponse.json({ success: true })
}
