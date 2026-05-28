'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface SourceListItem {
  id: string; full_name: string
  current_organization: string | null; current_position: string | null; owner_id: string
}

interface AnalysisData {
  source: any
  relationships: any[]
  sameOrg: any[]
  sameUniversity: any[]
  sameHighSchool: any[]
  sameExam: any[]
  sameTown: any[]
  sameAffiliation: any[]
  reportMentions: Array<{
    id: string
    title: string
    status: string
    visibility: string
    created_at: string
    authorName: string | null
    authorDept: string | null
    contentSnippet: { before: string; match: string; after: string } | null
    sensitiveSnippet: { before: string; match: string; after: string } | null
    hasSensitiveMatch: boolean
    canSeeSensitive: boolean
  }>
  coMentionedViaReports: Array<{
    source: { id: string; full_name: string; current_organization: string | null; current_position: string | null }
    reportCount: number
  }>
  registrants: any[]
  examType: string | null
  // AI 추출 관계망
  extractedCoEntities?: Array<{ name: string; role: string | null; reportCount: number }>
  extractedDirectRelations?: Array<{ fromName: string; toName: string; relType: string; detail: string | null; reportId: string }>
}

interface NLSearchResult {
  sourceId: string
  sourceName: string
  description: string
  results: Array<{
    id: string
    full_name: string
    current_organization: string | null
    current_position: string | null
    relation_type: string
    relation_label: string | null
    strength: number
    is_bidirectional: boolean
  }>
}

interface NLCandidate {
  id: string
  full_name: string
  current_organization: string | null
  current_position: string | null
}

interface QueryAnalysis {
  queryName: string
  coEntities: Array<{ name: string; role: string | null; reportCount: number }>
  directRelations: Array<{ fromName: string; toName: string; relType: string; detail: string | null; reportId: string }>
  reportIds: string[]
}

interface Props {
  allSources: SourceListItem[]
  selectedId: string | null
  analysisData: AnalysisData | null
  queryName?: string | null
  queryAnalysis?: QueryAnalysis | null
}

// ── 관계 유형 레이블 ──────────────────────────────────────────────────────────
const RELATION_LABELS: Record<string, string> = {
  direct_mention: '직접 언급', acquaintance: '지인', colleague: '동료',
  alumni: '동문', family: '가족', other: '기타',
}

// ── 자연어 쿼리 감지 ──────────────────────────────────────────────────────────
const NL_KEYWORDS = [
  '과 친한', '와 친한', '이랑', '랑', '의 동문', '동창', '같은 학교',
  '같은 학번', '출신', '동료', '친구', '아는 사람', '관계', '연결', '인맥',
]

function isNaturalLanguageQuery(query: string): boolean {
  if (!query.includes(' ')) return false
  const lower = query.toLowerCase()
  return NL_KEYWORDS.some(kw => lower.includes(kw))
}

