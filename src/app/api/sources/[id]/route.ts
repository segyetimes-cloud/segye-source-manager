// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { calcCompletenessScore, INCREMENTAL_POINT_FIELDS } from '@/lib/points'

interface Params {
  params: Promise<{ id: string }>
}

// GET /api/sources/:id — 상세 조회
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: source, error } = await supabase
    .from('sources')
    .select(`
      *,
      profiles!owner_id(full_name, email, department),
      source_positions(id, organization, department, position, rank, started_at, ended_at, is_current, change_source),
      source_edit_history(id, editor_name, field_name, old_value, new_value, edited_at),
      source_usefulness_ratings(rating)
    `)
    .eq('id', id)
    .eq('is_deleted', false)
    .single()

  if (error || !source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 요청자 역할 조회
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const callerRole = (callerProfile as any)?.role ?? 'reporter'
  // 부국장·국장·편집인·superadmin·부장 모두 admin급 이상으로 취급
  const isAdminOrAbove   = ['admin', 'section_editor', 'editor', 'publisher', 'superadmin'].includes(callerRole)
  const isDeputyOrAbove  = ['deputy', 'admin', 'section_editor', 'editor', 'publisher', 'superadmin'].includes(callerRole)
  const isOwner = source.owner_id === user.id

  // ── 접근 권한 확인 ──────────────────────────────────────────────────────────
  // 개인 목록: 소유자 또는 admin+ 만
  if (source.visibility === 'personal' && !isOwner && !isAdminOrAbove) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  // 공유 + 민감: 소유자 또는 admin+ 만 (기자·차장 열람 불가)
  if (source.visibility === 'shared' && source.sensitivity === 'private' && !isOwner && !isAdminOrAbove) {
    return NextResponse.json({ error: '민감 정보로 분류된 취재원입니다. 데스크 이상만 열람할 수 있습니다.' }, { status: 403 })
  }

  // ── personal_notes(민감 정보) 마스킹: 차장 이상 또는 승인된 기자만 열람 ──────
  if (!isOwner && !isDeputyOrAbove) {
    // 승인 여부 확인
    const { data: approval } = await supabase
      .from('source_access_approvals')
      .select('id, expires_at')
      .eq('source_id', id)
      .eq('requester_id', user.id)
      .eq('status', 'approved')
      .maybeSingle()
    const hasApproval = !!approval && (!(approval as any).expires_at || new Date((approval as any).expires_at) > new Date())
    if (!hasApproval) {
      source.personal_notes = null
    }
  }
  // ── public_notes: 모든 인증 사용자 열람 가능 (마스킹 없음) ──────────────────

  // 평균 유용성 점수 계산
  const ratings = (source.source_usefulness_ratings as { rating: number }[]) ?? []
  const avgRating = ratings.length > 0
    ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
    : null

  // 감사 로그 (fire-and-forget)
  void supabase.from('audit_logs').insert({
    user_id: user.id,
    user_email: user.email,
    action: source.sensitivity === 'private' ? 'view_private' : 'view',
    resource_type: 'source',
    resource_id: id,
  })

  return NextResponse.json({ ...source, avg_rating: avgRating })
}

