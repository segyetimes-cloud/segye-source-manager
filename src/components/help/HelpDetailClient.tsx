'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface HelpResponse {
  id: string
  request_id: string
  responder_id: string
  body: string
  attached_source_id: string | null
  is_accepted: boolean
  upvotes: number
  created_at: string
  profiles: { full_name: string; department: string | null } | null
}

interface HelpRequest {
  id: string
  requester_id: string
  title: string
  body: string | null
  request_type: string
  target_name: string | null
  target_org: string | null
  status: 'open' | 'resolved' | 'closed'
  reward_points: number
  accepted_response_id: string | null
  created_at: string
  profiles: { full_name: string; department: string | null } | null
}

interface Props {
  help: HelpRequest
  responses: HelpResponse[]
  userId: string
  isAdmin: boolean
}

const REQUEST_TYPE_LABEL: Record<string, string> = {
  contact: '📞 연락처',
  info: '📋 정보',
  interview: '🎤 인터뷰 주선',
  other: '💬 기타',
}

export default function HelpDetailClient({ help: initialHelp, responses: initialResponses, userId, isAdmin }: Props) {
  const router = useRouter()
  const [help, setHelp] = useState(initialHelp)
  const [responses, setResponses] = useState(initialResponses)
  const [newResponse, setNewResponse] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set())
  const [showWatermark, setShowWatermark] = useState(true)

  const isRequester = help.requester_id === userId

  // 로컬 스토리지에서 이미 추천한 응답 ID 복원
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`help_upvotes_${help.id}`)
      if (stored) setVotedIds(new Set(JSON.parse(stored)))
    } catch {}
  }, [help.id])

  // Realtime: 새 응답 실시간 수신
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`help_responses:${help.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'help_responses', filter: `request_id=eq.${help.id}` },
        (payload) => {
          const newResp = payload.new as HelpResponse
          setResponses(prev => [...prev, newResp])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [help.id])

  // 응답 정렬: 채택된 것 먼저, 그 다음 추천 수 내림차순
  const sortedResponses = [...responses].sort((a, b) => {
    if (a.is_accepted && !b.is_accepted) return -1
    if (!a.is_accepted && b.is_accepted) return 1
    return (b.upvotes ?? 0) - (a.upvotes ?? 0)
  })

  async function handleSubmitResponse() {
    if (!newResponse.trim()) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/help/${help.id}/responses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: newResponse.trim() }),
      })
      if (res.ok) {
        setNewResponse('')
        router.refresh()
      }
    } catch {
      // 네트워크 오류 — 폼 상태만 복원
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAccept(responseId: string) {
    if (!confirm('이 응답을 채택하시겠습니까? 채택 후에는 변경할 수 없습니다.')) return
    const res = await fetch(`/api/help/${help.id}/responses`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response_id: responseId }),
    })
    if (res.ok) {
      setHelp(prev => ({ ...prev, status: 'resolved', accepted_response_id: responseId }))
      setResponses(prev => prev.map(r => ({ ...r, is_accepted: r.id === responseId })))
    }
  }

  async function handleUpvote(responseId: string) {
    if (votedIds.has(responseId)) return
    const res = await fetch(`/api/help/${help.id}/responses`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response_id: responseId }),
    })
    if (res.ok) {
      const { upvotes } = await res.json()
      setResponses(prev => prev.map(r => r.id === responseId ? { ...r, upvotes } : r))
      const newVoted = new Set(votedIds)
      newVoted.add(responseId)
      setVotedIds(newVoted)
      try {
        localStorage.setItem(`help_upvotes_${help.id}`, JSON.stringify([...newVoted]))
      } catch {}
    }
  }

  async function handleClose() {
    if (!confirm('요청을 마감하시겠습니까?')) return
    await fetch(`/api/help/${help.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'closed' }),
    })
    setHelp(prev => ({ ...prev, status: 'closed' }))
  }

  const statusColors: Record<string, string> = {
    open: '#4A7CC0',
    resolved: '#3D9E6A',
    closed: '#607898',
  }

  const statusLabels: Record<string, string> = {
    open: '요청 중',
    resolved: '해결됨',
    closed: '마감',
  }

  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {/* 네비게이션 */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2 text-sm" style={{ color: '#607898' }}>
          <Link href="/help" style={{ color: '#607898', textDecoration: 'none' }}>도움</Link>
          <span>›</span>
          <span style={{ color: '#8AAAC8', lineHeight: 1.2 }}>{help.title}</span>
        </div>
        <Link
          href="/help"
          aria-label="목록으로"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '28px', height: '28px', borderRadius: '6px',
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
            color: '#8A9AB0', textDecoration: 'none', fontSize: '18px', lineHeight: 1,
          }}>
          ×
        </Link>
      </div>

      {/* 요청 카드 */}
      <div className="glass-card p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2 py-0.5 rounded"
                style={{ background: 'rgba(30,144,255,0.1)', color: '#8AAAC8' }}>
                {REQUEST_TYPE_LABEL[help.request_type] ?? help.request_type}
              </span>
              <span className="text-xs font-semibold" style={{ color: statusColors[help.status] }}>
                ● {statusLabels[help.status]}
              </span>
            </div>

            <h1 className="text-xl font-bold mb-2" style={{ color: '#CDD5E0' }}>{help.title}</h1>

            {(help.target_name || help.target_org) && (
              <p className="text-sm mb-3" style={{ color: '#8AAAC8' }}>
                📍 대상: <span style={{ color: '#CDD5E0' }}>{help.target_name}</span>
                {help.target_org && <span> ({help.target_org})</span>}
              </p>
            )}

            {help.body && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#8AAAC8' }}>
                {help.body}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span className="text-2xl font-bold" style={{ color: '#7E6E48' }}>
              +{help.reward_points}pt
            </span>
            <span className="text-xs" style={{ color: '#607898' }}>
              {help.profiles?.full_name}
              {help.profiles?.department && ` · ${help.profiles.department}`}
            </span>
            <span className="text-xs" style={{ color: '#607898' }}>
              {new Date(help.created_at).toLocaleString('ko-KR')}
            </span>
          </div>
        </div>

        {(isRequester || isAdmin) && help.status === 'open' && (
          <div className="mt-4 pt-4 flex gap-2" style={{ borderTop: '1px solid #1A2838' }}>
            <button
              onClick={handleClose}
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{ background: 'rgba(74,96,128,0.15)', color: '#607898', border: '1px solid #1A2838', cursor: 'pointer' }}>
              마감하기
            </button>
          </div>
        )}
      </div>

      {/* 응답 목록 */}
      <div>
        <h2 className="text-xs font-semibold mb-2 px-2" style={{ color: '#8AAAC8' }}>
          💬 응답 {responses.length}
        </h2>

        {responses.length === 0 ? (
          <div className="glass-card p-6 text-center">
            <p className="text-sm" style={{ color: '#607898' }}>아직 응답이 없습니다 🙋</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedResponses.map(resp => {
              const isOwnResponse = resp.responder_id === userId
              const hasVoted = votedIds.has(resp.id)

              return (
                <div
                  key={resp.id}
                  className="glass-card p-3"
                  style={{
                    border: resp.is_accepted ? '1px solid rgba(0,204,102,0.3)' : undefined,
                    background: resp.is_accepted ? 'rgba(0,204,102,0.03)' : undefined,
                  }}>
                  {resp.is_accepted && (
                    <div className="flex items-center gap-1 mb-2 text-xs font-semibold" style={{ color: '#3D9E6A' }}>
                      ✅ 채택
                    </div>
                  )}

                  <p className="text-sm leading-relaxed whitespace-pre-wrap mb-2" style={{ color: '#CDD5E0' }}>
                    {resp.body}
                  </p>

                  <div className="flex items-center justify-between text-xs">
                    <div className="text-xs" style={{ color: '#607898' }}>
                      <span style={{ color: '#8AAAC8' }}>{resp.profiles?.full_name ?? '—'}</span>
                      {resp.profiles?.department && ` · ${resp.profiles.department}`}
                      {' · '}
                      {new Date(resp.created_at).toLocaleString('ko-KR')}
                    </div>

                    {/* 추천 버튼 */}
                    {!isOwnResponse && (
                      <button
                        onClick={() => handleUpvote(resp.id)}
                        disabled={hasVoted}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          borderRadius: '20px',
                          fontSize: '12px',
                          fontWeight: 500,
                          background: hasVoted ? 'rgba(74,124,192,0.2)' : 'rgba(74,124,192,0.08)',
                          color: hasVoted ? '#4A7CC0' : '#8AAAC8',
                          border: hasVoted ? '1px solid rgba(74,124,192,0.4)' : '1px solid rgba(74,124,192,0.15)',
                          cursor: hasVoted ? 'default' : 'pointer',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { if (!hasVoted) (e.currentTarget as HTMLElement).style.background = 'rgba(74,124,192,0.15)' }}
                        onMouseLeave={e => { if (!hasVoted) (e.currentTarget as HTMLElement).style.background = 'rgba(74,124,192,0.08)' }}
                      >
                        👍 {resp.upvotes > 0 ? resp.upvotes : '도움돼요'}
                      </button>
                    )}

                    {isOwnResponse && resp.upvotes > 0 && (
                      <span className="text-xs" style={{ color: '#607898' }}>
                        👍 {resp.upvotes}
                      </span>
                    )}
                  </div>

                  {/* 채택 버튼 — 요청자에게만 표시 */}
                  {isRequester && (
                    <div className="mt-4">
                      {help.status === 'resolved' && resp.is_accepted ? (
                        <div
                          className="w-full py-3 rounded-xl text-sm font-bold text-center"
                          style={{
                            background: 'rgba(0,204,102,0.12)',
                            color: '#3D9E6A',
                            border: '1px solid rgba(0,204,102,0.35)',
                          }}>
                          ✅ 채택됨 · 고마워요!
                        </div>
                      ) : help.status === 'open' && !resp.is_accepted ? (
                        <button
                          onClick={() => handleAccept(resp.id)}
                          className="w-full py-3 rounded-xl text-sm font-bold"
                          style={{
                            background: 'linear-gradient(135deg, #3D9E6A, #009944)',
                            color: 'white',
                            border: 'none',
                            cursor: 'pointer',
                            letterSpacing: '0.01em',
                          }}>
                          🙏 도움이 됐어요! 해결 완료
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 응답 작성 */}
      {help.status === 'open' && !isRequester && (
        <div className="glass-card p-3" style={{ border: '1px solid rgba(30,144,255,0.15)' }}>
          <h3 className="text-xs font-semibold mb-2 px-1" style={{ color: '#CDD5E0' }}>
            💡 답변하기 (+{help.reward_points}pt)
          </h3>
          <textarea
            value={newResponse}
            onChange={e => setNewResponse(e.target.value)}
            placeholder="정보나 도움을 적어주세요..."
            rows={3}
            style={{
              width: '100%',
              background: '#182035',
              border: '1px solid #1A2838',
              color: '#CDD5E0',
              borderRadius: '6px',
              padding: '8px 10px',
              fontSize: '13px',
              resize: 'vertical',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div className="flex justify-end mt-2">
            <button
              onClick={handleSubmitResponse}
              disabled={submitting || !newResponse.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold"
              style={{
                background: (submitting || !newResponse.trim()) ? '#1A2838' : 'linear-gradient(135deg, #4A7CC0, #0066CC)',
                color: 'white',
                border: 'none',
                cursor: (submitting || !newResponse.trim()) ? 'not-allowed' : 'pointer',
              }}>
              {submitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </div>
      )}

      {help.status !== 'open' && (
        <div className="text-center py-2 space-y-2">
          <span className="inline-block text-xs px-3 py-1 rounded-full" style={{ background: '#131C2C', color: '#607898', border: '1px solid #1A2838' }}>
            {help.status === 'resolved' ? '✅ 해결됨' : '🔒 마감'}
          </span>

          {help.status === 'resolved' && help.accepted_response_id && (isRequester || isAdmin) && (
            <div>
              <Link
                href={`/sources/new?from_help=${help.id}`}
                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold"
                style={{
                  background: 'linear-gradient(135deg, #3D9E6A, #009944)',
                  color: 'white',
                  textDecoration: 'none',
                  marginTop: '4px',
                }}>
                📋 취재원 등록
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
