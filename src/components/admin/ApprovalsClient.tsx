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

export default function ApprovalsClient({ pending: initialPending, recent: initialRecent }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState(initialPending)
  const [recent, setRecent] = useState(initialRecent)
  const [processing, setProcessing] = useState<string | null>(null)
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({})
  const [showRejectForm, setShowRejectForm] = useState<string | null>(null)

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

  async function handleReject(approvalId: string) {
    const reason = rejectReasons[approvalId] ?? ''
    setProcessing(approvalId)
    const res = await fetch('/api/approvals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approval_id: approvalId, action: 'reject', reject_reason: reason }),
    })
    if (res.ok) {
      const rejected = pending.find(a => a.id === approvalId)
      if (rejected) {
        setPending(prev => prev.filter(a => a.id !== approvalId))
        setRecent(prev => [{ ...rejected, status: 'rejected' as const, reject_reason: reason }, ...prev])
      }
      setShowRejectForm(null)
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
            <p className="text-sm" style={{ color: '#485870' }}>대기 중인 요청이 없습니다 ✅</p>
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
                          style={{ background: 'rgba(30,144,255,0.1)', color: '#687898' }}>
                          {app.profiles.department}
                        </span>
                      )}
                    </div>

                    <p className="text-xs mb-1" style={{ color: '#485870' }}>
                      📄 취재원:{' '}
                      <Link href={`/sources/${app.source_id}`} style={{ color: '#4A7CC0', textDecoration: 'none' }}>
                        {app.sources?.full_name ?? app.source_id}
                      </Link>
                      {app.sources?.current_organization && ` (${app.sources.current_organization})`}
                    </p>

                    <div className="mt-2 p-3 rounded-lg" style={{ background: '#182035' }}>
                      <p className="text-xs font-medium mb-1" style={{ color: '#687898' }}>신청 사유</p>
                      <p className="text-sm" style={{ color: '#CDD5E0' }}>{app.reason}</p>
                    </div>

                    <p className="text-xs mt-2" style={{ color: '#485870' }}>
                      신청일: {new Date(app.requested_at).toLocaleString('ko-KR')}
                    </p>

                    {showRejectForm === app.id && (
                      <div className="mt-3">
                        <textarea
                          value={rejectReasons[app.id] ?? ''}
                          onChange={e => setRejectReasons(prev => ({ ...prev, [app.id]: e.target.value }))}
                          placeholder="거절 사유를 입력하세요 (선택사항)"
                          rows={2}
                          style={{
                            width: '100%',
                            background: '#182035',
                            border: '1px solid rgba(255,68,68,0.3)',
                            color: '#CDD5E0',
                            borderRadius: '8px',
                            padding: '8px',
                            fontSize: '13px',
                            resize: 'none',
                            outline: 'none',
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(app.id)}
                      disabled={processing === app.id}
                      className="px-4 py-2 rounded-lg text-xs font-semibold"
                      style={{
                        background: processing === app.id ? '#1A2838' : 'rgba(0,204,102,0.15)',
                        color: '#3D9E6A',
                        border: '1px solid rgba(0,204,102,0.3)',
                        cursor: processing === app.id ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}>
                      ✅ 승인
                    </button>

                    {showRejectForm === app.id ? (
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleReject(app.id)}
                          disabled={processing === app.id}
                          className="px-4 py-2 rounded-lg text-xs font-semibold"
                          style={{
                            background: 'rgba(255,68,68,0.15)',
                            color: '#C04040',
                            border: '1px solid rgba(255,68,68,0.3)',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          }}>
                          거절 확인
                        </button>
                        <button
                          onClick={() => setShowRejectForm(null)}
                          className="px-4 py-1.5 rounded-lg text-xs"
                          style={{ background: '#182035', color: '#485870', border: '1px solid #1A2838', cursor: 'pointer' }}>
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowRejectForm(app.id)}
                        className="px-4 py-2 rounded-lg text-xs font-semibold"
                        style={{
                          background: 'rgba(255,68,68,0.1)',
                          color: '#C04040',
                          border: '1px solid rgba(255,68,68,0.2)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                        }}>
                        ✗ 거절
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 최근 처리 내역 */}
      <section>
        <h2 className="text-sm font-semibold mb-3" style={{ color: '#687898' }}>최근 처리 내역</h2>
        {recent.length === 0 ? (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '24px' }}>
            <p className="text-sm" style={{ color: '#485870' }}>처리 내역이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map(app => (
              <div key={app.id} style={cardStyle}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xs px-2 py-0.5 rounded font-semibold"
                      style={{
                        background: app.status === 'approved' ? 'rgba(0,204,102,0.15)' : 'rgba(255,68,68,0.1)',
                        color: app.status === 'approved' ? '#3D9E6A' : '#C04040',
                      }}>
                      {app.status === 'approved' ? '✅ 승인' : '✗ 거절'}
                    </span>
                    <span className="text-sm" style={{ color: '#CDD5E0' }}>{app.profiles?.full_name ?? '—'}</span>
                    <span className="text-xs" style={{ color: '#485870' }}>→</span>
                    <Link href={`/sources/${app.source_id}`} className="text-sm" style={{ color: '#4A7CC0', textDecoration: 'none' }}>
                      {app.sources?.full_name ?? app.source_id}
                    </Link>
                  </div>
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-xs" style={{ color: '#485870' }}>
                      {app.decided_at ? new Date(app.decided_at).toLocaleDateString('ko-KR') : '—'}
                    </span>
                    {app.status === 'approved' && app.expires_at && (
                      <span className="text-xs" style={{ color: '#485870' }}>
                        ~{new Date(app.expires_at).toLocaleDateString('ko-KR')} 만료
                      </span>
                    )}
                  </div>
                </div>
                {app.reject_reason && (
                  <p className="text-xs mt-1.5" style={{ color: '#485870' }}>
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
