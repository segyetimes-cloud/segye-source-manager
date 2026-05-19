'use client'

import { useEffect, useState } from 'react'

interface AllowedEntry {
  id: string
  user_id: string
  profiles: {
    full_name: string
    department: string | null
    rank: string | null
  } | null
}

interface Props {
  reportId: string
  isAuthorOrDesk: boolean
}

export default function ReportAllowedUsers({ reportId, isAuthorOrDesk }: Props) {
  const [list, setList] = useState<AllowedEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isAuthorOrDesk) return
    fetch(`/api/reports/${reportId}/allowed-users`)
      .then(r => r.ok ? r.json() : { allowed: [] })
      .then(d => { setList(d.allowed ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [reportId, isAuthorOrDesk])

  if (!isAuthorOrDesk || (!loading && list.length === 0)) return null

  return (
    <div className="glass-card p-4">
      <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#CDD5E0', marginBottom: '10px' }}>
        👁 지정 열람자 ({list.length}명)
      </h2>
      {loading ? (
        <p style={{ fontSize: '13px', color: '#485870' }}>불러오는 중...</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.map(entry => (
            <div key={entry.id} style={{
              background: 'rgba(255,184,0,0.08)',
              border: '1px solid rgba(255,184,0,0.2)',
              borderRadius: '7px', padding: '6px 12px',
            }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#FFB800' }}>
                {entry.profiles?.full_name ?? '—'}
                {entry.profiles?.rank && (
                  <span style={{ fontSize: '11px', color: '#CC9400', marginLeft: '5px' }}>
                    {entry.profiles.rank}
                  </span>
                )}
              </p>
              {entry.profiles?.department && (
                <p style={{ fontSize: '11px', color: '#5A7099', marginTop: '1px' }}>
                  {entry.profiles.department}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
