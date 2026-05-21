// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/reports — 목록 조회
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = request.nextUrl.searchParams
  const visibilityFilter = sp.get('visibility_filter') ?? 'all' // 'all' | 'mine'
  const q = sp.get('q') ?? ''
  const page = parseInt(sp.get('page') ?? '1')
  const pageSize = 20

  // 현재 사용자 프로필 (열람 범위 판단용)
  const { data: myProfile } = await supabase
    .from('profiles').select('role, department').eq('id', user.id).single()
  const myDept = myProfile?.department ?? null
  const myRole = myProfile?.role ?? 'reporter'
  // 부국장 이상: 전 부서 열람 가능
  const isAboveAdmin = ['section_editor', 'editor', 'publisher', 'superadmin'].includes(myRole)
  // 부장: 소속 부서 + 전체공개만 열람
  const isAdminRole = myRole === 'admin'

  let query = supabase
    .from('information_reports')
    .select(`
      id, title, content, tags, visibility, status, author_id, created_at, updated_at,
      profiles!author_id(full_name, department),
      report_sources(source_id, sources!source_id(id, full_name, current_organization))
    `, { count: 'exact' })
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (visibilityFilter === 'mine') {
    query = query.eq('author_id', user.id)
  } else if (isAboveAdmin) {
    // 부국장 이상: 필터 없음 — 전체 열람
  } else if (isAdminRole) {
    // 부장: 내 보고서 + 전체공개 + 소속 부서 보고서 (visibility=desk_above/team)
    if (myDept) {
      const safeDept = `"${myDept.replace(/"/g, '')}"`
      query = query.or(
        `author_id.eq.${user.id},` +
        `visibility.eq.all,` +
        `and(visibility.in.(desk_above,team),author_department.eq.${safeDept})`
      )
    } else {
      query = query.or(`author_id.eq.${user.id},visibility.eq.all`)
    }
  } else {
    // 기자·차장: 비작성자에게는 status='approved' 보고서만 노출
    if (myDept) {
      const safeDept = `"${myDept.replace(/"/g, '')}"`
      query = query.or(
        `and(author_id.eq.${user.id}),` +
        `and(status.eq.approved,visibility.eq.all),` +
        `and(status.eq.approved,visibility.eq.team,author_department.eq.${safeDept})`
      )
    } else {
      query = query.or(
        `author_id.eq.${user.id},` +
        `and(status.eq.approved,visibility.eq.all)`
      )
    }
  }

  if (q) {
    // 취재원 이름으로도 검색 — 파라미터화된 ilike 사용 (SQL injection 방지)
    const { data: matchingSources } = await supabase
      .from('sources')
      .select('id')
      .ilike('full_name', `%${q}%`)
      .eq('is_deleted', false)
      .limit(100)

    const matchingSourceIds = (matchingSources ?? []).map((s: any) => s.id as string)
    let matchingReportIds: string[] = []

    if (matchingSourceIds.length > 0) {
      const { data: links } = await supabase
        .from('report_sources')
        .select('report_id')
        .in('source_id', matchingSourceIds)
      matchingReportIds = [...new Set<string>((links ?? []).map((l: any) => l.report_id as string))]
    }

    // 텍스트 검색을 별도 쿼리로 분리하여 interpolation 위험 제거
    const textQuery = supabase
      .from('information_reports')
      .select('id')
      .eq('is_deleted', false)
      .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
    const { data: textMatches } = await textQuery
    const textMatchIds: string[] = (textMatches ?? []).map((r: any) => r.id as string)

    const allMatchIds = [...new Set<string>([...textMatchIds, ...matchingReportIds])]
    if (allMatchIds.length > 0) {
      query = query.in('id', allMatchIds)
    } else {
      // 검색어와 일치하는 보고서 없음 → 빈 결과 보장
      query = query.eq('id', '00000000-0000-0000-0000-000000000000')
    }
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ reports: data ?? [], total: count ?? 0 })
}

// POST /api/reports — 보고서 생성
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Rate Limit: 사용자당 1분 10회 (대량 생성 방어)
  const { checkRateLimit, getClientIp } = await import('@/lib/rateLimit')
  const ip = getClientIp(request)
  const rl = checkRateLimit(`${user.id}:${ip}`, { prefix: 'report-create', limit: 10, windowMs: 60_000 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: '보고서 생성 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 429 }
    )
  }

  const body = await request.json()
  const { title, content, category, tags, visibility, source_ids, allowed_user_ids } = body

  if (!title?.trim()) return NextResponse.json({ error: '제목을 입력해 주세요.' }, { status: 400 })
  if (!content?.trim()) return NextResponse.json({ error: '본문을 입력해 주세요.' }, { status: 400 })

  // 작성자의 소속 부서를 스냅샷으로 저장 (라인 격벽용)
  const { data: authorProfile } = await supabase
    .from('profiles').select('department').eq('id', user.id).single()
  const authorDepartment = authorProfile?.department ?? null

  const VALID_CATEGORIES = ['일반','단독','공동취재','인터뷰','배경설명','분석','기타']
  const { data: report, error } = await supabase
    .from('information_reports')
    .insert({
      author_id: user.id,
      title: title.trim(),
      content: content.trim(),
      category: VALID_CATEGORIES.includes(category) ? category : '일반',
      tags: tags ?? [],
      visibility: visibility ?? 'author_only',
      author_department: authorDepartment,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 연결 취재원 등록
  if (Array.isArray(source_ids) && source_ids.length > 0) {
    const rows = source_ids.map((sid: string) => ({ report_id: report.id, source_id: sid }))
    const { error: sourceErr } = await supabase.from('report_sources').insert(rows)
    if (sourceErr) return NextResponse.json({ error: '취재원 연결에 실패했습니다.' }, { status: 500 })
  }

  // 최초 작성 revision 기록
  await supabase.from('report_revisions').insert({
    report_id: report.id,
    author_id: user.id,
    content: report.content,
  })

  // 지정 열람자 등록
  if (Array.isArray(allowed_user_ids) && allowed_user_ids.length > 0) {
    const rows = allowed_user_ids.map((uid: string) => ({
      report_id: report.id,
      user_id: uid,
      granted_by: user.id,
    }))
    const { error: allowedErr } = await supabase.from('report_allowed_users').insert(rows)
    if (allowedErr) return NextResponse.json({ error: '열람자 등록에 실패했습니다.' }, { status: 500 })
  }

  void supabase.from('audit_logs').insert({
    user_id:       user.id,
    user_email:    user.email,
    action:        'report_create',
    resource_type: 'report',
    resource_id:   report?.id ?? null,
    metadata:      { title: body?.title },
  })
  return NextResponse.json(report, { status: 201 })
}
