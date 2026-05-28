'use client'

import { useState } from 'react'

interface Props {
  reportId: string
  createdAt: string
  isSuperAdmin: boolean
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

/** ISO → datetime-local input 값 (YYYY-MM-DDTHH:mm, 로컬 시간) */
function toLocalInput(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function ReportCreatedAtEditor({ reportId, createdAt, isSuperAdmin }: Props) {
  const [editing, setEditing]   = useState(false)
  const [value, setValue]       = useState(toLocalInput(createdAt))
  const [current, setCurrent]   = useState(createdAt)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ created_at: new Date(value).toISOString() }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? '수정에 실패했습니다.')
        return
      }
      setCurrent(new Date(value).toISOString())
      setEditing(false)
    } catch {
      setError('저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  /* ── 일반 사용자: 날짜만 표시 ── */
  if (!isSuperAdmin) {
    return <span style={{ fontSize: '13px', color: '#607898' }}>{fmtDateTime(current)}</span>
  }

  /* ── superadmin 편집 모드 ── */
  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <input
          type="datetime-local"
          value={value}
          onChange={e => setValue(e.target.value)}
          style={{
            background: '#182035', border: '1px solid #4A7CC0',
            borderRadius: '6px', padding: '4px 8px',
            color: '#CDD5E0', fontSize: '13px',
          }}
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          style={{
            padding: '4px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
            background: saving ? 'rgba(61,158,106,0.4)' : '#3D9E6A',
            color: 'white', border: 'none',
            cursor: saving ? 'not-allowed' : 'pointer',
          }}
        >
          {saving ? '저장 중…' : '저장'}
        </button>
        <button
          type="button"
          onClick={() => { setEditing(false); setError('') }}
          style={{
            padding: '4px 10px', borderRadius: '6px', fontSize: '12px',
            background: 'none', color: '#607898', border: '1px solid #1A2838',
            cursor: 'pointer',
          }}
        >
          취소
        </button>
        {error && <span style={{ fontSize: '11px', color: '#C04040' }}>{error}</span>}
      </div>
    )
  }

  /* ── superadmin 기본 모드: 날짜 + 편집 버튼 ── */
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
      <span style={{ fontSize: '13px', color: '#607898' }}>{fmtDateTime(current)}</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="최고관리자 전용 — 작성 날짜 수정"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#4A7CC0', fontSize: '11px', padding: '1px 5px',
          borderRadius: '4px', lineHeight: 1,
          opacity: 0.5, transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
      >
        ✏️
      </button>
    </div>
  )
}
