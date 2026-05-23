'use client'

/**
 * FeedbackButton — 불편사항 신고 (임시 기능, 시스템 안정화 후 삭제 예정)
 *
 * 삭제 방법:
 *   1. 이 파일(FeedbackButton.tsx) 삭제
 *   2. Sidebar.tsx에서 import 및 <FeedbackButton /> 줄 삭제
 */

import { useState, useRef, useEffect } from 'react'

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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 폼 열릴 때 textarea에 포커스
  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [open])

  function handleOpen() {
    setOpen(true)
  }

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

  return (
    <>
      {/* 신고 버튼 */}
      <button
        onClick={handleOpen}
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
        {/* 경고 삼각형 아이콘 */}
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <path
            d="M8 2L14.5 13.5H1.5L8 2Z"
            stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"
          />
          <path d="M8 6.5V9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          <circle cx="8" cy="11.5" r="0.6" fill="currentColor"/>
        </svg>
        불편사항 신고
      </button>

      {/* 슬라이드-다운 인라인 폼 */}
      {open && (
        <div
          className="mx-2 mb-1 rounded-lg overflow-hidden"
          style={{
            background: '#0D1D14',
            border: '1px solid rgba(200,146,10,0.25)',
            animation: 'fadeSlideDown 0.18s ease',
          }}
        >
          <style>{`
            @keyframes fadeSlideDown {
              from { opacity: 0; transform: translateY(-6px); }
              to   { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          <div className="px-3 pt-2.5 pb-1">
            <p className="text-xs font-semibold mb-2" style={{ color: '#C8920A' }}>
              불편사항 신고
            </p>

            {/* 분류 선택 */}
            <select
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="w-full text-xs rounded px-2 py-1 mb-2 outline-none"
              style={{
                background: '#131C2C',
                border: '1px solid #253448',
                color: '#9AAABF',
              }}
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* 내용 입력 */}
            <textarea
              ref={textareaRef}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="불편하셨던 점을 간략히 적어 주세요."
              rows={3}
              className="w-full text-xs rounded px-2 py-1.5 mb-2 resize-none outline-none"
              style={{
                background: '#131C2C',
                border: '1px solid #253448',
                color: '#CDD5E0',
              }}
            />

            {/* 버튼 영역 */}
            <div className="flex gap-1.5 pb-2">
              <button
                onClick={handleSend}
                disabled={!description.trim()}
                className="flex-1 text-xs py-1 rounded font-medium transition-all"
                style={{
                  background: description.trim() ? 'rgba(200,146,10,0.18)' : 'rgba(200,146,10,0.05)',
                  border: '1px solid rgba(200,146,10,0.3)',
                  color: description.trim() ? '#C8920A' : '#7A6030',
                  cursor: description.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                메일 앱으로 보내기
              </button>
              <button
                onClick={handleClose}
                className="text-xs px-3 py-1 rounded transition-all"
                style={{ background: 'transparent', border: '1px solid #253448', color: '#485870', cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.color = '#687898' }}
                onMouseLeave={e => { e.currentTarget.style.color = '#485870' }}
              >
                취소
              </button>
            </div>

            <p className="text-xs pb-1" style={{ color: '#3A4E68' }}>
              → {REPORT_EMAIL}
            </p>
          </div>
        </div>
      )}
    </>
  )
}
