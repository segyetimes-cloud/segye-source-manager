'use client'
import { useEffect, useRef } from 'react'

interface Props {
  text: string
  href?: string       // tel:/mailto: 링크 (있으면 클릭 가능한 오버레이 추가)
  fontSize?: number
  fontWeight?: number
  color?: string
  style?: React.CSSProperties
}

export default function ProtectedText({ text, href, fontSize = 14, fontWeight = 500, color = '#4A7CC0', style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const fontStr = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans KR', sans-serif`

    // measure
    ctx.font = fontStr
    const metrics = ctx.measureText(text)
    const w = Math.ceil(metrics.width) + 4
    const h = Math.ceil(fontSize * 1.6)

    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`

    ctx.scale(dpr, dpr)
    ctx.font = fontStr
    ctx.fillStyle = color
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 2, h / 2)
  }, [text, fontSize, fontWeight, color])

  const canvas = (
    <canvas
      ref={canvasRef}
      style={{ display: 'inline-block', verticalAlign: 'middle', userSelect: 'none', ...style }}
    />
  )

  if (href) {
    return (
      <span style={{ position: 'relative', display: 'inline-block' }}>
        {canvas}
        <a
          href={href}
          style={{ position: 'absolute', inset: 0 }}
          aria-label={text}
        />
      </span>
    )
  }
  return canvas
}
