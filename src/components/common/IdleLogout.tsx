'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const IDLE_TIMEOUT_MS  = 15 * 60 * 1000  // 15분 무활동 시 경고
const WARN_DURATION_MS =  2 * 60 * 1000  // 경고 후 2분 내 무반응 시 로그아웃

/**
 * 유휴 세션 자동 로그아웃
 * - 마우스 이동·클릭·키보드·터치 이벤트를 감지해 타이머 리셋
 * - IDLE_TIMEOUT_MS 무활동 → 경고 모달 표시 + 카운트다운
 * - WARN_DURATION_MS 경과 또는 "지금 로그아웃" 클릭 → 로그아웃 후 /login 이동
 * - "계속 사용" 클릭 → 타이머 리셋
 */
export default function IdleLogout() {
  const router = useRouter()
  const [showWarn, setShowWarn]   = useState(false)
  const [countdown, setCountdown] = useState(WARN_DURATION_MS / 1000)

  const idleTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnTimer   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countTick   = useRef<ReturnType<typeof setInterval> | null>(null)

  const doLogout = useCallback(async () => {
    const supabase = createClient()
    // 세션 만료 감사 기록
    try {
      await fetch('/api/auth/login-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'idle_logout' }),
      })
    } catch { /* 감사 로그 실패는 로그아웃 차단 안 함 */ }
    await supabase.auth.signOut()
    router.push('/login?reason=idle')
  }, [router])

  const startWarnCountdown = useCallback(() => {
    setShowWarn(true)
    setCountdown(WARN_DURATION_MS / 1000)

    let remaining = WARN_DURATION_MS / 1000
    countTick.current = setInterval(() => {
      remaining -= 1
      setCountdown(remaining)
      if (remaining <= 0) {
        clearInterval(countTick.current!)
        doLogout()
      }
    }, 1000)

    warnTimer.current = setTimeout(doLogout, WARN_DURATION_MS)
  }, [doLogout])

  const resetTimer = useCallback(() => {
    // 기존 타이머 전부 초기화
    if (idleTimer.current)  clearTimeout(idleTimer.current)
    if (warnTimer.current)  clearTimeout(warnTimer.current)
    if (countTick.current)  clearInterval(countTick.current)
    setShowWarn(false)

    // 유휴 타이머 재시작
    idleTimer.current = setTimeout(startWarnCountdown, IDLE_TIMEOUT_MS)
  }, [startWarnCountdown])

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'] as const
    events.forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }))
    resetTimer()  // 최초 타이머 시작

    return () => {
      events.forEach(ev => window.removeEventListener(ev, resetTimer))
      if (idleTimer.current)  clearTimeout(idleTimer.current)
      if (warnTimer.current)  clearTimeout(warnTimer.current)
      if (countTick.current)  clearInterval(countTick.current)
    }
  }, [resetTimer])

  if (!showWarn) return null

  const mins = Math.floor(countdown / 60)
  const secs = countdown % 60
  const countStr = mins > 0
    ? `${mins}분 ${secs.toString().padStart(2, '0')}초`
    : `${secs}초`

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100000,
      background: 'rgba(4, 10, 22, 0.82)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#0D1F3C',
        border: '1px solid rgba(255,153,0,0.35)',
        borderRadius: '16px',
        padding: '36px 40px',
        maxWidth: '360px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      }}>
        {/* 아이콘 */}
        <div style={{
          width: '56px', height: '56px',
          borderRadius: '50%',
          background: 'rgba(255,153,0,0.12)',
          border: '1px solid rgba(255,153,0,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px',
          fontSize: '28px',
        }}>⏰</div>

        <p style={{ fontSize: '17px', fontWeight: 700, color: '#CDD5E0', margin: '0 0 10px' }}>
          세션이 곧 만료됩니다
        </p>
        <p style={{ fontSize: '13px', color: '#8AAAC8', margin: '0 0 6px', lineHeight: 1.6 }}>
          장시간 활동이 없어 보안을 위해<br/>자동 로그아웃됩니다.
        </p>

        {/* 카운트다운 */}
        <div style={{
          margin: '20px 0',
          padding: '14px',
          borderRadius: '10px',
          background: 'rgba(255,153,0,0.08)',
          border: '1px solid rgba(255,153,0,0.2)',
        }}>
          <p style={{ fontSize: '11px', color: '#A87228', margin: '0 0 4px' }}>남은 시간</p>
          <p style={{ fontSize: '28px', fontWeight: 700, color: '#FF9900', margin: 0, fontVariantNumeric: 'tabular-nums' }}>
            {countStr}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={resetTimer}
            style={{
              flex: 1, padding: '11px',
              borderRadius: '8px', fontSize: '14px', fontWeight: 600,
              background: 'linear-gradient(135deg, #4A7CC0, #0055CC)',
              color: 'white', border: 'none', cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(30,144,255,0.25)',
            }}
          >
            계속 사용
          </button>
          <button
            onClick={doLogout}
            style={{
              flex: 1, padding: '11px',
              borderRadius: '8px', fontSize: '14px', fontWeight: 500,
              background: 'none',
              color: '#8AAAC8', border: '1px solid #1A2838', cursor: 'pointer',
            }}
          >
            지금 로그아웃
          </button>
        </div>
      </div>
    </div>
  )
}
