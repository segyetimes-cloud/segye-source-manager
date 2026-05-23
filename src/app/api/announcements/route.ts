import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/announcements — 전체 목록 (고정 우선, 최신순)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, body, is_pinned, created_at, profiles(full_name)')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ announcements: data })
}

// POST /api/announcements — 작성 (superadmin only)
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'superadmin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { title, body: bodyText, is_pinned } = body
  if (!title?.trim()) return NextResponse.json({ error: '제목을 입력해 주세요' }, { status: 400 })

  const { data, error } = await supabase.from('announcements').insert({
    title: title.trim(),
    body: bodyText?.trim() || null,
    is_pinned: !!is_pinned,
    created_by: user.id,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
