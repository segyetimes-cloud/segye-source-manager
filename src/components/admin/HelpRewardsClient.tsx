'use client'

import { useState } from 'react'

interface Profile { full_name: string; department: string | null }
interface HelpResponse {
  id: string
  responder_id: string
  body: string
  is_accepted: boolean
  profiles: Profile | null
}
interface HelpRequest {
  id: string
  title: string
  request_type: string
  target_name: string | null
  reward_points: number
  created_at: string
  requester_id: string
  accepted_response_id: string | null
  profiles: Profile | null
  help_responses: HelpResponse[]
}

interface PointsModal {
  userId: string
  requestId: string
  userName: string
}

const REQUEST_TYPE_LABEL: Record<string, string> = {
  contact: '📞 연락처',
  info: '📋 정보',
  interview: '🎤 인터뷰',
  other: '💬 기타',
}

const modalInput: React.CSSProperties = {
  width: '100%', background: '#131C2C', border: '1px solid #1A2838',
  color: '#DCE8F4', borderRadius: '8px', padding: '9px 12px',
  fontSize: '13px', outline: 'none', boxSizing: 'border-box',
}

export default function HelpRewardsClient({ requests }: { requests: HelpRequest[] }) {
  const [awarding, setAwarding] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  // 모달 상태
  const [modal, setModal] = useState<PointsModal | null>(null)
  const [points, setPoints] = useState('')
  const [reason, setReason] = useState('')
  const [modalError, setModalError] = useState('')

  function openModal(userId: string, requestId: string, userName: string) {
    setModal({ userId, requestId, userName })
    setPoints('')
    setReason('')
    setModalError('')
  }

  function closeModal() {
    setModal(null)
    setPoints('')
    setReason('')
    setModalError('')
  }

  async function submitPoints() {
    if (!modal) return
    const pts = parseInt(points)
    if (isNaN(pts) || pts < 1 || pts > 500) {
      setModalError('1~500 사이의 숫자를 입력해주세요')
      return
    }
    if (!reason.trim()) {
      setModalError('지급 사유를 입력해주세요')
      return
    }
    setAwarding(true)
    setModalError('')
    const res = await fetch('/api/admin/points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: modal.userId,
        points: pts,
        reason: reason.trim(),
        related_request_id: modal.requestId,
      }),
    })
    setAwarding(false)
    if (res.ok) {
      closeModal()
      setSuccess(`${modal.userName}에게 ${pts}pt 지급 완료!`)
      setTimeout(() => setSuccess(null), 3000)
    } else {
      const data = await res.json()
      setModalError('오류: ' + (data.error ?? '알 수 없는 오류'))
    }
  }

  if (requests.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <p style={{ color: '#607898' }}>해결된 도움 요청이 없습니다</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {success && (
        <div className="p-3 rounded-lg text-sm text-center font-semibold"
          style={{ background: 'rgba(0,204,102,0.1)', color: '#3D9E6A', border: '1px solid rgba(0,204,102,0.2)' }}>
          ✅ {success}
        </div>
      )}

      {requests.map(req => {
        const acceptedResp = req.help_responses?.find(r => r.is_accepted)
        return (
          <div key={req.id} className="glass-card p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded"
                    style={{ background: 'rgba(30,144,255,0.1)', color: '#8AAAC8' }}>
                    {REQUEST_TYPE_LABEL[req.request_type] ?? req.request_type}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: '#7E6E48' }}>
                    기존 리워드: {req.reward_points}pt
                  </span>
                </div>
                <h3 className="font-semibold" style={{ color: '#DCE8F4' }}>{req.title}</h3>
                {req.target_name && (
                  <p className="text-xs mt-1" style={{ color: '#8AAAC8' }}>대상: {req.target_name}</p>
                )}
              </div>
              <span className="text-xs flex-shrink-0" style={{ color: '#607898' }}>
                {new Date(req.created_at).toLocaleDateString('ko-KR')}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg p-3" style={{ background: 'rgba(30,144,255,0.05)', border: '1px solid rgba(30,144,255,0.1)' }}>
                <p className="text-xs mb-1" style={{ color: '#607898' }}>📝 요청자</p>
                <p className="text-sm font-semibold" style={{ color: '#DCE8F4' }}>
                  {req.profiles?.full_name ?? '—'}
                </p>
                {req.profiles?.department && (
                  <p className="text-xs" style={{ color: '#8AAAC8' }}>{req.profiles.department}</p>
                )}
                <button
                  onClick={() => openModal(req.requester_id, req.id, req.profiles?.full_name ?? '요청자')}
                  className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold w-full"
                  style={{ background: 'linear-gradient(135deg, #4A7CC0, #0066CC)', color: 'white', border: 'none', cursor: 'pointer' }}>
                  + 보너스 지급
                </button>
              </div>

              {acceptedResp ? (
                <div className="rounded-lg p-3" style={{ background: 'rgba(0,204,102,0.05)', border: '1px solid rgba(0,204,102,0.1)' }}>
                  <p className="text-xs mb-1" style={{ color: '#607898' }}>✅ 채택된 응답자</p>
                  <p className="text-sm font-semibold" style={{ color: '#DCE8F4' }}>
                    {acceptedResp.profiles?.full_name ?? '—'}
                  </p>
                  {acceptedResp.profiles?.department && (
                    <p className="text-xs" style={{ color: '#8AAAC8' }}>{acceptedResp.profiles.department}</p>
                  )}
                  <button
                    onClick={() => openModal(acceptedResp.responder_id, req.id, acceptedResp.profiles?.full_name ?? '응답자')}
                    className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold w-full"
                    style={{ background: 'linear-gradient(135deg, #3D9E6A, #009944)', color: 'white', border: 'none', cursor: 'pointer' }}>
                    + 보너스 지급
                  </button>
                </div>
              ) : (
                <div className="rounded-lg p-3 flex items-center justify-center"
                  style={{ background: 'rgba(74,96,128,0.05)', border: '1px solid rgba(74,96,128,0.1)' }}>
                  <p className="text-xs" style={{ color: '#607898' }}>채택된 응답 없음</p>
                </div>
              )}
            </div>
          </div>
        )
      })}

      {/* ── 포인트 지급 모달 ── */}
      {modal && (
        <div
          onClick={closeModal}
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
              borderRadius: '14px', width: '100%', maxWidth: 440,
              boxShadow: '0 20px 56px rgba(0,0,0,0.7)', position: 'relative',
            }}>
            {/* 헤더 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #1A2838' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#DCE8F4', margin: 0 }}>
                보너스 포인트 지급
              </h3>
              <button onClick={closeModal} aria-label="닫기"
                style={{
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#8A9AB0', borderRadius: '7px', width: '30px', height: '30px',
                  cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                ×
              </button>
            </div>

            {/* 내용 */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'rgba(74,124,192,0.08)', border: '1px solid rgba(74,124,192,0.2)' }}>
                <p style={{ fontSize: '12px', color: '#8AAAC8', margin: '0 0 2px' }}>대상</p>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#DCE8F4', margin: 0 }}>{modal.userName}</p>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#8AAAC8', marginBottom: '5px' }}>
                  포인트 (1~500) <span style={{ color: '#C04040' }}>*</span>
                </label>
                <input
                  type="number" min={1} max={500}
                  value={points} onChange={e => setPoints(e.target.value)}
                  placeholder="예: 50"
                  autoFocus
                  style={modalInput}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#8AAAC8', marginBottom: '5px' }}>
                  지급 사유 <span style={{ color: '#C04040' }}>*</span>
                </label>
                <input
                  type="text"
                  value={reason} onChange={e => setReason(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitPoints()}
                  placeholder="예: 도움 게시판 기여 보너스"
                  style={modalInput}
                />
              </div>

              {modalError && (
                <p style={{ fontSize: '12px', color: '#C04040', margin: 0 }}>{modalError}</p>
              )}

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button onClick={closeModal}
                  style={{ background: '#182035', border: '1px solid #1A2838', color: '#8AAAC8', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', cursor: 'pointer' }}>
                  나가기
                </button>
                <button onClick={submitPoints} disabled={awarding}
                  style={{
                    background: awarding ? 'rgba(74,124,192,0.1)' : 'rgba(74,124,192,0.2)',
                    border: '1px solid rgba(74,124,192,0.5)', color: '#4A7CC0',
                    borderRadius: '8px', padding: '9px 22px', fontSize: '13px', fontWeight: 700,
                    cursor: awarding ? 'not-allowed' : 'pointer', opacity: awarding ? 0.6 : 1,
                  }}>
                  {awarding ? '처리 중...' : '지급 완료'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
