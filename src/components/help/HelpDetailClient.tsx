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

  const isRequester = help.requester_id === userId

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

  async function handleSubmitResponse() {
    if (!newResponse.trim()) return
    setSubmitting(true)
    const res = await fetch(`/api/help/${help.id}/responses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: newResponse.trim() }),
    })
    if (res.ok) {
      setNewResponse('')
      router.refresh()
    }
    setSubmitting(false)
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
    open: '#1E90FF',
    resolved: '#00CC66',
    closed: '#4A6080',
  }

  const statusLabels: Record<string, string> = {
    open: '요청 중',
    resolved: '해결됨',
    closed: '마감',
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 네비게이션 */}
      <div className="flex items-center gap-2 text-sm" style={{ color: '#4A6080' }}>
        <Link href="/help" style={{ color: '#4A6080', textDecoration: 'none' }}>도움 게시판</Link>
        <span>›</span>
        <span style={{ color: '#8899BB' }}>{help.title}</span>
      </div>

      {/* 요청 카드 */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2 py-0.5 rounded"
                style={{ background: 'rgba(30,144,255,0.1)', color: '#8899BB' }}>
                {REQUEST_TYPE_LABEL[help.request_type] ?? help.request_type}
              </span>
              <span className="text-xs font-semibold" style={{ color: statusColors[help.status] }}>
                ● {statusLabels[help.status]}
              </span>
            </div>

            <h1 className="text-xl font-bold mb-2" style={{ color: '#E8F0FE' }}>{help.title}</h1>

            {(help.target_name || help.target_org) && (
              <p className="text-sm mb-3" style={{ color: '#8899BB' }}>
                📍 대상: <span style={{ color: '#E8F0FE' }}>{help.target_name}</span>
                {help.target_org && <span> ({help.target_org})</span>}
              </p>
            )}

            {help.body && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#8899BB' }}>
                {help.body}
              </p>
            )}
          </div>

          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <span className="text-2xl font-bold" style={{ color: '#FFD700' }}>
              +{help.reward_points}pt
            </span>
            <span className="text-xs" style={{ color: '#4A6080' }}>
              {help.profiles?.full_name}
              {help.profiles?.department && ` · ${help.profiles.department}`}
            </span>
            <span className="text-xs" style={{ color: '#4A6080' }}>
              {new Date(help.created_at).toLocaleString('ko-KR')}
            </span>
          </div>
        </div>

        {/* 액션 버튼 */}
        {(isRequester || isAdmin) && help.status === 'open' && (
          <div className="mt-4 pt-4 flex gap-2" style={{ borderTop: '1px solid #1A3050' }}>
            <button
              onClick={handleClose}
              className="px-3 py-1.5 rounded-lg text-xs"
              style={{ background: 'rgba(74,96,128,0.15)', color: '#4A6080', border: '1px solid #1A3050', cursor: 'pointer' }}>
              마감하기
            </button>
          </div>
        )}
      </div>

      {/* 응답 목록 */}
      <div>
        <h2 className="text-sm font-semibold mb-3" style={{ color: '#8899BB' }}>
          응답 {responses.length}개
        </h2>

        {responses.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-sm" style={{ color: '#4A6080' }}>아직 응답이 없습니다. 첫 번째로 도움을 주세요! 🙋</p>
          </div>
        ) : (
          <div className="space-y-3">
            {responses.map(resp => (
              <div
                key={resp.id}
                className="glass-card p-5"
                style={{
                  border: resp.is_accepted ? '1px solid rgba(0,204,102,0.3)' : undefined,
                  background: resp.is_accepted ? 'rgba(0,204,102,0.03)' : undefined,
                }}>
                {resp.is_accepted && (
                  <div className="flex items-center gap-2 mb-3 text-xs font-semibold" style={{ color: '#00CC66' }}>
                    ✅ 채택된 응답
                  </div>
                )}

                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#E8F0FE' }}>
                  {resp.body}
                </p>

                <div className="flex items-center mt-3">
                  <div className="text-xs" style={{ color: '#4A6080' }}>
                    <span style={{ color: '#8899BB' }}>{resp.profiles?.full_name ?? '—'}</span>
                    {resp.profiles?.department && ` · ${resp.profiles.department}`}
                    {' · '}
                    {new Date(resp.created_at).toLocaleString('ko-KR')}
                  </div>
                </div>

                {/* 채택 버튼 — 요청자에게만 표시 */}
                {isRequester && (
                  <div className="mt-4">
                    {help.status === 'resolved' && resp.is_accepted ? (
                      <div
                        className="w-full py-3 rounded-xl text-sm font-bold text-center"
                        style={{
                          background: 'rgba(0,204,102,0.12)',
                          color: '#00CC66',
                          border: '1px solid rgba(0,204,102,0.35)',
                        }}>
                        ✅ 채택됨 · 고마워요!
                      </div>
                    ) : help.status === 'open' && !resp.is_accepted ? (
                      <button
                        onClick={() => handleAccept(resp.id)}
                        className="w-full py-3 rounded-xl text-sm font-bold"
                        style={{
                          background: 'linear-gradient(135deg, #00CC66, #009944)',
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
            ))}
          </div>
        )}
      </div>

      {/* 응답 작성 */}
      {help.status === 'open' && !isRequester && (
        <div className="glass-card p-5" style={{ border: '1px solid rgba(30,144,255,0.15)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: '#E8F0FE' }}>
            💡 응답하기
            <span className="text-xs ml-2 font-normal" style={{ color: '#4A6080' }}>
              채택 시 {help.reward_points}pt + 작성만 해도 3pt
            </span>
          </h3>
          <textarea
            value={newResponse}
            onChange={e => setNewResponse(e.target.value)}
            placeholder="알고 있는 정보나 도움이 될 내용을 적어주세요..."
            rows={4}
            style={{
              width: '100%',
              background: '#132850',
              border: '1px solid #1A3050',
              color: '#E8F0FE',
              borderRadius: '8px',
              padding: '10px 12px',
              fontSize: '14px',
              resize: 'vertical',
              outline: 'none',
            }}
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={handleSubmitResponse}
              disabled={submitting || !newResponse.trim()}
              className="px-5 py-2 rounded-lg text-sm font-semibold"
              style={{
                background: (submitting || !newResponse.trim()) ? '#1A3050' : 'linear-gradient(135deg, #1E90FF, #0066CC)',
                color: 'white',
                border: 'none',
                cursor: (submitting || !newResponse.trim()) ? 'not-allowed' : 'pointer',
              }}>
              {submitting ? '등록 중...' : '응답 등록'}
            </button>
          </div>
        </div>
      )}

      {help.status !== 'open' && (
        <div className="text-center py-4 space-y-3">
          <span className="text-sm px-4 py-2 rounded-full" style={{ background: '#0F2040', color: '#4A6080', border: '1px solid #1A3050' }}>
            {help.status === 'resolved' ? '✅ 해결된 요청입니다' : '🔒 마감된 요청입니다'}
          </span>

          {help.status === 'resolved' && help.accepted_response_id && (isRequester || isAdmin) && (
            <div>
              <Link
                href={`/sources/new?from_help=${help.id}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
                style={{
                  background: 'linear-gradient(135deg, #00CC66, #009944)',
                  color: 'white',
                  textDecoration: 'none',
                }}>
                📋 이 정보로 취재원 등록하기
              </Link>
              <p className="text-xs mt-2" style={{ color: '#4A6080' }}>
                응답에서 공유된 정보를 취재원 데이터베이스에 바로 추가할 수 있습니다
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
