import { Suspense } from 'react'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  can,
  CAN_VIEW_SENSITIVE_SOURCE,
  CAN_VIEW_PERSONAL_NOTES,
  CAN_EDIT_ANY_SOURCE,
} from '@/lib/permissions'
import { decryptNullable } from '@/lib/crypto'
import SourceDetailClient from '@/components/sources/SourceDetailClient'
import type { Source, SourcePosition, SourceEditHistory } from '@/types/database'
import SourceDetailLoading from './loading'

interface Params {
  params: Promise<{ id: string }>
}

export default function SourceDetailPage({ params }: Params) {
  return (
    <Suspense fallback={<SourceDetailLoading />}>
      <SourceDetailContent params={params} />
    </Suspense>
  )
}

async function SourceDetailContent({ params }: Params) {
  const { id } = await params

  // ── id 방어: 빈값·"new"·"edit" 등 잘못된 값 차단 ──────────────────────────
  if (!id || id === 'new' || id === 'edit') notFound()

  const supabase = await createClient()

  // ── 인증 확인 ──────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── 사용자 프로필 ──────────────────────────────────────────────────────────
  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('role, full_name, department')
    .eq('id', user.id)
    .single()
  const profile = profileRaw as { role: string; full_name: string; department: string | null } | null
  const userRole       = profile?.role       ?? 'reporter'
  const userFullName   = profile?.full_name  ?? '알 수 없음'
  const userDepartment = profile?.department ?? null

  // ── 권한 플래그 ─────────────────────────────────────────────────────────────
  const isAdminOrAbove    = can(userRole, CAN_VIEW_SENSITIVE_SOURCE)  // 부장+
  const isDeputyOrAboveF  = can(userRole, CAN_VIEW_PERSONAL_NOTES)   // 차장+
  const isAdminFlag       = can(userRole, CAN_EDIT_ANY_SOURCE)        // 부장+

  // ── 취재원 + 관련 데이터 조회 ─────────────────────────────────────────────
  const [sourceResult, ratingsResult] = await Promise.all([
    supabase
      .from('sources')
      .select(`
        *,
        profiles!owner_id(full_name, email, department),
        source_positions(
          id, organization, department, position, rank,
          started_at, ended_at, is_current, change_source
        ),
        source_edit_history(
          id, editor_name, field_name, old_value, new_value, edited_at
        )
      `)
      .eq('id', id)
      .eq('is_deleted', false)
      .single(),
    // 유용성 평점 (avg + 내 평점)
    supabase
      .from('source_usefulness_ratings')
      .select('rating, rater_id')
      .eq('source_id', id),
  ])

  if (sourceResult.error) {
    // DB 오류 시 notFound 대신 실제 에러를 throw해 error.tsx에서 잡히도록 함
    // → digest 코드가 서버 로그에 기록되어 원인 추적 가능
    throw new Error(
      `취재원 조회 실패 [${sourceResult.error.code ?? 'unknown'}]: ${sourceResult.error.message}`
    )
  }
  if (!sourceResult.data) notFound()

  const sourceRaw = sourceResult.data as Source & {
    profiles?: { full_name: string; email: string; department: string | null } | null
    source_positions?: SourcePosition[]
    source_edit_history?: SourceEditHistory[]
  }

  // Normalize null → undefined for the profiles join so the type matches SourceDetailClient's Props
  const source: Source & {
    profiles?: { full_name: string; email: string; department: string | null }
    source_positions?: SourcePosition[]
    source_edit_history?: SourceEditHistory[]
  } = {
    ...sourceRaw,
    profiles: sourceRaw.profiles ?? undefined,
  }

  const isOwner = source.owner_id === user.id

  // ── 열람 권한 확인 ─────────────────────────────────────────────────────────
  // 개인 목록: 소유자 또는 부장+ 만
  if (source.visibility === 'personal' && !isOwner && !isAdminOrAbove) {
    notFound()
  }
  // 공유 + 민감: 소유자 또는 부장+ 만
  if (
    source.visibility === 'shared' &&
    source.sensitivity === 'private' &&
    !isOwner &&
    !isAdminOrAbove
  ) {
    notFound()
  }

  // ── personal_notes 열람 승인 폐지 ────────────────────────────────────────
  // 열람 승인 기능 제거 — 모든 인증 사용자가 personal_notes 직접 열람 가능
  const canSeePersonalNotes = true
  const hasPrivateAccess    = true

  // ── 암호화 필드 복호화 ──────────────────────────────────────────────────────
  source.phone_primary   = decryptNullable(source.phone_primary)
  source.phone_secondary = decryptNullable(source.phone_secondary)
  source.personal_notes = decryptNullable(source.personal_notes)

  // ── 직책 이력 + 편집 이력 ──────────────────────────────────────────────────
  const positions    = (source.source_positions    ?? []) as SourcePosition[]
  const editHistory  = (source.source_edit_history ?? []) as SourceEditHistory[]

  // ── 평점 계산 ───────────────────────────────────────────────────────────────
  const ratings  = (ratingsResult.data ?? []) as { rating: number; rater_id: string }[]
  const avgRating = ratings.length > 0
    ? ratings.reduce((s, r) => s + r.rating, 0) / ratings.length
    : null
  const myRating = ratings.find(r => r.rater_id === user.id)?.rating ?? null

  // ── 노트 조회 (역할 기반 필터) ─────────────────────────────────────────────
  let notesQuery = supabase
    .from('source_notes')
    .select('id, content, is_sensitive, created_at, profiles!author_id(id, full_name, department)')
    .eq('source_id', id)
    .order('created_at', { ascending: true })

  // 차장 미만: 공개 노트 + 자신이 작성한 민감 노트만
  if (!isDeputyOrAboveF) {
    notesQuery = notesQuery.or(`is_sensitive.eq.false,author_id.eq.${user.id}`)
  }

  const { data: notesRaw } = await notesQuery
  const initialNotes = (notesRaw ?? []) as {
    id: string
    content: string
    is_sensitive: boolean
    created_at: string
    profiles: { id: string; full_name: string; department: string | null } | null
  }[]

  // ── 잠긴 노트 수 (차장 미만에게 표시용) ──────────────────────────────────
  let lockedNotesCount = 0
  if (!isDeputyOrAboveF) {
    const { count } = await supabase
      .from('source_notes')
      .select('id', { count: 'exact', head: true })
      .eq('source_id', id)
      .eq('is_sensitive', true)
      .neq('author_id', user.id)
    lockedNotesCount = count ?? 0
  }

  // ── 관련 정보보고 조회 ──────────────────────────────────────────────────────
  const { data: rsRaw } = await supabase
    .from('report_sources')
    .select('information_reports!report_id(id, title, created_at, profiles!author_id(full_name))')
    .eq('source_id', id)
    .limit(20)

  type RawRS = {
    information_reports: {
      id: string
      title: string
      created_at: string
      profiles: { full_name: string } | null
    } | null
  }

  const relatedReports = ((rsRaw ?? []) as RawRS[])
    .map(rs => rs.information_reports)
    .filter((r): r is NonNullable<RawRS['information_reports']> => r !== null)

  return (
    <SourceDetailClient
      source={source}
      positions={positions}
      editHistory={editHistory}
      avgRating={avgRating}
      myRating={myRating}
      hasPrivateAccess={hasPrivateAccess}
      isOwner={isOwner}
      isAdmin={isAdminFlag}
      isDeputyOrAbove={isDeputyOrAboveF}
      userRole={userRole}
      canSeePersonalNotes={canSeePersonalNotes}
      userId={user.id}
      userFullName={userFullName}
      userDepartment={userDepartment}
      initialNotes={initialNotes}
      lockedNotesCount={lockedNotesCount}
      relatedReports={relatedReports}
    />
  )
}
