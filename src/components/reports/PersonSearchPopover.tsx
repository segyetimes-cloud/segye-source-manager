'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface PopoverState {
  text: string
  x: number  // viewport 좌표 (selection 중앙)
  y: number  // viewport 좌표 (selection 상단)
}

// 한국어 인물명 패턴: 2~8자의 한글(공백 없음, 중간점 허용)
const KOREAN_NAME_RE = /^[가-힣·]{2,8}$/

export default function PersonSearchPopover() {
  const router = useRouter()
  const [popover, setPopover] = useState<PopoverState | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const dismiss = useCallback(() => {
    setPopover(null)
  }, [])

  // 텍스트 선택 감지
  useEffect(() => {
    function handleMouseUp(e: MouseEvent) {
      // 팝오버 자체를 클릭한 경우 무시
      if (popoverRef.current?.contains(e.target as Node)) return

      const sel = window.getSelection()
      const text = sel?.toString().trim() ?? ''

      if (!KOREAN_NAME_RE.test(text)) {
        setPopover(null)
        return
      }

      try {
        const range = sel?.getRangeAt(0)
        const rect = range?.getBoundingClientRect()
        if (!rect || rect.width === 0) {
          setPopover(null)
          return
        }

        setPopover({
          text,
          x: rect.left + rect.width / 2,
          y: rect.top,
        })
      } catch {
        setPopover(null)
      }
    }

    document.addEventListener('mouseup', handleMouseUp)
    return () => document.removeEventListener('mouseup', handleMouseUp)
  }, [])

  // 팝오버 바깥 포인터다운 시 닫기
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        dismiss()
      }
    }
    if (popover) {
      document.addEventListener('pointerdown', handlePointerDown)
      return () => document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [popover, dismiss])

  // Escape 키 닫기
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') dismiss()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [dismiss])

  if (!popover) return null

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        left: popover.x,
        top: popover.y - 8,
        transform: 'translate(-50%, -100%)',
        zIndex: 9999,
        background: '#131C2C',
        border: '1px solid #2A3A50',
        borderRadius: '8px',
        padding: '8px 12px',
        boxShadow: '0 6px 24px rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        whiteSpace: 'nowrap',
        pointerEvents: 'all',
        userSelect: 'none',
      }}
    >
      <span style={{ fontSize: '12px', color: '#607898' }}>
        <strong style={{ color: '#CDD5E0' }}>"{popover.text}"</strong>
        {' '}인물 검색?
      </span>

      <button
        type="button"
        onClick={() => {
          const query = popover.text
          dismiss()
          router.push(`/analysis?q=${encodeURIComponent(query)}`)
        }}
        style={{
          background: 'rgba(74,124,192,0.18)',
          border: '1px solid rgba(74,124,192,0.4)',
          color: '#7AADE0',
          borderRadius: '5px',
          padding: '3px 10px',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,124,192,0.32)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(74,124,192,0.18)')}
      >
        👤 분석에서 검색
      </button>

      <button
        type="button"
        onClick={dismiss}
        aria-label="닫기"
        style={{
          background: 'none',
          border: 'none',
          color: '#607898',
          cursor: 'pointer',
          fontSize: '15px',
          lineHeight: 1,
          padding: '0 1px',
          flexShrink: 0,
        }}
      >
        ×
      </button>

      {/* 아래 방향 화살표 */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: -5,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 0,
          height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '5px solid #2A3A50',
        }}
      />
    </div>
  )
}
