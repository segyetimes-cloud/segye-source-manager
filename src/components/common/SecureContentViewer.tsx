'use client'

import { useEffect, useRef, useState } from 'react'
import { injectFullWatermark } from '@/lib/copyWatermark'

interface Props {
  apiPath: string        // 복사 로그 전송 엔드포인트 (예: /api/reports/xxx/copy-log)
  content: string
  userId: string
  userFullName: string
  userDepartment: string | null
  minHeight?: string     // 워터마크 최소 높이 (기본 없음)
}

function buildWatermarkedText(selected: string, userId: string, userName: string): string {
  const now = new Date().toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  // 1차(ZW) + 2차(쉼표/마침표) 워터마크 삽입
  const watermarked = injectFullWatermark(selected, userId)
  const footer = [
    '',
    '',
    '─────────────────────────────────',
    '⚠️  세계일보 취재원관리시스템 내부자료',
    `열람자: ${userName}  |  일시: ${now}`,
    '무단 외부 유출 시 법적 책임을 집니다.',
    '─────────────────────────────────',
  ].join('\n')
  return watermarked + footer
}

function sendCopyLog(apiPath: string, copiedLength: number, copiedPreview: string) {
  const body = JSON.stringify({ copied_length: copiedLength, copied_preview: copiedPreview })
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon(apiPath, new Blob([body], { type: 'application/json' }))
    } else {
      fetch(apiPath, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }).catch(() => {})
    }
  } catch { /* noop */ }
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  lineHeight: number,
  startY: number,
): number {
  const paragraphs = text.split('\n')
  let y = startY
  for (const para of paragraphs) {
    if (!para.trim()) { y += lineHeight * 0.6; continue }
    const words = para.split(' ')
    let line = ''
    for (const word of words) {
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, 0, y)
        line = word
        y += lineHeight
      } else {
        line = test
      }
    }
    if (line) { ctx.fillText(line, 0, y); y += lineHeight }
  }
  return y
}

export default function SecureContentViewer({
  apiPath, content, userId, userFullName, userDepartment, minHeight,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [canvasHeight, setCanvasHeight] = useState(80)

  // copy watermark
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onCopy = (e: ClipboardEvent) => {
      e.preventDefault()
      const raw = window.getSelection()?.toString() ?? ''
      const selected = raw.trim() ? raw : content
      sendCopyLog(apiPath, selected.length, selected.slice(0, 100))
      const watermarked = buildWatermarkedText(selected, userId, userFullName)
      if (e.clipboardData) e.clipboardData.setData('text/plain', watermarked)
    }
    el.addEventListener('copy', onCopy)
    return () => el.removeEventListener('copy', onCopy)
  }, [apiPath, content, userId, userFullName])

  // canvas render
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!canvas || !container) return

    const render = () => {
      const dpr = window.devicePixelRatio || 1
      const containerWidth = container.clientWidth || 600
      const fontSize = 14
      const lineHeight = 25
      const fontStr = `${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif`

      // first pass: measure height via offscreen canvas
      const offscreen = document.createElement('canvas')
      const octx = offscreen.getContext('2d')!
      octx.font = fontStr
      const measuredHeight = drawWrappedText(octx, content, containerWidth, lineHeight, fontSize + 4)
      const totalHeight = measuredHeight + 8

      canvas.width = containerWidth * dpr
      canvas.height = totalHeight * dpr
      canvas.style.width = `${containerWidth}px`
      canvas.style.height = `${totalHeight}px`
      setCanvasHeight(totalHeight)

      const ctx = canvas.getContext('2d')!
      ctx.scale(dpr, dpr)
      ctx.font = fontStr
      ctx.fillStyle = '#1C2B3A'
      ctx.textBaseline = 'alphabetic'
      drawWrappedText(ctx, content, containerWidth, lineHeight, fontSize + 4)
    }

    render()

    const ro = new ResizeObserver(render)
    ro.observe(container)
    return () => ro.disconnect()
  }, [content])

  const watermarkLabel = userFullName + (userDepartment ? ` · ${userDepartment}` : '')

  return (
    <div ref={containerRef} style={{ position: 'relative', marginBottom: '4px', minHeight }}>
      {/* 워터마크 오버레이 */}
      <div aria-hidden="true" style={{
        position: 'absolute', inset: 0,
        pointerEvents: 'none', userSelect: 'none',
        overflow: 'hidden', zIndex: 1,
      }}>
        {Array.from({ length: 10 }).map((_, row) => (
          <div key={row} style={{
            position: 'absolute',
            top: `${row * 56 - 10}px`,
            left: '-30px', right: '-30px',
            display: 'flex', gap: '80px',
            transform: 'rotate(-18deg)',
            whiteSpace: 'nowrap',
          }}>
            {Array.from({ length: 6 }).map((_, col) => (
              <span key={col} style={{
                fontSize: '12px', fontWeight: 700,
                color: '#7CA3D4', opacity: 0.07,
                letterSpacing: '1.5px',
              }}>
                {watermarkLabel}
              </span>
            ))}
          </div>
        ))}
      </div>
      {/* Canvas 본문 */}
      <canvas
        ref={canvasRef}
        style={{ position: 'relative', zIndex: 2, display: 'block', userSelect: 'none' }}
      />
    </div>
  )
}
