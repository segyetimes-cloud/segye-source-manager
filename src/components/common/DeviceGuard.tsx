'use client'

/**
 * DeviceGuard
 *
 * 앱 로드 시 기기 지문을 확인합니다.
 * - 이미 확인한 세션이면 스킵 (sessionStorage 캐시)
 * - 새 기기면 서버에 등록 + 관리자 감사 로그 기록
 * - 새 기기일 경우 하단에 잠깐 알림 배너를 표시합니다.
 */

import { useEffect, useState } from 'react'
import { getDeviceFingerprint, getDeviceLabel } from '@/lib/fingerprint'

const SESSION_KEY = 'device_checked'

export default function DeviceGuard() {
  const [newDevice, setNewDevice] = useState(false)

  useEffect(() => {
    // 이미 이 세션에서 확인했으면 스킵
    if (sessionStorage.getItem(SESSION_KEY)) return

    let cancelled = false

    async function check() {
      try {
        const fingerprint = await getDeviceFingerprint()
        const deviceLabel = getDeviceLabel()

        const res = await fetch('/api/auth/device-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fingerprint, deviceLabel }),
          credentials: 'same-origin',
        })

        const data = await res.json()

        sessionStorage.setItem(SESSION_KEY, '1')

        if (!cancelled && data.status === 'new') {
          setNewDevice(true)
          // 5초 후 자동 숨김
          setTimeout(() => { if (!cancelled) setNewDevice(false) }, 5000)
        }
      } catch {
        // 네트워크 오류 — 사용자 흐름 방해하지 않음
      }
    }

    check()
    return () => { cancelled = true }
  }, [])

  if (!newDevice) return null

  return (
    <div
      style={{
        position: 'fixed', bottom: '20px', right: '20px', zIndex: 99998,
        maxWidth: '320px',
        padding: '14px 18px',
        borderRadius: '12px',
        background: 'rgba(10, 20, 40, 0.95)',
        border: '1px solid rgba(255,153,0,0.4)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'flex-start', gap: '12px',
        animation: 'fadeSlideIn 0.3s ease',
      }}
    >
      <span style={{ fontSize: '22px', flexShrink: 0, marginTop: '1px' }}>🔔</span>
      <div>
        <p style={{ fontSize: '13px', fontWeight: 700, color: '#CDD5E0', margin: '0 0 4px' }}>
          새 기기에서 접속
        </p>
        <p style={{ fontSize: '12px', color: '#687898', margin: 0, lineHeight: 1.5 }}>
          처음 접속하는 기기입니다. 본인이 아닌 경우 즉시 비밀번호를 변경하세요.
        </p>
      </div>
      <button
        onClick={() => setNewDevice(false)}
        style={{
          flexShrink: 0, background: 'none', border: 'none',
          color: '#485870', cursor: 'pointer', fontSize: '16px',
          padding: '0', lineHeight: 1,
        }}
      >×</button>
    </div>
  )
}
