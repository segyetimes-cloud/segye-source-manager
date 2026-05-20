// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/sources/[id]/positions — 직책 이력 목록
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sourceId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('source_positions')
    .select('*')
    .eq('source_id', sourceId)
    .order('is_current', { ascending: false })
    .order('started_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/sources/[id]/positions — 직책 추가
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sourceId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 소유자 또는 admin만 허용
  const [{ data: source }, { data: profile }] = await Promise.all([
    supabase.from('sources').select('owner_id').eq('id', sourceId).single(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ])

  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const isAdmin = ['admin', 'section_editor', 'editor', 'publisher', 'superadmin'].includes(profile?.role ?? '')
  if (source.owner_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { organization, department, position, rank, started_at, ended_at, is_current, change_note } = body

  if (!organization || !position || !started_at) {
    return NextResponse.json({ error: '필수 필드가 누락되었습니다 (조직, 직책, 시작일)' }, { status: 400 })
  }

  // is_current=true 추가 시 기존 현직 종료
  if (is_current) {
    await supabase
      .from('source_positions')
      .update({ is_current: false, ended_at: started_at })
      .eq('source_id', sourceId)
      .eq('is_current', true)

    // sources 테이블의 current_* 필드도 갱신
    await supabase
      .from('sources')
      .update({
        current_organization: organization,
        current_position: position,
        current_department: department ?? null,
      })
      .eq('id', sourceId)
  }

  const { data: newPos, error } = await supabase
    .from('source_positions')
    .insert({
      source_id: sourceId,
      organization,
      department: department ?? null,
      position,
      rank: rank ?? null,
      started_at,
      ended_at: ended_at ?? null,
      is_current: is_current ?? false,
      change_source: 'manual',
      change_note: change_note ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(newPos, { status: 201 })
}

// PATCH /api/sources/[id]/positions?posId=xxx — 직책 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sourceId } = await params
  const { searchParams } = new URL(request.url)
  const posId = searchParams.get('posId')
  if (!posId) return NextResponse.json({ error: 'posId required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: source }, { data: profile }] = await Promise.all([
    supabase.from('sources').select('owner_id').eq('id', sourceId).single(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ])

  const isAdmin = ['admin', 'section_editor', 'editor', 'publisher', 'superadmin'].includes(profile?.role ?? '')
  if (source?.owner_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { data, error } = await supabase
    .from('source_positions')
    .update(body)
    .eq('id', posId)
    .eq('source_id', sourceId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/sources/[id]/positions?posId=xxx
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sourceId } = await params
  const { searchParams } = new URL(request.url)
  const posId = searchParams.get('posId')
  if (!posId) return NextResponse.json({ error: 'posId required' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: source }, { data: profile }] = await Promise.all([
    supabase.from('sources').select('owner_id').eq('id', sourceId).single(),
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ])

  const isAdmin = ['admin', 'section_editor', 'editor', 'publisher', 'superadmin'].includes(profile?.role ?? '')
  if (source?.owner_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('source_positions')
    .delete()
    .eq('id', posId)
    .eq('source_id', sourceId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
