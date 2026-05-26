'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Approval {
  id: string
  source_id: string
  requester_id: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string
  decided_at: string | null
  expires_at: string | null
  reject_reason: string | null
  sources: { full_name: string; current_organization: string | null } | null
  profiles: { full_name: string; department: string | null; email: string } | null
}

interface Props {
  pending: Approval[]
  recent: Approval[]
}

interface RejectModal {
  approvalId: string
  sourceName: string
  requesterName: string
}

const modalInput: React.CSSProperties = {
  width: '100%', background: '#131C2C', border: '1px solid #1A2838',
  color: '#CDD5E0', borderRadius: '8px', padding: '9px 12px',
  fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  resize: 'none',
}

export default function ApprovalsClient({ pending: initialPending, recent: initialRecent }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(initialPending)
  const [recent, setRecent] = useState(initialRecent)
  const [processing, setProcessing] = useState<string | null>(null)

  // 거절 모달
  const [rejectModal, setRejectModal] = useState<RejectModal | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectError, setRejectError] = useState('')

  function openRejectModal(app: Approval) {
    setRejectModal({
      approvalId: app.id,
      sourceName: app.sources?.full_name ?? app.source_id,
      requesterName: app.profiles?.full_name ?? '—',
    })
    setRejectReason('')
    setRejectError('')
  }

  function closeRejectModal() {
    setRejectModal(null)
    setRejectReason('')
    setRejectError('')
  }

  async function handleApprove(approvalId: string) {
    setProcessing(approvalId)
    const res = await fetch('/api/approvals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approval_id: approvalId, action: 'approve' }),
    })
    if (res.ok) {
      const approved = pending.find(a => a.id === approvalId)
      if (approved) {
        setPending(prev => prev.filter(a => a.id !== approvalId))
        setRecent(prev => [{ ...approved, status: 'approved' as const }, ...prev])
      }
      router.refresh()
    }
    setProcessing(null)
  }

  async function handleReject() {
    if (!rejectModal) return
    setProcessing(rejectModal.approvalId)
    setRejectError('')
    const res = await fetch('/api/approvals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approval_id: rejectModal.approvalId, action: 'reject', reject_reason: rejectReason }),
    })
    if (res.ok) {
      const rejected = pending.find(a => a.id === rejectModal.approvalId)
      if (rejected) {
        setPending(prev => prev.filter(a => a.id !== rejectModal.approvalId))
        setRecent(prev => [{ ...rejected, status: 'rejected' as const, reject_reason: rejectReason }, ...prev])
      }
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
    border: '1px solid #1A2838',
    borderRadius: '12px',
    padding: '16px',
  }

  return (
    <div className="space-y-8">
      {/* ── 거절 모달 ── */}
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
              borderRadius: '14px', width: '100%', maxWidth: 460,
              boxShadow: '0 20px 56px rgba(0,0,0,0.7)', position: 'relative',
            }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #1A2838' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#C04040', margin: 0 }}>
                ✗ 열람 요청 거절
              </h3>
              <button onClick={closeRejectModal} aria-label="닫기"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#8A9AB0', borderRadius: '7px', width: '30px', height: '30px', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ×
              </button>
            </div>
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(192,64,64,0.06)', border: '1px solid rgba(192,64,64,0.2)' }}>
                <p style={{ fontSize: '12px', color: '#8AAAC8', margin: '0 0 4px' }}>거절 대상</p>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#CDD5E0', margin: '0 0 2px' }}>
                  {rejectModal.requesterName} → {rejectModal.sourceName}
                </p>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#8AAAC8', marginBottom: '5px' }}>
                  거절 사유 (선택사항)
                </label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="거절 사유를 입력하세요 (생략 가능)"
                  style={{ ...modalInput }}
                />
              </div>
              {rejectError && <p style={{ fontSize: '12px', color: '#C04040', margin: 0 }}>{rejectError}</p>}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={closeRejectModal}
                  style={{ background: '#182035', border: '1px solid #1A2838', color: '#8AAAC8', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', cursor: 'pointer' }}>
                  나가기
                </button>
                <button onClick={handleReject} disabled={processing === rejectModal.approvalId}
                  style={{
                    background: 'rgba(192,64,64,0.15)', border: '1px solid rgba(192,64,64,0.4)', color: '#C04040',
                    borderRadius: '8px', padding: '9px 22px', fontSize: '13px', fontWeight: 700,
                    cursor: processing === rejectModal.approvalId ? 'not-allowed' : 'pointer',
                    opacity: processing === rejectModal.approvalId ? 0.6 : 1,
                  }}>
                  {processing === rejectModal.approvalId ? '처리 중...' : '거절 확인'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 대기 중 */}
      <section>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: '#CDD5E0' }}>
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold"
            style={{ background: '#A87228', color: 'white' }}>
            {pending.length}
          </span>
          승인 대기 중
        </h2>

        {pending.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '32px' }}>
            <p className="text-sm" style={{ color: '#607898' }}>대기 중인 요청이 없습니다 ✅</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map(app => (
              <div key={app.id} style={{ ...cardStyle, border: '1px solid rgba(255,153,0,0.25)' }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold" style={{ color: '#CDD5E0' }}>
                        {app.profiles?.full_name ?? '—'}
                      </span>
                      {app.profiles?.department && (
                        <span className="text-xs px-2 py-0.5 rounded"
                          style={{ background: 'rgba(30,144,255,0.1)', color: '#8AAAC8' }}>
                          {app.profiles.department}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mb-1" style={{ color: '#607898' }}>
                      📄 취재원:{' '}
                      <Link href={`/sources/${app.source_id}`} style={{ color: '#4A7CC0', textDecoration: 'none' }}>
                        {app.sources?.full_name ?? app.source_id}
                      </Link>
                      {app.sources?.current_organization && ` (${app.sources.current_organization})`}
                    </p>
                    <div className="mt-2 p-3 rounded-lg" style={{ background: '#182035' }}>
                      <p className="text-xs font-medium mb-1" style={{ color: '#8AAAC8' }}>신청 사유</p>
                      <p className="text-sm" style={{ color: '#CDD5E0' }}>{app.reason}</p>
                    </div>
                    <p className="text-xs mt-2" style={{ color: '#607898' }}>
                      신청일: {new Date(app.requested_at).toLocaleString('ko-KR')}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(app.id)}
                      disabled={processing === app.id}
                      className="px-4 py-2 rounded-lg text-xs font-semibold"
                      style={{
                        background: processing === app.id ? '#1A2838' : 'rgba(0,204,102,0.15)',
                        color: '#3D9E6A', border: '1px solid rgba(0,204,102,0.3)',
                        cursor: processing === app.id ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                      }}>
                      ✅ 승인
                    </button>
                    <button
                      onClick={() => openRejectModal(app)}
                      className="px-4 py-2 rounded-lg text-xs font-semibold"
                      style={{
                        background: 'rgba(255,68,68,0.1)', color: '#C04040',
                        border: '1px solid rgba(255,68,68,0.2)',
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>
                      ✗ 거절
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 최근 처리 내역 */}
      <section>
        <h2 className="text-sm font-semibold mb-3" style={{ color: '#8AAAC8' }}>최근 처리 내역</h2>
        {recent.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '24px' }}>
            <p className="text-sm" style={{ color: '#607898' }}>처리 내역이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map(app => (
              <div key={app.id} style={cardStyle}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-0.5 rounded font-semibold"
                      style={{
                        background: app.status === 'approved' ? 'rgba(0,204,102,0.15)' : 'rgba(255,68,68,0.1)',
                        color: app.status === 'approved' ? '#3D9E6A' : '#C04040',
                      }}>
                      {app.status === 'approved' ? '✅ 승인' : '✗ 거절'}
                    </span>
                    <span className="text-sm" style={{ color: '#CDD5E0' }}>{app.profiles?.full_name ?? '—'}</span>
                    <span className="text-xs" style={{ color: '#607898' }}>→</span>
                    <Link href={`/sources/${app.source_id}`} className="text-sm" style={{ color: '#4A7CC0', textDecoration: 'none' }}>
                      {app.sources?.full_name ?? app.source_id}
                    </Link>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-xs" style={{ color: '#607898' }}>
                      {app.decided_at ? new Date(app.decided_at).toLocaleDateString('ko-KR') : '—'}
                    </span>
                    {app.status === 'approved' && app.expires_at && (
                      <span className="text-xs" style={{ color: '#607898' }}>
                        ~{new Date(app.expires_at).toLocaleDateString('ko-KR')} 만료
                      </span>
                    )}
                  </div>
                </div>
                {app.reject_reason && (
                  <p className="text-xs mt-1.5" style={{ color: '#607898' }}>
                    사유: {app.reject_reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
