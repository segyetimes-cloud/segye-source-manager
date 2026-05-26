'use client'

import { useState, useCallback } from 'react'

export interface AllowedUser {
  id: string
  full_name: string
  department: string | null
  rank: string | null
}

interface Props {
  selected: AllowedUser[]
  onChange: (users: AllowedUser[]) => void
}

export default function AllowedUsersSelector({ selected, onChange }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<AllowedUser[]>([])
  const [searching, setSearching] = useState(false)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/profiles/search?q=${encodeURIComponent(q)}&limit=15`)
      if (res.ok) {
        const data = await res.json()
        setResults((data.users ?? []) as AllowedUser[])
      }
    } finally {
      setSearching(false)
    }
  }, [])

  function add(u: AllowedUser) {
    if (selected.find(x => x.id === u.id)) return
    onChange([...selected, u])
    setQuery('')
    setResults([])
  }

  function remove(id: string) {
    onChange(selected.filter(x => x.id !== id))
  }

  return (
    <div>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); search(e.target.value) }}
          placeholder="기자 이름 또는 부서 검색"
          style={{
            background: '#182035', border: '1px solid #1A2838',
            color: '#DCE8F4', borderRadius: '8px',
            padding: '9px 12px', fontSize: '14px', width: '100%',
          }}
        />
        {results.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
            background: '#131C2C', border: '1px solid #1A2838',
            borderRadius: '8px', marginTop: '4px',
            maxHeight: '220px', overflowY: 'auto',
          }}>
            {results.map(u => (
              <button
                key={u.id}
                type="button"
                onClick={() => add(u)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  width: '100%', textAlign: 'left',
                  padding: '9px 12px', background: 'none', border: 'none',
                  cursor: 'pointer', color: '#DCE8F4', fontSize: '13px',
                  borderBottom: '1px solid #1A2838',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#182035')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <span style={{ fontWeight: 600 }}>{u.full_name}</span>
                {u.rank && (
                  <span style={{
                    fontSize: '11px', fontWeight: 600,
                    color: ['부국장','편집국장','편집인'].includes(u.rank) ? '#FFB800'
                          : u.rank === '부장' ? '#3A90A8' : '#8AAAC8',
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: '4px', padding: '1px 6px',
                  }}>{u.rank}</span>
                )}
                {u.department && (
                  <span style={{ fontSize: '12px', color: '#5A7099' }}>{u.department}</span>
                )}
              </button>
            ))}
          </div>
        )}
        {searching && (
          <p style={{ fontSize: '12px', color: '#607898', marginTop: '4px' }}>검색 중...</p>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selected.map(u => (
            <span key={u.id} style={{
              background: 'rgba(255,184,0,0.08)',
              color: '#FFB800',
              border: '1px solid rgba(255,184,0,0.25)',
              borderRadius: '5px', padding: '3px 9px',
              fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px',
            }}>
              👁 {u.full_name}
              {u.rank && <span style={{ fontSize: '10px', opacity: 0.7 }}>({u.rank})</span>}
              <button type="button" onClick={() => remove(u.id)}
                style={{ background: 'none', border: 'none', color: '#FFB800', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 }}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
