import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { ReportVisibility } from '@/types/database'
import VisibilityBadge from '@/components/reports/VisibilityBadge'

interface SearchParams {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>
}

export default async function ReportsPage({ searchParams }: SearchParams) {
  const { tab = 'all', q = '', page = '1' } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const supabaseAny = supabase as any

  // 현재 사용자 역할·부서 조회
  const { data: myProfile } = await supabaseAny
    .from('profiles').select('role, department').eq('id', user.id).single()
  const myDept: string | null = myProfile?.department ?? null
  const myRole: string = myProfile?.role ?? 'reporter'
  const isAboveAdmin = ['section_editor', 'editor', 'publisher', 'superadmin'].includes(myRole)
  const isAdminRole = myRole === 'admin'

  const pageSize = 20
  const pageNum = parseInt(page)

  let query = supabaseAny
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
    const { data: matchingSources } = await supabaseAny
      .from('sources')
      .select('id')
      .ilike('full_name', `%${q}%`)
      .eq('is_deleted', false)
      .limit(100)

    const matchingSourceIds = (matchingSources ?? []).map((s: any) => s.id as string)
    let matchingReportIds: string[] = []

    if (matchingSourceIds.length > 0) {
      const { data: links } = await supabaseAny
        .from('report_sources')
        .select('report_id')
        .in('source_id', matchingSourceIds)
      matchingReportIds = [...new Set<string>((links ?? []).map((l: any) => l.report_id as string))]
    }

    // SQL injection 방지: or() 인터폴레이션 대신 별도 쿼리로 분리
    const { data: textMatches } = await supabaseAny
      .from('information_reports')
      .select('id')
      .eq('is_deleted', false)
      .or(`title.ilike.%${q}%,content.ilike.%${q}%`)
    const textMatchIds: string[] = (textMatches ?? []).map((r: any) => r.id as string)
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
    <div className="max-w-4xl mx-auto space-y-5" style={{ padding: '0 0 2rem' }}>

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

      {/* 검색 + 탭 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* 검색 먼저 */}
        <form method="GET" action="/reports" style={{ display: 'flex', gap: '6px' }}>
          <input type="hidden" name="tab" value={tab} />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="제목 내용 검색"
            style={{
              flex: 1, background: '#131C2C',
              border: '1px solid #1A2838', color: '#CDD5E0',
              borderRadius: '8px', padding: '9px 12px', fontSize: '14px', outline: 'none',
            }}
          />
          <button type="submit" style={{
            background: '#4A7CC0', color: 'white',
            border: 'none', borderRadius: '8px',
            padding: '9px 14px', fontSize: '14px', fontWeight: 500, cursor: 'pointer', flexShrink: 0,
          }}>
            검색
          </button>
        </form>

        {/* 탭 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #1A2838' }}>
            {[
              { value: 'all',  label: '전체 공개' },
              { value: 'mine', label: '내 보고서' },
            ].map(t => (
              <Link
                key={t.value}
                href={`/reports?tab=${t.value}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
                style={{
                  padding: '6px 16px', fontSize: '13px', fontWeight: 500,
                  textDecoration: 'none',
                  background: tab === t.value ? 'rgba(30,144,255,0.15)' : 'transparent',
                  color: tab === t.value ? '#4A7CC0' : '#687898',
                  borderRight: t.value === 'all' ? '1px solid #1A2838' : 'none',
                }}>
                {t.label}
              </Link>
            ))}
          </div>
          {count != null && (
            <span style={{ fontSize: '12px', color: '#485870' }}>총 {count}건</span>
          )}
        </div>
      </div>

      {/* 목록 */}
      {(!reports || reports.length === 0) ? (
        <div className="glass-card p-8 text-center">
          <p style={{ color: '#485870', fontSize: '14px' }}>
            {q ? `"${q}"에 해당하는 보고서가 없습니다.` : '아직 보고서가 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          {(reports as any[]).map((report, idx) => {
            const author = report.profiles as { full_name: string; department: string | null } | null
            const sourcesRaw = (report.report_sources as any[]) ?? []
            const sourceNames = sourcesRaw
              .map((rs: any) => rs.sources?.full_name)
              .filter(Boolean)

            const preview = (report.content as string)
              .replace(/\n/g, ' ')
              .slice(0, 100)

            const dateStr = new Date(report.created_at).toLocaleDateString('ko-KR', {
              month: '2-digit', day: '2-digit',
            })

            const catCfg = report.category && report.category !== '일반' ? {
              bg: report.category === '단독' ? 'rgba(192,64,64,0.15)' :
                  report.category === '인터뷰' ? 'rgba(61,158,106,0.15)' : 'rgba(74,124,192,0.15)',
              color: report.category === '단독' ? '#C04040' :
                     report.category === '인터뷰' ? '#3D9E6A' : '#4A7CC0',
            } : null

            return (
              <Link
                key={report.id}
                href={`/reports/${report.id}`}
                className="report-list-row"
                style={{
                  textDecoration: 'none', display: 'block',
                  borderBottom: idx < (reports as any[]).length - 1 ? '1px solid #1A2838' : 'none',
                }}>
                <div style={{ padding: '13px 18px' }}>
                  {/* 제목 줄 */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '5px' }}>
                    {catCfg && (
                      <span style={{
                        fontSize: '10px', fontWeight: 700, padding: '2px 6px',
                        borderRadius: '4px', flexShrink: 0, marginTop: '2px',
                        background: catCfg.bg, color: catCfg.color,
                      }}>
                        {report.category}
                      </span>
                    )}
                    <span style={{
                      fontSize: '14px', fontWeight: 600, color: '#CDD5E0',
                      lineHeight: 1.35, flex: 1, minWidth: 0,
                    }}>
                      {report.title}
                    </span>
                    <VisibilityBadge visibility={report.visibility as ReportVisibility} />
                  </div>

                  {/* 미리보기 */}
                  <p style={{
                    fontSize: '12px', color: '#5A7099', margin: '0 0 7px',
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                  }}>
                    {preview}{(report.content as string).length > 100 ? '…' : ''}
                  </p>

                  {/* 태그 + 취재원 + 메타 한 줄 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    {(report.tags as string[]).slice(0, 4).map((tag, i) => (
                      <span key={i} style={{
                        fontSize: '11px', padding: '1px 6px', borderRadius: '4px',
                        background: 'rgba(30,144,255,0.08)', color: '#4A7CC0',
                      }}>#{tag}</span>
                    ))}
                    {sourceNames.slice(0, 3).map((name: string, i: number) => (
                      <span key={i} style={{
                        fontSize: '11px', padding: '1px 6px', borderRadius: '4px',
                        background: 'rgba(0,212,255,0.06)', color: '#3A90A8',
                      }}>👤 {name}</span>
                    ))}
                    <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#485870', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {author?.full_name ?? '—'}{author?.department ? ` · ${author.department}` : ''} · {dateStr}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          {pageNum > 1 && (
            <Link href={`/reports?tab=${tab}&q=${q}&page=${pageNum - 1}`}
              style={{ padding: '6px 14px', background: '#182035', border: '1px solid #1A2838', color: '#687898', borderRadius: '6px', textDecoration: 'none', fontSize: '13px' }}>
              이전
            </Link>
          )}
          <span style={{ fontSize: '13px', color: '#5A7099' }}>
            {pageNum} / {totalPages}
          </span>
          {pageNum < totalPages && (
            <Link href={`/reports?tab=${tab}&q=${q}&page=${pageNum + 1}`}
              style={{ padding: '6px 14px', background: '#182035', border: '1px solid #1A2838', color: '#687898', borderRadius: '6px', textDecoration: 'none', fontSize: '13px' }}>
              다음
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
