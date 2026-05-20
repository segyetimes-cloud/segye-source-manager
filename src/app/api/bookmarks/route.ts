// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/bookmarks — 내 즐겨찾기 목록
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('source_bookmarks')
    .select(`
      id, created_at, source_id,
      sources!source_id(id, full_name, current_organization, current_position, completeness_score, sensitivity, visibility, is_deleted)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const filtered = (data ?? []).filter((b: any) => b.sources && !b.sources.is_deleted)
  return NextResponse.json(filtered)
}

// POST /api/bookmarks — 즐겨찾기 추가
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { source_id } = await request.json()
  if (!source_id) return NextResponse.json({ error: 'source_id 필요' }, { status: 400 })

  const { data, error } = await supabase
    .from('source_bookmarks')
    .insert({ user_id: user.id, source_id })
    .select('id, source_id, created_at')
    .single()

  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: '이미 즐겨찾기에 추가됨' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

// DELETE /api/bookmarks?source_id=xxx — 즐겨찾기 제거
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const source_id = request.nextUrl.searchParams.get('source_id')
  if (!source_id) return NextResponse.json({ error: 'source_id 필요' }, { status: 400 })

  const { error } = await supabase
    .from('source_bookmarks')
    .delete()
    .eq('user_id', user.id)
    .eq('source_id', source_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
