'use client'

import { useEffect, useRef } from 'react'

interface WatermarkProps {
  userId: string
  userEmail: string
  userName?: string
  department?: string
}

export default function Watermark({ userId, userEmail, userName, department }: WatermarkProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const overlay = overlayRef.current
    if (!overlay) return

    // 워터마크 텍스트 구성: 이름·부서·이메일·ID 앞 8자·접속시각
    const shortId = userId.slice(0, 8).toUpperCase()
    const now = new Date()
    const timestamp = now.toLocaleString('ko-KR', {
      year: '2-digit', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
    const namePart = [userName, department].filter(Boolean).join(' · ')
    const line1 = namePart || userEmail
    const line2 = `${shortId} | ${timestamp}`

    // SVG 타일: 두 줄 텍스트, -35도 회전
    // 레이어 1(밝은 색): 다크 배경에서 보임 / 레이어 2(어두운 색): 밝은 배경에서 보임
    // → 어떤 배경에서 캡처해도 항상 하나가 표시됨
    const svgContent = encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="420" height="180">
  <text x="210" y="80"
    font-family="monospace" font-size="13" font-weight="700"
    fill="rgba(220,235,255,0.18)"
    text-anchor="middle" dominant-baseline="middle"
    transform="rotate(-35, 210, 90)"
  >${line1}</text>
  <text x="210" y="100"
    font-family="monospace" font-size="12"
    fill="rgba(220,235,255,0.18)"
    text-anchor="middle" dominant-baseline="middle"
    transform="rotate(-35, 210, 90)"
  >${line2}</text>
  <text x="210" y="80"
    font-family="monospace" font-size="13" font-weight="700"
    fill="rgba(15,50,110,0.20)"
    text-anchor="middle" dominant-baseline="middle"
    transform="rotate(-35, 210, 90)"
  >${line1}</text>
  <text x="210" y="100"
    font-family="monospace" font-size="12"
    fill="rgba(15,50,110,0.20)"
    text-anchor="middle" dominant-baseline="middle"
    transform="rotate(-35, 210, 90)"
  >${line2}</text>
</svg>`)

    const bgImage = `url("data:image/svg+xml,${svgContent}")`

    // 스타일 직접 적용 (CSS 클래스 우회 방어)
    function applyStyles() {
      if (!overlay) return
      overlay.style.cssText = [
        'position:fixed',
        'inset:0',
        'width:100%',
        'height:100%',
        'pointer-events:none',
        'user-select:none',
        'z-index:9999',
        'overflow:hidden',
        'display:block',
        'visibility:visible',
        'opacity:1',
        `background-image:${bgImage}`,
        'background-repeat:repeat',
        'background-size:420px 180px',
      ].join(';')
    }

    applyStyles()

    // MutationObserver: DOM에서 제거되거나 스타일 변조 시 재주입·복원
    // ① body childList 감시 — 오버레이 완전 제거 감지 (subtree 필요, attributes 불필요)
    const removalObserver = new MutationObserver(() => {
      if (!document.contains(overlay)) {
        document.body.appendChild(overlay)
        applyStyles()
        // 재추가 후 styleObserver가 새 요소를 감시하도록 재연결
        styleObserver.disconnect()
        styleObserver.observe(overlay, { attributes: true, attributeFilter: ['style', 'class'] })
      }
    })
    removalObserver.observe(document.body, { childList: true, subtree: true })

    // ② overlay 자체만 감시 — style/class 변조 감지 (전체 DOM attribute 감시 불필요)
    const styleObserver = new MutationObserver(() => {
      const cs = window.getComputedStyle(overlay)
      if (
        cs.display === 'none' ||
        cs.visibility === 'hidden' ||
        parseFloat(cs.opacity) < 0.5
      ) {
        applyStyles()
      }
    })
    styleObserver.observe(overlay, { attributes: true, attributeFilter: ['style', 'class'] })

    return () => {
      removalObserver.disconnect()
      styleObserver.disconnect()
    }
  }, [userId, userEmail, userName, department])

  return (
    <div
      ref={overlayRef}
      aria-hidden="true"
      className="watermark-overlay"
    />
  )
}
