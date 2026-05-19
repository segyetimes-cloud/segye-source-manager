'use client'

import { useState, useEffect, useCallback } from 'react'

interface Award {
  id: string
  points: number
  description: string
  created_at: string
  profiles?: { full_name: string } | null
}

interface Props {
  reportId: string
  authorName: string
  authorId: string
  currentUserId: string
}

const QUICK_POINTS = [5, 10, 15, 20, 30]

export default function ReportPointAward({ reportId, authorName, authorId, currentUserId }: Props) {
  const [points, setPoints] = useState<number | ''>('')
  const [memo, setMemo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [awards, setAwards] = useState<Award[]>([])
  const [totalAwarded, setTotalAwarded] = useState(0)

  const isSelf = authorId === currentUserId

  const loadAwards = useCallback(async () => {
    const res = await fetch(`/api/reports/${reportId}/award-points`)
    if (res.ok) {
      const data = await res.json()
      const list: Award[] = data.awards ?? []
      setAwards(list)
      setTotalAwarded(list.reduce((sum, a) => sum + a.points, 0))
    }
  }, [reportId])

  useEffect(() => { loadAwards() }, [loadAwards])

  async function handleAward(e: React.FormEvent) {
    e.preventDefault()
    if (!points || Number(points) < 1) return
    setSubmitting(true)
    setMessage(null)

    const res = await fetch(`/api/reports/${reportId}/award-points`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ points: Number(points), memo }),
    })
    const data = await res.json()

    if (res.ok) {
      setMessage({ type: 'ok', text: `✅ ${authorName}에게 ${data.points}점 부여 완료!` })
      setPoints('')
      setMemo('')
      await loadAwards()
    } else {
      setMessage({ type: 'err', text: data.error ?? '포인트 부여에 실패했습니다.' })
    }
    setSubmitting(false)
    setTimeout(() => setMessage(null), 4000)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString('ko-KR', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#CDD5E0' }}>
          ⭐ 포인트 부여
          <span style={{
            marginLeft: '8px', fontSize: '12px', fontWeight: 400,
            color: '#5A7099',
          }}>데스크 전용</span>
        </h2>
        {totalAwarded > 0 && (
          <span style={{
            background: 'rgba(255,215,0,0.12)', color: '#7E6E48',
            border: '1px solid rgba(255,215,0,0.25)',
            borderRadius: '6px', padding: '2px 10px',
            fontSize: '12px', fontWeight: 600,
          }}>
            누적 +{totalAwarded}점
          </span>
        )}
      </div>

      {isSelf ? (
        <p style={{ fontSize: '13px', color: '#485870' }}>
          자신의 보고서에는 포인트를 부여할 수 없습니다.
        </p>
      ) : (
        <form onSubmit={handleAward}>
          {/* 수신자 */}
          <p style={{ fontSize: '12px', color: '#5A7099', marginBottom: '10px' }}>
            수신자: <span style={{ color: '#3A90A8', fontWeight: 600 }}>{authorName}</span>
          </p>

          {/* 빠른 선택 */}
          <div style={{ marginBottom: '10px' }}>
            <p style={{ fontSize: '11px', color: '#485870', marginBottom: '6px' }}>빠른 선택</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_POINTS.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPoints(p)}
                  style={{
                    padding: '5px 14px',
                    background: points === p ? 'rgba(255,215,0,0.2)' : '#182035',
                    border: `1px solid ${points === p ? 'rgba(255,215,0,0.5)' : '#1A2838'}`,
                    color: points === p ? '#7E6E48' : '#687898',
                    borderRadius: '6px', fontSize: '13px',
                    fontWeight: points === p ? 600 : 400,
                    cursor: 'pointer',
                  }}>
                  +{p}점
                </button>
              ))}
              {/* 직접 입력 */}
              <input
                type="number"
                min={1}
                max={100}
                placeholder="직접"
                value={typeof points === 'number' && !QUICK_POINTS.includes(points) ? points : ''}
                onChange={e => {
                  const v = parseInt(e.target.value)
                  setPoints(isNaN(v) ? '' : Math.min(100, Math.max(1, v)))
                }}
                style={{
                  width: '64px', padding: '5px 8px',
                  background: '#182035',
                  border: `1px solid ${typeof points === 'number' && !QUICK_POINTS.includes(points) ? 'rgba(255,215,0,0.5)' : '#1A2838'}`,
                  color: '#CDD5E0', borderRadius: '6px',
                  fontSize: '13px', textAlign: 'center',
                }}
              />
            </div>
          </div>

          {/* 메모 */}
          <div style={{ marginBottom: '10px' }}>
            <input
              type="text"
              placeholder="메모 (선택) — 예: 단독 취재 정보"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              maxLength={100}
              style={{
                width: '100%', padding: '8px 12px',
                background: '#182035',
                border: '1px solid #1A2838',
                color: '#CDD5E0', borderRadius: '8px',
                fontSize: '13px',
              }}
            />
          </div>

          {/* 부여 버튼 */}
          <button
            type="submit"
            disabled={submitting || !points}
            style={{
              width: '100%', padding: '9px',
              background: (submitting || !points)
                ? '#1A2838'
                : 'linear-gradient(135deg, #7E6E48, #A87228)',
              color: (submitting || !points) ? '#485870' : '#0D1520',
              border: 'none', borderRadius: '8px',
              fontSize: '14px', fontWeight: 700,
              cursor: (submitting || !points) ? 'not-allowed' : 'pointer',
            }}>
            {submitting ? '처리 중...' : points ? `${authorName}에게 +${points}점 부여` : '포인트를 선택하세요'}
          </button>
        </form>
      )}

      {/* 피드백 메시지 */}
      {message && (
        <div style={{
          marginTop: '10px', padding: '8px 12px', borderRadius: '8px',
          background: message.type === 'ok' ? 'rgba(0,204,102,0.1)' : 'rgba(255,68,68,0.1)',
          border: `1px solid ${message.type === 'ok' ? 'rgba(0,204,102,0.3)' : 'rgba(255,68,68,0.3)'}`,
          color: message.type === 'ok' ? '#3D9E6A' : '#C04040',
          fontSize: '13px',
        }}>
          {message.text}
        </div>
      )}

      {/* 부여 이력 */}
      {awards.length > 0 && (
        <div style={{ marginTop: '14px' }}>
          <p style={{ fontSize: '11px', color: '#485870', marginBottom: '6px', fontWeight: 600, letterSpacing: '0.5px' }}>
            부여 이력
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {awards.map(a => (
              <div key={a.id} className="flex items-center justify-between" style={{
                padding: '6px 10px',
                background: '#131C2C',
                borderRadius: '6px',
                border: '1px solid #1A2838',
              }}>
                <span style={{ fontSize: '12px', color: '#687898' }}>
                  <span style={{ color: '#3A90A8' }}>{(a.profiles as any)?.full_name ?? '데스크'}</span>
                  {' '}— {a.description.split('—')[1]?.trim() || ''}
                </span>
                <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                  <span style={{ fontSize: '12px', color: '#7E6E48', fontWeight: 600 }}>+{a.points}점</span>
                  <span style={{ fontSize: '11px', color: '#485870' }}>{formatDate(a.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
