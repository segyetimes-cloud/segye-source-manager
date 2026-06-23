'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  reportId: string
  /** 편집할 필드명 */
  field: 'content' | 'title'
  /** 현재 값 */
  value: string | null
  /** 표시 레이블 */
  label: string
  /** 편집 권한 */
  canEdit: boolean
  /** 렌더 슬롯 — 읽기 모드에서 표시할 내용 */
  children: React.ReactNode
  /** 저장 후 콜백 (선택) */
  onSaved?: (newValue: string) => void
}

/**
 * 정보보고 개별 필드 인라인 편집 래퍼
 *
 * 사용법:
 *   <ReportFieldEditor reportId={id} field="content" value={content} label="공개정보" canEdit={canEdit}>
 *     <ReportContentViewer ... />
 *   </ReportFieldEditor>
 */
export default function ReportFieldEditor({
  reportId, field, value, label, canEdit, children, onSaved,
}: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(value ?? '')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function handleSave() {
    if (draft === (value ?? '')) { setEditing(false); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: draft || null }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error ?? '저장 실패')
        return
      }
      onSaved?.(draft)
      setEditing(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setDraft(value ?? '')
    setError('')
    setEditing(false)
  }

  return (
    <div>
      {/* 헤더: 레이블 + 편집 버튼 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#526070' }}>{label}</span>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => { setDraft(value ?? ''); setEditing(true) }}
            style={{
              fontSize: '12px', padding: '3px 10px', borderRadius: '6px',
              background: '#EEF2F7', color: '#526070',
              border: '1px solid #DDE5EF', cursor: 'pointer',
            }}
          >
            ✏️ 수정
          </button>
        )}
      </div>

      {editing ? (
        <div>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={field === 'title' ? 2 : 8}
            style={{
              width: '100%', background: '#F8FAFC', border: '1px solid #4A7CC0',
              color: '#1C2B3A', borderRadius: '8px', padding: '10px 12px',
              fontSize: '14px', lineHeight: 1.7, resize: 'vertical',
            }}
            autoFocus
          />
          {error && <p style={{ fontSize: '12px', color: '#C04040', marginTop: '4px' }}>{error}</p>}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '6px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: 600,
                background: '#4A7CC0', color: 'white', border: 'none',
                cursor: saving ? 'wait' : 'pointer', opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? '저장 중…' : '저장'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={saving}
              style={{
                padding: '6px 14px', borderRadius: '7px', fontSize: '13px',
                background: '#EEF2F7', color: '#526070',
                border: '1px solid #DDE5EF', cursor: 'pointer',
              }}
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        /* 읽기 모드: 슬롯 표시 */
        <div>
          {children}
        </div>
      )}
    </div>
  )
}
