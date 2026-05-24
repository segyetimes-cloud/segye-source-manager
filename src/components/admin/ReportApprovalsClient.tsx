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

interface RejectModal {
  reportId: string
  title: string
  author: string
}

export default function ReportApprovalsClient({ reports: initialReports }: Props) {
  const router = useRouter()
  const [reports, setReports] = useState(initialReports)
  const [processing, setProcessing] = useState<string | null>(null)

  // 반려 모달
  const [rejectModal, setRejectModal] = useState<RejectModal | null>(null)
  const [rejectNote, setRejectNote] = useState('')
  const [rejectError, setRejectError] = useState('')

  function openRejectModal(report: SubmittedReport) {
    setRejectModal({
      reportId: report.id,
      title: report.title,
      author: report.profiles?.full_name ?? '—',
    })
    setRejectNote('')
    setRejectError('')
  }

  function closeRejectModal() {
    setRejectModal(null)
    setRejectNote('')
    setRejectError('')
  }

  async function handleApprove(reportId: string) {
    setProcessing(reportId)
    const res = await fetch(`/api/reports/${reportId}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    })
    if (res.ok) {
      setReports(prev => prev.filter(r => r.id !== reportId))
      router.refresh()
    }
    setProcessing(null)
  }

  async function handleReject() {
    if (!rejectModal) return
    const note = rejectNote.trim()
    if (!note) {
      setRejectError('반려 사유를 입력해 주세요.')
      return
    }
    setProcessing(rejectModal.reportId)
    setRejectError('')
    const res = await fetch(`/api/reports/${rejectModal.reportId}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', note }),
    })
    if (res.ok) {
      setReports(prev => prev.filter(r => r.id !== rejectModal.reportId))
      closeRejectModal()
      router.refresh()
    } else {
      const data = await res.json()
      setRejectError(data.error ?? '처리 실패')
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
    <>
      {/* ── 반려 모달 ── */}
      {rejectModal && (
        <div
          onClick={closeRejectModal}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(5,10,20,0.78)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '24px 16px',
          }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#0D1726', border: '1px solid #1E3050',
              borderRadius: '14px', width: '100%', maxWidth: 480,
              boxShadow: '0 20px 56px rgba(0,0,0,0.7)',
            }}>
            {/* 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #1A2838' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#C04040', margin: 0 }}>
                보고서 반려
              </h3>
              <button onClick={closeRejectModal} aria-label="닫기"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#8A9AB0', borderRadius: '7px', width: '30px', height: '30px', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ×
              </button>
            </div>

            {/* 내용 */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(192,64,64,0.06)', border: '1px solid rgba(192,64,64,0.2)' }}>
                <p style={{ fontSize: '12px', color: '#687898', margin: '0 0 3px' }}>반려 대상 보고서</p>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#CDD5E0', margin: '0 0 2px' }}>{rejectModal.title}</p>
                <p style={{ fontSize: '12px', color: '#687898', margin: 0 }}>작성자: {rejectModal.author}</p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#687898', marginBottom: '5px' }}>
                  반려 사유 <span style={{ color: '#C04040' }}>*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                  placeholder="반려 사유를 입력하세요"
                  autoFocus
                  style={{
                    width: '100%', background: '#131C2C', border: '1px solid #1A2838',
                    color: '#CDD5E0', borderRadius: '8px', padding: '9px 12px',
                    fontSize: '13px', outline: 'none', boxSizing: 'border-box', resize: 'none',
                  }}
                />
              </div>

              {rejectError && (
                <p style={{ fontSize: '12px', color: '#C04040', margin: 0 }}>{rejectError}</p>
              )}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={closeRejectModal}
                  style={{ background: '#182035', border: '1px solid #1A2838', color: '#687898', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', cursor: 'pointer' }}>
                  나가기
                </button>
                <button
                  onClick={handleReject}
                  disabled={processing === rejectModal.reportId}
                  style={{
                    background: 'rgba(192,64,64,0.15)', border: '1px solid rgba(192,64,64,0.4)', color: '#C04040',
                    borderRadius: '8px', padding: '9px 22px', fontSize: '13px', fontWeight: 700,
                    cursor: processing === rejectModal.reportId ? 'not-allowed' : 'pointer',
                    opacity: processing === rejectModal.reportId ? 0.6 : 1,
                  }}>
                  {processing === rejectModal.reportId ? '처리 중...' : '반려 확인'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 목록 */}
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
                    <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '4px', background: 'rgba(74,124,192,0.1)', color: '#687898' }}>
                      {report.profiles.department}
                    </span>
                  )}
                  <span style={{ fontSize: '11px', color: '#485870' }}>
                    {new Date(report.updated_at).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 제출
                  </span>
                </div>
                <Link href={`/reports/${report.id}`} style={{ textDecoration: 'none' }}>
                  <p style={{ fontSize: '15px', fontWeight: 600, color: '#CDD5E0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {report.title}
                  </p>
                </Link>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                <button
                  onClick={() => handleApprove(report.id)}
                  disabled={processing === report.id}
                  style={{
                    background: processing === report.id ? '#1A2838' : 'rgba(61,158,106,0.15)',
                    color: '#3D9E6A', border: '1px solid rgba(61,158,106,0.3)',
                    borderRadius: '7px', padding: '7px 16px', fontSize: '12px', fontWeight: 600,
                    cursor: processing === report.id ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                  }}>
                  승인
                </button>
                <button
                  onClick={() => openRejectModal(report)}
                  disabled={processing === report.id}
                  style={{
                    background: 'rgba(192,64,64,0.1)', color: '#C04040',
                    border: '1px solid rgba(192,64,64,0.2)',
                    borderRadius: '7px', padding: '7px 16px', fontSize: '12px', fontWeight: 600,
                    cursor: processing === report.id ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                  }}>
                  반려
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
