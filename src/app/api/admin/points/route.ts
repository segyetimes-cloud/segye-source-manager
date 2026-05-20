// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/admin/points — 관리자가 특정 유저에게 포인트 지급
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // admin 이상만 허용
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'section_editor', 'editor', 'publisher', 'superadmin'].includes(profile?.role ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { user_id, points, reason, related_request_id } = body

  if (!user_id || !points || !reason) {
    return NextResponse.json({ error: 'user_id, points, reason 필수' }, { status: 400 })
  }

  const pts = Math.min(Math.max(Number(points), 1), 500)

  const serviceClient = createServiceClient()
  const { error } = await serviceClient.from('point_transactions').insert({
    user_id,
    point_type: 'help_accepted',
    points: pts,
    related_request_id: related_request_id ?? null,
    related_user_id: user.id,
    description: `관리자 지급: ${reason}`,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, points: pts })
}
