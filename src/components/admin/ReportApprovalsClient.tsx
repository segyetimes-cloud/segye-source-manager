'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface SubmittedReport {
  id: string
  title: string
  author_id: string
  status: string
  created_at: string
  updated_at: string
  profiles: { full_name: string; department: string | null } | null
}

interface Props {
  reports: SubmittedReport[]
}

export default function ReportApprovalsClient({ reports: initialReports }: Props) {
  const router = useRouter()
  const [reports, setReports] = useState(initialReports)
  const [processing, setProcessing] = useState<string | null>(null)
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({})
  const [showRejectForm, setShowRejectForm] = useState<string | null>(null)
  const [error, setError] = useState<Record<string, string>>({})

  async function handleApprove(reportId: string) {
    setProcessing(reportId)
    setError(prev => ({ ...prev, [reportId]: '' }))
    const res = await fetch(`/api/reports/${reportId}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    })
    if (res.ok) {
      setReports(prev => prev.filter(r => r.id !== reportId))
      router.refresh()
    } else {
      const data = await res.json()
      setError(prev => ({ ...prev, [reportId]: data.error ?? '처리 실패' }))
    }
    setProcessing(null)
  }

  async function handleReject(reportId: string) {
    const note = rejectNotes[reportId]?.trim() ?? ''
    if (!note) {
      setError(prev => ({ ...prev, [reportId]: '반려 사유를 입력해 주세요.' }))
      return
    }
    setProcessing(reportId)
    setError(prev => ({ ...prev, [reportId]: '' }))
    const res = await fetch(`/api/reports/${reportId}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', note }),
    })
    if (res.ok) {
      setReports(prev => prev.filter(r => r.id !== reportId))
      setShowRejectForm(null)
      router.refresh()
    } else {
      const data = await res.json()
      setError(prev => ({ ...prev, [reportId]: data.error ?? '처리 실패' }))
    }
    setProcessing(null)
  }

  const cardStyle = {
    background: 'rgba(15,32,64,0.85)',
    border: '1px solid rgba(74,124,192,0.2)',
    borderRadius: '12px',
    padding: '16px',
  }

  if (reports.length === 0) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center' as const, padding: '40px', border: '1px solid #1A2838' }}>
        <p style={{ color: '#485870', fontSize: '14px' }}>검토 대기 중인 보고서가 없습니다</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {reports.map(report => (
        <div key={report.id} style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#687898' }}>
                  {report.profiles?.full_name ?? '—'}
                </span>
                {report.profiles?.department && (
                  <span style={{
                    fontSize: '11px', padding: '1px 7px', borderRadius: '4px',
                    background: 'rgba(74,124,192,0.1)', color: '#687898',
                  }}>
                    {report.profiles.department}
                  </span>
                )}
                <span style={{ fontSize: '11px', color: '#485870' }}>
                  {new Date(report.updated_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 제출
                </span>
              </div>

              <Link href={`/reports/${report.id}`} style={{ textDecoration: 'none' }}>
                <p style={{
                  fontSize: '15px', fontWeight: 600, color: '#CDD5E0',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {report.title}
                </p>
              </Link>

              {error[report.id] && (
                <p style={{ fontSize: '12px', color: '#C04040', marginTop: '6px' }}>{error[report.id]}</p>
              )}

              {showRejectForm === report.id && (
                <div style={{ marginTop: '10px' }}>
                  <textarea
                    value={rejectNotes[report.id] ?? ''}
                    onChange={e => setRejectNotes(prev => ({ ...prev, [report.id]: e.target.value }))}
                    placeholder="반려 사유를 입력하세요"
                    rows={2}
                    style={{
                      width: '100%',
                      background: '#0D1520',
                      border: '1px solid rgba(192,64,64,0.3)',
                      color: '#CDD5E0',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '13px',
                      resize: 'none',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
              <button
                onClick={() => handleApprove(report.id)}
                disabled={processing === report.id}
                style={{
                  background: processing === report.id ? '#1A2838' : 'rgba(61,158,106,0.15)',
                  color: '#3D9E6A',
                  border: '1px solid rgba(61,158,106,0.3)',
                  borderRadius: '7px', padding: '7px 16px',
                  fontSize: '12px', fontWeight: 600,
                  cursor: processing === report.id ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}>
                승인
              </button>

              {showRejectForm === report.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button
                    onClick={() => handleReject(report.id)}
                    disabled={processing === report.id}
                    style={{
                      background: 'rgba(192,64,64,0.15)',
                      color: '#C04040',
                      border: '1px solid rgba(192,64,64,0.3)',
                      borderRadius: '7px', padding: '7px 14px',
                      fontSize: '12px', fontWeight: 600,
                      cursor: processing === report.id ? 'not-allowed' : 'pointer',
                    }}>
                    반려 확인
                  </button>
                  <button
                    onClick={() => setShowRejectForm(null)}
                    style={{
                      background: '#182035', border: '1px solid #1A2838',
                      color: '#485870', borderRadius: '7px', padding: '5px 12px',
                      fontSize: '12px', cursor: 'pointer',
                    }}>
                    취소
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowRejectForm(report.id)}
                  disabled={processing === report.id}
                  style={{
                    background: 'rgba(192,64,64,0.1)',
                    color: '#C04040',
                    border: '1px solid rgba(192,64,64,0.2)',
                    borderRadius: '7px', padding: '7px 16px',
                    fontSize: '12px', fontWeight: 600,
                    cursor: processing === report.id ? 'not-allowed' : 'pointer',
                    whiteSpace: 'nowrap',
                  }}>
                  반려
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
