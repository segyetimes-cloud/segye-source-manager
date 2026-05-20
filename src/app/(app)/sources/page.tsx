import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SourceListClient from '@/components/sources/SourceListClient'

interface SearchParams {
  filter?: 'all' | 'mine'
  q?: string
  page?: string
}

export default async function SourcesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const filter = params.filter ?? 'all'
  const query = params.q ?? ''
  const page = parseInt(params.page ?? '1')
  const pageSize = 20

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const callerRole = (callerProfile as any)?.role ?? 'reporter'
  const canSeeSensitive = ['admin', 'section_editor', 'editor', 'publisher', 'superadmin'].includes(callerRole)

  let sourcesQuery = (supabase as any)
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

  if (filter === 'mine') {
    // 내가 등록한 것 — visibility 무관하게 내 소스 전체
    sourcesQuery = sourcesQuery.eq('owner_id', user.id)
  } else {
    // 전체: 공유 소스 + 내 개인 소스
    sourcesQuery = sourcesQuery.or(`visibility.eq.shared,owner_id.eq.${user.id}`)
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#CDD5E0' }}>취재원 목록</h1>
          <p className="text-xs mt-0.5" style={{ color: '#687898' }}>편집국 공유 취재원 데이터베이스</p>
        </div>
        <div className="source-header-actions">
          <Link
            href="/sources/new"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, #4A7CC0, #0066CC)', color: 'white' }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1v11M1 6.5h11" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className="hidden sm:inline">새 취재원</span>
            <span className="sm:hidden">등록</span>
          </Link>
          <Link
            href="/sources/import"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{ background: '#182035', color: '#687898', border: '1px solid #1A2838' }}>
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
        currentFilter={filter}
        currentQuery={query}
        currentPage={page}
        pageSize={pageSize}
        userId={user.id}
      />
    </div>
  )
}
