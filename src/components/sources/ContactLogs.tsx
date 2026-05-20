'use client'

import { useState, useEffect } from 'react'
import ProtectedText from '@/components/common/ProtectedText'

interface ContactLog {
  id: string
  method: 'call' | 'message' | 'email' | 'meet' | 'other'
  summary: string
  result: string | null
  contacted_at: string
  next_followup_at: string | null
  is_sensitive: boolean
  user_id: string
  profiles: { full_name: string } | null
}

const METHOD_LABELS: Record<string, string> = {
  call: '📞 전화', message: '💬 문자', email: '📧 이메일', meet: '🤝 대면', other: '📝 기타',
}

const METHOD_COLORS: Record<string, string> = {
  call: '#4A7CC0', message: '#3A90A8', email: '#3D9E6A', meet: '#A87228', other: '#485870',
}

function formatFollowup(iso: string): { label: string; urgent: boolean } {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = d.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / 86400000)
  const dateStr = d.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  if (diffMs < 0) return { label: `${dateStr} (기한 초과)`, urgent: true }
  if (diffDays <= 1) return { label: `${dateStr} (오늘/내일!)`, urgent: true }
  if (diffDays <= 3) return { label: `${dateStr} (${diffDays}일 후)`, urgent: true }
  return { label: `${dateStr} (${diffDays}일 후)`, urgent: false }
}

const ADMIN_OR_ABOVE = ['admin', 'section_editor', 'editor', 'publisher', 'superadmin']

