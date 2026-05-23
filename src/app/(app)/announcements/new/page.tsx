'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewAnnouncementPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [isPinned, setIsPinned] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('제목을 입력해 주세요'); return }
    setSubmitting(true)
    setError('')
    const res = await fetch('/api/announcements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, is_pinned: isPinned }),
    })
    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? '저장에 실패했습니다')
      setSubmitting(false)
      return
    }
    router.push('/announcements')
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px',
    background: '#182035', border: '1px solid #1A2838',
    borderRadius: '8px', color: '#CDD5E0', fontSize: '14px',
    outline: 'none', boxSizing: 'border-box' as const,
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#CDD5E0' }}>📢 새 공지 작성</h1>
        <p className="text-sm mt-1" style={{ color: '#687898' }}>작성한 공지는 전체 구성원에게 표시됩니다</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: '#8A9EC0' }}>제목 *</label>
          <input value={title} onChange={e => setTitle(e.target.value)}
            placeholder="공지 제목" style={inputStyle} />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1" style={{ color: '#8A9EC0' }}>본문</label>
          <textarea value={body} onChange={e => setBody(e.target.value)}
            placeholder="공지 내용을 입력하세요 (선택)"
            rows={8} style={{ ...inputStyle, resize: 'vertical' as const }} />
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="pin" checked={isPinned} onChange={e => setIsPinned(e.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: '#A87228', cursor: 'pointer' }} />
          <label htmlFor="pin" className="text-sm cursor-pointer" style={{ color: '#A87228' }}>
            📌 상단 고정
          </label>
        </div>

        {error && <p className="text-sm" style={{ color: '#C04040' }}>{error}</p>}

        <div className="flex gap-3 justify-end">
          <a href="/announcements"
            style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13px',
              background: '#1A2838', color: '#687898', border: '1px solid #1A2838',
              textDecoration: 'none', display: 'inline-block' }}>
            취소
          </a>
          <button type="submit" disabled={submitting}
            style={{ padding: '9px 22px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
              background: submitting ? '#1A2838' : 'rgba(30,144,255,0.18)',
              color: submitting ? '#485870' : '#4A7CC0',
              border: '1px solid rgba(30,144,255,0.3)', cursor: submitting ? 'not-allowed' : 'pointer' }}>
            {submitting ? '저장 중...' : '공지 등록'}
          </button>
        </div>
      </form>
    </div>
  )
}
