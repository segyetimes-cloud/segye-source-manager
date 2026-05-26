'use client'

import { useEffect, useState } from 'react'
import ReportContentViewer from './ReportContentViewer'
import VisibilityBadge from './VisibilityBadge'
import type { ReportVisibility } from '@/types/database'

interface ReportDetail {
  id: string
  title: string
  content: string
  sensitive_content: string | null
  category: string | null
  tags: string[]
  visibility: string
  status: string
  created_at: string
  profiles: { full_name: string; department: string | null } | null
  report_sources: Array<{
    source_id: string
    sources: { id: string; full_name: string; current_organization: string | null } | null
  }>
}

interface Props {
  reportId: string
  onClose: () => void
  userId: string
  userFullName: string
  userDepartment: string | null
}

const STATUS_LABEL: Record<string, string> = {
  draft: '임시저장', submitted: '검토 중', approved: '승인됨', rejected: '반려됨',
}
const STATUS_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  draft:     { bg: 'rgba(104,120,152,0.15)', color: '#8AAAC8', border: 'rgba(104,120,152,0.35)' },
  submitted: { bg: 'rgba(74,124,192,0.15)',  color: '#4A7CC0', border: 'rgba(74,124,192,0.35)' },
  approved:  { bg: 'rgba(61,158,106,0.15)',  color: '#3D9E6A', border: 'rgba(61,158,106,0.35)' },
  rejected:  { bg: 'rgba(192,64,64,0.15)',   color: '#C04040', border: 'rgba(192,64,64,0.35)' },
}

export default function ReportModal({ reportId, onClose, userId, userFullName, userDepartment }: Props) {
  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    setReport(null)
    fetch(`/api/reports/${reportId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error)
        else setReport(data.report)
      })
      .catch(() => setError('보고서를 불러오는 데 실패했습니다.'))
      .finally(() => setLoading(false))
  }, [reportId])

  // ESC 키 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  // body 스크롤 잠금
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  const st = report ? (STATUS_COLOR[report.status] ?? STATUS_COLOR.approved) : STATUS_COLOR.approved

  return (
    /* 백드롭 — 클릭 시 닫기 */
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(5,10,20,0.78)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '48px 16px 48px',
        overflowY: 'auto',
      }}>

      {/* 모달 박스 */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0D1726',
          border: '1px solid #1E3050',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '740px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.75)',
          position: 'relative',
          marginBottom: '48px',
        }}>

        {/* ── X 닫기 버튼 ── */}
        <button
          onClick={onClose}
          aria-label="닫기"
          style={{
            position: 'absolute', top: '14px', right: '14px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: '#8A9AB0', borderRadius: '8px',
            width: '32px', height: '32px',
            cursor: 'pointer', fontSize: '20px', lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 10,
            transition: 'background 0.15s, color 0.15s',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.13)'
            ;(e.currentTarget as HTMLButtonElement).style.color = '#CDD5E0'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)'
            ;(e.currentTarget as HTMLButtonElement).style.color = '#8A9AB0'
          }}>
          ×
        </button>

        <div style={{ padding: '24px 28px 28px' }}>

          {/* ── 로딩 ── */}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '56px 0' }}>
              <div className="w-8 h-8 rounded-full border-2 animate-spin"
                style={{ borderColor: '#1A2838', borderTopColor: '#4A7CC0' }} />
            </div>
          )}

          {/* ── 에러 ── */}
          {!loading && error && (
            <p style={{ color: '#C04040', textAlign: 'center', padding: '40px 0', margin: 0 }}>{error}</p>
          )}

          {/* ── 본문 ── */}
          {!loading && report && (
            <>
              {/* 제목 */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 14, paddingRight: 40 }}>
                {report.category && report.category !== '일반' && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                    flexShrink: 0, marginTop: 4,
                    background: report.category === '단독' ? 'rgba(192,64,64,0.15)' :
                                report.category === '인터뷰' ? 'rgba(61,158,106,0.15)' : 'rgba(74,124,192,0.15)',
                    color: report.category === '단독' ? '#C04040' :
                           report.category === '인터뷰' ? '#3D9E6A' : '#4A7CC0',
                  }}>{report.category}</span>
                )}
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#CDD5E0', lineHeight: 1.35, flex: 1, margin: 0 }}>
                  {report.title}
                </h2>
              </div>

              {/* 배지 + 메타 */}
              <div style={{
                display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8,
                marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid #1A2838',
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 5,
                  background: st.bg, color: st.color, border: `1px solid ${st.border}`,
                }}>
                  {STATUS_LABEL[report.status] ?? '승인됨'}
                </span>
                <VisibilityBadge visibility={report.visibility as ReportVisibility} />
                <span style={{ fontSize: 12, color: '#8AAAC8', marginLeft: 'auto' }}>
                  ✍️ {report.profiles?.full_name ?? '—'}
                  {report.profiles?.department ? ` · ${report.profiles.department}` : ''}
                </span>
                <span style={{ fontSize: 12, color: '#607898' }}>
                  {new Date(report.created_at).toLocaleDateString('ko-KR', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                  })}
                </span>
              </div>

              {/* 공개 본문 */}
              <div style={{ marginBottom: 16 }}>
                <ReportContentViewer
                  reportId={report.id}
                  content={report.content}
                  userId={userId}
                  userFullName={userFullName}
                  userDepartment={userDepartment}
                />
              </div>

              {/* 민감정보 */}
              {report.sensitive_content && (
                <div style={{
                  background: 'rgba(255,153,0,0.04)',
                  border: '1px solid rgba(255,153,0,0.3)',
                  borderRadius: 10, padding: '12px 16px', marginBottom: 16,
                }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: '#A87228', marginBottom: 6, margin: '0 0 6px' }}>
                    ⚠️ 민감정보
                  </p>
                  <p style={{ fontSize: 13, color: '#CDD5E0', whiteSpace: 'pre-wrap', lineHeight: 1.7, margin: 0 }}>
                    {report.sensitive_content}
                  </p>
                </div>
              )}

              {/* 태그 */}
              {report.tags?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
                  {report.tags.map((tag, i) => (
                    <span key={i} style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 4,
                      background: 'rgba(30,144,255,0.1)', color: '#4A7CC0',
                      border: '1px solid rgba(30,144,255,0.2)',
                    }}>#{tag}</span>
                  ))}
                </div>
              )}

              {/* 연결된 취재원 */}
              {(report.report_sources?.length ?? 0) > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, color: '#607898', margin: '0 0 6px' }}>연결된 취재원</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {report.report_sources.map((rs, i) => rs.sources && (
                      <a
                        key={i}
                        href={`/sources/${rs.sources.id}`}
                        onClick={e => e.stopPropagation()}
                        style={{
                          fontSize: 12, padding: '4px 10px', borderRadius: 6, textDecoration: 'none',
                          background: 'rgba(0,212,255,0.07)', color: '#3A90A8',
                          border: '1px solid rgba(0,212,255,0.15)',
                        }}>
                        👤 {rs.sources.full_name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* 하단: 전체 페이지 이동 */}
              <div style={{ borderTop: '1px solid #1A2838', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  onClick={onClose}
                  style={{
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#8AAAC8', borderRadius: 8, padding: '6px 14px',
                    fontSize: 12, cursor: 'pointer',
                  }}>
                  나가기
                </button>
                <a
                  href={`/reports/${report.id}`}
                  style={{ fontSize: 12, color: '#4A7CC0', textDecoration: 'none' }}>
                  전체 페이지로 보기 →
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
