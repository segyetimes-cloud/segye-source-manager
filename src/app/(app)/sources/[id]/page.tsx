import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import SourceDetailClient from '@/components/sources/SourceDetailClient'
import BookmarkButton from '@/components/sources/BookmarkButton'
import { can, CAN_VIEW_SENSITIVE_SOURCE, CAN_VIEW_PERSONAL_NOTES, CAN_EDIT_ANY_SOURCE } from '@/lib/permissions'

interface Params {
  params: Promise<{ id: string }>
}

export default async function SourceDetailPage({ params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const supabaseAny = supabase as any

  const { data: sourceRaw } = await supabaseAny
    .from('sources')
    .select(`
      *,
      profiles!owner_id(full_name, email, department),
      source_positions(id, organization, department, position, rank, started_at, ended_at, is_current, change_source, change_note),
      source_edit_history(id, editor_name, field_name, old_value, new_value, edited_at),
      source_usefulness_ratings(rating, rater_id)
    `)
    .eq('id', id)
    .eq('is_deleted', false)
    .single()

  const source = sourceRaw as any
  if (!source) notFound()

  // 접근 권한 확인
  if (source.visibility === 'personal' && source.owner_id !== user.id) {
    const { data: profileRaw } = await supabaseAny.from('profiles').select('role').eq('id', user.id).single()
    const profile = profileRaw as { role: string } | null
    if (!can(profile?.role, CAN_EDIT_ANY_SOURCE)) {
      redirect('/sources?error=forbidden')
    }
  }

  // 민감정보 열람 권한 확인
  let hasPrivateAccess = source.owner_id === user.id
  if (!hasPrivateAccess && source.sensitivity === 'private') {
    const { data: approval } = await supabaseAny
      .from('source_access_approvals')
      .select('id, expires_at')
      .eq('source_id', id)
      .eq('requester_id', user.id)
      .eq('status', 'approved')
      .maybeSingle()
    const approvalTyped = approval as { id: string; expires_at: string | null } | null
    hasPrivateAccess = !!approvalTyped && (!approvalTyped.expires_at || new Date(approvalTyped.expires_at) > new Date())
  }

  // personal_notes는 소유자만
  if (source.owner_id !== user.id) source.personal_notes = null

  // 내 기존 평가
  const myRating = (source.source_usefulness_ratings as { rater_id: string; rating: number }[])
    ?.find((r: { rater_id: string; rating: number }) => r.rater_id === user.id)?.rating ?? null

  // 평균 평점
  const ratings = (source.source_usefulness_ratings as { rating: number }[]) ?? []
  const avgRating = ratings.length > 0
    ? ratings.reduce((s: number, r: { rating: number }) => s + r.rating, 0) / ratings.length
    : null

  const { data: profileRaw2 } = await supabaseAny.from('profiles').select('role, full_name, department').eq('id', user.id).single()
  const profile = profileRaw2 as { role: string; full_name: string | null; department: string | null } | null
  const isOwner = source.owner_id === user.id
  const userRole = profile?.role ?? 'reporter'
  const isAdmin = can(userRole, CAN_EDIT_ANY_SOURCE)
  // 차장 이상은 민감 정보 무조건 열람 가능
  const isDeputyOrAbove = can(userRole, CAN_VIEW_PERSONAL_NOTES)

  // personal_notes(민감 정보) 열람 규칙:
  //   소유자 OR 차장 이상 → 항상 열람
  //   기자 → source_access_approvals 승인 있을 때만 열람
  const canSeePersonalNotes = isOwner || isDeputyOrAbove || hasPrivateAccess
  if (!canSeePersonalNotes) source.personal_notes = null

  // source_notes 조회 (RLS 적용 — 민감 정보는 승인된 경우에만)
  const { data: publicNotesRaw } = await supabaseAny
    .from('source_notes')
    .select('id, content, is_sensitive, created_at, profiles!author_id(id, full_name, department)')
    .eq('source_id', id)
    .eq('is_sensitive', false)
    .order('created_at', { ascending: true })

  let sensitiveNotes: any[] = []
  let lockedNotesCount = 0

  if (hasPrivateAccess || isOwner || isDeputyOrAbove) {
    // 차장 이상·소유자·승인된 사용자: 모든 민감 노트 열람
    const { data: sensitiveRaw } = await supabaseAny
      .from('source_notes')
      .select('id, content, is_sensitive, created_at, profiles!author_id(id, full_name, department)')
      .eq('source_id', id)
      .eq('is_sensitive', true)
      .order('created_at', { ascending: true })
    sensitiveNotes = (sensitiveRaw ?? []) as any[]
  } else {
    // 일반 기자: 자신이 직접 작성한 민감 노트만 열람
    const { data: ownSensitiveRaw } = await supabaseAny
      .from('source_notes')
      .select('id, content, is_sensitive, created_at, profiles!author_id(id, full_name, department)')
      .eq('source_id', id)
      .eq('is_sensitive', true)
      .eq('author_id', user.id)
      .order('created_at', { ascending: true })
    sensitiveNotes = (ownSensitiveRaw ?? []) as any[]

    // 잠긴 민감 노트 수 = 타인이 쓴 민감 노트
    const svcClient = createServiceClient()
    const { count } = await svcClient
      .from('source_notes')
      .select('*', { count: 'exact', head: true })
      .eq('source_id', id)
      .eq('is_sensitive', true)
      .neq('author_id', user.id)
    lockedNotesCount = count ?? 0
  }

  const initialNotes = [
    ...(publicNotesRaw ?? []),
    ...sensitiveNotes,
  ].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) as any[]

  // 즐겨찾기 여부 조회
  const { data: bookmarkRaw } = await supabaseAny
    .from('source_bookmarks')
    .select('id')
    .eq('user_id', user.id)
    .eq('source_id', id)
    .maybeSingle()
  const isBookmarked = !!bookmarkRaw

  // 관련 정보보고 조회
  const { data: relatedReportsRaw } = await supabaseAny
    .from('report_sources')
    .select('report_id, information_reports!report_id(id, title, created_at, is_deleted, profiles!author_id(full_name))')
    .eq('source_id', id)

  const relatedReports = ((relatedReportsRaw ?? []) as any[])
    .map((rs: any) => rs.information_reports)
    .filter((r: any) => r && !r.is_deleted)
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <>
      {/* 즐겨찾기 버튼 — 오른쪽 상단 */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <BookmarkButton sourceId={id} initialBookmarked={isBookmarked} />
      </div>
      <SourceDetailClient
        source={source as any}
        positions={(source.source_positions as any[]) ?? []}
        editHistory={(source.source_edit_history as any[]) ?? []}
        avgRating={avgRating}
        myRating={myRating}
        hasPrivateAccess={hasPrivateAccess}
        isOwner={isOwner}
        isAdmin={isAdmin}
        isDeputyOrAbove={isDeputyOrAbove}
        userRole={userRole}
        userId={user.id}
        userFullName={profile?.full_name ?? '—'}
        userDepartment={profile?.department ?? null}
        initialNotes={initialNotes}
        lockedNotesCount={lockedNotesCount}
        canSeePersonalNotes={canSeePersonalNotes}
        relatedReports={relatedReports}
      />
    </>
  )
}
