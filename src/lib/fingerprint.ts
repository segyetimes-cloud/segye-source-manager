/**
 * src/lib/fingerprint.ts
 *
 * 브라우저 기기 지문(fingerprint) 생성 유틸리티
 * — 클라이언트 사이드에서만 동작 (window, navigator, screen 사용)
 *
 * 수집 항목: userAgent, 언어, 화면 해상도, 색상 깊이, 타임존, CPU 코어 수, 플랫폼
 * → SHA-256 해시 → hex 문자열 반환
 */

export async function getDeviceFingerprint(): Promise<string> {
  if (typeof window === 'undefined') return 'server'

  const components = [
    navigator.userAgent,
    navigator.language,
    navigator.languages?.join(',') ?? '',
    `${screen.width}x${screen.height}`,
    String(screen.colorDepth),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    String(navigator.hardwareConcurrency ?? ''),
    navigator.platform ?? '',
    String(screen.pixelDepth ?? ''),
  ].join('||')

  try {
    const encoder = new TextEncoder()
    const data    = encoder.encode(components)
    const hashBuf = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    // Web Crypto 미지원 환경 (매우 구형 브라우저) — 기본값
    const fallback = components.split('').reduce((h, c) =>
      ((h << 5) - h + c.charCodeAt(0)) | 0, 0
    )
    // 음수값을 32bit unsigned로 변환해 안정적인 hex 출력 보장
    return (fallback >>> 0).toString(16)
  }
}

/** 기기 레이블 자동 생성 (기록 목적) */
export function getDeviceLabel(): string {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'server'

  const ua = navigator.userAgent ?? ''
  const os = /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /iPhone/.test(ua) ? 'iPhone'
    : /Android/.test(ua) ? 'Android'
    : /Linux/.test(ua) ? 'Linux' : 'Unknown'

  const browser = /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) && !/Chrome/.test(ua) ? 'Safari'
    : /Firefox\//.test(ua) ? 'Firefox' : 'Browser'

  return `${browser} / ${os}`
}
