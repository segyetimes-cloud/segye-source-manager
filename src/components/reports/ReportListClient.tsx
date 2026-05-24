'use client'

import { useState, useEffect, useMemo } from 'react'
import type { ReportVisibility } from '@/types/database'
import VisibilityBadge from '@/components/reports/VisibilityBadge'
import ReportModal from '@/components/reports/ReportModal'

function Highlight({ text, query }: { text: string | null; query: string }) {
  if (!query.trim() || !text) return <>{text ?? ''}</>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} style={{ background: 'rgba(255,213,0,0.35)', color: '#FFD700', borderRadius: '2px', padding: '0 1px' }}>
            {part}
          </mark>
        ) : part
      )}
    </>
  )
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

interface Props {
  initialReports: ReportListRow[]
  totalCount: number
  currentPage: number
  totalPages: number
  currentTab: string
  currentQuery: string
  userId: string
  userFullName: string
  userDepartment: string | null
}

export default function ReportListClient({
  initialReports,
  totalCount,
  currentPage,
  totalPages,
  currentTab,
  currentQuery,
  userId,
  userFullName,
  userDepartment,
}: Props) {
  const [openReportId, setOpenReportId] = useState<string | null>(null)

  // AI 검색 상태
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResults, setAiResults] = useState<ReportListRow[] | null>(null)
  const [aiIntent, setAiIntent] = useState('')
  const [aiExpandedTerms, setAiExpandedTerms] = useState<string[]>([])
  const [aiError, setAiError] = useState('')

  // currentQuery 변경 시 자동 AI 검색
  useEffect(() => {
    if (!currentQuery.trim()) {
      setAiResults(null)
      setAiIntent('')
      setAiExpandedTerms([])
      return
    }
    setAiLoading(true)
    setAiError('')
    fetch('/api/reports/search-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: currentQuery }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setAiError(data.error); return }
        setAiResults(data.reports ?? [])
        setAiIntent(data.intent ?? '')
        setAiExpandedTerms(data.expandedTerms ?? [])
      })
      .catch(() => setAiError('AI 검색 오류'))
      .finally(() => setAiLoading(false))
  }, [currentQuery])

  // 표시할 목록: 서버 결과 + AI 추가 결과 합집합
  const displayReports = useMemo(() => {
    if (!currentQuery.trim()) return initialReports
    if (!aiResults) return initialReports
    const ids = new Set(initialReports.map(r => r.id))
    const extra = aiResults.filter(r => !ids.has(r.id))
    return [...initialReports, ...extra]
  }, [initialReports, aiResults, currentQuery])

  const highlightQuery = currentQuery

  return (
    <div className="space-y-5">
      {/* 팝업 모달 */}
      {openReportId && (
        <ReportModal
          reportId={openReportId}
          onClose={() => setOpenReportId(null)}
          userId={userId}
          userFullName={userFullName}
          userDepartment={userDepartment}
        />
      )}

      {/* 검색 + 탭 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {/* 검색 폼 */}
        <form method="GET" action="/reports" style={{ display: 'flex', gap: '6px' }}>
          <input type="hidden" name="tab" value={currentTab} />
          <input
            type="text"
            name="q"
            defaultValue={currentQuery}
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
          {aiLoading && currentQuery && (
            <span style={{ fontSize: '11px', color: '#9060B0', whiteSpace: 'nowrap', alignSelf: 'center' }}>
              ✨ AI 검색 중…
            </span>
          )}
        </form>

        {/* 탭 + 총 건수 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #1A2838' }}>
            {[
              { value: 'all',  label: '전체 공개' },
              { value: 'mine', label: '내 보고서' },
            ].map(t => (
              <a
                key={t.value}
                href={`/reports?tab=${t.value}${currentQuery ? `&q=${encodeURIComponent(currentQuery)}` : ''}`}
                style={{
                  padding: '6px 16px', fontSize: '13px', fontWeight: 500,
                  textDecoration: 'none',
                  background: currentTab === t.value ? 'rgba(30,144,255,0.15)' : 'transparent',
                  color: currentTab === t.value ? '#4A7CC0' : '#687898',
                  borderRight: t.value === 'all' ? '1px solid #1A2838' : 'none',
                  display: 'inline-block',
                }}>
                {t.label}
              </a>
            ))}
          </div>
          <span style={{ fontSize: '12px', color: '#485870' }}>
            총 {totalCount}건
          </span>
        </div>
      </div>

      {/* AI 배너 */}
      {aiIntent && currentQuery && (
        <div style={{
          padding: '8px 12px', borderRadius: '8px',
          background: 'rgba(147,51,234,0.08)',
          border: '1px solid rgba(147,51,234,0.25)',
          fontSize: '12px', color: '#C084FC',
        }}>
          ✨ <strong>AI 분석:</strong> {aiIntent}
          {aiExpandedTerms.length > 0 && (
            <span style={{ color: '#9060B0', marginLeft: '8px' }}>
              → {aiExpandedTerms.join(', ')}
            </span>
          )}
        </div>
      )}

      {/* AI 에러 */}
      {aiError && currentQuery && (
        <div style={{
          padding: '8px 12px', borderRadius: '8px',
          background: 'rgba(192,64,64,0.08)', border: '1px solid rgba(192,64,64,0.25)',
          fontSize: '12px', color: '#C04040',
        }}>
          {aiError}
        </div>
      )}

      {/* 목록 */}
      {displayReports.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p style={{ color: '#485870', fontSize: '14px' }}>
            {currentQuery
              ? `"${currentQuery}"에 해당하는 보고서가 없습니다.`
              : '아직 보고서가 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          {displayReports.map((report, idx) => {
            const author = report.profiles
            const sourcesRaw = report.report_sources ?? []
            const sourceNames = sourcesRaw
              .map(rs => rs.sources?.full_name)
              .filter((n): n is string => !!n)

            const preview = report.content.replace(/\n/g, ' ').slice(0, 100)

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
              <a
                key={report.id}
                href={`/reports/${report.id}`}
                className="report-list-row"
                onClick={e => { e.preventDefault(); setOpenReportId(report.id) }}
                style={{
                  textDecoration: 'none', display: 'block', color: 'inherit',
                  borderBottom: idx < displayReports.length - 1 ? '1px solid #1A2838' : 'none',
                }}>
                <div style={{ padding: '8px 18px' }}>
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
                      <Highlight text={report.title} query={highlightQuery} />
                    </span>
                    <VisibilityBadge visibility={report.visibility as ReportVisibility} />
                  </div>

                  {/* 미리보기 — 2줄 말줄임 */}
                  <p style={{
                    fontSize: '12px', color: '#5A7099', margin: '0 0 7px',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    lineHeight: 1.5,
                  }}>
                    <Highlight text={preview + (report.content.length > 100 ? '…' : '')} query={highlightQuery} />
                  </p>

                  {/* 태그 + 취재원 */}
                  {(report.tags.length > 0 || sourceNames.length > 0) && (
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      {report.tags.slice(0, 4).map((tag, i) => (
                        <span key={i} style={{
                          fontSize: '11px', padding: '1px 6px', borderRadius: '4px',
                          background: 'rgba(30,144,255,0.08)', color: '#4A7CC0',
                        }}>#{tag}</span>
                      ))}
                      {sourceNames.slice(0, 3).map((name, i) => (
                        <span key={i} style={{
                          fontSize: '11px', padding: '1px 6px', borderRadius: '4px',
                          background: 'rgba(0,212,255,0.06)', color: '#3A90A8',
                        }}>👤 {name}</span>
                      ))}
                    </div>
                  )}

                  {/* 작성자 · 날짜 */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#5A7099' }}>
                      {author?.full_name ?? '—'}{author?.department ? ` · ${author.department}` : ''}
                    </span>
                    <span style={{ fontSize: '11px', color: '#485870' }}>{dateStr}</span>
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          {currentPage > 1 && (
            <a
              href={`/reports?tab=${currentTab}&q=${currentQuery}&page=${currentPage - 1}`}
              style={{ padding: '6px 14px', background: '#182035', border: '1px solid #1A2838', color: '#687898', borderRadius: '6px', textDecoration: 'none', fontSize: '13px' }}>
              이전
            </a>
          )}
          <span style={{ fontSize: '13px', color: '#5A7099' }}>
            {currentPage} / {totalPages}
          </span>
          {currentPage < totalPages && (
            <a
              href={`/reports?tab=${currentTab}&q=${currentQuery}&page=${currentPage + 1}`}
              style={{ padding: '6px 14px', background: '#182035', border: '1px solid #1A2838', color: '#687898', borderRadius: '6px', textDecoration: 'none', fontSize: '13px' }}>
              다음
            </a>
          )}
        </div>
      )}
    </div>
  )
}
