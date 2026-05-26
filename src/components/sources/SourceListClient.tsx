'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect, useMemo, useTransition, useCallback, type CSSProperties } from 'react'

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

interface Source {
  id: string
  full_name: string
  current_organization: string | null
  current_position: string | null
  phone_primary: string | null
  email_primary: string | null
  visibility: 'personal' | 'shared'
  sensitivity: 'public' | 'private'
  completeness_score: number
  tags: string[]
  exam_batch: string | null
  updated_at: string
  owner_id: string
  profiles?: { full_name: string } | null
}

interface Props {
  initialSources: Source[]
  totalCount: number
  currentFilter: 'all' | 'mine'
  currentQuery: string
  currentPage: number
  pageSize: number
  userId: string
  currentTag?: string
}

type BulkAction = 'delete' | 'set_visibility' | 'add_tag' | 'remove_tag' | null

export default function SourceListClient({
  initialSources,
  totalCount,
  currentFilter,
  currentQuery,
  currentPage,
  pageSize,
  userId,
  currentTag = '',
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [searchInput, setSearchInput] = useState(currentQuery)

  // ── AI 검색 상태 ──────────────────────────────────────────────────
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResults, setAiResults] = useState<typeof initialSources | null>(null)
  const [aiIntent, setAiIntent] = useState('')
  const [aiExpandedTerms, setAiExpandedTerms] = useState<string[]>([])
  const [aiError, setAiError] = useState('')

  // ── 대량 작업 상태 ──────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkAction, setBulkAction] = useState<BulkAction>(null)
  const [tagInput, setTagInput] = useState('')

  const totalPages = Math.ceil(totalCount / pageSize)

  // ── currentQuery 변경 시 자동 AI 검색 ──────────────────────────────
  useEffect(() => {
    if (!currentQuery.trim()) {
      setAiResults(null)
      setAiIntent('')
      setAiExpandedTerms([])
      return
    }
    setAiLoading(true)
    setAiError('')
    fetch('/api/sources/search-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: currentQuery }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.error) { setAiError(data.error); return }
        setAiResults(data.sources ?? [])
        setAiIntent(data.intent ?? '')
        setAiExpandedTerms(data.expandedTerms ?? [])
      })
      .catch(() => setAiError('AI 검색 오류'))
      .finally(() => setAiLoading(false))
  }, [currentQuery])

  // ── 표시할 목록: 서버 결과 + AI 추가 결과 합집합 ─────────────────────
  const displayedSources = useMemo(() => {
    if (!currentQuery.trim()) return initialSources
    if (!aiResults) return initialSources
    const ids = new Set(initialSources.map(s => s.id))
    const extra = aiResults.filter(s => !ids.has(s.id))
    return [...initialSources, ...extra]
  }, [initialSources, aiResults, currentQuery])

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams()
    if (params.filter && params.filter !== 'all') sp.set('filter', params.filter)
    if (params.q) sp.set('q', params.q)
    if (params.page && params.page !== '1') sp.set('page', params.page)
    if (params.tag) sp.set('tag', params.tag)
    startTransition(() => router.push(`${pathname}?${sp.toString()}`))
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    navigate({ filter: currentFilter, q: searchInput, page: '1' })
  }

  // ── 체크박스 핸들러 ────────────────────────────────────────────────
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    if (selectedIds.size === displayedSources.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(displayedSources.map(s => s.id)))
    }
  }, [selectedIds.size, displayedSources])

  // ── 대량 작업 실행 ─────────────────────────────────────────────────
  async function executeBulk(action: string, value?: string) {
    if (selectedIds.size === 0) return
    setBulkLoading(true)
    try {
      const res = await fetch('/api/sources/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids: Array.from(selectedIds), value }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error ?? '오류가 발생했습니다')
      } else {
        setSelectedIds(new Set())
        setBulkAction(null)
        setTagInput('')
        startTransition(() => router.refresh())
      }
    } catch {
      alert('네트워크 오류가 발생했습니다')
    } finally {
      setBulkLoading(false)
    }
  }

  function confirmBulkDelete() {
    if (!confirm(`선택한 ${selectedIds.size}명의 취재원을 삭제하시겠습니까?\n(본인이 등록한 취재원만 삭제됩니다)`)) return
    executeBulk('delete')
  }

  const scoreColor = (score: number) =>
    score >= 90 ? '#3D9E6A' : score >= 60 ? '#A87228' : '#C04040'

  const allSelected = displayedSources.length > 0 && selectedIds.size === displayedSources.length
  const someSelected = selectedIds.size > 0

  return (
    <div className="space-y-4">
      {/* 필터 + 검색 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* 검색폼 — 탭보다 위 */}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="이름, 소속, 직책 등으로 검색..."
            style={{
              flex: 1,
              background: '#131C2C',
              border: '1px solid #1A2838',
              color: '#CDD5E0',
              borderRadius: '8px',
              padding: '9px 12px',
              fontSize: '14px',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{ background: '#4A7CC0', color: 'white', border: 'none', borderRadius: 8, padding: '9px 14px', fontSize: 14, fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>
            검색
          </button>
          {currentQuery && (
            <button
              type="button"
              onClick={() => { setSearchInput(''); navigate({ filter: currentFilter, page: '1' }) }}
              style={{ background: '#182035', color: '#8AAAC8', border: '1px solid #1A2838', borderRadius: 8, padding: '9px 12px', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
              초기화
            </button>
          )}
          {aiLoading && currentQuery && (
            <span style={{ fontSize: '11px', color: '#9060B0', whiteSpace: 'nowrap', alignSelf: 'center' }}>
              ✨ AI 검색 중…
            </span>
          )}
        </form>

        {/* 탭 + 총 명수 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="flex rounded-lg p-1" style={{ background: '#131C2C', border: '1px solid #1A2838' }}>
            {[
              { value: 'all', label: '전체' },
              { value: 'mine', label: '내가 등록' },
            ].map(t => (
              <button
                key={t.value}
                onClick={() => navigate({ filter: t.value, q: currentQuery, page: '1' })}
                className="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
                style={{
                  background: currentFilter === t.value ? '#4A7CC0' : 'transparent',
                  color: currentFilter === t.value ? 'white' : '#8AAAC8',
                  border: 'none',
                  cursor: 'pointer',
                }}>
                {t.label}
              </button>
            ))}
          </div>
          <span className="text-sm flex-shrink-0" style={{ color: '#607898' }}>
            총 {totalCount.toLocaleString()}명
          </span>
        </div>

        {currentTag && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#607898' }}>태그 필터:</span>
            <span style={{
              fontSize: 12, padding: '3px 10px', borderRadius: 99, fontWeight: 600,
              background: 'rgba(30,144,255,0.15)', color: '#4A7CC0', border: '1px solid rgba(30,144,255,0.35)',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              🏷️ {currentTag}
              <button type="button"
                onClick={() => navigate({ filter: currentFilter, q: currentQuery, page: '1' })}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4A7CC0', fontSize: 14, lineHeight: 1, padding: 0 }}>
                ×
              </button>
            </span>
          </div>
        )}
      </div>

      {/* AI 검색 배너 */}
      {aiIntent && currentQuery && (
        <div style={{
          padding: '10px 14px', borderRadius: '10px', marginBottom: '12px',
          background: 'rgba(147,51,234,0.08)', border: '1px solid rgba(147,51,234,0.25)',
        }}>
          <p style={{ fontSize: '12px', color: '#C084FC', margin: 0 }}>
            ✨ AI 검색: {aiIntent}
            {aiExpandedTerms.length > 0 && (
              <span style={{ color: '#9060B0', marginLeft: '8px' }}>
                → {aiExpandedTerms.join(', ')}
              </span>
            )}
          </p>
          {aiError && <p style={{ fontSize: '12px', color: '#C04040', marginTop: '4px' }}>{aiError}</p>}
        </div>
      )}

      {/* 목록 */}
      {isPending ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: '#1A2838', borderTopColor: '#4A7CC0' }} />
        </div>
      ) : displayedSources.length > 0 ? (
        <div className="glass-card overflow-hidden">
          {/* 데스크톱 테이블 헤더 */}
          <div className="source-table-header"
            style={{ background: '#182035', color: '#607898', borderBottom: '1px solid #1A2838' }}>
            {/* 전체 선택 체크박스 */}
            <div style={{ width: 36, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => { if (el) el.indeterminate = !allSelected && someSelected }}
                onChange={toggleAll}
                style={{ cursor: 'pointer', accentColor: '#4A7CC0' }}
                title="전체 선택/해제"
              />
            </div>
            <div style={{ flex: '3 1 0' }}>이름 / 소속</div>
            <div style={{ flex: '2 1 0' }}>직책</div>
            <div style={{ flex: '2 1 0' }}>연락처</div>
            <div style={{ flex: '2 1 0' }}>태그</div>
            <div style={{ flex: '1 1 0', textAlign: 'center' }}>완성도</div>
            <div style={{ flex: '1 1 0', textAlign: 'center' }}>민감도</div>
          </div>

          {displayedSources.map(source => {
            const isMine = source.owner_id === userId
            const isChecked = selectedIds.has(source.id)
            return (
              <div
                key={source.id}
                style={{
                  display: 'flex', alignItems: 'stretch',
                  borderBottom: '1px solid #1A2838',
                  background: isChecked ? 'rgba(74,124,192,0.07)' : 'transparent',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => { if (!isChecked) (e.currentTarget as HTMLElement).style.background = '#182035' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isChecked ? 'rgba(74,124,192,0.07)' : 'transparent' }}>

                {/* 체크박스 셀 */}
                <label
                  onClick={e => e.stopPropagation()}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 10px', cursor: 'pointer', flexShrink: 0, width: 36 }}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSelect(source.id)}
                    style={{ cursor: 'pointer', accentColor: '#4A7CC0' }}
                  />
                </label>

                {/* 행 콘텐츠 — a 하드 네비게이션 (Next.js 클라이언트 라우팅 우회, 이전 페이지 잔상 방지) */}
                <a
                  href={`/sources/${source.id}`}
                  className="source-list-row"
                  style={{ flex: 1, color: 'inherit', textDecoration: 'none', display: 'block' }}>

                  {/* 모바일 카드 뷰 */}
                  <div className="source-card-mobile">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(30,144,255,0.15)', color: '#4A7CC0',
                        fontSize: 14, fontWeight: 700,
                      }}>
                        {source.full_name[0]}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <p style={{ color: '#CDD5E0', fontWeight: 600, fontSize: 14, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Highlight text={source.full_name} query={currentQuery} />
                          </p>
                          {isMine && (
                            <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, flexShrink: 0, background: 'rgba(74,124,192,0.15)', color: '#4A7CC0', border: '1px solid rgba(74,124,192,0.25)' }}>
                              내 등록
                            </span>
                          )}
                        </div>
                        <p style={{ color: '#8AAAC8', fontSize: 12, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {source.current_organization
                            ? <><Highlight text={source.current_organization} query={currentQuery} />{source.current_position ? <> · <Highlight text={source.current_position} query={currentQuery} /></> : ''}</>
                            : <>{'—'}{source.current_position ? <> · <Highlight text={source.current_position} query={currentQuery} /></> : ''}</>
                          }
                        </p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(source.completeness_score) }}>
                          {source.completeness_score}점
                        </span>
                        <span className={`sensitivity-${source.sensitivity}`}
                          style={{ fontSize: 11, padding: '1px 6px', borderRadius: 99 }}>
                          {source.sensitivity === 'private' ? '🔒 민감' : '일반'}
                        </span>
                      </div>
                    </div>
                    {(source.phone_primary || source.email_primary || source.exam_batch || source.tags.length > 0) && (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                        {source.phone_primary && (
                          <span style={{ fontSize: 11, color: '#8AAAC8' }}>{source.phone_primary}</span>
                        )}
                        {source.exam_batch && (
                          <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'rgba(0,212,255,0.1)', color: '#3A90A8' }}>
                            {source.exam_batch}
                          </span>
                        )}
                        {source.tags.slice(0, 3).map(t => (
                          <span key={t}
                            onClick={e => { e.preventDefault(); e.stopPropagation(); navigate({ filter: currentFilter, q: currentQuery, page: '1', tag: t }) }}
                            style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'rgba(30,144,255,0.1)', color: '#4A7CC0', cursor: 'pointer' }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 데스크톱 테이블 뷰 */}
                  <div className="source-row-desktop">
                    {/* 이름/소속 */}
                    <div style={{ flex: '3 1 0', display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'rgba(30,144,255,0.15)', color: '#4A7CC0',
                        fontSize: 11, fontWeight: 700,
                      }}>
                        {source.full_name[0]}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <p style={{ color: '#CDD5E0', fontWeight: 600, fontSize: 14, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <Highlight text={source.full_name} query={currentQuery} />
                          </p>
                          {isMine && (
                            <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, flexShrink: 0, background: 'rgba(74,124,192,0.15)', color: '#4A7CC0', border: '1px solid rgba(74,124,192,0.25)' }}>
                              내 등록
                            </span>
                          )}
                        </div>
                        <p style={{ color: '#8AAAC8', fontSize: 11, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {source.current_organization
                            ? <Highlight text={source.current_organization} query={currentQuery} />
                            : '—'
                          }
                        </p>
                      </div>
                    </div>
                    {/* 직책 */}
                    <div style={{ flex: '2 1 0', minWidth: 0 }}>
                      <p style={{ color: '#8AAAC8', fontSize: 13, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {source.current_position
                          ? <Highlight text={source.current_position} query={currentQuery} />
                          : '—'
                        }
                      </p>
                    </div>
                    {/* 연락처 */}
                    <div style={{ flex: '2 1 0', minWidth: 0 }}>
                      <p style={{ color: '#8AAAC8', fontSize: 12, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {source.phone_primary ?? source.email_primary ?? '—'}
                      </p>
                    </div>
                    {/* 태그 */}
                    <div style={{ flex: '2 1 0', display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {source.exam_batch && (
                        <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,212,255,0.1)', color: '#3A90A8' }}>
                          {source.exam_batch}
                        </span>
                      )}
                      {source.tags.slice(0, 2).map(t => (
                        <span key={t}
                          onClick={e => { e.preventDefault(); e.stopPropagation(); navigate({ filter: currentFilter, q: currentQuery, page: '1', tag: t }) }}
                          style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'rgba(30,144,255,0.1)', color: '#4A7CC0', cursor: 'pointer', border: '1px solid rgba(30,144,255,0.2)' }}
                          title={`태그 "${t}"로 필터`}>
                          {t}
                        </span>
                      ))}
                    </div>
                    {/* 완성도 */}
                    <div style={{ flex: '1 1 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(source.completeness_score) }}>
                        {source.completeness_score}
                      </span>
                      <div style={{ width: 40, height: 4, borderRadius: 99, background: '#1A2838' }}>
                        <div style={{
                          width: `${source.completeness_score}%`, height: '100%',
                          borderRadius: 99, background: scoreColor(source.completeness_score),
                        }} />
                      </div>
                    </div>
                    {/* 민감도 */}
                    <div style={{ flex: '1 1 0', display: 'flex', justifyContent: 'center' }}>
                      <span className={`sensitivity-${source.sensitivity}`}
                        style={{ fontSize: 11, padding: '2px 8px', borderRadius: 99 }}>
                        {source.sensitivity === 'private' ? '🔒 민감' : '일반'}
                      </span>
                    </div>
                  </div>
                </a>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="glass-card flex flex-col items-center justify-center py-16">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mb-4">
            <circle cx="24" cy="20" r="10" stroke="#607898" strokeWidth="2"/>
            <path d="M8 44c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="#607898" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className="text-sm" style={{ color: '#607898' }}>
            {currentQuery ? `"${currentQuery}" 검색 결과가 없습니다` : '등록된 취재원이 없습니다'}
          </p>
          <Link href="/sources/new" className="mt-3 text-sm" style={{ color: '#4A7CC0' }}>
            첫 번째 취재원을 등록하세요 →
          </Link>
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => navigate({ filter: currentFilter, q: currentQuery, page: String(currentPage - 1) })}
            disabled={currentPage <= 1}
            className="px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{
              background: '#182035', color: '#8AAAC8',
              border: '1px solid #1A2838',
              opacity: currentPage <= 1 ? 0.4 : 1,
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            }}>
            ← 이전
          </button>
          <span className="text-sm px-3" style={{ color: '#8AAAC8' }}>
            {currentPage} / {totalPages}
          </span>
          <button
            onClick={() => navigate({ filter: currentFilter, q: currentQuery, page: String(currentPage + 1) })}
            disabled={currentPage >= totalPages}
            className="px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{
              background: '#182035', color: '#8AAAC8',
              border: '1px solid #1A2838',
              opacity: currentPage >= totalPages ? 0.4 : 1,
              cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
            }}>
            다음 →
          </button>
        </div>
      )}

      {/* ── 대량 작업 플로팅 바 ──────────────────────────────────────────── */}
      {someSelected && (
        <div style={{
          position: 'fixed',
          bottom: 28,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
          background: '#0D1726',
          border: '1px solid #1E3050',
          borderRadius: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          maxWidth: 'calc(100vw - 40px)',
        }}>
          {/* 선택 수 표시 */}
          <span style={{ color: '#4A7CC0', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
            {selectedIds.size}개 선택됨
          </span>

          <div style={{ width: 1, height: 20, background: '#1E3050', flexShrink: 0 }} />

          {/* 태그 추가 */}
          {bulkAction === 'add_tag' ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && tagInput.trim() && executeBulk('add_tag', tagInput.trim())}
                placeholder="태그 입력 후 Enter"
                autoFocus
                style={{
                  background: '#182035', border: '1px solid #2A4060', color: '#CDD5E0',
                  borderRadius: 6, padding: '5px 10px', fontSize: 12, width: 140,
                }}
              />
              <button
                onClick={() => tagInput.trim() && executeBulk('add_tag', tagInput.trim())}
                disabled={!tagInput.trim() || bulkLoading}
                style={{ ...bulkBtnStyle('#3D9E6A'), opacity: !tagInput.trim() ? 0.5 : 1 }}>
                적용
              </button>
              <button onClick={() => setBulkAction(null)} style={bulkBtnStyle('#607898')}>취소</button>
            </div>
          ) : bulkAction === 'remove_tag' ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && tagInput.trim() && executeBulk('remove_tag', tagInput.trim())}
                placeholder="제거할 태그 입력"
                autoFocus
                style={{
                  background: '#182035', border: '1px solid #2A4060', color: '#CDD5E0',
                  borderRadius: 6, padding: '5px 10px', fontSize: 12, width: 140,
                }}
              />
              <button
                onClick={() => tagInput.trim() && executeBulk('remove_tag', tagInput.trim())}
                disabled={!tagInput.trim() || bulkLoading}
                style={{ ...bulkBtnStyle('#A87228'), opacity: !tagInput.trim() ? 0.5 : 1 }}>
                적용
              </button>
              <button onClick={() => setBulkAction(null)} style={bulkBtnStyle('#607898')}>취소</button>
            </div>
          ) : (
            <>
              <button
                onClick={() => setBulkAction('add_tag')}
                disabled={bulkLoading}
                style={bulkBtnStyle('#3A90A8')}>
                🏷️ 태그 추가
              </button>
              <button
                onClick={() => setBulkAction('remove_tag')}
                disabled={bulkLoading}
                style={bulkBtnStyle('#7E6E48')}>
                태그 제거
              </button>
              <button
                onClick={() => executeBulk('set_visibility', 'shared')}
                disabled={bulkLoading}
                style={bulkBtnStyle('#4A7CC0')}>
                🌐 공유 전환
              </button>
              <button
                onClick={() => executeBulk('set_visibility', 'personal')}
                disabled={bulkLoading}
                style={bulkBtnStyle('#8AAAC8')}>
                🔒 개인 전환
              </button>
              <button
                onClick={confirmBulkDelete}
                disabled={bulkLoading}
                style={bulkBtnStyle('#C04040')}>
                🗑️ 삭제
              </button>
            </>
          )}

          <div style={{ width: 1, height: 20, background: '#1E3050', flexShrink: 0 }} />

          <button
            onClick={() => { setSelectedIds(new Set()); setBulkAction(null); setTagInput('') }}
            style={{ background: 'none', border: 'none', color: '#607898', cursor: 'pointer', fontSize: 18, padding: '0 4px', lineHeight: 1 }}
            title="선택 취소">
            ✕
          </button>

          {bulkLoading && (
            <div className="w-4 h-4 rounded-full border-2 animate-spin"
              style={{ borderColor: '#1A2838', borderTopColor: '#4A7CC0', flexShrink: 0 }} />
          )}
        </div>
      )}
    </div>
  )
}

function bulkBtnStyle(color: string): CSSProperties {
  return {
    background: `${color}22`,
    border: `1px solid ${color}55`,
    color,
    borderRadius: 8,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  }
}
