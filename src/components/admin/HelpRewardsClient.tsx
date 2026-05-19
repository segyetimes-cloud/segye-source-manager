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

const REQUEST_TYPE_LABEL: Record<string, string> = {
  contact: '📞 연락처',
  info: '📋 정보',
  interview: '🎤 인터뷰',
  other: '💬 기타',
}

export default function HelpRewardsClient({ requests }: { requests: HelpRequest[] }) {
  const [awarding, setAwarding] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function givePoints(userId: string, requestId: string, userName: string) {
    const pointsStr = prompt(`${userName}에게 지급할 보너스 포인트를 입력하세요 (1~500):`)
    if (!pointsStr) return
    const points = parseInt(pointsStr)
    if (isNaN(points) || points < 1 || points > 500) {
      alert('1~500 사이의 숫자를 입력해주세요')
      return
    }
    const reason = prompt('지급 사유를 입력하세요:') || '도움 게시판 기여 보너스'

    setAwarding(userId + requestId)
    const res = await fetch('/api/admin/points', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, points, reason, related_request_id: requestId }),
    })
    setAwarding(null)

    if (res.ok) {
      setSuccess(`${userName}에게 ${points}pt 지급 완료!`)
      setTimeout(() => setSuccess(null), 3000)
    } else {
      const data = await res.json()
      alert('오류: ' + data.error)
    }
  }

  if (requests.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <p style={{ color: '#485870' }}>해결된 도움 요청이 없습니다</p>
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
                    style={{ background: 'rgba(30,144,255,0.1)', color: '#687898' }}>
                    {REQUEST_TYPE_LABEL[req.request_type] ?? req.request_type}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: '#A88C30' }}>
                    기존 리워드: {req.reward_points}pt
                  </span>
                </div>
                <h3 className="font-semibold" style={{ color: '#CDD5E0' }}>{req.title}</h3>
                {req.target_name && (
                  <p className="text-xs mt-1" style={{ color: '#687898' }}>대상: {req.target_name}</p>
                )}
              </div>
              <span className="text-xs flex-shrink-0" style={{ color: '#485870' }}>
                {new Date(req.created_at).toLocaleDateString('ko-KR')}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {/* 요청자 */}
              <div className="rounded-lg p-3" style={{ background: 'rgba(30,144,255,0.05)', border: '1px solid rgba(30,144,255,0.1)' }}>
                <p className="text-xs mb-1" style={{ color: '#485870' }}>📝 요청자</p>
                <p className="text-sm font-semibold" style={{ color: '#CDD5E0' }}>
                  {req.profiles?.full_name ?? '—'}
                </p>
                {req.profiles?.department && (
                  <p className="text-xs" style={{ color: '#687898' }}>{req.profiles.department}</p>
                )}
                <button
                  onClick={() => givePoints(req.requester_id, req.id, req.profiles?.full_name ?? '요청자')}
                  disabled={awarding === req.requester_id + req.id}
                  className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold w-full"
                  style={{
                    background: 'linear-gradient(135deg, #4A7CC0, #0066CC)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                  }}>
                  {awarding === req.requester_id + req.id ? '처리 중...' : '+ 보너스 지급'}
                </button>
              </div>

              {/* 응답자 */}
              {acceptedResp ? (
                <div className="rounded-lg p-3" style={{ background: 'rgba(0,204,102,0.05)', border: '1px solid rgba(0,204,102,0.1)' }}>
                  <p className="text-xs mb-1" style={{ color: '#485870' }}>✅ 채택된 응답자</p>
                  <p className="text-sm font-semibold" style={{ color: '#CDD5E0' }}>
                    {acceptedResp.profiles?.full_name ?? '—'}
                  </p>
                  {acceptedResp.profiles?.department && (
                    <p className="text-xs" style={{ color: '#687898' }}>{acceptedResp.profiles.department}</p>
                  )}
                  <button
                    onClick={() => givePoints(acceptedResp.responder_id, req.id, acceptedResp.profiles?.full_name ?? '응답자')}
                    disabled={awarding === acceptedResp.responder_id + req.id}
                    className="mt-2 px-3 py-1.5 rounded-lg text-xs font-semibold w-full"
                    style={{
                      background: 'linear-gradient(135deg, #3D9E6A, #009944)',
                      color: 'white',
                      border: 'none',
                      cursor: 'pointer',
                    }}>
                    {awarding === acceptedResp.responder_id + req.id ? '처리 중...' : '+ 보너스 지급'}
                  </button>
                </div>
              ) : (
                <div className="rounded-lg p-3 flex items-center justify-center" style={{ background: 'rgba(74,96,128,0.05)', border: '1px solid rgba(74,96,128,0.1)' }}>
                  <p className="text-xs" style={{ color: '#485870' }}>채택된 응답 없음</p>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
