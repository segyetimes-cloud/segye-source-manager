'use client'
import { useEffect, useState, useCallback } from 'react'

export default function ScreenshotGuard({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false)

  const lock = useCallback(() => setLocked(true), [])
  const unlock = useCallback(() => setLocked(false), [])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') lock()
      else unlock()
    }
    window.addEventListener('blur', lock)
    window.addEventListener('focus', unlock)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', lock)
      window.removeEventListener('focus', unlock)
      document.removeEventListener('visibilitychange', onVisibility)
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
