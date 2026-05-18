import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import type { ReportVisibility } from '@/types/database'
import ReportDeleteButton from '@/components/reports/ReportDeleteButton'

interface Params {
  params: Promise<{ id: string }>
}

function VisibilityBadge({ visibility }: { visibility: ReportVisibility }) {
  const map = {
    author_only: { bg: 'rgba(255,153,0,0.1)', color: '#FF9900', label: '🔒 작성자만' },
    desk_above:  { bg: 'rgba(0,212,255,0.1)',  color: '#00D4FF', label: '📋 데스크' },
    all:         { bg: 'rgba(0,204,102,0.1)',  color: '#00CC66', label: '🌐 전체' },
  }
  const s = map[visibility] ?? map.author_only
  return (
    <span style={{
      background: s.bg, color: s.color,
      border: `1px solid ${s.color}44`,
      borderRadius: '6px', padding: '3px 10px',
      fontSize: '12px', fontWeight: 600,
    }}>
      {s.label}
    </span>
  )
}

export default async function ReportDetailPage({ params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const supabaseAny = supabase as any

  const { data: report } = await supabaseAny
    .from('information_reports')
    .select(`
      *,
      profiles!author_id(full_name, department),
      report_sources(source_id, sources!source_id(id, full_name, current_organization))
    `)
    .eq('id', id)
    .eq('is_deleted', false)
    .single()

  if (!report) notFound()

  const isAuthor = report.author_id === user.id

  const author = report.profiles as { full_name: string; department: string | null } | null
  const sourcesRaw = (report.report_sources as any[]) ?? []
  const linkedSources = sourcesRaw.map((rs: any) => rs.sources).filter(Boolean)

  const dateStr = new Date(report.created_at).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="max-w-3xl mx-auto space-y-5" style={{ paddingBottom: '2rem' }}>

      {/* 뒤로가기 */}
      <div className="flex items-center gap-2">
        <Link href="/reports" style={{ color: '#4A6080', textDecoration: 'none', fontSize: '22px', lineHeight: 1 }}>←</Link>
        <span style={{ fontSize: '13px', color: '#4A6080' }}>정보보고 목록</span>
      </div>

      {/* 메인 카드 */}
      <div className="glass-card p-5">
        {/* 제목 + 배지 */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#E8F0FE', lineHeight: 1.35, flex: 1 }}>
            {report.title}
          </h1>
          <VisibilityBadge visibility={report.visibility as ReportVisibility} />
        </div>

        {/* 메타 */}
        <div className="flex flex-wrap items-center gap-3 mb-4" style={{ borderBottom: '1px solid #1A3050', paddingBottom: '12px' }}>
          <span style={{ fontSize: '13px', color: '#8899BB' }}>
            ✍️ {author?.full_name ?? '—'}
            {author?.department ? ` · ${author.department}` : ''}
          </span>
          <span style={{ fontSize: '12px', color: '#4A6080' }}>🕐 {dateStr}</span>
        </div>

        {/* 본문 */}
        <div style={{
          fontSize: '14px', color: '#D0DFF5',
          lineHeight: 1.8, whiteSpace: 'pre-wrap',
          marginBottom: '16px',
        }}>
          {report.content}
        </div>

        {/* 태그 */}
        {(report.tags as string[]).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {(report.tags as string[]).map((tag, i) => (
              <span key={i} style={{
                background: 'rgba(30,144,255,0.1)',
                color: '#1E90FF',
                border: '1px solid rgba(30,144,255,0.2)',
                borderRadius: '4px', padding: '2px 8px',
                fontSize: '12px',
              }}>
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 연결된 취재원 */}
      {linkedSources.length > 0 && (
        <div className="glass-card p-4">
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#E8F0FE', marginBottom: '10px' }}>
            👤 연결된 취재원 ({linkedSources.length}명)
          </h2>
          <div className="flex flex-wrap gap-2">
            {linkedSources.map((src: any) => (
              <Link
                key={src.id}
                href={`/sources/${src.id}`}
                style={{ textDecoration: 'none' }}>
                <div style={{
                  background: '#132850',
                  border: '1px solid #1A3050',
                  borderRadius: '8px', padding: '8px 14px',
                  cursor: 'pointer',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#1E90FF')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#1A3050')}>
                  <p style={{ fontSize: '13px', fontWeight: 600, color: '#E8F0FE' }}>{src.full_name}</p>
                  {src.current_organization && (
                    <p style={{ fontSize: '12px', color: '#5A7099', marginTop: '2px' }}>{src.current_organization}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* 작성자 액션 버튼 */}
      {isAuthor && (
        <div className="flex gap-2">
          <Link
            href={`/reports/${id}/edit`}
            style={{
              padding: '9px 20px',
              background: '#132850',
              border: '1px solid #1A3050',
              color: '#8899BB',
              borderRadius: '8px',
              fontSize: '13px',
              textDecoration: 'none',
            }}>
            수정
          </Link>
          <ReportDeleteButton reportId={id} />
        </div>
      )}
    </div>
  )
}
