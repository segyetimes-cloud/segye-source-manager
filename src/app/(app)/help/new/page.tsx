'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const REQUEST_TYPES = [
  { value: 'contact', label: '📞 연락처 요청', desc: '취재원의 연락처 정보를 요청합니다' },
  { value: 'info', label: '📋 정보 요청', desc: '특정 인물의 배경 정보를 요청합니다' },
  { value: 'interview', label: '🎤 인터뷰 주선', desc: '인터뷰 연결을 부탁합니다' },
  { value: 'other', label: '💬 기타', desc: '그 외 협조 요청' },
]

export default function NewHelpPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    title: '',
    body: '',
    request_type: 'contact',
    target_name: '',
    target_org: '',
    reward_points: 10,
  })

  function set(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('제목을 입력해 주세요.')
      return
    }
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '등록에 실패했습니다.')
        return
      }

      router.push(`/help/${data.id}`)
    } catch {
      setError('등록 중 오류가 발생했습니다. 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = {
    background: '#182035',
    border: '1px solid #1A2838',
    color: '#CDD5E0',
    borderRadius: '8px',
    padding: '9px 12px',
    fontSize: '14px',
    width: '100%',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '13px',
    fontWeight: 500,
    marginBottom: '6px',
    color: '#8AAAC8',
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link href="/help" style={{ color: '#607898', textDecoration: 'none', fontSize: '20px' }}>←</Link>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#CDD5E0' }}>도움 요청</h1>
          <p className="text-sm mt-0.5" style={{ color: '#8AAAC8' }}>
            동료 기자에게 취재 도움을 요청합니다. 채택 시 포인트가 지급됩니다.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* 요청 유형 */}
        <div className="glass-card p-5">
          <label style={labelStyle}>요청 유형 *</label>
          <div className="grid grid-cols-2 gap-3">
            {REQUEST_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => set('request_type', t.value)}
                className="p-3 rounded-lg text-left transition-colors"
                style={{
                  background: form.request_type === t.value ? 'rgba(30,144,255,0.15)' : '#131C2C',
                  border: `1px solid ${form.request_type === t.value ? 'rgba(30,144,255,0.4)' : '#1A2838'}`,
                  cursor: 'pointer',
                }}>
                <div className="text-sm font-semibold" style={{ color: '#CDD5E0' }}>{t.label}</div>
                <div className="text-xs mt-0.5" style={{ color: '#607898' }}>{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* 요청 내용 */}
        <div className="glass-card p-5 space-y-4">
          <div>
            <label style={labelStyle}>제목 *</label>
            <input
              type="text"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              placeholder="예: 국토부 장관 연락처가 필요합니다"
              style={inputStyle}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={labelStyle}>대상 이름</label>
              <input
                type="text"
                value={form.target_name}
                onChange={e => set('target_name', e.target.value)}
                placeholder="홍길동"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>대상 소속 / 조직</label>
              <input
                type="text"
                value={form.target_org}
                onChange={e => set('target_org', e.target.value)}
                placeholder="국토교통부"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>상세 내용</label>
            <textarea
              value={form.body}
              onChange={e => set('body', e.target.value)}
              placeholder="구체적인 요청 내용이나 배경을 적어주세요..."
              rows={4}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>
        </div>

        {/* 리워드 포인트 */}
        <div className="glass-card p-5">
          <label style={labelStyle}>리워드 포인트 (채택 시 응답자에게 지급)</label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min="5"
              max="100"
              step="5"
              value={form.reward_points}
              onChange={e => set('reward_points', parseInt(e.target.value))}
              style={{ flex: 1, accentColor: '#4A7CC0' }}
            />
            <span className="text-lg font-bold min-w-[4rem] text-right" style={{ color: '#7E6E48' }}>
              {form.reward_points}pt
            </span>
          </div>
          <p className="text-xs mt-2" style={{ color: '#607898' }}>
            포인트가 높을수록 빠른 응답을 받을 수 있습니다 (5~100pt)
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(255,68,68,0.1)', color: '#C04040', border: '1px solid rgba(255,68,68,0.2)' }}>
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 py-3 rounded-lg font-semibold text-sm"
            style={{
              background: submitting ? '#1A2838' : 'linear-gradient(135deg, #4A7CC0, #0066CC)',
              color: 'white',
              border: 'none',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}>
            {submitting ? '등록 중...' : '🙋 도움 요청 등록'}
          </button>
          <Link
            href="/help"
            className="px-6 py-3 rounded-lg text-sm font-medium"
            style={{ background: '#182035', color: '#8AAAC8', border: '1px solid #1A2838', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            취소
          </Link>
        </div>
      </form>
    </div>
  )
}
