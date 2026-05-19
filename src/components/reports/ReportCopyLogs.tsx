'use client'

import { useState, useEffect, useCallback } from 'react'

interface CopyLog {
  id: string
  user_id: string
  copied_length: number
  copied_preview: string | null
  user_agent: string | null
  created_at: string
  profiles?: { full_name: string; department: string | null } | null
}

interface Props {
  reportId: string
}

export default function ReportCopyLogs({ reportId }: Props) {
  const [logs, setLogs]         = useState<CopyLog[]>([])
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/reports/${reportId}/copy-log`)
    if (res.ok) {
      const data = await res.json()
      setLogs(data.logs ?? [])
    }
    setLoading(false)
  }, [reportId])

  useEffect(() => { load() }, [load])

  function fmt(iso: string) {
    return new Date(iso).toLocaleString('ko-KR', {
      month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  }

  const uniqueUsers = new Set(logs.map(l => l.user_id)).size

  return (
    <div className="glass-card p-4">
      {/* 헤더 */}
      <button
        onClick={() => setExpanded(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#CDD5E0' }}>
            🔍 복사 이력 추적
          </span>
          <span style={{
            fontSize: '11px', color: '#485870',
            background: 'rgba(255,68,68,0.08)',
            border: '1px solid rgba(255,68,68,0.2)',
            borderRadius: '4px', padding: '1px 7px',
          }}>
            데스크 전용
          </span>
        </div>
        <div className="flex items-center gap-3">
          {logs.length > 0 && (
            <div className="flex items-center gap-2">
              <span style={{
                background: 'rgba(255,68,68,0.12)', color: '#C04040',
                border: '1px solid rgba(255,68,68,0.25)',
                borderRadius: '6px', padding: '2px 10px',
                fontSize: '12px', fontWeight: 600,
              }}>
                {logs.length}회 복사
              </span>
              <span style={{
                background: 'rgba(255,153,0,0.12)', color: '#A87228',
                border: '1px solid rgba(255,153,0,0.25)',
                borderRadius: '6px', padding: '2px 10px',
                fontSize: '12px', fontWeight: 600,
              }}>
                {uniqueUsers}명
              </span>
            </div>
          )}
          <span style={{ fontSize: '18px', color: '#485870', lineHeight: 1 }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
      </button>

      {expanded && (
        <div style={{ marginTop: '14px' }}>
          {loading && (
            <p style={{ fontSize: '13px', color: '#485870', textAlign: 'center', padding: '12px' }}>
              불러오는 중...
            </p>
          )}

          {!loading && logs.length === 0 && (
            <p style={{ fontSize: '13px', color: '#485870', textAlign: 'center', padding: '12px' }}>
              복사 이력이 없습니다.
            </p>
          )}

          {!loading && logs.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {logs.map((log, idx) => {
                const person = log.profiles as { full_name: string; department: string | null } | null
                return (
                  <div
                    key={log.id}
                    style={{
                      padding: '9px 12px',
                      background: idx % 2 === 0 ? '#131C2C' : '#0D1520',
                      borderRadius: '7px',
                      border: '1px solid #1A2838',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#C04040' }}>
                          {person?.full_name ?? '알 수 없음'}
                        </span>
                        {person?.department && (
                          <span style={{ fontSize: '11px', color: '#485870' }}>
                            {person.department}
                          </span>
                        )}
                        <span style={{
                          fontSize: '11px', color: '#5A7099',
                          background: 'rgba(30,144,255,0.08)',
                          borderRadius: '4px', padding: '1px 6px',
                        }}>
                          {log.copied_length}자
                        </span>
                      </div>
                      <span style={{ fontSize: '11px', color: '#485870', flexShrink: 0 }}>
                        {fmt(log.created_at)}
                      </span>
                    </div>

                    {/* 복사 내용 미리보기 */}
                    {log.copied_preview && (
                      <p style={{
                        marginTop: '5px',
                        fontSize: '12px', color: '#5A7099',
                        background: '#182035',
                        borderRadius: '4px', padding: '4px 8px',
                        fontFamily: 'monospace',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        "{log.copied_preview.slice(0, 80)}{log.copied_preview.length > 80 ? '…' : ''}"
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          <button
            onClick={load}
            style={{
              marginTop: '10px', width: '100%',
              padding: '7px', background: '#182035',
              border: '1px solid #1A2838', color: '#687898',
              borderRadius: '7px', fontSize: '12px', cursor: 'pointer',
            }}
          >
            새로고침
          </button>
        </div>
      )}
    </div>
  )
}