// PATCH /api/sources/:id — 수정
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  // 기존 데이터 조회
  const { data: existing } = await supabase.from('sources').select('*').eq('id', id).single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // 소유자 또는 관리자만 수정 가능
  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  const isAdmin = profile && ['admin', 'section_editor', 'editor', 'publisher', 'superadmin'].includes(profile.role)

  if (existing.owner_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const updateFields: Record<string, unknown> = {}
  const editHistory: { field_name: string; old_value: string | null; new_value: string | null }[] = []

  const trackableFields = [
    'full_name', 'current_organization', 'current_position', 'current_department',
    'phone_primary', 'phone_secondary', 'email_primary', 'email_secondary',
    'birthday', 'hometown_province', 'hometown_city',
    'high_school', 'university', 'university_major', 'graduate_school',
    'exam_batch', 'visibility', 'sensitivity', 'on_record_status', 'public_notes', 'personal_notes',
  ]

  for (const field of trackableFields) {
    if (body[field] !== undefined) {
      const oldVal = (existing as Record<string, unknown>)[field]
      const newVal = body[field]
      if (String(oldVal ?? '') !== String(newVal ?? '')) {
        updateFields[field] = newVal || null
        editHistory.push({
          field_name: field,
          old_value: oldVal ? String(oldVal) : null,
          new_value: newVal ? String(newVal) : null,
        })
      }
    }
  }

  if (body.tags !== undefined) updateFields.tags = body.tags
  if (body.sns_links !== undefined) updateFields.sns_links = body.sns_links

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ message: 'No changes' })
  }

  // 변경 후 완성도 점수 재계산 (merged)
  updateFields.completeness_score = calcCompletenessScore({ ...existing, ...updateFields })

  const { data: updated, error } = await supabase
    .from('sources')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 편집 이력 기록
  if (editHistory.length > 0) {
    await supabase.from('source_edit_history').insert(
      editHistory.map(h => ({
        source_id: id,
        editor_id: user.id,
        editor_name: profile?.full_name ?? user.email ?? 'Unknown',
        ...h,
      }))
    )
  }

  // 감사 로그 (fire-and-forget)
  void supabase.from('audit_logs').insert({
    user_id: user.id,
    user_email: user.email,
    action: 'update',
    resource_type: 'source',
    resource_id: id,
    metadata: { changed_fields: Object.keys(updateFields) },
  })

  // 증분 포인트: 새로 채워진 필드에 대해 포인트 지급 (lib/points.ts 기준)
  let incrementalPts = 0
  for (const [field, pts] of INCREMENTAL_POINT_FIELDS) {
    const wasEmpty = !existing[field]
    const isChanging = body[field] !== undefined
    const nowFilled = isChanging ? !!body[field] : false
    if (wasEmpty && isChanging && nowFilled) incrementalPts += pts
  }
  // 태그 신규 추가
  if (body.tags !== undefined) {
    const hadTags = Array.isArray(existing.tags) && existing.tags.length > 0
    const hasTags = Array.isArray(body.tags) && body.tags.length > 0
    if (!hadTags && hasTags) incrementalPts += 0.5
  }

  if (incrementalPts > 0) {
    const serviceClient2 = createServiceClient()
    await serviceClient2.from('point_transactions').insert({
      user_id: user.id,
      point_type: 'source_created',
      points: incrementalPts,
      related_source_id: id,
      description: `취재원 정보 보완: ${existing.full_name} (+${incrementalPts}pt)`,
    })
  }

  // 소속/직책 변경 시 직책 이력 자동 생성
  const orgChanged = updateFields.current_organization && updateFields.current_organization !== existing.current_organization
  const posChanged = updateFields.current_position && updateFields.current_position !== existing.current_position
  if (orgChanged || posChanged) {
    // 기존 현직 종료
    await supabase.from('source_positions').update({
      is_current: false,
      ended_at: new Date().toISOString().split('T')[0],
    }).eq('source_id', id).eq('is_current', true)

    // 새 직책 이력 생성
    const newOrg = (updateFields.current_organization ?? existing.current_organization) as string
    const newPos = (updateFields.current_position ?? existing.current_position) as string
    if (newOrg && newPos) {
      await supabase.from('source_positions').insert({
        source_id: id,
        organization: newOrg,
        department: (updateFields.current_department ?? existing.current_department ?? null) as string | null,
        position: newPos,
        started_at: new Date().toISOString().split('T')[0],
        is_current: true,
        change_source: 'manual',
        created_by: user.id,
      })
    }
  }

  return NextResponse.json(updated)
}

// DELETE /api/sources/:id — 소프트 삭제
export async function DELETE(request: NextRequest, { params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: source } = await supabase.from('sources').select('owner_id').eq('id', id).single()
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile && ['admin', 'section_editor', 'editor', 'publisher', 'superadmin'].includes(profile.role)

  if (source.owner_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await supabase.from('sources').update({ is_deleted: true }).eq('id', id)

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    user_email: user.email,
    action: 'delete',
    resource_type: 'source',
    resource_id: id,
  })

  return NextResponse.json({ success: true })
}