export default function ContactLogs({ sourceId, currentUserId, userRole }: { sourceId: string; currentUserId: string; userRole?: string }) {
  const isAdminOrAbove = ADMIN_OR_ABOVE.includes(userRole ?? '')
  const [logs, setLogs] = useState<ContactLog[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [method, setMethod] = useState<'call' | 'message' | 'email' | 'meet' | 'other'>('call')
  const [summary, setSummary] = useState('')
  const [result, setResult] = useState('')
  const [contactedAt, setContactedAt] = useState(() => new Date().toISOString().slice(0, 16))
  const [nextFollowupAt, setNextFollowupAt] = useState('')
  const [isSensitive, setIsSensitive] = useState(false)

  useEffect(() => {
    fetch(`/api/sources/${sourceId}/contact-logs`)
      .then(r => r.ok ? r.json() : { logs: [] })
      .then(d => setLogs(d.logs ?? []))
      .finally(() => setLoading(false))
  }, [sourceId])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!summary.trim()) return
    setSubmitting(true)
    const res = await fetch(`/api/sources/${sourceId}/contact-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        method, summary, result,
        contacted_at: new Date(contactedAt).toISOString(),
        next_followup_at: nextFollowupAt ? new Date(nextFollowupAt).toISOString() : null,
        is_sensitive: isSensitive,
      }),
    })
    if (res.ok) {
      const newLog = await res.json()
      setLogs(prev => [newLog, ...prev])
      setSummary(''); setResult(''); setAdding(false)
      setContactedAt(new Date().toISOString().slice(0, 16))
      setNextFollowupAt(''); setIsSensitive(false)
    }
    setSubmitting(false)
  }

  async function handleDelete(logId: string) {
    if (!confirm('이 연락 이력을 삭제하시겠습니까?')) return
    const res = await fetch(`/api/sources/${sourceId}/contact-logs?log_id=${logId}`, { method: 'DELETE' })
    if (res.ok) setLogs(prev => prev.filter(l => l.id !== logId))
  }

  const inputStyle: React.CSSProperties = {
    background: '#1A2838', border: '1px solid #202C3A', color: '#CDD5E0',
    borderRadius: '6px', padding: '7px 10px', fontSize: '13px', width: '100%',
  }

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold" style={{ color: '#CDD5E0' }}>📞 연락 이력</h2>
        <button
          type="button"
          onClick={() => setAdding(!adding)}
          style={{
            fontSize: '12px', padding: '5px 12px', borderRadius: '6px',
            background: adding ? 'rgba(192,64,64,0.1)' : 'rgba(74,124,192,0.12)',
            color: adding ? '#C04040' : '#4A7CC0',
            border: `1px solid ${adding ? 'rgba(192,64,64,0.3)' : 'rgba(74,124,192,0.3)'}`,
            cursor: 'pointer',
          }}>
          {adding ? '취소' : '+ 추가'}
        </button>
      </div>

      {/* 다가오는 팔로업 배너 */}
      {!loading && (() => {
        const upcoming = logs
          .filter(l => l.next_followup_at)
          .sort((a, b) => new Date(a.next_followup_at!).getTime() - new Date(b.next_followup_at!).getTime())
          .slice(0, 1)[0]
        if (!upcoming) return null
        const { label, urgent } = formatFollowup(upcoming.next_followup_at!)
        return (
          <div style={{
            marginBottom: '12px', padding: '8px 12px', borderRadius: '8px',
            background: urgent ? 'rgba(61,158,106,0.1)' : 'rgba(74,124,192,0.08)',
            border: `1px solid ${urgent ? 'rgba(61,158,106,0.35)' : 'rgba(74,124,192,0.2)'}`,
            display: 'flex', alignItems: 'center', gap: '8px',
          }}>
            <span style={{ fontSize: '14px' }}>{urgent ? '🔔' : '📅'}</span>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 600, color: urgent ? '#3D9E6A' : '#4A7CC0' }}>다음 팔로업</span>
              <span style={{ fontSize: '12px', color: '#CDD5E0', marginLeft: '8px' }}>{label}</span>
            </div>
          </div>
        )
      })()}

      {/* 추가 폼 */}
      {adding && (
        <form onSubmit={handleAdd} style={{
          marginBottom: '16px', padding: '14px',
          background: 'rgba(74,124,192,0.05)', border: '1px solid rgba(74,124,192,0.15)',
          borderRadius: '8px',
        }}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label style={{ fontSize: '12px', color: '#485870', display: 'block', marginBottom: '4px' }}>방법</label>
              <select value={method} onChange={e => setMethod(e.target.value as typeof method)} style={inputStyle}>
                {Object.entries(METHOD_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#485870', display: 'block', marginBottom: '4px' }}>일시</label>
              <input
                type="datetime-local"
                value={contactedAt}
                onChange={e => setContactedAt(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ fontSize: '12px', color: '#485870', display: 'block', marginBottom: '4px' }}>내용 *</label>
            <textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="연락 내용을 간략히 기록하세요"
              rows={3}
              required
              style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label style={{ fontSize: '12px', color: '#485870', display: 'block', marginBottom: '4px' }}>결과 (선택)</label>
              <input
                value={result}
                onChange={e => setResult(e.target.value)}
                placeholder="예: 인터뷰 수락"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: '#3D9E6A', display: 'block', marginBottom: '4px' }}>📅 다음 팔로업 일시 (선택)</label>
              <input
                type="datetime-local"
                value={nextFollowupAt}
                onChange={e => setNextFollowupAt(e.target.value)}
                style={{ ...inputStyle, borderColor: nextFollowupAt ? 'rgba(61,158,106,0.5)' : undefined }}
              />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isSensitive}
              onChange={e => setIsSensitive(e.target.checked)}
              style={{ width: '14px', height: '14px', accentColor: '#C04040', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '12px', color: isSensitive ? '#E06060' : '#485870', fontWeight: isSensitive ? 600 : 400 }}>
              🔒 민감 연락 (부장 이상만 열람)
            </span>
          </label>

          <button
            type="submit"
            disabled={submitting || !summary.trim()}
            style={{
              width: '100%', padding: '9px',
              background: submitting ? '#1A2838' : '#4A7CC0',
              color: '#fff', border: 'none', borderRadius: '6px',
              fontSize: '13px', fontWeight: 600, cursor: submitting ? 'default' : 'pointer',
              opacity: !summary.trim() ? 0.5 : 1,
            }}>
            {submitting ? '저장 중…' : '저장'}
          </button>
        </form>
      )}

      {/* 목록 */}
      {loading ? (
        <p style={{ fontSize: '13px', color: '#485870', textAlign: 'center', padding: '16px 0' }}>불러오는 중…</p>
      ) : logs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <p style={{ fontSize: '14px', color: '#485870' }}>연락 이력이 없습니다.</p>
          <p style={{ fontSize: '12px', color: '#384860', marginTop: '4px' }}>
            통화·문자·이메일·대면 연락을 기록해두면 히스토리로 관리됩니다.
          </p>
        </div>
      ) : (
        <div style={{ position: 'relative' }}>
          {/* 타임라인 선 */}
          <div style={{
            position: 'absolute', left: '15px', top: '4px', bottom: '4px',
            width: '2px', background: 'rgba(74,124,192,0.15)',
          }} />

          <div className="space-y-4">
            {logs.map(log => {
              const color = METHOD_COLORS[log.method] ?? '#485870'
              const dateStr = new Date(log.contacted_at).toLocaleString('ko-KR', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit',
              })
              const isOwn = log.user_id === currentUserId

              return (
                <div key={log.id} style={{ display: 'flex', gap: '12px', paddingLeft: '6px' }}>
                  {/* 아이콘 */}
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                    background: `${color}22`, border: `2px solid ${color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '9px', marginTop: '2px', zIndex: 1,
                  }}>
                    {log.method === 'call' ? '📞' : log.method === 'message' ? '💬' :
                     log.method === 'email' ? '📧' : log.method === 'meet' ? '🤝' : '📝'}
                  </div>

                  {/* 내용 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '11px', color, fontWeight: 600 }}>
                        {METHOD_LABELS[log.method]}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {log.is_sensitive && (
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '10px',
                            background: 'rgba(192,64,64,0.1)', color: '#E06060', border: '1px solid rgba(192,64,64,0.3)' }}>
                            🔒 민감
                          </span>
                        )}
                        <span style={{ fontSize: '11px', color: '#485870' }}>{dateStr}</span>
                        {isOwn && (
                          <button
                            type="button"
                            onClick={() => handleDelete(log.id)}
                            style={{ fontSize: '11px', color: '#485870', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            title="삭제">
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                    {log.is_sensitive ? (
                      <ProtectedText text={log.summary} fontSize={13} color="#CDD5E0" style={{ display: 'block', lineHeight: 1.5 }} />
                    ) : (
                      <p style={{ fontSize: '13px', color: '#CDD5E0', lineHeight: 1.5, margin: 0 }}>{log.summary}</p>
                    )}
                    {log.result && (
                      log.is_sensitive ? (
                        <ProtectedText text={`→ ${log.result}`} fontSize={12} color="#3D9E6A" style={{ display: 'block', marginTop: '3px' }} />
                      ) : (
                        <p style={{ fontSize: '12px', color: '#3D9E6A', marginTop: '3px' }}>
                          → {log.result}
                        </p>
                      )
                    )}
                    {log.next_followup_at && (() => {
                      const { label, urgent } = formatFollowup(log.next_followup_at!)
                      return (
                        <p style={{ fontSize: '11px', marginTop: '4px', fontWeight: 500,
                          color: urgent ? '#3D9E6A' : '#4A7CC0' }}>
                          📅 팔로업: {label}
                        </p>
                      )
                    })()}
                    {log.profiles?.full_name && !isOwn && (
                      <p style={{ fontSize: '11px', color: '#485870', marginTop: '2px' }}>
                        기록: {log.profiles.full_name}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
