'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  reportId: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  isAuthor: boolean
  isDesk: boolean
  reviewNote: string | null
}

export default function ReportReviewActions({ reportId, status, isAuthor, isDesk, reviewNote }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [note, setNote] = useState('')

  async function callReview(action: 'submit' | 'approve' | 'reject', rejectNote?: string) {
    setLoading(true)
    setError('')
    const res = await fetch(`/api/reports/${reportId}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, note: rejectNote }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? '처리에 실패했습니다.')
    } else {
      router.refresh()
    }
    setLoading(false)
  }

  function handleSubmit() {
    callReview('submit')
  }

  function handleApprove() {
    callReview('approve')
  }

  function handleReject() {
    if (!note.trim()) { setError('반려 사유를 입력해 주세요.'); return }
    callReview('reject', note)
  }

  return (
    <div>
      {error && (
        <div style={{
          background: 'rgba(192,64,64,0.1)', border: '1px solid rgba(192,64,64,0.3)',
          borderRadius: '8px', padding: '8px 12px',
          color: '#C04040', fontSize: '13px', marginBottom: '10px',
        }}>
          {error}
        </div>
      )}

      {/* 검토 요청 버튼: 작성자 본인 + draft 상태 */}
      {isAuthor && status === 'draft' && (
        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            background: loading ? '#DDE5EF' : 'linear-gradient(135deg, #4A7CC0, #0066CC)',
            color: 'white', border: 'none',
            borderRadius: '8px', padding: '9px 20px',
            fontSize: '13px', fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
          {loading ? '처리 중...' : '검토 요청'}
        </button>
      )}

      {/* 승인 / 반려 버튼: 데스크 + submitted 상태 */}
      {isDesk && status === 'submitted' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleApprove}
              disabled={loading}
              style={{
                background: loading ? '#DDE5EF' : 'rgba(61,158,106,0.15)',
                color: '#3D9E6A',
                border: '1px solid rgba(61,158,106,0.3)',
                borderRadius: '8px', padding: '9px 20px',
                fontSize: '13px', fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}>
              {loading ? '처리 중...' : '승인'}
            </button>
            {!showRejectForm && (
              <button
                onClick={() => setShowRejectForm(true)}
                disabled={loading}
                style={{
                  background: 'rgba(192,64,64,0.1)',
                  color: '#C04040',
                  border: '1px solid rgba(192,64,64,0.3)',
                  borderRadius: '8px', padding: '9px 20px',
                  fontSize: '13px', fontWeight: 600,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}>
                반려
              </button>
            )}
          </div>

          {showRejectForm && (
            <div style={{
              background: '#EEF2F7', border: '1px solid rgba(192,64,64,0.2)',
              borderRadius: '8px', padding: '12px',
            }}>
              <p style={{ fontSize: '12px', color: '#526070', marginBottom: '8px', fontWeight: 600 }}>반려 사유 *</p>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="반려 사유를 입력하세요"
                rows={3}
                style={{
                  width: '100%',
                  background: '#F0F7F3',
                  border: '1px solid rgba(192,64,64,0.3)',
                  color: '#1C2B3A',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  fontSize: '13px',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  onClick={handleReject}
                  disabled={loading}
                  style={{
                    background: 'rgba(192,64,64,0.15)',
                    color: '#C04040',
                    border: '1px solid rgba(192,64,64,0.3)',
                    borderRadius: '6px', padding: '7px 16px',
                    fontSize: '13px', fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}>
                  {loading ? '처리 중...' : '반려 확인'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowRejectForm(false); setNote('') }}
                  style={{
                    background: '#F0F7F3', border: '1px solid #DDE5EF',
                    color: '#7A8A9E', borderRadius: '6px', padding: '7px 14px',
                    fontSize: '13px', cursor: 'pointer',
                  }}>
                  취소
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 반려된 경우 사유 표시 (작성자에게) */}
      {isAuthor && status === 'rejected' && reviewNote && (
        <div style={{
          background: 'rgba(192,64,64,0.08)', border: '1px solid rgba(192,64,64,0.2)',
          borderRadius: '8px', padding: '10px 14px',
        }}>
          <p style={{ fontSize: '12px', color: '#C04040', fontWeight: 600, marginBottom: '4px' }}>반려 사유</p>
          <p style={{ fontSize: '13px', color: '#1C2B3A' }}>{reviewNote}</p>
        </div>
      )}
    </div>
  )
}
