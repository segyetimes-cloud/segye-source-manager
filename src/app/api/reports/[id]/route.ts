// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/reports/[id] — 단건 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const supabaseAny = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAny
    .from('information_reports')
    .select(`
      *,
      profiles!author_id(full_name, department),
      report_sources(source_id, sources!source_id(id, full_name, current_organization))
    `)
    .eq('id', id)
    .eq('is_deleted', false)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(data)
}

// PUT /api/reports/[id] — 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const supabaseAny = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 작성자 확인
  const { data: existing } = await supabaseAny
    .from('information_reports')
    .select('author_id')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.author_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { title, content, tags, visibility, source_ids } = body

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

  // 취재원 연결 갱신 — 기존 삭제 후 재삽입
  if (Array.isArray(source_ids)) {
    await supabaseAny.from('report_sources').delete().eq('report_id', id)
    if (source_ids.length > 0) {
      const rows = source_ids.map((sid: string) => ({ report_id: id, source_id: sid }))
      await supabaseAny.from('report_sources').insert(rows)
    }
  }

  return NextResponse.json(report)
}

// DELETE /api/reports/[id] — 소프트 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const supabaseAny = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existing } = await supabaseAny
    .from('information_reports')
    .select('author_id')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (existing.author_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabaseAny
    .from('information_reports')
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
