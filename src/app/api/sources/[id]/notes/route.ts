// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface Params { params: Promise<{ id: string }> }

// GET /api/sources/[id]/notes
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const supabaseAny = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 역할 확인 — 차장 이상은 모든 민감 노트 열람 가능
  const { data: profile } = await supabaseAny
    .from('profiles').select('role').eq('id', user.id).single()
  const isDeputyOrAbove = ['deputy', 'admin', 'section_editor', 'editor', 'publisher', 'superadmin']
    .includes(profile?.role ?? '')

  let query = supabaseAny
    .from('source_notes')
    .select('id, content, is_sensitive, created_at, profiles!author_id(id, full_name, department)')
    .eq('source_id', id)
    .order('created_at', { ascending: true })

  // 차장 미만: 공개 노트 + 자신이 직접 작성한 민감 노트만 반환
  if (!isDeputyOrAbove) {
    query = query.or(`is_sensitive.eq.false,author_id.eq.${user.id}`)
  }

  const { data } = await query
  return NextResponse.json(data ?? [])
}

// POST /api/sources/[id]/notes — 정보 추가 (+10pt)
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const supabaseAny = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { content, is_sensitive = false } = body

  if (!content?.trim()) {
    return NextResponse.json({ error: '내용을 입력해주세요' }, { status: 400 })
  }

  // 취재원 존재 확인
  const { data: source } = await supabaseAny
    .from('sources').select('id').eq('id', id).eq('is_deleted', false).single()
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: note, error } = await supabaseAny
    .from('source_notes')
    .insert({
      source_id: id,
      author_id: user.id,
      content: content.trim(),
      is_sensitive,
    })
    .select('id, content, is_sensitive, created_at, profiles!author_id(id, full_name, department)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 정보 추가 포인트 +10pt
  const serviceClient = createServiceClient()
  await serviceClient.from('point_transactions').insert({
    user_id: user.id,
    point_type: 'note_created',
    points: 10,
    related_source_id: id,
    description: `정보 추가 (+10pt)`,
  })

  return NextResponse.json(note, { status: 201 })
}

// DELETE /api/sources/[id]/notes?note_id=xxx
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const supabaseAny = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const noteId = request.nextUrl.searchParams.get('note_id')
  if (!noteId) return NextResponse.json({ error: 'note_id required' }, { status: 400 })

  const { data: note } = await supabaseAny
    .from('source_notes').select('author_id').eq('id', noteId).eq('source_id', id).single()
  if (!note) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profile } = await supabaseAny.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = ['admin', 'section_editor', 'editor', 'publisher', 'superadmin'].includes(profile?.role ?? '')
  if (note.author_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await supabaseAny.from('source_notes').delete().eq('id', noteId)
  return NextResponse.json({ ok: true })
}
