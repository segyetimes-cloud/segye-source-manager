import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { can, CAN_APPROVE_REPORT } from '@/lib/permissions'
import { isDesk as isDeskFn } from '@/lib/roles'
import ReportListClient from '@/components/reports/ReportListClient'

interface SearchParams {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>
}

interface ReportListRow {
  id: string
  title: string
  content: string
  category: string | null
  tags: string[]
  visibility: string
  author_id: string
  author_department?: string | null
  created_at: string
  profiles: { full_name: string; department: string | null } | null
  report_sources: Array<{
    source_id: string
    sources: { id?: string; full_name: string } | null
  }>
}

export default async function ReportsPage({ searchParams }: SearchParams) {
  const { tab = 'all', q = '', page = '1' } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')


  // 현재 사용자 역할·부서 조회
  const { data: myProfileRaw } = await supabase
    .from('profiles').select('role, department, full_name').eq('id', user.id).single()
  const myProfile = myProfileRaw as { role: string; department: string | null; full_name: string | null } | null
  const myDept: string | null = myProfile?.department ?? null
  const myRole: string = myProfile?.role ?? 'reporter'
  const isAboveAdmin = can(myRole, CAN_APPROVE_REPORT)
  const isAdminRole = myRole === 'admin'
  const isDeskUser = isDeskFn(myRole)

  const pageSize = 20
  const pageNum = parseInt(page)

  let query = supabase
    .from('information_reports')
    .select(`
      id, title, content, category, tags, visibility, author_id, created_at,
      profiles!author_id(full_name, department),
      report_sources(source_id, sources!source_id(id, full_name))
    `, { count: 'exact' })
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range((pageNum - 1) * pageSize, pageNum * pageSize - 1)

  if (tab === 'mine') {
    query = query.eq('author_id', user.id)
  } else if (isAboveAdmin) {
    // 부국장 이상: 필터 없음 — 전체 열람
  } else if (isAdminRole) {
    // 부장: 내 보고서 + 전체공개 + 소속 부서 보고서
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
    // 기자·차장: 승인된 보고서 + 소속 부서 팀공개 + 내 보고서
    if (myDept) {
      const safeDept = `"${myDept.replace(/"/g, '')}"`
      query = query.or(
        `author_id.eq.${user.id},` +
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
    // 취재원 이름으로도 검색: sources.full_name → report_sources → report id 추출
    const { data: matchingSources } = await supabase
      .from('sources')
      .select('id')
      .ilike('full_name', `%${q}%`)
      .eq('is_deleted', false)
      .limit(100)

    const matchingSourceIds = (matchingSources ?? []).map((s) => s.id)
    let matchingReportIds: string[] = []

    if (matchingSourceIds.length > 0) {
      const { data: links } = await supabase
        .from('report_sources')
        .select('report_id')
        .in('source_id', matchingSourceIds)
      matchingReportIds = [...new Set<string>((links ?? []).map((l) => l.report_id))]
    }

    // 특수문자 이스케이프 (%, _, \)
    const qEsc = q.replace(/[%_\\]/g, '\\$&')
    // 데스크 이상은 민감정보(sensitive_content)도 검색 범위에 포함
    const searchFields = isDeskUser
      ? `title.ilike.%${qEsc}%,content.ilike.%${qEsc}%,sensitive_content.ilike.%${qEsc}%`
      : `title.ilike.%${qEsc}%,content.ilike.%${qEsc}%`
    const { data: textMatches } = await supabase
      .from('information_reports')
      .select('id')
      .eq('is_deleted', false)
      .or(searchFields)
    const textMatchIds: string[] = (textMatches ?? []).map((r) => r.id)
    const allMatchIds = [...new Set<string>([...textMatchIds, ...matchingReportIds])]
    if (allMatchIds.length > 0) {
      query = query.in('id', allMatchIds)
    } else {
      query = query.eq('id', '00000000-0000-0000-0000-000000000000')
    }
  }

  const { data: reports, count } = await query
  const totalPages = Math.ceil((count ?? 0) / pageSize)

  return (
    <div className="space-y-5" style={{ padding: '0 0 2rem' }}>

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#CDD5E0' }}>📋 정보보고</h1>
          <p className="text-xs mt-0.5" style={{ color: '#5A7099' }}>취재 관련 정보 보고서를 작성하고 공유합니다</p>
        </div>
        <Link
          href="/reports/new"
          style={{
            background: 'linear-gradient(135deg, #4A7CC0, #0066CC)',
            color: 'white', borderRadius: '8px',
            padding: '8px 16px', fontSize: '13px',
            fontWeight: 600, textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}>
          + 새 보고서
        </Link>
      </div>

      <ReportListClient
        initialReports={(reports ?? []) as ReportListRow[]}
        totalCount={count ?? 0}
        currentPage={pageNum}
        totalPages={totalPages}
        currentTab={tab}
        currentQuery={q}
        userId={user.id}
        userFullName={myProfile?.full_name ?? '—'}
        userDepartment={myProfile?.department ?? null}
      />
    </div>
  )
}
