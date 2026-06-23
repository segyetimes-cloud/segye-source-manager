import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import type { ReportVisibility } from '@/types/database'
import ReportDeleteButton from '@/components/reports/ReportDeleteButton'
import ReportPointAward from '@/components/reports/ReportPointAward'
import ReportContentViewer from '@/components/reports/ReportContentViewer'
import ReportCopyLogs from '@/components/reports/ReportCopyLogs'
import ReportAllowedUsers from '@/components/reports/ReportAllowedUsers'
import VisibilityBadge from '@/components/reports/VisibilityBadge'
import ReportReviewActions from '@/components/reports/ReportReviewActions'
import ReportFieldEditor from '@/components/reports/ReportFieldEditor'
import ReportAttachments, { type AttachmentRow } from '@/components/reports/ReportAttachments'
import ReportCreatedAtEditor from '@/components/reports/ReportCreatedAtEditor'
import PersonSearchPopover from '@/components/reports/PersonSearchPopover'
import ReportRelationExtractor from '@/components/reports/ReportRelationExtractor'
import { isDesk as isDeskRole } from '@/lib/roles'

interface Params {
  params: Promise<{ id: string }>
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

export default async function ReportDetailPage({ params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')


  // 현재 사용자 프로필 (role 확인)
  const { data: myProfileRaw } = await supabase
    .from('profiles').select('role, full_name, department').eq('id', user.id).single()
  const myProfile = myProfileRaw as { role: string; full_name: string; department: string | null } | null
  const isDesk = isDeskRole(myProfile?.role)

  // 보고서 + 수정이력 + 첨부파일 병렬 조회
  const [reportResult, revisionsResult, attachmentsResult] = await Promise.all([
    supabase
      .from('information_reports')
      .select(`
        *,
        profiles!author_id(full_name, department),
        report_sources(source_id, sources!source_id(id, full_name, current_organization))
      `)
      .eq('id', id)
      .eq('is_deleted', false)
      .single(),
    supabase
      .from('report_revisions')
      .select('id, author_id, content, created_at, profiles!author_id(full_name, department)')
      .eq('report_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('report_attachments')
      .select('*')
      .eq('report_id', id)
      .order('created_at', { ascending: true }),
  ])
  const report = reportResult.data as ({
    id: string; author_id: string; author_department: string | null;
    title: string; content: string; category: string; tags: string[];
    visibility: string; status: string; reviewer_id: string | null;
    reviewed_at: string | null; review_note: string | null;
    created_at: string; updated_at: string;
    profiles: { full_name: string; department: string | null } | null;
    report_sources: Array<{ source_id: string; sources: { id: string; full_name: string; current_organization: string | null } | null }>;
  }) | null
  const revisionsRaw = revisionsResult.data as Array<{
    id: string; author_id: string; content: string; created_at: string;
    profiles: { full_name: string; department: string | null } | null;
  }> | null
  const attachments = (attachmentsResult.data ?? []) as AttachmentRow[]

  if (!report) notFound()

  const isAuthor = report.author_id === user.id
  const canEdit = isAuthor || isDesk
  const isSuperAdmin = myProfile?.role === 'superadmin'

  // 열람 권한 체크
  const vis = report.visibility as string
  if (!isDesk && !isAuthor) {
    if (vis === 'author_only') notFound()
    if (vis === 'desk_above') notFound()
    if (vis === 'team' && myProfile?.department !== report.author_department) notFound()
  }

  const author = report.profiles as { full_name: string; department: string | null } | null
  const sourcesRaw = report.report_sources ?? []
  const linkedSources = sourcesRaw.map((rs: any) => rs.sources).filter(Boolean)
  const revisions: any[] = revisionsRaw ?? []

  const reportStatus = (report.status ?? 'approved') as 'draft' | 'submitted' | 'approved' | 'rejected'

  const STATUS_LABEL: Record<string, string> = {
    draft: '임시저장',
    submitted: '검토 중',
    approved: '승인됨',
    rejected: '반려됨',
  }
  const STATUS_COLOR: Record<string, { bg: string; color: string; border: string }> = {
    draft:     { bg: 'rgba(104,120,152,0.12)', color: '#526070', border: 'rgba(104,120,152,0.3)' },
    submitted: { bg: 'rgba(74,124,192,0.12)',  color: '#4A7CC0', border: 'rgba(74,124,192,0.3)'  },
    approved:  { bg: 'rgba(61,158,106,0.12)',  color: '#3D9E6A', border: 'rgba(61,158,106,0.3)'  },
    rejected:  { bg: 'rgba(192,64,64,0.12)',   color: '#C04040', border: 'rgba(192,64,64,0.3)'   },
  }

  // 수정이력이 2개 이상이면 이력 표시 (1개는 최초 작성본으로 본문에 표시)
  const hasRevisions = revisions.length > 1

  return (
    <div className="max-w-3xl mx-auto space-y-3" style={{ paddingBottom: '1rem', background: '#F0F3F7', minHeight: '100vh', padding: '1rem' }}>

      {/* 텍스트 선택 → 인물 검색 팝오버 (전역, 클라이언트 전용) */}
      <PersonSearchPopover />

      {/* 뒤로가기 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/reports" style={{ color: '#526070', textDecoration: 'none', fontSize: '22px', lineHeight: 1 }}>←</Link>
          <span style={{ fontSize: '13px', color: '#526070' }}>정보보고 목록</span>
        </div>
        <Link
          href="/reports"
          aria-label="목록으로"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '32px', height: '32px', borderRadius: '8px',
            background: '#F5F8FB', border: '1px solid #E0E8F0',
            color: '#526070', textDecoration: 'none', fontSize: '20px', lineHeight: 1,
          }}>
          ×
        </Link>
      </div>

      {/* 메인 카드 */}
      <div className="glass-card p-5" style={{ background: '#FFFFFF', border: '1px solid #E0E8F0' }}>
        {/* 제목 + 배지 */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#2C3E50', lineHeight: 1.35, flex: 1 }}>
            {report.title}
            {hasRevisions && (
              <span style={{
                marginLeft: '10px', fontSize: '11px', fontWeight: 600,
                background: 'rgba(30,144,255,0.12)', color: '#4A7CC0',
                border: '1px solid rgba(30,144,255,0.25)',
                borderRadius: '5px', padding: '1px 7px',
                verticalAlign: 'middle',
              }}>
                수정 {revisions.length - 1}회
              </span>
            )}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            {/* 승인 상태 뱃지 */}
            <span style={{
              fontSize: '11px', fontWeight: 600,
              background: STATUS_COLOR[reportStatus].bg,
              color: STATUS_COLOR[reportStatus].color,
              border: `1px solid ${STATUS_COLOR[reportStatus].border}`,
              borderRadius: '5px', padding: '2px 8px',
              whiteSpace: 'nowrap',
            }}>
              {STATUS_LABEL[reportStatus]}
            </span>
            <VisibilityBadge visibility={report.visibility as ReportVisibility} />
          </div>
        </div>

        {/* 작성자 + 날짜 메타 */}
        <div className="flex flex-wrap items-center gap-3 mb-4" style={{ borderBottom: '1px solid #E0E8F0', paddingBottom: '12px' }}>
          <span style={{ fontSize: '13px', color: '#526070' }}>
            ✍️ {author?.full_name ?? '—'}
            {author?.department ? ` · ${author.department}` : ''}
          </span>
          <span style={{ fontSize: '12px', color: '#526070' }}>
            🕐 {formatDateTime(report.created_at)}
          </span>
        </div>

        {/* ── 본문 (공개정보) — 인라인 편집 가능 ── */}
        <ReportFieldEditor
          reportId={id}
          field="content"
          value={report.content}
          label="공개정보"
          canEdit={canEdit}
        >
        {!hasRevisions ? (
          /* 이력 없음: 보안 뷰어 (워터마크 + 복사 추적) */
          <ReportContentViewer
            reportId={id}
            content={report.content}
            userId={user.id}
            userFullName={myProfile?.full_name ?? '—'}
            userDepartment={myProfile?.department ?? null}
          />
        ) : (
          /* 이력 있음: 버전별 스택 + 각각 보안 뷰어 */
          <div style={{ marginBottom: '16px' }}>
            {revisions.map((rev: any, idx: number) => {
              const revAuthor = rev.profiles as { full_name: string; department?: string | null } | null
              const isFirst = idx === 0
              const isSameAuthor = rev.author_id === report.author_id

              return (
                <div key={rev.id}>
                  {/* 구분선 (첫 번째 이후) */}
                  {!isFirst && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      margin: '14px 0 12px',
                    }}>
                      <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, #E0E8F0, transparent)' }} />
                      <span style={{
                        fontSize: '11px', color: '#4A7CC0',
                        background: 'rgba(30,144,255,0.08)',
                        border: '1px solid rgba(30,144,255,0.2)',
                        borderRadius: '4px', padding: '1px 8px',
                        whiteSpace: 'nowrap',
                      }}>
                        수정 {idx}
                      </span>
                      <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to left, transparent, #E0E8F0, transparent)' }} />
                    </div>
                  )}

                  {/* 저자 레이블 */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    marginBottom: '6px',
                  }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 600,
                      color: isFirst ? '#526070' : (isSameAuthor ? '#526070' : '#3A90A8'),
                    }}>
                      {isFirst ? '최초 작성' : '수정'}
                    </span>
                    <span style={{ fontSize: '12px', color: isFirst ? '#526070' : '#3A90A8', fontWeight: 600 }}>
                      {revAuthor?.full_name ?? '—'}
                    </span>
                    {revAuthor?.department && (
                      <span style={{ fontSize: '11px', color: '#526070' }}>{revAuthor.department}</span>
                    )}
                    <span style={{ fontSize: '11px', color: '#526070', marginLeft: '2px' }}>
                      · {formatDateTime(rev.created_at)}
                    </span>
                  </div>

                  {/* 각 버전 본문 — 보안 뷰어로 감쌈 */}
                  <div style={{
                    borderLeft: isFirst ? 'none' : '2px solid rgba(30,144,255,0.3)',
                    paddingLeft: isFirst ? '0' : '12px',
                  }}>
                    <ReportContentViewer
                      reportId={id}
                      content={rev.content}
                      userId={user.id}
                      userFullName={myProfile?.full_name ?? '—'}
                      userDepartment={myProfile?.department ?? null}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
        </ReportFieldEditor>

        {/* 태그 */}
        {(report.tags as string[]).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {(report.tags as string[]).map((tag: string, i: number) => (
              <span key={i} style={{
                background: 'rgba(30,144,255,0.1)', color: '#4A7CC0',
                border: '1px solid rgba(30,144,255,0.2)',
                borderRadius: '4px', padding: '2px 8px', fontSize: '12px',
              }}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* 첨부파일 */}
        {attachments.length > 0 && (
          <ReportAttachments
            reportId={id}
            attachments={attachments}
            canDelete={isAuthor || isDesk}
          />
        )}

        {/* ── 하단 서명 (작성자 · 작성일) ── */}
        <div style={{
          marginTop: '20px',
          paddingTop: '14px',
          borderTop: '1px solid #E0E8F0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '8px',
        }}>
          {/* 작성자 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '30px', height: '30px', borderRadius: '50%',
              background: 'rgba(30,144,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 700, color: '#4A7CC0',
              flexShrink: 0,
            }}>
              {(author?.full_name ?? '?')[0]}
            </span>
            <div>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#526070' }}>
                {author?.full_name ?? '—'}
              </p>
              {author?.department && (
                <p style={{ margin: 0, fontSize: '11px', color: '#526070' }}>
                  {author.department}
                </p>
              )}
            </div>
          </div>

          {/* 작성일 (superadmin은 수정 가능) */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
            <span style={{ fontSize: '10px', color: '#3A4A5E', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              최초 작성
            </span>
            <ReportCreatedAtEditor
              reportId={id}
              createdAt={report.created_at}
              isSuperAdmin={isSuperAdmin}
            />
          </div>
        </div>
      </div>

      {/* 연결된 취재원 */}
      {linkedSources.length > 0 && (
        <div className="glass-card p-4">
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#2C3E50', marginBottom: '10px' }}>
            👤 연결된 취재원 ({linkedSources.length}명)
          </h2>
          <div className="flex flex-wrap gap-2">
            {linkedSources.map((src: any) => (
              <Link key={src.id} href={`/sources/${src.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  background: '#182035', border: '1px solid #E0E8F0',
                  borderRadius: '8px', padding: '8px 14px', cursor: 'pointer',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#4A7CC0')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#E0E8F0')}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#2C3E50' }}>{src.full_name}</p>
                  {src.current_organization && (
                    <p style={{ fontSize: '12px', color: '#526070', marginTop: '2px' }}>{src.current_organization}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── AI 인물 관계망 추출 ── */}
      <ReportRelationExtractor reportId={id} />

      {/* ── 지정 열람자 (작성자 or 데스크만 표시) ── */}
      {(isAuthor || isDesk) && report.visibility !== 'all' && (
        <ReportAllowedUsers reportId={id} isAuthorOrDesk={true} />
      )}

      {/* ── 포인트 부여 (데스크만 표시) ── */}
      {isDesk && (
        <ReportPointAward
          reportId={id}
          authorName={author?.full_name ?? '기자'}
          authorId={report.author_id}
          currentUserId={user.id}
        />
      )}

      {/* ── 복사 이력 추적 (데스크만 표시) ── */}
      {isDesk && <ReportCopyLogs reportId={id} />}

      {/* ── 검토 요청 / 승인 / 반려 ── */}
      {(isAuthor || isDesk) && (
        <div className="glass-card p-4">
          <h2 style={{ fontSize: '13px', fontWeight: 600, color: '#526070', marginBottom: '12px' }}>
            보고서 검토
          </h2>
          <ReportReviewActions
            reportId={id}
            status={reportStatus}
            isAuthor={isAuthor}
            isDesk={isDesk}
            reviewNote={report.review_note ?? null}
          />
        </div>
      )}

      {/* 액션 버튼 (작성자 or 데스크) */}
      {canEdit && (
        <div className="flex gap-2">
          <Link
            href={`/reports/${id}/edit`}
            style={{
              padding: '9px 20px', background: '#182035',
              border: '1px solid #E0E8F0', color: '#526070',
              borderRadius: '8px', fontSize: '13px', textDecoration: 'none',
            }}>
            수정
          </Link>
          {(isAuthor || isDesk) && <ReportDeleteButton reportId={id} />}
        </div>
      )}
    </div>
  )
}
