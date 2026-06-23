'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Props {
  sourceId: string
  sourceName: string
  hasPending: boolean
  pendingRequestedAt?: string | null
}

export default function SourceAccessRequest({ sourceId, sourceName, hasPending, pendingRequestedAt }: Props) {
  const router = useRouter()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) { setError('신청 사유를 입력해 주세요.'); return }
    setSubmitting(true)
    setError('')
    const res = await fetch(`/api/sources/${sourceId}/request-access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { setError(data.error ?? '신청에 실패했습니다.'); return }
    setDone(true)
  }

  return (
    <div style={{ maxWidth: 520, margin: '60px auto', padding: '0 1rem' }}>
      {/* 뒤로 */}
      <Link href="/sources" style={{ color: '#607898', fontSize: '13px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 24 }}>
        ← 취재원 목록으로
      </Link>

      {/* 경고 카드 */}
      <div style={{
        background: '#131C2C',
        border: '1px solid rgba(255,153,0,0.25)',
        borderRadius: 12,
        padding: '28px 28px',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <h2 style={{ color: '#CDD5E0', fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>
          민감 취재원 — 열람 승인 필요
        </h2>
        <p style={{ color: '#8AAAC8', fontSize: 14, margin: '0 0 6px' }}>
          <strong style={{ color: '#CDD5E0' }}>{sourceName}</strong>
        </p>
        <p style={{ color: '#5A7099', fontSize: 13, margin: 0, lineHeight: 1.6 }}>
          이 취재원은 민감정보로 분류되어 있어<br />
          부장(데스크) 이상의 열람 승인이 필요합니다.
        </p>
      </div>

      {done || hasPending ? (
        /* 신청 완료 / 대기 중 */
        <div style={{
          marginTop: 20,
          background: 'rgba(74,124,192,0.08)',
          border: '1px solid rgba(74,124,192,0.25)',
          borderRadius: 10,
          padding: '20px 24px',
          textAlign: 'center',
        }}>
          <p style={{ color: '#7AADE0', fontSize: 15, fontWeight: 600, margin: '0 0 6px' }}>
            승인 대기 중
          </p>
          {pendingRequestedAt && !done && (
            <p style={{ color: '#5A7099', fontSize: 12, margin: 0 }}>
              신청일: {new Date(pendingRequestedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
          {done && (
            <p style={{ color: '#5A7099', fontSize: 12, margin: '4px 0 0' }}>
              부장이 승인하면 열람할 수 있습니다.
            </p>
          )}
          <button
            onClick={() => router.back()}
            style={{
              marginTop: 16, background: 'rgba(74,124,192,0.15)',
              border: '1px solid rgba(74,124,192,0.3)', color: '#7AADE0',
              borderRadius: 7, padding: '8px 20px', fontSize: 13,
              cursor: 'pointer', fontWeight: 600,
            }}>
            돌아가기
          </button>
        </div>
      ) : (
        /* 신청 폼 */
        <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>
          {error && (
            <div style={{
              background: 'rgba(255,68,68,0.08)', border: '1px solid rgba(255,68,68,0.25)',
              borderRadius: 8, padding: '10px 14px', color: '#C04040',
              fontSize: 13, marginBottom: 14,
            }}>{error}</div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#8AAAC8', marginBottom: 6 }}>
              열람 신청 사유 *
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="열람이 필요한 취재 목적이나 사유를 입력하세요"
              rows={4}
              style={{
                width: '100%', background: '#182035', border: '1px solid #1A2838',
                color: '#CDD5E0', borderRadius: 8, padding: '9px 12px',
                fontSize: 14, resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <Link href="/sources" style={{
              padding: '10px 20px', background: '#182035',
              border: '1px solid #1A2838', color: '#8AAAC8',
              borderRadius: 8, fontSize: 13, textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}>취소</Link>
            <button
              type="submit"
              disabled={submitting}
              style={{
                flex: 1, background: submitting ? '#1A2838' : 'linear-gradient(135deg, #4A7CC0, #0066CC)',
                color: 'white', border: 'none', borderRadius: 8,
                padding: '10px', fontSize: 14, fontWeight: 600,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}>
              {submitting ? '신청 중...' : '열람 승인 신청'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
