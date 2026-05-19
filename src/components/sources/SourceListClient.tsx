'use client'

import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { useState, useTransition } from 'react'

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
  currentTab: 'personal' | 'shared'
  currentQuery: string
  currentPage: number
  pageSize: number
  userId: string
}

export default function SourceListClient({
  initialSources,
  totalCount,
  currentTab,
  currentQuery,
  currentPage,
  pageSize,
  userId,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [searchInput, setSearchInput] = useState(currentQuery)

  const totalPages = Math.ceil(totalCount / pageSize)

  function navigate(params: Record<string, string>) {
    const sp = new URLSearchParams()
    if (params.tab) sp.set('tab', params.tab)
    if (params.q) sp.set('q', params.q)
    if (params.page && params.page !== '1') sp.set('page', params.page)
    startTransition(() => router.push(`${pathname}?${sp.toString()}`))
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    navigate({ tab: currentTab, q: searchInput, page: '1' })
  }

  const scoreColor = (score: number) =>
    score >= 90 ? '#3D9E6A' : score >= 60 ? '#A87228' : '#C04040'

  return (
    <div className="space-y-4">
      {/* 탭 + 검색 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* 탭 + 총 건수 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div className="flex rounded-lg p-1" style={{ background: '#131C2C', border: '1px solid #1A2838' }}>
            {[
              { value: 'personal', label: '내 목록' },
              { value: 'shared', label: '공유 목록' },
            ].map(t => (
              <button
                key={t.value}
                onClick={() => navigate({ tab: t.value, q: currentQuery, page: '1' })}
                className="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
                style={{
                  background: currentTab === t.value ? '#4A7CC0' : 'transparent',
                  color: currentTab === t.value ? 'white' : '#687898',
                }}>
                {t.label}
              </button>
            ))}
          </div>
          <span className="text-sm flex-shrink-0" style={{ color: '#485870' }}>
            총 {totalCount.toLocaleString()}명
          </span>
        </div>

        {/* 검색 */}
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
              padding: '8px 12px',
              fontSize: '14px',
            }}
          />
          <button
            type="submit"
            style={{ background: '#4A7CC0', color: 'white', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 14, fontWeight: 500, cursor: 'pointer', flexShrink: 0 }}>
            검색
          </button>
          {currentQuery && (
            <button
              type="button"
              onClick={() => { setSearchInput(''); navigate({ tab: currentTab, page: '1' }) }}
              style={{ background: '#182035', color: '#687898', border: '1px solid #1A2838', borderRadius: 8, padding: '8px 12px', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>
              초기화
            </button>
          )}
        </form>
      </div>

      {/* 목록 */}
      {isPending ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: '#1A2838', borderTopColor: '#4A7CC0' }} />
        </div>
      ) : initialSources.length > 0 ? (
        <div className="glass-card overflow-hidden">
          {/* 데스크톱: 테이블 헤더 */}
          <div className="source-table-header"
            style={{ background: '#182035', color: '#485870', borderBottom: '1px solid #1A2838' }}>
            <div style={{ flex: '3 1 0' }}>이름 / 소속</div>
            <div style={{ flex: '2 1 0' }}>직책</div>
            <div style={{ flex: '2 1 0' }}>연락처</div>
            <div style={{ flex: '2 1 0' }}>태그</div>
            <div style={{ flex: '1 1 0', textAlign: 'center' }}>완성도</div>
            <div style={{ flex: '1 1 0', textAlign: 'center' }}>민감도</div>
            <div style={{ flex: '1 1 0', textAlign: 'center' }}>구분</div>
          </div>

          {/* 행 — 데스크톱: 가로 테이블 / 모바일: 카드 */}
          {initialSources.map(source => (
            <Link
              key={source.id}
              href={`/sources/${source.id}`}
              className="source-list-row"
              style={{ borderBottom: '1px solid #1A2838', color: 'inherit', textDecoration: 'none', display: 'block' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#182035')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

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
                    <p style={{ color: '#CDD5E0', fontWeight: 600, fontSize: 14, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {source.full_name}
                    </p>
                    <p style={{ color: '#687898', fontSize: 12, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {source.current_organization ?? '—'} {source.current_position ? `· ${source.current_position}` : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: scoreColor(source.completeness_score) }}>
                      {source.completeness_score}점
                    </span>
                    <span className={`sensitivity-${source.sensitivity}`}
                      style={{ fontSize: 11, padding: '1px 6px', borderRadius: 99 }}>
                      {source.sensitivity === 'private' ? '🔒 비공개' : '공개'}
                    </span>
                  </div>
                </div>
                {(source.phone_primary || source.email_primary || source.exam_batch || source.tags.length > 0) && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    {source.phone_primary && (
                      <span style={{ fontSize: 11, color: '#687898' }}>{source.phone_primary}</span>
                    )}
                    {source.exam_batch && (
                      <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'rgba(0,212,255,0.1)', color: '#3A90A8' }}>
                        {source.exam_batch}
                      </span>
                    )}
                    {source.tags.slice(0, 3).map(tag => (
                      <span key={tag} style={{ fontSize: 11, padding: '1px 6px', borderRadius: 4, background: 'rgba(30,144,255,0.1)', color: '#687898' }}>
                        {tag}
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
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(30,144,255,0.15)', color: '#4A7CC0',
                    fontSize: 12, fontWeight: 700,
                  }}>
                    {source.full_name[0]}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ color: '#CDD5E0', fontWeight: 600, fontSize: 14, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {source.full_name}
                    </p>
                    <p style={{ color: '#687898', fontSize: 11, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {source.current_organization ?? '—'}
                    </p>
                  </div>
                </div>
                {/* 직책 */}
                <div style={{ flex: '2 1 0', minWidth: 0 }}>
                  <p style={{ color: '#687898', fontSize: 13, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {source.current_position ?? '—'}
                  </p>
                </div>
                {/* 연락처 */}
                <div style={{ flex: '2 1 0', minWidth: 0 }}>
                  <p style={{ color: '#687898', fontSize: 12, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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
                  {source.tags.slice(0, 2).map(tag => (
                    <span key={tag} style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'rgba(30,144,255,0.1)', color: '#687898' }}>
                      {tag}
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
                    {source.sensitivity === 'private' ? '🔒 비공개' : '공개'}
                  </span>
                </div>
                {/* 구분 */}
                <div style={{ flex: '1 1 0', display: 'flex', justifyContent: 'center' }}>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 99,
                    background: source.visibility === 'shared' ? 'rgba(0,204,102,0.1)' : 'rgba(30,144,255,0.1)',
                    color: source.visibility === 'shared' ? '#3D9E6A' : '#687898',
                  }}>
                    {source.visibility === 'shared' ? '공유' : '개인'}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="glass-card flex flex-col items-center justify-center py-16">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mb-4">
            <circle cx="24" cy="20" r="10" stroke="#485870" strokeWidth="2"/>
            <path d="M8 44c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="#485870" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className="text-sm" style={{ color: '#485870' }}>
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
            onClick={() => navigate({ tab: currentTab, q: currentQuery, page: String(currentPage - 1) })}
            disabled={currentPage <= 1}
            className="px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{
              background: '#182035', color: '#687898',
              border: '1px solid #1A2838',
              opacity: currentPage <= 1 ? 0.4 : 1,
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            }}>
            ← 이전
          </button>

          <span className="text-sm px-3" style={{ color: '#687898' }}>
            {currentPage} / {totalPages}
          </span>

          <button
            onClick={() => navigate({ tab: currentTab, q: currentQuery, page: String(currentPage + 1) })}
            disabled={currentPage >= totalPages}
            className="px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{
              background: '#182035', color: '#687898',
              border: '1px solid #1A2838',
              opacity: currentPage >= totalPages ? 0.4 : 1,
              cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
            }}>
            다음 →
          </button>
        </div>
      )}
    </div>
  )
}
