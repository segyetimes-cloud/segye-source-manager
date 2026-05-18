'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  duplicateNames: string[]
}

export default function DuplicateWarning({ duplicateNames }: Props) {
  const [dismissed, setDismissed] = useState(false)
  const router = useRouter()

  if (dismissed || duplicateNames.length === 0) return null

  return (
    <div className="rounded-lg px-4 py-3 flex items-start justify-between gap-3"
      style={{ background: 'rgba(255,153,0,0.1)', border: '1px solid rgba(255,153,0,0.3)' }}>
      <div className="flex items-start gap-2 text-sm" style={{ color: '#FFB84D' }}>
        <span className="flex-shrink-0 mt-0.5">⚠️</span>
        <span>
          <strong>중복 이름 감지:</strong>{' '}
          {duplicateNames.map((name, i) => (
            <span key={name}>
              {i > 0 && ', '}
              <button
                onClick={() => router.push(`/sources?tab=shared&q=${encodeURIComponent(name)}`)}
                style={{
                  color: '#FFD700',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  fontWeight: 700,
                  padding: 0,
                  fontSize: 'inherit',
                }}>
                {name}
              </button>
            </span>
          ))}{' '}
          — 동일 이름의 취재원이 2개 이상 등록되어 있습니다.{' '}
          <span style={{ color: '#CC9933' }}>이름을 클릭하면 해당 취재원 목록으로 이동합니다. 중복 레코드를 삭제하면 경고가 사라집니다.</span>
        </span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        title="닫기"
        style={{
          flexShrink: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#8B6914',
          fontSize: '18px',
          lineHeight: 1,
          padding: '0 2px',
        }}>
        ×
      </button>
    </div>
  )
}
