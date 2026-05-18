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
    score >= 90 ? '#00CC66' : score >= 60 ? '#FF9900' : '#FF4444'

  return (
    <div className="space-y-4">
      {/* 탭 + 검색 */}
      <div className="flex items-center gap-4">
        {/* 탭 */}
        <div className="flex rounded-lg p-1" style={{ background: '#0F2040', border: '1px solid #1A3050' }}>
          {[
            { value: 'personal', label: '내 목록' },
            { value: 'shared', label: '공유 목록' },
          ].map(t => (
            <button
              key={t.value}
              onClick={() => navigate({ tab: t.value, q: currentQuery, page: '1' })}
              className="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
              style={{
                background: currentTab === t.value ? '#1E90FF' : 'transparent',
                color: currentTab === t.value ? 'white' : '#8899BB',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* 검색 */}
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="이름, 소속, 직책, 고시기수, 대학 등으로 검색..."
            style={{
              flex: 1,
              background: '#0F2040',
              border: '1px solid #1A3050',
              color: '#E8F0FE',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '14px',
            }}
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: '#1E90FF', color: 'white', border: 'none' }}>
            검색
          </button>
          {currentQuery && (
            <button
              type="button"
              onClick={() => { setSearchInput(''); navigate({ tab: currentTab, page: '1' }) }}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ background: '#132850', color: '#8899BB', border: '1px solid #1A3050' }}>
              초기화
            </button>
          )}
        </form>

        <span className="text-sm flex-shrink-0" style={{ color: '#4A6080' }}>
          총 {totalCount.toLocaleString()}명
        </span>
      </div>

      {/* 목록 */}
      {isPending ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 rounded-full border-2 animate-spin"
            style={{ borderColor: '#1A3050', borderTopColor: '#1E90FF' }} />
        </div>
      ) : initialSources.length > 0 ? (
        <div className="glass-card overflow-hidden">
          {/* 테이블 헤더 */}
          <div className="grid grid-cols-12 gap-4 px-5 py-3 text-xs font-semibold"
            style={{ background: '#132850', color: '#4A6080', borderBottom: '1px solid #1A3050' }}>
            <div className="col-span-3">이름 / 소속</div>
            <div className="col-span-2">직책</div>
            <div className="col-span-2">연락처</div>
            <div className="col-span-2">태그</div>
            <div className="col-span-1 text-center">완성도</div>
            <div className="col-span-1 text-center">민감도</div>
            <div className="col-span-1 text-center">구분</div>
          </div>

          {/* 행 */}
          {initialSources.map(source => (
            <Link
              key={source.id}
              href={`/sources/${source.id}`}
              className="grid grid-cols-12 gap-4 px-5 py-2.5 transition-colors items-center"
              style={{ borderBottom: '1px solid #1A3050', color: 'inherit', textDecoration: 'none' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#132850')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

              {/* 이름/소속 */}
              <div className="col-span-3 flex items-center gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                  style={{ background: 'rgba(30,144,255,0.15)', color: '#1E90FF' }}>
                  {source.full_name[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#E8F0FE' }}>
                    {source.full_name}
                  </p>
                  <p className="text-xs truncate" style={{ color: '#8899BB' }}>
                    {source.current_organization ?? '—'}
                  </p>
                </div>
              </div>

              {/* 직책 */}
              <div className="col-span-2">
                <p className="text-sm truncate" style={{ color: '#8899BB' }}>
                  {source.current_position ?? '—'}
                </p>
              </div>

              {/* 연락처 */}
              <div className="col-span-2">
                <p className="text-xs truncate" style={{ color: '#8899BB' }}>
                  {source.phone_primary ?? source.email_primary ?? '—'}
                </p>
              </div>

              {/* 태그 */}
              <div className="col-span-2 flex flex-wrap gap-1">
                {source.exam_batch && (
                  <span className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(0,212,255,0.1)', color: '#00D4FF' }}>
                    {source.exam_batch}
                  </span>
                )}
                {source.tags.slice(0, 2).map(tag => (
                  <span key={tag} className="text-xs px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(30,144,255,0.1)', color: '#8899BB' }}>
                    {tag}
                  </span>
                ))}
              </div>

              {/* 완성도 */}
              <div className="col-span-1 flex flex-col items-center gap-1">
                <span className="text-xs font-bold" style={{ color: scoreColor(source.completeness_score) }}>
                  {source.completeness_score}
                </span>
                <div className="w-10 h-1 rounded-full" style={{ background: '#1A3050' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${source.completeness_score}%`,
                      background: scoreColor(source.completeness_score),
                    }}
                  />
                </div>
              </div>

              {/* 민감도 */}
              <div className="col-span-1 flex justify-center">
                <span className={`text-xs px-2 py-0.5 rounded-full sensitivity-${source.sensitivity}`}>
                  {source.sensitivity === 'private' ? '🔒 비공개' : '공개'}
                </span>
              </div>

              {/* 구분 */}
              <div className="col-span-1 flex justify-center">
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{
                    background: source.visibility === 'shared'
                      ? 'rgba(0,204,102,0.1)' : 'rgba(30,144,255,0.1)',
                    color: source.visibility === 'shared' ? '#00CC66' : '#8899BB',
                  }}>
                  {source.visibility === 'shared' ? '공유' : '개인'}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="glass-card flex flex-col items-center justify-center py-16">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mb-4">
            <circle cx="24" cy="20" r="10" stroke="#4A6080" strokeWidth="2"/>
            <path d="M8 44c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="#4A6080" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p className="text-sm" style={{ color: '#4A6080' }}>
            {currentQuery ? `"${currentQuery}" 검색 결과가 없습니다` : '등록된 취재원이 없습니다'}
          </p>
          <Link href="/sources/new" className="mt-3 text-sm" style={{ color: '#1E90FF' }}>
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
              background: '#132850', color: '#8899BB',
              border: '1px solid #1A3050',
              opacity: currentPage <= 1 ? 0.4 : 1,
              cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
            }}>
            ← 이전
          </button>

          <span className="text-sm px-3" style={{ color: '#8899BB' }}>
            {currentPage} / {totalPages}
          </span>

          <button
            onClick={() => navigate({ tab: currentTab, q: currentQuery, page: String(currentPage + 1) })}
            disabled={currentPage >= totalPages}
            className="px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{
              background: '#132850', color: '#8899BB',
              border: '1px solid #1A3050',
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
