import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/notifications — 내 알림 목록 (최근 30개)
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const supabaseAny = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAny
    .from('notifications')
    .select('id, type, title, body, link_path, is_read, related_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const unread = (data ?? []).filter((n: any) => !n.is_read).length
  return NextResponse.json({ notifications: data ?? [], unread })
}

// PATCH /api/notifications — 읽음 처리 (body: { id? } — 없으면 전체)
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const supabaseAny = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { id } = body as { id?: string }

  let q = supabaseAny
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)

  if (id) q = q.eq('id', id)
  else q = q.eq('is_read', false)

  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
