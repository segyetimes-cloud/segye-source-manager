'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface HelpRequest {
  id: string
  title: string
  body: string | null
  request_type: string
  target_name: string | null
  target_org: string | null
  status: 'open' | 'resolved' | 'closed'
  reward_points: number
  created_at: string
  requester_id: string
  profiles: { full_name: string; department: string | null } | null
}

interface Props {
  requests: HelpRequest[]
  userId: string
}

const REQUEST_TYPE_LABEL: Record<string, string> = {
  contact: '📞 연락처',
  info: '📋 정보',
  interview: '🎤 인터뷰 주선',
  other: '💬 기타',
}

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  open: { label: '요청 중', color: '#4A7CC0' },
  resolved: { label: '해결됨', color: '#3D9E6A' },
  closed: { label: '마감', color: '#485870' },
}

export default function HelpBoard({ requests: initialRequests, userId }: Props) {
  const [requests, setRequests] = useState(initialRequests)
  const [filter, setFilter] = useState<'all' | 'open' | 'mine'>('open')

  useEffect(() => {
    // Supabase Realtime — 새 도움 요청 실시간 수신
    const supabase = createClient()
    const channel = supabase
      .channel('help_requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'help_requests' },
        (payload) => {
          setRequests(prev => [payload.new as HelpRequest, ...prev])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const filtered = requests.filter(r => {
    if (filter === 'open') return r.status === 'open'
    if (filter === 'mine') return r.requester_id === userId
    return true
  })

  return (
    <div className="space-y-4">
      {/* 필터 탭 */}
      <div className="flex rounded-lg p-1 w-fit" style={{ background: '#131C2C', border: '1px solid #1A2838' }}>
        {[
          { value: 'open', label: '🔵 진행 중' },
          { value: 'all', label: '전체' },
          { value: 'mine', label: '내 요청' },
        ].map(t => (
          <button
            key={t.value}
            onClick={() => setFilter(t.value as typeof filter)}
            className="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
            style={{
              background: filter === t.value ? '#4A7CC0' : 'transparent',
              color: filter === t.value ? 'white' : '#687898',
              cursor: 'pointer',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 요청 목록 */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="glass-card flex flex-col items-center py-12">
            <p className="text-sm" style={{ color: '#485870' }}>요청이 없습니다</p>
          </div>
        ) : filtered.map(req => (
          <Link
            key={req.id}
            href={`/help/${req.id}`}
            className="block glass-card p-5 transition-colors"
            style={{ textDecoration: 'none' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(15,32,64,0.95)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(15,32,64,0.85)')}>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs px-2 py-0.5 rounded"
                    style={{ background: 'rgba(30,144,255,0.1)', color: '#687898' }}>
                    {REQUEST_TYPE_LABEL[req.request_type] ?? req.request_type}
                  </span>
                  <span className="text-xs" style={{ color: STATUS_LABEL[req.status].color }}>
                    ● {STATUS_LABEL[req.status].label}
                  </span>
                </div>

                <h3 className="text-sm font-semibold" style={{ color: '#CDD5E0' }}>
                  {req.title}
                </h3>

                {(req.target_name || req.target_org) && (
                  <p className="text-xs mt-1" style={{ color: '#687898' }}>
                    대상: {req.target_name} {req.target_org && `(${req.target_org})`}
                  </p>
                )}

                {req.body && (
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: '#485870' }}>
                    {req.body}
                  </p>
                )}
              </div>

              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span className="text-sm font-bold" style={{ color: '#7E6E48' }}>
                  +{req.reward_points}pt
                </span>
                <span className="text-xs" style={{ color: '#485870' }}>
                  {req.profiles?.full_name ?? '—'}
                  {req.profiles?.department && ` · ${req.profiles.department}`}
                </span>
                <span className="text-xs" style={{ color: '#485870' }}>
                  {new Date(req.created_at).toLocaleDateString('ko-KR')}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
