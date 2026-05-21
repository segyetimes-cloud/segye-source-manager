// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/sources/[id]/copy-log
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { copied_length, copied_preview } = body

  await supabase.from('source_copy_logs').insert({
    source_id: id,
    user_id: user.id,
    copied_length: copied_length ?? 0,
    copied_preview: (copied_preview ?? '').slice(0, 100),
    user_agent: request.headers.get('user-agent') ?? null,
  })

  return NextResponse.json({ ok: true })
}

// GET /api/sources/[id]/copy-log — 데스크용 복사 이력 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ logs: [] }, { status: 401 })

  const { data: myProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'section_editor', 'editor', 'publisher', 'superadmin'].includes(myProfile?.role ?? '')) {
    return NextResponse.json({ logs: [] }, { status: 403 })
  }

  const { data: logs } = await supabase
    .from('source_copy_logs')
    .select('id, user_id, copied_length, copied_preview, user_agent, created_at, profiles!user_id(full_name, department)')
    .eq('source_id', id)
    .order('created_at', { ascending: false })
    .limit(50)

  return NextResponse.json({ logs: logs ?? [] })
}
