import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SourceListClient from '@/components/sources/SourceListClient'

interface SearchParams {
  tab?: 'personal' | 'shared'
  q?: string
  page?: string
}

export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const tab = params.tab ?? 'personal'
  const query = params.q ?? ''
  const page = parseInt(params.page ?? '1')
  const pageSize = 20

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // 역할 조회 — 공유+민감 열람 권한 판별
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const callerRole = (callerProfile as any)?.role ?? 'reporter'
  const canSeeSensitive = ['admin', 'superadmin'].includes(callerRole)

  let sourcesQuery = supabase
    .from('sources')
    .select(`
      id, full_name, current_organization, current_position,
      phone_primary, email_primary, visibility, sensitivity,
      completeness_score, tags, exam_batch, updated_at, owner_id,
      profiles!owner_id(full_name)
    `, { count: 'exact' })
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (tab === 'personal') {
    sourcesQuery = sourcesQuery.eq('owner_id', user.id)
  } else {
    sourcesQuery = sourcesQuery.eq('visibility', 'shared')
    // 기자·차장: 공유+민감 소스 제외
    if (!canSeeSensitive) {
      sourcesQuery = sourcesQuery.neq('sensitivity', 'private')
    }
  }

  if (query) {
    sourcesQuery = sourcesQuery.or(
      `full_name.ilike.%${query}%,current_organization.ilike.%${query}%,current_position.ilike.%${query}%,exam_batch.ilike.%${query}%,university.ilike.%${query}%,high_school.ilike.%${query}%`
    )
  }

  const { data: sources, count } = await sourcesQuery

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#E8F0FE' }}>취재원 목록</h1>
          <p className="text-xs mt-0.5" style={{ color: '#8899BB' }}>
            {tab === 'personal' ? '내 취재원 목록' : '편집국 공유 목록'}
          </p>
        </div>
        <div className="source-header-actions">
          <Link
            href="/sources/new"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, #1E90FF, #0066CC)', color: 'white' }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1v11M1 6.5h11" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className="hidden sm:inline">새 취재원</span>
            <span className="sm:hidden">등록</span>
          </Link>
          <Link
            href="/sources/import"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ background: '#132850', color: '#8899BB', border: '1px solid #1A3050' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v8M4 6l3 3 3-3M2 10v2a1 1 0 001 1h8a1 1 0 001-1v-2"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="hidden sm:inline">엑셀 가져오기</span>
          </Link>
        </div>
      </div>

      <SourceListClient
        initialSources={(sources ?? []) as any[]}
        totalCount={count ?? 0}
        currentTab={tab}
        currentQuery={query}
        currentPage={page}
        pageSize={pageSize}
        userId={user.id}
      />
    </div>
  )
}
