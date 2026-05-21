// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/reports/draft — 내 드래프트 불러오기
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('report_drafts')
    .select('id, title, content, category, tags, visibility, source_ids, allowed_user_ids, updated_at')
    .eq('author_id', user.id)
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ draft: data ?? null })
}

// PUT /api/reports/draft — 드래프트 저장 (upsert)
export async function PUT(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { title, content, category, tags, visibility, source_ids, allowed_user_ids } = body

  const { data, error } = await supabase
    .from('report_drafts')
    .upsert(
      {
        author_id: user.id,
        title: title ?? '',
        content: content ?? '',
        category: category ?? '일반',
        tags: tags ?? [],
        visibility: visibility ?? 'author_only',
        source_ids: source_ids ?? [],
        allowed_user_ids: allowed_user_ids ?? [],
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'author_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ draft: data })
}

// DELETE /api/reports/draft — 드래프트 삭제
export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('report_drafts')
    .delete()
    .eq('author_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
