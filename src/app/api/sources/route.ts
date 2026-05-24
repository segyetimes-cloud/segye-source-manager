
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calcCompletenessScore, calcRegistrationPoints } from '@/lib/points'
import { can, CAN_VIEW_SENSITIVE_SOURCE } from '@/lib/permissions'
import { encryptNullable } from '@/lib/crypto'
import { parseBody, CreateSourceSchema } from '@/lib/schemas'
import { auditLog } from '@/lib/audit'

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
  const callerRole = callerProfile?.role ?? 'reporter'
  // 부장 이상(admin+) 공유+민감 열람 가능
  const canSeeSensitive = can(callerRole, CAN_VIEW_SENSITIVE_SOURCE)

  const sp = request.nextUrl.searchParams
  const filter = sp.get('filter') ?? 'all'   // 'all' | 'mine'
  const rawQ = sp.get('q') ?? ''
  const q = rawQ.slice(0, 100)  // 검색어 최대 100자 제한 (DoS·ReDoS 방어)
  const page = parseInt(sp.get('page') ?? '1')
  const pageSize = Math.min(Math.max(1, parseInt(sp.get('limit') ?? '20') || 20), 100)

  let query = supabase
    .from('sources')
    .select('id, full_name, current_organization, current_position, phone_primary, email_primary, visibility, sensitivity, completeness_score, tags, exam_batch, updated_at, owner_id', { count: 'exact' })
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })

  // ── 필터 먼저 적용 → 그 뒤에 페이지네이션 ────────────────────────────────
  if (filter === 'mine') {
    query = query.eq('owner_id', user.id)
  } else {
    query = query.or(`visibility.eq.shared,owner_id.eq.${user.id}`)
    if (!canSeeSensitive) {
      query = query.neq('sensitivity', 'private')
    }
  }

  if (q) {
    if (q.length >= 2) {
      // GIN 인덱스 전문 검색: search_vector (simple 사전, 한국어 공백 분리 토큰)
      query = (query as any).textSearch('search_vector', q, { type: 'plain', config: 'simple' })
    } else {
      // 1글자 검색은 ilike 유지 (tsvector는 단일 문자에 비효율)
      const escaped = q.replace(/[%_\\]/g, '\\$&')
      query = query.or(`full_name.ilike.%${escaped}%,current_organization.ilike.%${escaped}%`)
    }
  }

  // range는 모든 필터 이후 마지막에 적용
  query = query.range((page - 1) * pageSize, page * pageSize - 1)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 감사 로그 (fire-and-forget)
  void auditLog(supabase, {
    user_id:       user.id,
    user_email:    user.email ?? null,
    user_role:     callerRole,
    action:        'view',
    resource_type: 'source_list',
    ip_address:    request.headers.get('x-forwarded-for') ?? null,
    metadata:      { filter, query: q, page },
  })

  return NextResponse.json({ sources: data, total: count })
}

// POST /api/sources — 새 취재원 등록
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 계정 활성 여부 확인
  const { data: profile } = await supabase.from('profiles').select('is_active, full_name, role').eq('id', user.id).single()
  if (!profile?.is_active) return NextResponse.json({ error: 'Inactive account' }, { status: 403 })

  const parsed = await parseBody(request, CreateSourceSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  const { data: source, error } = await supabase.from('sources').insert({
    owner_id: user.id,
    full_name: body.full_name,
    current_organization: body.current_organization || null,
    current_position: body.current_position || null,
    current_department: body.current_department || null,
    phone_primary:   encryptNullable(body.phone_primary   || null),
    phone_secondary: encryptNullable(body.phone_secondary || null),
    email_primary: body.email_primary || null,
    email_secondary: body.email_secondary || null,
    birthday: body.birthday || null,
    hometown_province: body.hometown_province || null,
    hometown_city: body.hometown_city || null,
    high_school: body.high_school || null,
    university: body.university || null,
    university_major: body.university_major || null,
    graduate_school: body.graduate_school || null,
    exam_batch: body.exam_batch != null ? String(body.exam_batch) : null,
    tags: body.tags ?? [],
    visibility: 'shared',
    sensitivity: body.sensitivity ?? 'public',
    public_notes: body.public_notes || null,
    personal_notes: encryptNullable(body.personal_notes || null),
    on_record_status: body.on_record_status || null,
    sns_links: (body.sns_links ?? {}) as Record<string, string>,
    completeness_score: calcCompletenessScore(body),
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

  // 포인트 부여
  const points = calcRegistrationPoints(source as Record<string, unknown>)
  if (points > 0) {
    await supabase.from('point_transactions').insert({
      user_id: user.id,
      point_type: 'source_created',
      points,
      related_source_id: source.id,
      description: `취재원 등록: ${source.full_name} (+${points}pt)`,
    })
  }

  // 감사 로그 (fire-and-forget)
  void auditLog(supabase, {
    user_id:       user.id,
    user_email:    user.email ?? null,
    user_role:     profile?.role ?? null,
    action:        'create',
    resource_type: 'source',
    resource_id:   source.id,
    ip_address:    request.headers.get('x-forwarded-for') ?? null,
    metadata:      { full_name: source.full_name, points_awarded: points ?? 0 },
  })

  return NextResponse.json({ ...source, points_awarded: points }, { status: 201 })
}
