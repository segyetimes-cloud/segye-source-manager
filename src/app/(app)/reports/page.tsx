import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { ReportVisibility } from '@/types/database'

interface SearchParams {
  searchParams: Promise<{ tab?: string; q?: string; page?: string }>
}

function VisibilityBadge({ visibility }: { visibility: ReportVisibility }) {
  const map = {
    author_only: { bg: 'rgba(255,153,0,0.1)', color: '#FF9900', label: '🔒 작성자만' },
    desk_above:  { bg: 'rgba(0,212,255,0.1)',  color: '#00D4FF', label: '📋 데스크' },
    all:         { bg: 'rgba(0,204,102,0.1)',  color: '#00CC66', label: '🌐 전체' },
  }
  const s = map[visibility] ?? map.author_only
  return (
    <span style={{
      background: s.bg, color: s.color,
      border: `1px solid ${s.color}44`,
      borderRadius: '6px', padding: '2px 8px',
      fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

export default async function ReportsPage({ searchParams }: SearchParams) {
  const { tab = 'all', q = '', page = '1' } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const supabaseAny = supabase as any

  const pageSize = 20
  const pageNum = parseInt(page)

  let query = supabaseAny
    .from('information_reports')
    .select(`
      id, title, content, tags, visibility, author_id, created_at,
      profiles!author_id(full_name, department),
      report_sources(source_id, sources!source_id(id, full_name))
    `, { count: 'exact' })
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range((pageNum - 1) * pageSize, pageNum * pageSize - 1)

  if (tab === 'mine') {
    query = query.eq('author_id', user.id)
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
      matchingReportIds = [...new Set((links ?? []).map((l: any) => l.report_id as string))]
    }

    if (matchingReportIds.length > 0) {
      query = query.or(
        `title.ilike.%${q}%,content.ilike.%${q}%,id.in.(${matchingReportIds.join(',')})`
      )
    } else {
      query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`)
    }
  }

  const { data: reports, count } = await query
  const totalPages = Math.ceil((count ?? 0) / pageSize)

  return (
    <div className="max-w-4xl mx-auto space-y-5" style={{ padding: '0 0 2rem' }}>

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#E8F0FE' }}>📋 정보보고</h1>
          <p className="text-xs mt-0.5" style={{ color: '#5A7099' }}>취재 관련 정보 보고서를 작성하고 공유합니다</p>
        </div>
        <Link
          href="/reports/new"
          style={{
            background: 'linear-gradient(135deg, #1E90FF, #0066CC)',
            color: 'white', borderRadius: '8px',
            padding: '8px 16px', fontSize: '13px',
            fontWeight: 600, textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}>
          + 새 보고서
        </Link>
      </div>

      {/* 탭 + 검색 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* 탭 */}
        <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #1A3050', flexShrink: 0 }}>
          {[
            { value: 'all',  label: '전체 공개' },
            { value: 'mine', label: '내 보고서' },
          ].map(t => (
            <Link
              key={t.value}
              href={`/reports?tab=${t.value}${q ? `&q=${encodeURIComponent(q)}` : ''}`}
              style={{
                padding: '7px 18px',
                fontSize: '13px', fontWeight: 500,
                textDecoration: 'none',
                background: tab === t.value ? 'rgba(30,144,255,0.15)' : 'transparent',
                color: tab === t.value ? '#1E90FF' : '#8899BB',
                borderRight: t.value === 'all' ? '1px solid #1A3050' : 'none',
              }}>
              {t.label}
            </Link>
          ))}
        </div>

        {/* 검색 */}
        <form method="GET" action="/reports" style={{ display: 'flex', gap: '6px', flex: 1, maxWidth: '360px' }}>
          <input type="hidden" name="tab" value={tab} />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="제목·내용 검색"
            style={{
              flex: 1, background: '#132850',
              border: '1px solid #1A3050', color: '#E8F0FE',
              borderRadius: '8px', padding: '7px 12px', fontSize: '13px',
            }}
          />
          <button type="submit" style={{
            background: '#1E90FF', color: 'white',
            border: 'none', borderRadius: '8px',
            padding: '7px 14px', fontSize: '13px', cursor: 'pointer',
          }}>
            검색
          </button>
        </form>
      </div>

      {/* 목록 */}
      {(!reports || reports.length === 0) ? (
        <div className="glass-card p-8 text-center">
          <p style={{ color: '#4A6080', fontSize: '14px' }}>
            {q ? `"${q}"에 해당하는 보고서가 없습니다.` : '아직 보고서가 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="report-card-grid">
          {(reports as any[]).map(report => {
            const author = report.profiles as { full_name: string; department: string | null } | null
            const sourcesRaw = (report.report_sources as any[]) ?? []
            const sourceNames = sourcesRaw
              .map((rs: any) => rs.sources?.full_name)
              .filter(Boolean)

            const preview = (report.content as string)
              .replace(/\n/g, ' ')
              .slice(0, 120)

            const dateStr = new Date(report.created_at).toLocaleDateString('ko-KR', {
              year: 'numeric', month: '2-digit', day: '2-digit',
            })

            return (
              <Link
                key={report.id}
                href={`/reports/${report.id}`}
                style={{ textDecoration: 'none' }}>
                <div
                  className="glass-card p-4"
                  style={{ cursor: 'pointer', transition: 'border-color 0.15s' }}
                  onMouseEnter={undefined}>
                  {/* 상단: 제목 + 배지 */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h2 style={{
                      fontSize: '15px', fontWeight: 600,
                      color: '#E8F0FE', lineHeight: 1.3,
                      flex: 1,
                    }}>
                      {report.title}
                    </h2>
                    <VisibilityBadge visibility={report.visibility as ReportVisibility} />
                  </div>

                  {/* 본문 미리보기 */}
                  <p style={{
                    fontSize: '13px', color: '#8899BB',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: 1.5,
                    marginBottom: '10px',
                  }}>
                    {preview}{(report.content as string).length > 120 ? '…' : ''}
                  </p>

                  {/* 태그 */}
                  {(report.tags as string[]).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(report.tags as string[]).slice(0, 5).map((tag, i) => (
                        <span key={i} style={{
                          background: 'rgba(30,144,255,0.1)',
                          color: '#1E90FF',
                          border: '1px solid rgba(30,144,255,0.2)',
                          borderRadius: '4px', padding: '1px 7px',
                          fontSize: '11px',
                        }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 연결 취재원 */}
                  {sourceNames.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {sourceNames.slice(0, 4).map((name: string, i: number) => (
                        <span key={i} style={{
                          background: 'rgba(0,212,255,0.08)',
                          color: '#00D4FF',
                          border: '1px solid rgba(0,212,255,0.2)',
                          borderRadius: '4px', padding: '1px 7px',
                          fontSize: '11px',
                        }}>
                          👤 {name}
                        </span>
                      ))}
                      {sourceNames.length > 4 && (
                        <span style={{ fontSize: '11px', color: '#4A6080' }}>+{sourceNames.length - 4}명</span>
                      )}
                    </div>
                  )}

                  {/* 하단 메타 */}
                  <div className="flex items-center justify-between mt-1">
                    <span style={{ fontSize: '12px', color: '#5A7099' }}>
                      {author?.full_name ?? '—'}
                      {author?.department ? ` · ${author.department}` : ''}
                    </span>
                    <span style={{ fontSize: '12px', color: '#4A6080' }}>{dateStr}</span>
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
              style={{ padding: '6px 14px', background: '#132850', border: '1px solid #1A3050', color: '#8899BB', borderRadius: '6px', textDecoration: 'none', fontSize: '13px' }}>
              이전
            </Link>
          )}
          <span style={{ fontSize: '13px', color: '#5A7099' }}>
            {pageNum} / {totalPages}
          </span>
          {pageNum < totalPages && (
            <Link href={`/reports?tab=${tab}&q=${q}&page=${pageNum + 1}`}
              style={{ padding: '6px 14px', background: '#132850', border: '1px solid #1A3050', color: '#8899BB', borderRadius: '6px', textDecoration: 'none', fontSize: '13px' }}>
              다음
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
