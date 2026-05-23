'use client'
import { useState } from 'react'

interface Announcement {
  id: string
  title: string
  body: string | null
  is_pinned: boolean
  created_at: string
  profiles: { full_name: string } | null
}

export default function AnnouncementsClient({
  announcements: initial,
  isSuperAdmin,
}: {
  announcements: Announcement[]
  isSuperAdmin: boolean
}) {
  const [list, setList] = useState(initial)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string) {
    if (!confirm('이 공지를 삭제할까요?')) return
    setDeleting(id)
    await fetch(`/api/announcements/${id}`, { method: 'DELETE' })
    setList(prev => prev.filter(a => a.id !== id))
    setDeleting(null)
  }

  function fmtDate(s: string) {
    return s.slice(0, 10)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#CDD5E0' }}>📢 알립니다</h1>
          <p className="text-sm mt-1" style={{ color: '#687898' }}>관리자가 작성한 공지 사항입니다</p>
        </div>
        {isSuperAdmin && (
          <a href="/announcements/new"
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              background: 'rgba(30,144,255,0.12)', color: '#4A7CC0',
              border: '1px solid rgba(30,144,255,0.3)', textDecoration: 'none',
            }}>
            + 새 공지 작성
          </a>
        )}
      </div>

      {list.length === 0 && (
        <div className="glass-card p-8 text-center" style={{ color: '#485870' }}>
          등록된 공지가 없습니다.
        </div>
      )}

      {list.map(a => (
        <div key={a.id}
          className="glass-card p-4"
          style={{
            border: a.is_pinned ? '1px solid rgba(255,153,0,0.35)' : '1px solid #1A2838',
            cursor: 'pointer',
          }}
          onClick={() => setExpanded(expanded === a.id ? null : a.id)}>

          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              {a.is_pinned && <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>📌</span>}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: '#CDD5E0' }}>{a.title}</p>
                <p className="text-xs mt-0.5" style={{ color: '#485870' }}>
                  {a.profiles?.full_name ?? '관리자'} · {fmtDate(a.created_at)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
              {isSuperAdmin && (
                <>
                  <a href={`/announcements/${a.id}/edit`}
                    style={{ fontSize: '12px', color: '#4A7CC0', padding: '4px 8px',
                      background: 'rgba(30,144,255,0.08)', borderRadius: '6px',
                      border: '1px solid rgba(30,144,255,0.2)', textDecoration: 'none' }}>
                    ✏️ 수정
                  </a>
                  <button
                    onClick={() => handleDelete(a.id)}
                    disabled={deleting === a.id}
                    style={{ fontSize: '12px', color: '#C04040', padding: '4px 8px',
                      background: 'rgba(192,64,64,0.08)', borderRadius: '6px',
                      border: '1px solid rgba(192,64,64,0.2)', cursor: 'pointer' }}>
                    {deleting === a.id ? '...' : '🗑 삭제'}
                  </button>
                </>
              )}
              <span style={{ fontSize: '11px', color: '#485870', marginLeft: '4px' }}>
                {expanded === a.id ? '▲' : '▼'}
              </span>
            </div>
          </div>

          {expanded === a.id && a.body && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid #1A2838' }}
              onClick={e => e.stopPropagation()}>
              <p className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: '#8A9EC0' }}>
                {a.body}
              </p>
            </div>
          )}
          {expanded === a.id && !a.body && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid #1A2838' }}>
              <p className="text-sm" style={{ color: '#485870' }}>(본문 없음)</p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
