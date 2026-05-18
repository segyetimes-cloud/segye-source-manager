// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// 필드별 포인트 계산 (신규 기준)
function calcFieldPoints(source: Record<string, unknown>): number {
  let pts = 0
  if (source.full_name) pts += 1
  if (source.phone_primary) pts += 1
  if (source.high_school) pts += 1
  if (source.university) pts += 1
  if (source.current_organization) pts += 1
  if (source.current_position) pts += 1
  if (source.email_primary) pts += 0.5
  if (source.birthday) pts += 0.5
  if (source.hometown_city || source.hometown_province) pts += 0.5
  if (source.university_major) pts += 0.5
  if (source.graduate_school) pts += 0.5
  if (Array.isArray(source.tags) && source.tags.length > 0) pts += 0.5
  return pts
}

// GET /api/sources — 목록 조회
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 요청자 역할 조회 — 공유+민감 열람 권한 판별에 사용
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const callerRole = (callerProfile as any)?.role ?? 'reporter'
  // 데스크(admin) / 슈퍼관리자(superadmin)만 공유+민감 열람 가능
  const canSeeSensitive = ['admin', 'superadmin'].includes(callerRole)

  const sp = request.nextUrl.searchParams
  const tab = sp.get('tab') ?? 'personal'
  const q = sp.get('q') ?? ''
  const page = parseInt(sp.get('page') ?? '1')
  const pageSize = parseInt(sp.get('limit') ?? '20')

  let query = supabase
    .from('sources')
    .select('id, full_name, current_organization, current_position, phone_primary, email_primary, visibility, sensitivity, completeness_score, tags, exam_batch, updated_at, owner_id', { count: 'exact' })
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (tab === 'personal') {
    query = query.eq('owner_id', user.id)
  } else {
    query = query.eq('visibility', 'shared')
    // 기자·차장은 공유+민감 소스 제외
    if (!canSeeSensitive) {
      query = query.neq('sensitivity', 'private')
    }
  }

  if (q) {
    query = query.or(
      `full_name.ilike.%${q}%,current_organization.ilike.%${q}%,current_position.ilike.%${q}%,exam_batch.ilike.%${q}%,university.ilike.%${q}%,high_school.ilike.%${q}%`
    )
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 감사 로그
  await supabase.from('audit_logs').insert({
    user_id: user.id,
    user_email: user.email,
    action: 'view',
    resource_type: 'source_list',
    metadata: { tab, query: q, page },
  })

  return NextResponse.json({ sources: data, total: count })
}

// POST /api/sources — 새 취재원 등록
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const serviceClient = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 계정 활성 여부 확인
  const { data: profile } = await supabase.from('profiles').select('is_active, full_name').eq('id', user.id).single()
  if (!profile?.is_active) return NextResponse.json({ error: 'Inactive account' }, { status: 403 })

  const body = await request.json()

  const { data: source, error } = await supabase.from('sources').insert({
    owner_id: user.id,
    full_name: body.full_name,
    current_organization: body.current_organization || null,
    current_position: body.current_position || null,
    current_department: body.current_department || null,
    phone_primary: body.phone_primary || null,
    phone_secondary: body.phone_secondary || null,
    email_primary: body.email_primary || null,
    email_secondary: body.email_secondary || null,
    birthday: body.birthday || null,
    hometown_province: body.hometown_province || null,
    hometown_city: body.hometown_city || null,
    high_school: body.high_school || null,
    university: body.university || null,
    university_major: body.university_major || null,
    graduate_school: body.graduate_school || null,
    exam_batch: body.exam_batch || null,
    tags: body.tags ?? [],
    visibility: body.visibility ?? 'personal',
    sensitivity: body.sensitivity ?? 'public',
    personal_notes: body.personal_notes || null,
    sns_links: body.sns_links ?? {},
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 첫 직책 등록 (현재 소속/직책이 있으면)
  if (body.current_organization && body.current_position) {
    await supabase.from('source_positions').insert({
      source_id: source.id,
      organization: body.current_organization,
      department: body.current_department || null,
      position: body.current_position,
      started_at: new Date().toISOString().split('T')[0],
      is_current: true,
      change_source: 'manual',
      created_by: user.id,
    })
  }

  // 포인트 부여 (Service Role 사용 — 클라이언트 직접 INSERT 방지)
  const points = calcFieldPoints(source as Record<string, unknown>)
  if (points > 0) {
    await serviceClient.from('point_transactions').insert({
      user_id: user.id,
      point_type: 'source_created',
      points,
      related_source_id: source.id,
      description: `취재원 등록: ${source.full_name} (+${points}pt)`,
    })
  }

  // 감사 로그
  await supabase.from('audit_logs').insert({
    user_id: user.id,
    user_email: user.email,
    action: 'create',
    resource_type: 'source',
    resource_id: source.id,
    metadata: { full_name: source.full_name, points_awarded: points ?? 0 },
  })

  return NextResponse.json({ ...source, points_awarded: points }, { status: 201 })
}
