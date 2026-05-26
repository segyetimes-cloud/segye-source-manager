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
  response_count: number
  profiles: { full_name: string; department: string | null } | null
}

interface Props {
  requests: HelpRequest[]
  userId: string
  respondedIds: string[]
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
  closed: { label: '마감', color: '#607898' },
}

const TYPE_FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'contact', label: '📞 연락처' },
  { value: 'info', label: '📋 정보' },
  { value: 'interview', label: '🎤 인터뷰' },
  { value: 'other', label: '💬 기타' },
]

export default function HelpBoard({ requests: initialRequests, userId, respondedIds }: Props) {
  const [requests, setRequests] = useState(initialRequests)
  const [statusFilter, setStatusFilter] = useState<'open' | 'all' | 'mine' | 'responded'>('open')
  const [typeFilter, setTypeFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('help_requests')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'help_requests' },
        (payload) => {
          setRequests(prev => [{ ...(payload.new as HelpRequest), response_count: 0 }, ...prev])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const filtered = requests.filter(r => {
    if (statusFilter === 'open' && r.status !== 'open') return false
    if (statusFilter === 'mine' && r.requester_id !== userId) return false
    if (statusFilter === 'responded' && !respondedIds.includes(r.id)) return false
    if (typeFilter !== 'all' && r.request_type !== typeFilter) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      if (
        !r.title.toLowerCase().includes(q) &&
        !r.body?.toLowerCase().includes(q) &&
        !r.target_name?.toLowerCase().includes(q) &&
        !r.target_org?.toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  return (
    <div className="space-y-4">
      {/* 검색 */}
      <input
        type="text"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="제목, 본문, 대상자명 검색..."
        style={{
          width: '100%',
          background: '#131C2C',
          border: '1px solid #1A2838',
          borderRadius: '8px',
          padding: '9px 14px',
          fontSize: '14px',
          color: '#DCE8F4',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      {/* 필터 행 */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        {/* 상태 필터 */}
        <div className="flex rounded-lg p-1" style={{ background: '#131C2C', border: '1px solid #1A2838' }}>
          {([
            { value: 'open', label: '🔵 진행 중' },
            { value: 'all', label: '전체' },
            { value: 'mine', label: '내 요청' },
            { value: 'responded', label: '내가 응답한' },
          ] as const).map(t => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 500,
                background: statusFilter === t.value ? '#4A7CC0' : 'transparent',
                color: statusFilter === t.value ? 'white' : '#8AAAC8',
                cursor: 'pointer',
                border: 'none',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* 유형 필터 */}
        <div className="flex rounded-lg p-1" style={{ background: '#131C2C', border: '1px solid #1A2838' }}>
          {TYPE_FILTERS.map(t => (
            <button
              key={t.value}
              onClick={() => setTypeFilter(t.value)}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 500,
                background: typeFilter === t.value ? 'rgba(74,124,192,0.3)' : 'transparent',
                color: typeFilter === t.value ? '#DCE8F4' : '#8AAAC8',
                cursor: 'pointer',
                border: 'none',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s',
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 요청 목록 */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="glass-card flex flex-col items-center py-12">
            <p className="text-sm" style={{ color: '#607898' }}>
              {searchQuery ? `"${searchQuery}"에 해당하는 요청이 없습니다` : '요청이 없습니다'}
            </p>
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
                <div className="flex items-center gap-2 mb-1.5" style={{ flexWrap: 'wrap' }}>
                  <span className="text-xs px-2 py-0.5 rounded"
                    style={{ background: 'rgba(30,144,255,0.1)', color: '#8AAAC8' }}>
                    {REQUEST_TYPE_LABEL[req.request_type] ?? req.request_type}
                  </span>
                  <span className="text-xs" style={{ color: STATUS_LABEL[req.status].color }}>
                    ● {STATUS_LABEL[req.status].label}
                  </span>
                  {respondedIds.includes(req.id) && (
                    <span className="text-xs px-2 py-0.5 rounded"
                      style={{ background: 'rgba(61,158,106,0.15)', color: '#3D9E6A' }}>
                      ✓ 응답함
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-semibold mb-1" style={{ color: '#DCE8F4' }}>
                  {req.title}
                </h3>

                {(req.target_name || req.target_org) && (
                  <p className="text-xs mt-0.5" style={{ color: '#8AAAC8' }}>
                    대상: {req.target_name}{req.target_org && ` (${req.target_org})`}
                  </p>
                )}

                {req.body && (
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: '#607898' }}>
                    {req.body}
                  </p>
                )}
              </div>

              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <span className="text-sm font-bold" style={{ color: '#7E6E48' }}>
                  +{req.reward_points}pt
                </span>
                {req.response_count > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded"
                    style={{ background: 'rgba(74,124,192,0.12)', color: '#4A7CC0', border: '1px solid rgba(74,124,192,0.2)' }}>
                    💬 {req.response_count}
                  </span>
                )}
                <span className="text-xs" style={{ color: '#607898' }}>
                  {req.profiles?.full_name ?? '—'}
                  {req.profiles?.department && ` · ${req.profiles.department}`}
                </span>
                <span className="text-xs" style={{ color: '#607898' }}>
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
