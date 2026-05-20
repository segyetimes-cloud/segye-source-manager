'use client'
import { useEffect, useState, useCallback } from 'react'

export default function ScreenshotGuard({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false)

  const lock   = useCallback(() => setLocked(true),  [])
  const unlock = useCallback(() => setLocked(false), [])

  useEffect(() => {
    // ── ① 창 포커스 이탈 (Alt+Tab, 다른 앱 전환) ─────────────────────────
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') lock()
      else unlock()
    }
    window.addEventListener('blur', lock)
    window.addEventListener('focus', unlock)
    document.addEventListener('visibilitychange', onVisibility)

    // ── ② 키보드 스크린샷 감지 ────────────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      // Windows PrintScreen (단독 / Alt+PrintScreen)
      if (e.key === 'PrintScreen') {
        e.preventDefault()   // 일부 브라우저에서 기본 캡처 억제
        lock()
        // 짧은 시간 후 잠금 해제 (사용자가 캡처 도구를 닫으면)
        setTimeout(unlock, 3000)
        return
      }

      // macOS: Cmd+Shift+3 (전체화면), Cmd+Shift+4 (영역), Cmd+Shift+5 (메뉴)
      if (e.metaKey && e.shiftKey && ['3', '4', '5', 's', 'S'].includes(e.key)) {
        e.preventDefault()
        lock()
        setTimeout(unlock, 3000)
        return
      }

      // Windows Snipping Tool / Snip & Sketch: Win+Shift+S
      // (metaKey는 Win키에 해당하지 않으므로 직접 감지 불가 — blur 이벤트로 커버)
    }

    // ── ③ 프린트 다이얼로그 감지 ──────────────────────────────────────────
    // beforeprint 이벤트: Ctrl+P 또는 window.print() 호출 시
    const onBeforePrint = () => lock()
    const onAfterPrint  = () => unlock()

    document.addEventListener('keydown',     onKeyDown,      true)   // capture phase
    window.addEventListener('beforeprint',   onBeforePrint)
    window.addEventListener('afterprint',    onAfterPrint)

    return () => {
      window.removeEventListener('blur',          lock)
      window.removeEventListener('focus',         unlock)
      document.removeEventListener('visibilitychange', onVisibility)
      document.removeEventListener('keydown',     onKeyDown,      true)
      window.removeEventListener('beforeprint',   onBeforePrint)
      window.removeEventListener('afterprint',    onAfterPrint)
    }
  }, [lock, unlock])

  return (
    <>
      {children}
      {locked && (
        <div
          onClick={unlock}
          style={{
            position: 'fixed', inset: 0, zIndex: 99999,
            backdropFilter: 'blur(28px) brightness(0.25)',
            WebkitBackdropFilter: 'blur(28px) brightness(0.25)',
            background: 'rgba(5, 10, 20, 0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <div style={{ textAlign: 'center', userSelect: 'none', pointerEvents: 'none' }}>
            <div style={{ fontSize: '52px', marginBottom: '16px' }}>🔒</div>
            <p style={{ fontSize: '18px', fontWeight: 700, color: '#CDD5E0', margin: 0 }}>보안 화면 보호 중</p>
            <p style={{ fontSize: '13px', color: '#485870', marginTop: '8px', margin: '8px 0 0' }}>화면을 클릭하면 잠금이 해제됩니다</p>
          </div>
        </div>
      )}
    </>
  )
}
