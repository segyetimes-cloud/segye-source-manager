import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sourceId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profileRaw } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const role = (profileRaw as { role: string } | null)?.role ?? 'reporter'

  // 부장 이상은 이미 열람 가능 — 신청 불필요
  const adminRoles = ['admin', 'section_editor', 'editor', 'publisher', 'superadmin']
  if (adminRoles.includes(role)) {
    return NextResponse.json({ error: '이미 열람 권한이 있습니다.' }, { status: 400 })
  }

  // 취재원 존재 및 sensitivity 확인
  const { data: source } = await supabase
    .from('sources')
    .select('id, sensitivity, visibility, owner_id')
    .eq('id', sourceId)
    .eq('is_deleted', false)
    .single()

  if (!source) return NextResponse.json({ error: '취재원을 찾을 수 없습니다.' }, { status: 404 })
  if (source.owner_id === user.id) {
    return NextResponse.json({ error: '소유자는 직접 열람 가능합니다.' }, { status: 400 })
  }
  if (source.sensitivity !== 'private') {
    return NextResponse.json({ error: '이 취재원은 열람 승인이 필요하지 않습니다.' }, { status: 400 })
  }

  // 중복 신청 방지
  const { data: existing } = await supabase
    .from('source_access_approvals')
    .select('id, status')
    .eq('source_id', sourceId)
    .eq('requester_id', user.id)
    .in('status', ['pending', 'approved'])
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: '이미 신청하였거나 승인된 요청이 있습니다.' }, { status: 409 })
  }

  const body = await request.json().catch(() => ({}))
  const reason = (body.reason ?? '').toString().trim()
  if (!reason) return NextResponse.json({ error: '신청 사유를 입력해 주세요.' }, { status: 400 })
  if (reason.length > 500) return NextResponse.json({ error: '신청 사유는 500자 이내로 입력해 주세요.' }, { status: 400 })

  const { error } = await supabase.from('source_access_approvals').insert({
    source_id:    sourceId,
    requester_id: user.id,
    reason,
    status:       'pending',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true }, { status: 201 })
}
