// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/reports/[id]/allowed-users — 지정 열람자 목록
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const supabaseAny = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 작성자 또는 데스크만 조회
  const { data: report } = await supabaseAny
    .from('information_reports').select('author_id').eq('id', id).single()
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: myProfile } = await supabaseAny
    .from('profiles').select('role').eq('id', user.id).single()
  const isDesk = ['admin', 'superadmin'].includes(myProfile?.role ?? '')
  if (report.author_id !== user.id && !isDesk) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data } = await supabaseAny
    .from('report_allowed_users')
    .select('id, user_id, profiles!user_id(full_name, department, rank)')
    .eq('report_id', id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ allowed: data ?? [] })
}

// POST /api/reports/[id]/allowed-users — 열람자 추가
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const supabaseAny = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: report } = await supabaseAny
    .from('information_reports').select('author_id').eq('id', id).single()
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: myProfile } = await supabaseAny
    .from('profiles').select('role').eq('id', user.id).single()
  const isDesk = ['admin', 'superadmin'].includes(myProfile?.role ?? '')
  if (report.author_id !== user.id && !isDesk) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { user_ids } = body // string[]

  if (!Array.isArray(user_ids) || user_ids.length === 0) {
    return NextResponse.json({ error: 'user_ids required' }, { status: 400 })
  }

  const rows = user_ids.map((uid: string) => ({
    report_id: id,
    user_id: uid,
    granted_by: user.id,
  }))

  const { error } = await supabaseAny
    .from('report_allowed_users')
    .upsert(rows, { onConflict: 'report_id,user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE /api/reports/[id]/allowed-users?user_id=xxx — 열람자 제거
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const supabaseAny = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: report } = await supabaseAny
    .from('information_reports').select('author_id').eq('id', id).single()
  if (!report) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: myProfile } = await supabaseAny
    .from('profiles').select('role').eq('id', user.id).single()
  const isDesk = ['admin', 'superadmin'].includes(myProfile?.role ?? '')
  if (report.author_id !== user.id && !isDesk) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url = new URL(request.url)
  const targetUserId = url.searchParams.get('user_id')
  if (!targetUserId) return NextResponse.json({ error: 'user_id required' }, { status: 400 })

  const { error } = await supabaseAny
    .from('report_allowed_users')
    .delete()
    .eq('report_id', id)
    .eq('user_id', targetUserId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