// ── 서브그룹 정렬 헬퍼 ────────────────────────────────────────────────────────
function sortedSubGroups(map: Map<string, any[]>): [string, any[]][] {
  return [...map.entries()].sort(([aKey, aItems], [bKey, bItems]) => {
    const numA = parseInt(aKey)
    const numB = parseInt(bKey)
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB
    if (aKey.includes('미입력')) return 1
    if (bKey.includes('미입력')) return -1
    return bItems.length - aItems.length
  })
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function AnalysisClient({ allSources, selectedId, analysisData, queryName, queryAnalysis }: Props) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  // null = 아직 검색 안 함, [] = 검색했으나 0건, [...] = 검색 결과
  const [searchResults, setSearchResults] = useState<SourceListItem[] | null>(null)

  // NL 검색 상태
  const [nlResults, setNlResults] = useState<NLSearchResult | null>(null)
  const [nlLoading, setNlLoading] = useState(false)
  const [nlError, setNlError] = useState('')
  const [nlCandidates, setNlCandidates] = useState<NLCandidate[] | null>(null)
  const [nlDescription, setNlDescription] = useState('')

  // 라이브 자동완성용 (드롭다운)
  const filteredSources = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.trim().toLowerCase()
    return allSources
      .filter(s => s.full_name.toLowerCase().includes(q) || (s.current_organization ?? '').toLowerCase().includes(q))
      .slice(0, 8)
  }, [searchQuery, allSources])

  // NL 검색 실행
  async function doNLSearch(query: string) {
    setNlLoading(true)
    setNlError('')
    setNlResults(null)
    setNlCandidates(null)
    setSearchResults(null)

    try {
      const res = await fetch('/api/analysis/search-nl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const data = await res.json()

      if (!res.ok) {
        setNlError(data.error ?? '검색 중 오류가 발생했습니다.')
        return
      }

      if (data.needSelection) {
        setNlCandidates(data.candidates)
        setNlDescription(data.description ?? query)
      } else {
        setNlResults(data as NLSearchResult)
      }
    } catch {
      setNlError('서버와 통신 중 오류가 발생했습니다.')
    } finally {
      setNlLoading(false)
    }
  }

  // NL 후보 중 하나 선택 시 해당 인물로 재검색
  async function selectNLCandidate(candidateId: string, candidateName: string) {
    setNlCandidates(null)
    setNlLoading(true)
    setNlError('')

    try {
      const res = await fetch('/api/analysis/search-nl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // 정확한 이름으로 재요청하면 Claude가 exact match로 반환
        body: JSON.stringify({ query: candidateName }),
      })
      const data = await res.json()

      if (!res.ok) {
        setNlError(data.error ?? '검색 중 오류가 발생했습니다.')
        return
      }

      if (data.needSelection) {
        // 여전히 여러 명이면 ID로 직접 이동
        router.push(`/analysis?id=${candidateId}`)
      } else {
        setNlResults(data as NLSearchResult)
      }
    } catch {
      setNlError('서버와 통신 중 오류가 발생했습니다.')
    } finally {
      setNlLoading(false)
    }
  }

  // 검색 실행 (버튼 클릭 또는 Enter)
  function doSearch() {
    const q = searchQuery.trim()
    if (!q) return
    setShowDropdown(false)

    // 자연어 쿼리 감지
    if (isNaturalLanguageQuery(q)) {
      doNLSearch(q)
      return
    }

    const ql = q.toLowerCase()
    const results = allSources.filter(s =>
      s.full_name.toLowerCase().includes(ql) ||
      (s.current_organization ?? '').toLowerCase().includes(ql)
    )

    if (results.length === 1) {
      // 단 1명이면 바로 이동
      router.push(`/analysis?id=${results[0].id}`)
      setSearchResults(null)
    } else {
      setSearchResults(results)
    }
  }

  function selectSource(id: string) {
    setSearchQuery('')
    setShowDropdown(false)
    setSearchResults(null)
    router.push(`/analysis?id=${id}`)
  }

  const src = analysisData?.source

  return (
    <div style={{ minHeight: '100%', background: '#0D1520' }}>

      {/* 헤더 */}
      <div style={{ borderBottom: '1px solid #1A2838', padding: '20px 32px 16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#CDD5E0', margin: 0 }}>
          취재원 관계 분석
        </h1>
        <p style={{ fontSize: '13px', color: '#607898', marginTop: '4px' }}>
          취재원을 선택하면 학맥·지역·소속·기수별 인맥을 계층적으로 분석합니다
        </p>
      </div>

      {/* 검색창 */}
      <div style={{ padding: '20px 32px 0' }}>
        <div style={{ position: 'relative', maxWidth: '560px' }}>
          {/* 입력 + 검색 버튼 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#607898' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value)
                  setShowDropdown(true)
                  setSearchResults(null)
                  // 새로 타이핑하면 NL 결과도 초기화
                  setNlResults(null)
                  setNlLoading(false)
                  setNlError('')
                  setNlCandidates(null)
                }}
                onKeyDown={e => { if (e.key === 'Enter') doSearch() }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                placeholder="이름 검색 또는 '한동훈과 친한 사람' 등 자연어로 검색..."
                style={{
                  width: '100%', paddingLeft: '36px', paddingRight: '12px',
                  paddingTop: '10px', paddingBottom: '10px',
                  background: '#131C2C', border: '1px solid #1A2838',
                  borderRadius: '8px', fontSize: '14px', color: '#CDD5E0',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            {/* 검색 버튼 */}
            <button
              type="button"
              onClick={doSearch}
              style={{
                padding: '0 20px', borderRadius: '8px', flexShrink: 0,
                background: 'linear-gradient(135deg, #4A7CC0, #2A5CA0)',
                border: 'none', color: 'white', fontSize: '13px',
                fontWeight: 600, cursor: 'pointer', letterSpacing: '0.02em',
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              검색
            </button>
          </div>

          {/* 라이브 자동완성 드롭다운 (searchResults·nlResults가 없을 때만 표시) */}
          {showDropdown && filteredSources.length > 0 && !searchResults && !nlResults && !nlLoading && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: '80px', zIndex: 50,
              marginTop: '4px', background: '#131C2C',
              border: '1px solid #1A2838', borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden',
            }}>
              {filteredSources.map(s => (
                <button key={s.id} type="button" onMouseDown={() => selectSource(s.id)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid #1A2838' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(30,144,255,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#CDD5E0' }}>{s.full_name}</div>
                  {(s.current_organization || s.current_position) && (
                    <div style={{ fontSize: '12px', color: '#607898', marginTop: '2px' }}>
                      {[s.current_organization, s.current_position].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── 검색 결과 선택 패널 (Enter / 버튼 클릭 후, 일반 검색) ── */}
        {searchResults !== null && (
          <div style={{ marginTop: '14px', maxWidth: '560px' }}>
            {searchResults.length === 0 ? (
              <div style={{ padding: '20px', background: '#131C2C', border: '1px solid #1A2838', borderRadius: '10px', textAlign: 'center' }}>
                <p style={{ color: '#607898', fontSize: '13px', margin: 0 }}>
                  &ldquo;{searchQuery}&rdquo;에 해당하는 취재원이 없습니다
                </p>
              </div>
            ) : searchResults.length === 1 ? null /* 1명이면 바로 이동하므로 표시 안 함 */ : (
              <div style={{ background: '#131C2C', border: '1px solid #1A2838', borderRadius: '10px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid #1A2838', background: 'rgba(30,144,255,0.06)' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#8AAAC8' }}>
                    <span style={{ color: '#4A7CC0', fontWeight: 700 }}>{searchResults.length}명</span>이 검색되었습니다 — 분석할 취재원을 선택하세요
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {searchResults.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => selectSource(s.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '11px 16px', background: 'none', border: 'none',
                        borderBottom: i < searchResults.length - 1 ? '1px solid #1A2838' : 'none',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(30,144,255,0.07)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      {/* 아바타 */}
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(30,144,255,0.15)', color: '#4A7CC0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700,
                      }}>
                        {s.full_name[0]}
                      </div>
                      {/* 이름 + 소속 */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#CDD5E0' }}>{s.full_name}</div>
                        {(s.current_organization || s.current_position) && (
                          <div style={{ fontSize: '12px', color: '#607898', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {[s.current_organization, s.current_position].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                      {/* 화살표 */}
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M5 2.5l4.5 4.5L5 11.5" stroke="#4A7CC0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── AI 자연어 검색 결과 패널 ── */}
        {(nlLoading || nlError || nlCandidates || nlResults) && (
          <div style={{ marginTop: '14px', maxWidth: '560px', background: '#131C2C', border: '1px solid #1A2838', borderRadius: '12px', overflow: 'hidden' }}>

            {/* 패널 헤더 */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid #1A2838', background: 'rgba(30,144,255,0.06)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#8AAAC8' }}>AI 분석 결과</span>
              {/* 쿼리 배지 */}
              <span style={{
                padding: '2px 8px', borderRadius: '4px', fontSize: '11px',
                background: 'rgba(74,124,192,0.15)', color: '#7AADE0',
                border: '1px solid rgba(74,124,192,0.25)',
              }}>
                {searchQuery}
              </span>
            </div>

            {/* 로딩 */}
            {nlLoading && (
              <div style={{ padding: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
                  <circle cx="12" cy="12" r="10" stroke="#2A3848" strokeWidth="2.5"/>
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="#4A7CC0" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                <span style={{ fontSize: '13px', color: '#607898' }}>AI가 검색 의도를 분석 중입니다…</span>
              </div>
            )}

            {/* 에러 */}
            {!nlLoading && nlError && (
              <div style={{ padding: '20px', textAlign: 'center' }}>
                <p style={{ fontSize: '13px', color: '#E05050', margin: 0 }}>{nlError}</p>
              </div>
            )}

            {/* 동명이인 선택 */}
            {!nlLoading && !nlError && nlCandidates && (
              <div>
                <div style={{ padding: '10px 16px', borderBottom: '1px solid #1A2838' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#8AAAC8' }}>
                    동명이인이 있습니다 — 분석할 취재원을 선택하세요
                  </p>
                  {nlDescription && (
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#607898', fontStyle: 'italic' }}>{nlDescription}</p>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {nlCandidates.map((c, i) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectNLCandidate(c.id, c.full_name)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '12px',
                        padding: '11px 16px', background: 'none', border: 'none',
                        borderBottom: i < nlCandidates.length - 1 ? '1px solid #1A2838' : 'none',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(30,144,255,0.07)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(74,124,192,0.15)', color: '#7AADE0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700,
                      }}>
                        {c.full_name[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#CDD5E0' }}>{c.full_name}</div>
                        {(c.current_organization || c.current_position) && (
                          <div style={{ fontSize: '12px', color: '#607898', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {[c.current_organization, c.current_position].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </div>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
                        <path d="M5 2.5l4.5 4.5L5 11.5" stroke="#4A7CC0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* NL 검색 결과 */}
            {!nlLoading && !nlError && !nlCandidates && nlResults && (
              <div>
                {/* 설명 + 취재원 배지 */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #1A2838', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 700,
                    background: 'rgba(30,144,255,0.12)', color: '#4A7CC0',
                    border: '1px solid rgba(30,144,255,0.2)', flexShrink: 0,
                  }}>
                    {nlResults.sourceName}
                  </span>
                  <span style={{ fontSize: '12px', color: '#8AAAC8' }}>{nlResults.description}</span>
                </div>

                {/* 결과 없음 */}
                {nlResults.results.length === 0 && (
                  <div style={{ padding: '24px 20px', textAlign: 'center' }}>
                    <p style={{ fontSize: '13px', color: '#607898', margin: '0 0 12px' }}>
                      직접 입력된 관계가 없습니다. 취재원 관계 메뉴에서 관계를 입력해주세요.
                    </p>
                    <Link
                      href={`/analysis?id=${nlResults.sourceId}`}
                      style={{
                        display: 'inline-block', padding: '7px 16px', borderRadius: '7px',
                        fontSize: '13px', background: 'rgba(30,144,255,0.12)',
                        color: '#4A7CC0', border: '1px solid rgba(30,144,255,0.2)',
                        textDecoration: 'none',
                      }}
                    >
                      전체 프로필 분석 보기
                    </Link>
                  </div>
                )}

                {/* 결과 목록 */}
                {nlResults.results.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                    {nlResults.results.map((r, i) => (
                      <div
                        key={r.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          padding: '10px 16px',
                          borderBottom: i < nlResults.results.length - 1 ? '1px solid #1A2838' : 'none',
                        }}
                      >
                        {/* 관계 유형 배지 */}
                        <span style={{
                          padding: '2px 8px', borderRadius: '4px', fontSize: '11px', flexShrink: 0,
                          background: 'rgba(184,148,40,0.12)', color: '#C8A840',
                          border: '1px solid rgba(184,148,40,0.2)',
                        }}>
                          {r.relation_label ?? RELATION_LABELS[r.relation_type] ?? r.relation_type}
                        </span>

                        {/* 이름 (링크) */}
                        <Link
                          href={`/sources/${r.id}`}
                          style={{ color: '#B8CCDE', textDecoration: 'none', fontWeight: 600, fontSize: '14px', flexShrink: 0 }}
                        >
                          {r.full_name}
                        </Link>

                        {/* 소속·직위 */}
                        {(r.current_organization || r.current_position) && (
                          <span style={{ fontSize: '12px', color: '#607898', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                            {[r.current_organization, r.current_position].filter(Boolean).join(' · ')}
                          </span>
                        )}

                        {/* 친밀도 별 (★ 1-5) */}
                        <span style={{ marginLeft: 'auto', flexShrink: 0, display: 'flex', gap: '1px' }} aria-label={`친밀도 ${r.strength}점`}>
                          {[1, 2, 3, 4, 5].map(n => (
                            <span key={n} style={{ fontSize: '12px', color: n <= r.strength ? '#C8A840' : '#2A3848' }}>★</span>
                          ))}
                        </span>
                      </div>
                    ))}

                    {/* 전체 분석 보기 버튼 */}
                    <div style={{ padding: '12px 16px', borderTop: '1px solid #1A2838', display: 'flex', justifyContent: 'flex-end' }}>
                      <Link
                        href={`/analysis?id=${nlResults.sourceId}`}
                        style={{
                          padding: '6px 14px', borderRadius: '7px', fontSize: '13px',
                          background: 'rgba(30,144,255,0.12)', color: '#4A7CC0',
                          border: '1px solid rgba(30,144,255,0.2)', textDecoration: 'none',
                        }}
                      >
                        전체 프로필 분석 보기
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ?q=name 모드 — 취재원 DB 미등록 인물 AI 추출 결과 */}
      {queryAnalysis && !selectedId && (
        <div style={{ padding: '20px 32px 48px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: 'rgba(100,70,200,0.06)', border: '1px solid rgba(100,70,200,0.2)',
            borderRadius: '12px', padding: '16px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <span style={{ fontSize: '18px' }}>🤖</span>
              <h2 style={{ fontSize: '17px', fontWeight: 700, color: '#CDD5E0', margin: 0 }}>
                "{queryAnalysis.queryName}"
              </h2>
              <span style={{
                fontSize: '11px', fontWeight: 600,
                background: 'rgba(100,70,200,0.15)', color: '#9B7DE8',
                border: '1px solid rgba(100,70,200,0.3)',
                borderRadius: '4px', padding: '1px 7px',
              }}>
                AI 추출 관계망
              </span>
            </div>
            <p style={{ fontSize: '12px', color: '#607898', margin: 0 }}>
              취재원 DB 미등록 인물 · 보고서 본문에서 AI가 추출한 관계입니다
            </p>
          </div>

          {queryAnalysis.directRelations.length > 0 && (
            <SectionCard title="🔗 추출된 관계">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {queryAnalysis.directRelations.map((r, i) => {
                  const isFrom = r.fromName.toLowerCase().includes(queryAnalysis.queryName.toLowerCase())
                  const other  = isFrom ? r.toName : r.fromName
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      background: '#182035', borderRadius: '6px', padding: '8px 12px',
                      border: '1px solid #1A2838', fontSize: '12px', flexWrap: 'wrap',
                    }}>
                      <span style={{ fontWeight: 700, color: '#9B7DE8' }}>{queryAnalysis.queryName}</span>
                      <span style={{ color: '#3A4A5E' }}>—</span>
                      <span style={{
                        fontSize: '10px', fontWeight: 700,
                        background: 'rgba(100,70,200,0.12)', color: '#9B7DE8',
                        border: '1px solid rgba(100,70,200,0.28)',
                        borderRadius: '4px', padding: '1px 6px',
                      }}>{r.relType}</span>
                      <span style={{ color: '#3A4A5E' }}>—</span>
                      <button
                        type="button"
                        onClick={() => router.push(`/analysis?q=${encodeURIComponent(other)}`)}
                        style={{
                          fontWeight: 700, color: '#CDD5E0', background: 'none', border: 'none',
                          cursor: 'pointer', padding: 0, fontSize: '12px',
                          textDecoration: 'underline', textDecorationColor: 'rgba(74,124,192,0.4)',
                        }}
                      >
                        {other}
                      </button>
                      {r.detail && (
                        <span style={{ fontSize: '10px', color: '#5A7099', marginLeft: 'auto' }}>{r.detail}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </SectionCard>
          )}

          {queryAnalysis.coEntities.length > 0 && (
            <SectionCard title="👥 같은 보고서에 등장한 인물">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
                {queryAnalysis.coEntities.map((e, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => router.push(`/analysis?q=${encodeURIComponent(e.name)}`)}
                    style={{
                      background: '#182035', border: '1px solid #1A2838',
                      color: '#CDD5E0', borderRadius: '7px', padding: '6px 12px',
                      fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '5px',
                    }}
                    onMouseEnter={e2 => (e2.currentTarget.style.borderColor = '#4A7CC0')}
                    onMouseLeave={e2 => (e2.currentTarget.style.borderColor = '#1A2838')}
                  >
                    {e.name}
                    {e.role && <span style={{ fontSize: '10px', color: '#607898' }}>({e.role})</span>}
                    <span style={{
                      fontSize: '10px', background: 'rgba(100,70,200,0.12)', color: '#8060C0',
                      borderRadius: '3px', padding: '0 4px',
                    }}>{e.reportCount}건</span>
                  </button>
                ))}
              </div>
            </SectionCard>
          )}

          {queryAnalysis.directRelations.length === 0 && queryAnalysis.coEntities.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#607898', fontSize: '13px' }}>
              보고서 내 AI 추출 관계 데이터가 없습니다.<br />
              정보보고 저장 시 자동으로 추출됩니다.
            </div>
          )}
        </div>
      )}

      {/* 빈 상태 */}
      {!analysisData && !queryAnalysis && !searchResults && !nlResults && !nlLoading && !nlCandidates && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 32px', gap: '12px' }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="20" cy="20" r="13" stroke="#2A3848" strokeWidth="2.5"/>
            <path d="M31 31L42 42" stroke="#2A3848" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M14 20h12M20 14v12" stroke="#2A3848" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p style={{ fontSize: '15px', color: '#607898', textAlign: 'center', lineHeight: 1.7 }}>
            취재원을 검색해서 선택하면<br />계층형 관계 분석 결과가 표시됩니다
          </p>
        </div>
      )}

      {/* 분석 결과 */}
      {analysisData && src && (
        <div style={{ padding: '20px 32px 48px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* 기본 정보 카드 */}
          <div style={{ background: '#131C2C', border: '1px solid #1A2838', borderRadius: '12px', padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#CDD5E0', margin: 0 }}>{src.full_name}</h2>
                {(src.current_organization || src.current_position) && (
                  <p style={{ fontSize: '14px', color: '#8AAAC8', marginTop: '4px' }}>
                    {[src.current_organization, src.current_position].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <Link href={`/sources/${src.id}`}
                style={{ padding: '6px 14px', borderRadius: '7px', fontSize: '13px', background: 'rgba(30,144,255,0.12)', color: '#4A7CC0', border: '1px solid rgba(30,144,255,0.2)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                전체 프로필 보기
              </Link>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
              {src.phone_primary && <InfoChip label={src.phone_primary} />}
              {src.email_primary && <InfoChip label={src.email_primary} />}
              {src.university && <InfoChip label={src.university + (src.university_major ? ` ${src.university_major}` : '') + (src.university_year ? ` ${src.university_year}학번` : '')} accent />}
              {src.high_school && <InfoChip label={src.high_school + (src.high_school_year ? ` ${src.high_school_year}학번` : '')} accent />}
              {src.exam_batch && <InfoChip label={src.exam_batch} accent />}
              {src.hometown_province && <InfoChip label={src.hometown_province + (src.hometown_city ? ` ${src.hometown_city}` : '')} />}
            </div>
            {src.tags && src.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                {src.tags.map((tag: string) => (
                  <span key={tag} style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', background: 'rgba(30,144,255,0.08)', color: '#6A9AC8', border: '1px solid rgba(30,144,255,0.15)' }}>{tag}</span>
                ))}
              </div>
            )}
            {src.affiliations && src.affiliations.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                {src.affiliations.map((aff: string) => (
                  <span key={aff} style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', background: 'rgba(61,158,106,0.08)', color: '#4DAA82', border: '1px solid rgba(61,158,106,0.2)' }}>🤝 {aff}</span>
                ))}
              </div>
            )}
          </div>

          {/* 인맥 분석 */}
          <SectionCard title="인맥 분석">

            {/* 소속 동료 — 단순 목록 */}
            <FlatGroup
              label="소속 동료"
              groupKey={src.current_organization}
              items={analysisData.sameOrg}
              renderItem={(s: any) => <PersonRow key={s.id} id={s.id} name={s.full_name} sub={s.current_position} />}
            />

            {/* 대학 동문 — 학과 > 학번 */}
            <DrillGroup
              label="대학 동문"
              topKey={src.university}
              items={analysisData.sameUniversity}
              getSubKey={(s: any) => s.university_major || '전공 미입력'}
              renderItem={(s: any) => (
                <PersonRow key={s.id} id={s.id} name={s.full_name}
                  sub={s.current_organization || s.current_position || ''}
                  badge={s.university_year ? `${s.university_year}학번` : undefined} />
              )}
            />

            {/* 고교 동문 — 학번별 */}
            <DrillGroup
              label="고교 동문"
              topKey={src.high_school}
              items={analysisData.sameHighSchool}
              getSubKey={(s: any) => s.high_school_year ? `${s.high_school_year}학번` : '학번 미입력'}
              renderItem={(s: any) => (
                <PersonRow key={s.id} id={s.id} name={s.full_name}
                  sub={s.current_organization || s.current_position || ''} />
              )}
            />

            {/* 시험·기수 — 기수별 */}
            <DrillGroup
              label="시험 · 기수"
              topKey={analysisData.examType ?? src.exam_batch}
              items={analysisData.sameExam}
              getSubKey={(s: any) => {
                if (!s.exam_batch) return '미입력'
                if (analysisData.examType) {
                  const prefix = analysisData.examType + ' '
                  return s.exam_batch.startsWith(prefix) ? s.exam_batch.slice(prefix.length) : s.exam_batch
                }
                return s.exam_batch
              }}
              renderItem={(s: any) => (
                <PersonRow key={s.id} id={s.id} name={s.full_name}
                  sub={s.current_organization || s.current_position || ''} />
              )}
            />

            {/* 출신 지역 — 시·군·구별 */}
            <DrillGroup
              label="출신 지역"
              topKey={src.hometown_province}
              items={analysisData.sameTown}
              getSubKey={(s: any) => s.hometown_city || '시/구 미입력'}
              renderItem={(s: any) => (
                <PersonRow key={s.id} id={s.id} name={s.full_name}
                  sub={s.current_organization || s.current_position || ''} />
              )}
            />

            {/* 동호회·단체 — 단체별 */}
            <DrillGroup
              label="동호회 · 단체"
              topKey={src.affiliations?.length > 0 ? src.affiliations.join(', ') : null}
              items={analysisData.sameAffiliation}
              getSubKey={(s: any) => {
                const shared = (s.affiliations ?? []).filter((a: string) => src.affiliations?.includes(a))
                return shared.length > 0 ? shared.join(' · ') : '기타'
              }}
              renderItem={(s: any) => (
                <PersonRow key={s.id} id={s.id} name={s.full_name}
                  sub={s.current_organization || s.current_position || ''} />
              )}
            />

          </SectionCard>

          {/* 정보보고 언급 */}
          {(analysisData.reportMentions.length > 0 || analysisData.coMentionedViaReports.length > 0) && (
            <SectionCard title="📰 정보보고 언급">
              {analysisData.reportMentions.map(mention => (
                <ReportMentionCard key={mention.id} mention={mention} sourceName={src.full_name} />
              ))}

              {analysisData.coMentionedViaReports.length > 0 && (
                <div style={{
                  marginTop: analysisData.reportMentions.length > 0 ? '12px' : '0',
                  paddingTop: analysisData.reportMentions.length > 0 ? '12px' : '0',
                  borderTop: analysisData.reportMentions.length > 0 ? '1px solid #1A2838' : 'none',
                }}>
                  <p style={{ fontSize: '12px', color: '#8AAAC8', fontWeight: 600, marginBottom: '8px' }}>
                    같은 보고서에 함께 언급된 인물
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {analysisData.coMentionedViaReports.map(({ source: s, reportCount }) => (
                      <PersonRow
                        key={s.id}
                        id={s.id}
                        name={s.full_name}
                        sub={[s.current_organization, s.current_position].filter(Boolean).join(' · ')}
                        badge={`보고서 ${reportCount}건`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {/* AI 추출 관계망 (보고서 본문 기반) */}
          {((analysisData.extractedDirectRelations?.length ?? 0) > 0 ||
            (analysisData.extractedCoEntities?.length ?? 0) > 0) && (
            <SectionCard title="🤖 AI 추출 관계망 (보고서 본문 기반)">
              {/* 직접 관계 */}
              {(analysisData.extractedDirectRelations?.length ?? 0) > 0 && (
                <div style={{ marginBottom: (analysisData.extractedCoEntities?.length ?? 0) > 0 ? '14px' : '0' }}>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: '#7A60C0', marginBottom: '8px', letterSpacing: '0.05em' }}>
                    관계망
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {analysisData.extractedDirectRelations!.map((r, i) => {
                      const isSrc = r.fromName.includes(src.full_name) || src.full_name.includes(r.fromName)
                      const otherName = isSrc ? r.toName : r.fromName
                      return (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          background: '#182035', borderRadius: '6px', padding: '7px 10px',
                          border: '1px solid #1A2838', fontSize: '12px',
                        }}>
                          <span style={{ fontWeight: 700, color: '#4A7CC0', flexShrink: 0 }}>{src.full_name}</span>
                          <span style={{ color: '#3A4A5E' }}>—</span>
                          <span style={{
                            fontSize: '10px', fontWeight: 700,
                            background: 'rgba(100,70,200,0.12)', color: '#9B7DE8',
                            border: '1px solid rgba(100,70,200,0.28)',
                            borderRadius: '4px', padding: '1px 6px', flexShrink: 0,
                          }}>{r.relType}</span>
                          <span style={{ color: '#3A4A5E' }}>—</span>
                          <button
                            type="button"
                            onClick={() => router.push(`/analysis?q=${encodeURIComponent(otherName)}`)}
                            style={{
                              fontWeight: 700, color: '#CDD5E0', background: 'none', border: 'none',
                              cursor: 'pointer', padding: 0, fontSize: '12px',
                              textDecoration: 'underline', textDecorationColor: 'rgba(74,124,192,0.4)',
                            }}
                          >
                            {otherName}
                          </button>
                          {r.detail && (
                            <span style={{ fontSize: '10px', color: '#5A7099', marginLeft: 'auto', textAlign: 'right' }}>
                              {r.detail}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              {/* 함께 언급된 인물 (보고서 내 co-entity) */}
              {(analysisData.extractedCoEntities?.length ?? 0) > 0 && (
                <>
                  <p style={{ fontSize: '11px', fontWeight: 600, color: '#7A60C0', marginBottom: '8px', letterSpacing: '0.05em' }}>
                    같은 보고서에 등장한 인물
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {analysisData.extractedCoEntities!.map((e, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => router.push(`/analysis?q=${encodeURIComponent(e.name)}`)}
                        style={{
                          background: 'rgba(100,70,200,0.08)', border: '1px solid rgba(100,70,200,0.22)',
                          color: '#9B7DE8', borderRadius: '6px', padding: '4px 10px',
                          fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: '5px',
                        }}
                      >
                        {e.name}
                        {e.role && <span style={{ fontSize: '10px', opacity: 0.7 }}>({e.role})</span>}
                        <span style={{
                          fontSize: '10px', background: 'rgba(100,70,200,0.15)',
                          borderRadius: '3px', padding: '0 4px', color: '#8060C0',
                        }}>{e.reportCount}건</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </SectionCard>
          )}

          {/* 직접 입력 관계 */}
          {analysisData.relationships.length > 0 && (
            <SectionCard title="직접 입력 관계">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {analysisData.relationships.map((rel: any) => {
                  const isA = rel.source_a_id === src.id
                  const other = isA ? rel.source_b : rel.source_a
                  if (!other) return null
                  return (
                    <div key={rel.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#0D1520', borderRadius: '7px', border: '1px solid #1A2838' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', background: 'rgba(184,148,40,0.12)', color: '#C8A840', border: '1px solid rgba(184,148,40,0.2)', flexShrink: 0 }}>
                        {RELATION_LABELS[rel.relation_type] ?? rel.relation_type}
                      </span>
                      <Link href={`/sources/${other.id}`} style={{ color: '#B8CCDE', textDecoration: 'none', fontWeight: 600, fontSize: '14px' }}>
                        {other.full_name}
                      </Link>
                      {other.current_organization && (
                        <span style={{ fontSize: '12px', color: '#607898' }}>
                          {other.current_organization}{other.current_position ? ` · ${other.current_position}` : ''}
                        </span>
                      )}
                      {rel.relation_label && (
                        <span style={{ fontSize: '11px', color: '#607898', marginLeft: 'auto', fontStyle: 'italic' }}>&ldquo;{rel.relation_label}&rdquo;</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </SectionCard>
          )}

          {/* 등록 현황 */}
          <SectionCard title="등록 현황">
            {analysisData.registrants.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#607898' }}>등록 정보 없음</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {analysisData.registrants.map((r: any, i: number) => {
                  const p = r.profiles
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#0D1520', borderRadius: '7px', border: '1px solid #1A2838' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#B8CCDE' }}>{p?.full_name ?? '알 수 없음'}</span>
                      {p?.department && <span style={{ fontSize: '12px', color: '#607898' }}>{p.department}</span>}
                      <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', background: r.visibility === 'shared' ? 'rgba(56,200,184,0.1)' : 'rgba(255,255,255,0.06)', color: r.visibility === 'shared' ? '#38C8B8' : '#607898', border: `1px solid ${r.visibility === 'shared' ? 'rgba(56,200,184,0.25)' : 'rgba(255,255,255,0.1)'}` }}>
                        {r.visibility === 'shared' ? '공개' : '개인'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

        </div>
      )}
    </div>
  )
}

function ReportMentionCard({ mention, sourceName }: {
  mention: AnalysisData['reportMentions'][0]
  sourceName: string
}) {
  return (
    <div style={{
      background: '#0D1520', border: '1px solid #1A2838', borderRadius: '8px',
      padding: '12px 14px', marginBottom: '8px',
    }}>
      {/* Title + date */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
        <a
          href={`/reports/${mention.id}`}
          style={{ fontSize: '13px', fontWeight: 600, color: '#B8CCDE', textDecoration: 'none', flex: 1, lineHeight: 1.4 }}
          onMouseEnter={e => (e.currentTarget.style.color = '#4A7CC0')}
          onMouseLeave={e => (e.currentTarget.style.color = '#B8CCDE')}
        >
          {mention.title}
        </a>
        <span style={{ fontSize: '11px', color: '#607898', flexShrink: 0 }}>
          {new Date(mention.created_at).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })}
        </span>
      </div>

      {/* Author */}
      {mention.authorName && (
        <p style={{ fontSize: '11px', color: '#607898', marginTop: '3px' }}>
          {mention.authorName}{mention.authorDept ? ` · ${mention.authorDept}` : ''}
        </p>
      )}

      {/* Content snippet (regular content match) */}
      {mention.contentSnippet && (
        <div style={{ marginTop: '8px', fontSize: '12px', lineHeight: 1.8, color: '#8AAAC8', background: 'rgba(255,255,255,0.02)', borderRadius: '5px', padding: '6px 8px' }}>
          <span>{mention.contentSnippet.before}</span>
          <mark style={{
            background: 'rgba(200,168,64,0.2)', color: '#D4A840',
            padding: '0 3px', borderRadius: '3px', fontWeight: 600,
          }}>
            {mention.contentSnippet.match}
          </mark>
          <span>{mention.contentSnippet.after}</span>
        </div>
      )}

      {/* Sensitive content match */}
      {mention.hasSensitiveMatch && (
        <div style={{
          marginTop: '8px', padding: '8px 10px',
          background: 'rgba(255,153,0,0.05)', border: '1px solid rgba(255,153,0,0.18)',
          borderRadius: '6px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#A87228', letterSpacing: '0.03em', flexShrink: 0 }}>
              🔒 민감정보
            </span>
            <div style={{ flex: 1, minWidth: 0, fontSize: '12px', lineHeight: 1.8, userSelect: mention.canSeeSensitive ? 'auto' : 'none' }}>
              <span style={{
                color: '#A87228',
                filter: mention.canSeeSensitive ? 'none' : 'blur(5px)',
                display: 'inline',
              }}>
                {mention.sensitiveSnippet?.before}
              </span>
              <mark style={{
                background: 'rgba(200,168,64,0.2)', color: '#D4A840',
                padding: '0 3px', borderRadius: '3px', fontWeight: 600,
                filter: 'none',
              }}>
                {mention.sensitiveSnippet?.match ?? sourceName}
              </mark>
              <span style={{
                color: '#A87228',
                filter: mention.canSeeSensitive ? 'none' : 'blur(5px)',
                display: 'inline',
              }}>
                {mention.sensitiveSnippet?.after}
              </span>
            </div>
            {!mention.canSeeSensitive && (
              <a
                href={`/reports/${mention.id}`}
                style={{
                  flexShrink: 0, padding: '4px 12px', borderRadius: '6px',
                  fontSize: '11px', fontWeight: 600,
                  background: 'rgba(255,153,0,0.12)', color: '#C88A20',
                  border: '1px solid rgba(255,153,0,0.28)', textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                열람 신청
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── 서브 컴포넌트들 ───────────────────────────────────────────────────────────

function InfoChip({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', background: accent ? 'rgba(30,144,255,0.08)' : '#0D1520', color: accent ? '#6A9AC8' : '#8AAAC8', border: accent ? '1px solid rgba(30,144,255,0.18)' : '1px solid #1A2838' }}>
      {label}
    </span>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#131C2C', border: '1px solid #1A2838', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #1A2838' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#B8CCDE' }}>{title}</h3>
      </div>
      <div style={{ padding: '14px 20px' }}>{children}</div>
    </div>
  )
}

function PersonRow({ id, name, sub, badge }: { id: string; name: string; sub?: string; badge?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px', background: '#0D1520', borderRadius: '6px', border: '1px solid #1A2838' }}>
      <Link href={`/sources/${id}`} style={{ fontSize: '13px', fontWeight: 600, color: '#B8CCDE', textDecoration: 'none', flexShrink: 0 }}>
        {name}
      </Link>
      {sub && <span style={{ fontSize: '11px', color: '#607898', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>}
      {badge && (
        <span style={{ marginLeft: 'auto', flexShrink: 0, padding: '1px 7px', borderRadius: '4px', fontSize: '10px', background: 'rgba(0,212,255,0.08)', color: '#3A90A8', border: '1px solid rgba(0,212,255,0.15)' }}>
          {badge}
        </span>
      )}
    </div>
  )
}

// 단순 목록 (소속 동료 등 — 드릴다운 없음)
function FlatGroup({ label, groupKey, items, renderItem }: {
  label: string; groupKey: string | null; items: any[]; renderItem: (s: any) => React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <GroupRow
      label={label} groupKey={groupKey} count={items.length}
      expanded={expanded} onToggle={() => setExpanded(p => !p)}
    >
      {expanded && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', paddingLeft: '100px' }}>
          {items.map(renderItem)}
        </div>
      )}
      {expanded && items.length === 0 && (
        <p style={{ fontSize: '12px', color: '#3A4A5E', paddingLeft: '100px', marginTop: '4px' }}>해당 없음</p>
      )}
    </GroupRow>
  )
}

// 드릴다운 그룹 (대학/고교/지역/기수 — 서브그룹 존재)
function DrillGroup({ label, topKey, items, getSubKey, renderItem }: {
  label: string; topKey: string | null; items: any[]
  getSubKey: (s: any) => string; renderItem: (s: any) => React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set())

  const subGroups = useMemo(() => {
    const map = new Map<string, any[]>()
    for (const s of items) {
      const k = getSubKey(s)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(s)
    }
    return sortedSubGroups(map)
  }, [items, getSubKey])

  const toggleSub = useCallback((key: string) => {
    setExpandedSubs(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }, [])

  const isSingleGroup = subGroups.length <= 1

  return (
    <GroupRow
      label={label} groupKey={topKey} count={items.length}
      expanded={expanded} onToggle={() => setExpanded(p => !p)}
    >
      {expanded && items.length === 0 && (
        <p style={{ fontSize: '12px', color: '#3A4A5E', paddingLeft: '100px', marginTop: '4px' }}>해당 없음</p>
      )}

      {expanded && items.length > 0 && isSingleGroup && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', paddingLeft: '100px' }}>
          {items.map(renderItem)}
        </div>
      )}

      {expanded && items.length > 0 && !isSingleGroup && (
        <div style={{ marginTop: '6px', paddingLeft: '100px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {subGroups.map(([subKey, subItems]) => (
            <div key={subKey}>
              <button
                type="button"
                onClick={() => toggleSub(subKey)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid #1A2838', borderRadius: '6px', cursor: 'pointer', padding: '5px 10px', marginBottom: '3px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#8AAAC8' }}>{subKey}</span>
                <span style={{ fontSize: '11px', color: '#4A7CC0', marginLeft: '4px' }}>{subItems.length}명</span>
                <span style={{ fontSize: '10px', color: '#607898', marginLeft: 'auto' }}>
                  {expandedSubs.has(subKey) ? '▲' : '▼'}
                </span>
              </button>
              {expandedSubs.has(subKey) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginLeft: '12px', marginBottom: '6px' }}>
                  {subItems.map(renderItem)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </GroupRow>
  )
}

// 그룹 헤더 행 (공통)
function GroupRow({ label, groupKey, count, expanded, onToggle, children }: {
  label: string; groupKey: string | null; count: number
  expanded: boolean; onToggle: () => void; children?: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <button
        type="button"
        onClick={groupKey ? onToggle : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', background: 'none', border: 'none', cursor: groupKey ? 'pointer' : 'default', padding: '4px 0', textAlign: 'left' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#8AAAC8', minWidth: '90px', flexShrink: 0 }}>{label}</span>
        {groupKey ? (
          <>
            <span style={{ padding: '2px 8px', borderRadius: '5px', fontSize: '12px', background: '#0D1520', color: '#B8CCDE', border: '1px solid #1A2838', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {groupKey}
            </span>
            <span style={{ fontSize: '11px', color: count > 0 ? '#4A7CC0' : '#3A4A5E' }}>
              {count > 0 ? `${count}명` : '없음'}
            </span>
            {count > 0 && (
              <span style={{ fontSize: '10px', color: '#607898', marginLeft: 'auto' }}>{expanded ? '▲' : '▼'}</span>
            )}
          </>
        ) : (
          <span style={{ fontSize: '11px', color: '#3A4A5E' }}>정보 없음</span>
        )}
      </button>
      {children}
    </div>
  )
}
