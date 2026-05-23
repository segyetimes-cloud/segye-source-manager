import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { can, CAN_DELETE_SOURCE } from '@/lib/permissions'

interface Params {
  params: Promise<{ id: string }>
}

// POST /api/sources/:id/deletion-request
// 기자·차장이 취재원 삭제를 부장에게 요청 — 부장+ 전원에게 알림 발송
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 요청자 프로필 조회
  const { data: requester } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (!requester) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 부장+는 직접 삭제 가능 — 이 엔드포인트 사용 불필요
  if (can(requester.role, CAN_DELETE_SOURCE)) {
    return NextResponse.json({ error: '부장 이상은 직접 삭제 버튼을 이용하세요.' }, { status: 400 })
  }

  // 삭제 대상 취재원 조회
  const { data: source } = await supabase
    .from('sources')
    .select('full_name, current_organization')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()

  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 부장+ 전원 조회 — 알림 수신 대상
  const { data: admins } = await supabase
    .from('profiles')
    .select('id')
    .in('role', ['admin', 'section_editor', 'editor', 'publisher', 'superadmin'])
    .eq('is_active', true)

  if (!admins || admins.length === 0) {
    return NextResponse.json({ error: '알림을 받을 관리자가 없습니다.' }, { status: 500 })
  }

  const requesterName = requester.full_name ?? user.email ?? '알 수 없음'
  const sourceLabel   = source.current_organization
    ? `${source.full_name} (${source.current_organization})`
    : source.full_name

  // 부장+ 전원에게 알림 삽입
  const notifications = admins.map(admin => ({
    user_id:   admin.id,
    type:      'deletion_request',
    title:     '취재원 삭제 요청',
    body:      `${requesterName}이(가) "${sourceLabel}" 취재원 삭제를 요청했습니다.`,
    link_path: `/sources/${id}`,
    related_id: id,
    is_read:   false,
  }))

  const { error } = await supabase.from('notifications').insert(notifications)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
