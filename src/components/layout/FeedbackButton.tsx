'use client'

/**
 * FeedbackButton — 불편사항 신고 (임시 기능, 시스템 안정화 후 삭제 예정)
 *
 * 삭제 방법:
 *   1. 이 파일(FeedbackButton.tsx) 삭제
 *   2. Sidebar.tsx에서 import 및 <FeedbackButton /> 줄 삭제
 */

import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

const REPORT_EMAIL = 'july1st@segye.com'

const CATEGORIES = [
  '화면/UI 문제',
  '기능 오류',
  '데이터 오류',
  '속도 문제',
  '기타',
] as const

export default function FeedbackButton() {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<string>(CATEGORIES[0])
  const [description, setDescription] = useState('')
  const [mounted, setMounted] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 포털을 위한 클라이언트 마운트 확인
  useEffect(() => { setMounted(true) }, [])

  // 모달 열릴 때 textarea 포커스 + body 스크롤 잠금
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      setTimeout(() => textareaRef.current?.focus(), 80)
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  // ESC 키로 닫기
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function handleClose() {
    setOpen(false)
    setDescription('')
    setCategory(CATEGORIES[0])
  }

  function handleSend() {
    const subject = encodeURIComponent(`[불편사항 신고] ${category}`)
    const body = encodeURIComponent(
      `분류: ${category}\n\n내용:\n${description.trim()}\n\n──────────────\n접속 URL: ${typeof window !== 'undefined' ? window.location.href : ''}\n보낸 시각: ${new Date().toLocaleString('ko-KR')}`,
    )
    window.location.href = `mailto:${REPORT_EMAIL}?subject=${subject}&body=${body}`
    handleClose()
  }

  const modal = mounted && open ? createPortal(
    /* ── 딤 오버레이 ── */
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        animation: 'fbOverlayIn 0.18s ease',
      }}
    >
      <style>{`
        @keyframes fbOverlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes fbModalIn {
          from { opacity: 0; transform: scale(0.95) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>

      {/* ── 모달 본체 ── */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '440px',
          background: '#FFFFFF',
          borderRadius: '14px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          animation: 'fbModalIn 0.2s ease',
        }}
      >
        {/* 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px 14px',
          borderBottom: '1px solid #EEF2F7',
          background: '#FAFBFD',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: '#C8920A', flexShrink: 0 }}>
              <path d="M8 2L14.5 13.5H1.5L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M8 6.5V9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="8" cy="11.5" r="0.7" fill="currentColor"/>
            </svg>
            <span style={{ fontSize: '14px', fontWeight: 700, color: '#1C2B3A' }}>불편사항 신고</span>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#94A3B8', fontSize: '20px', lineHeight: 1,
              padding: '2px 4px', borderRadius: '4px',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#526070')}
            onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        {/* 본문 */}
        <div style={{ padding: '20px' }}>
          {/* 분류 */}
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#526070', marginBottom: '6px' }}>
            분류
          </label>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px', borderRadius: '8px',
              border: '1px solid #DDE5EF', background: '#F8FAFC',
              color: '#1C2B3A', fontSize: '13px', outline: 'none',
              marginBottom: '16px', cursor: 'pointer',
            }}
          >
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* 내용 */}
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#526070', marginBottom: '6px' }}>
            내용
          </label>
          <textarea
            ref={textareaRef}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="불편하셨던 점을 간략히 적어 주세요."
            rows={5}
            style={{
              width: '100%', padding: '10px 12px', borderRadius: '8px',
              border: '1px solid #DDE5EF', background: '#F8FAFC',
              color: '#1C2B3A', fontSize: '13px', lineHeight: 1.6,
              outline: 'none', resize: 'vertical',
              boxSizing: 'border-box', marginBottom: '8px',
              fontFamily: 'inherit',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = '#4A7CC0')}
            onBlur={e => (e.currentTarget.style.borderColor = '#DDE5EF')}
          />
          <p style={{ fontSize: '11px', color: '#A0AEC0', marginBottom: '20px' }}>
            → {REPORT_EMAIL} 으로 발송됩니다
          </p>

          {/* 버튼 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleClose}
              style={{
                padding: '9px 16px', borderRadius: '8px', fontSize: '13px',
                background: '#F0F3F7', border: '1px solid #DDE5EF',
                color: '#526070', cursor: 'pointer', fontWeight: 500,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#E5EAF0')}
              onMouseLeave={e => (e.currentTarget.style.background = '#F0F3F7')}
            >
              취소
            </button>
            <button
              onClick={handleSend}
              disabled={!description.trim()}
              style={{
                flex: 1, padding: '9px 16px', borderRadius: '8px', fontSize: '13px',
                fontWeight: 600, cursor: description.trim() ? 'pointer' : 'not-allowed',
                background: description.trim() ? 'rgba(200,146,10,0.12)' : '#F0F3F7',
                border: `1px solid ${description.trim() ? 'rgba(200,146,10,0.4)' : '#DDE5EF'}`,
                color: description.trim() ? '#A87228' : '#A0AEC0',
                transition: 'all 0.15s',
              }}
            >
              메일 앱으로 보내기
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      {/* 사이드바 트리거 버튼 */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg text-xs transition-all"
        style={{ color: '#7A6030', background: 'transparent', border: 'none', cursor: 'pointer' }}
        onMouseEnter={e => {
          e.currentTarget.style.color = '#C8920A'
          e.currentTarget.style.background = 'rgba(200,146,10,0.08)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = '#7A6030'
          e.currentTarget.style.background = 'transparent'
        }}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <path d="M8 2L14.5 13.5H1.5L8 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
          <path d="M8 6.5V9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          <circle cx="8" cy="11.5" r="0.6" fill="currentColor"/>
        </svg>
        불편사항 신고
      </button>

      {modal}
    </>
  )
}
