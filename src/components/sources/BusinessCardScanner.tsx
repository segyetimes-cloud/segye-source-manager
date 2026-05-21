'use client'

import { useRef, useState } from 'react'

interface Props {
  onExtracted: (data: { [key: string]: string | null | undefined }) => void
}

export default function BusinessCardScanner({ onExtracted }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [done, setDone]       = useState(false)

  function reset() {
    setPreview(null)
    setLoading(false)
    setError('')
    setDone(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('이미지 파일만 업로드 가능합니다.')
      return
    }

    // 미리보기
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    // 즉시 OCR
    setError('')
    setLoading(true)
    try {
      const form = new FormData()
      form.append('image', file)
      const res  = await fetch('/api/ocr/business-card', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'OCR 실패')
        return
      }
      onExtracted(json.data)
      setDone(true)
    } catch {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // ── 완료 ──────────────────────────────────────────────────────────────────
  if (done && preview) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 12px', borderRadius: '8px',
        background: 'rgba(61,158,106,0.06)', border: '1px solid rgba(61,158,106,0.25)',
      }}>
        <img src={preview} alt="명함"
          style={{ width: '64px', height: '40px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '13px', color: '#3D9E6A', fontWeight: 600, margin: 0 }}>
            ✅ 정보 추출 완료
          </p>
          <p style={{ fontSize: '11px', color: '#485870', margin: '2px 0 0' }}>
            아래 필드를 확인 · 수정해 주세요
          </p>
        </div>
        <button type="button" onClick={reset}
          style={{ fontSize: '11px', color: '#485870', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', flexShrink: 0 }}>
          다시 스캔
        </button>
      </div>
    )
  }

  // ── 분석 중 ────────────────────────────────────────────────────────────────
  if (loading && preview) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 12px', borderRadius: '8px',
        background: 'rgba(30,144,255,0.04)', border: '1px solid rgba(30,144,255,0.15)',
      }}>
        <img src={preview} alt="명함"
          style={{ width: '64px', height: '40px', objectFit: 'cover', borderRadius: '4px', flexShrink: 0 }} />
        <div style={{
          width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
          border: '2px solid #1A2838', borderTopColor: '#4A7CC0',
          animation: 'spin 0.8s linear infinite',
        }} />
        <p style={{ fontSize: '13px', color: '#4A7CC0', margin: 0 }}>명함 분석 중...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  // ── 기본 ───────────────────────────────────────────────────────────────────
  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        style={{
          width: '100%', padding: '11px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
          background: 'rgba(30,144,255,0.08)', border: '1px solid rgba(30,144,255,0.25)',
          borderRadius: '8px', cursor: 'pointer',
          fontSize: '13px', fontWeight: 600, color: '#4A7CC0',
        }}
      >
        📸 명함 사진 스캔
        <span style={{ fontSize: '11px', fontWeight: 400, color: '#485870' }}>
          — 촬영 또는 갤러리 선택
        </span>
      </button>
      {error && (
        <p style={{ fontSize: '12px', color: '#C04040', marginTop: '6px' }}>⚠ {error}</p>
      )}
    </div>
  )
}
