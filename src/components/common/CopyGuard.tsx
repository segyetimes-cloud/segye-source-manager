'use client'

/**
 * CopyGuard
 *
 * 전역 copy 이벤트를 가로채 클립보드 내용에 사용자 식별 워터마크를 삽입합니다.
 *
 * 보호 레이어:
 *   1차 — Zero-width character fingerprint (완전 불가시, 역추적용)
 *   2차 — 쉼표/마침표 패턴 삽입 (준가시, 이메일·파일 역추적용)
 *   3차 — data-secure 영역 복사 시 visible 경고 푸터 추가
 *
 * 동작:
 *   - 5자 미만의 짧은 복사는 무시
 *   - 복사 감사 로그: 앞 80자를 audit_logs에 기록 (30초 디바운스)
 *   - DOM을 변경하지 않음 — 화면에는 원본 텍스트만 표시됨
 */

import { useEffect } from 'react'
import { injectFullWatermark } from '@/lib/copyWatermark'

interface CopyGuardProps {
  userId: string
  userEmail?: string
  userFullName?: string
}

// 동일 텍스트는 30초 내 재기록 안 함 (과도한 감사 로그 방지)
const recentCopies = new Map<string, number>()
const COPY_DEBOUNCE_MS = 30_000

/** 복사 이벤트가 data-secure 컨테이너 내부에서 발생했는지 확인 */
function isFromSecureContainer(e: ClipboardEvent): boolean {
  const target = e.target as HTMLElement | null
  if (!target) return false
  return !!target.closest('[data-secure="true"]')
}

export default function CopyGuard({ userId, userEmail, userFullName }: CopyGuardProps) {
  useEffect(() => {
    if (!userId) return

    const handleCopy = (e: ClipboardEvent) => {
      const raw = window.getSelection()?.toString() ?? ''
      if (raw.length < 5) return

      // ── 워터마크 주입 (1차 ZW + 2차 쉼표/마침표) ─────────────────────────
      const watermarked = injectFullWatermark(raw, userId)

      // data-secure 영역에서 복사 시 visible 경고 푸터 추가
      const fromSecure = isFromSecureContainer(e)
      const now = new Date().toLocaleString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      })
      const visibleFooter = fromSecure
        ? [
            '',
            '',
            '─────────────────────────────────',
            '⚠️  세계일보 취재원관리시스템 내부자료',
            `열람자: ${userFullName ?? userEmail ?? userId}`,
            `열람일시: ${now}`,
            '무단 외부 유출 시 법적 책임을 집니다.',
            '─────────────────────────────────',
          ].join('\n')
        : ''

      try {
        e.clipboardData?.setData('text/plain', watermarked + visibleFooter)
        e.preventDefault()
      } catch {
        // 일부 브라우저에서 clipboardData 수정 실패 — 감사 기록만 유지
      }

      // ── 복사 감사 기록 (디바운스) ────────────────────────────────────────
      const previewKey = raw.slice(0, 40)
      const lastCopied = recentCopies.get(previewKey)
      if (lastCopied && Date.now() - lastCopied < COPY_DEBOUNCE_MS) return

      recentCopies.set(previewKey, Date.now())
      // 오래된 키 정리 (메모리 누수 방지)
      if (recentCopies.size > 50) {
        const oldest = [...recentCopies.entries()]
          .sort((a, b) => a[1] - b[1])
          .slice(0, 20)
          .map(entry => entry[0])
        oldest.forEach(k => recentCopies.delete(k))
      }

      const preview = raw.slice(0, 80).replace(/\n/g, ' ')
      void fetch('/api/auth/login-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'copy',
          email: userEmail,
          reason: `${fromSecure ? '[보안영역] ' : ''}"${preview}${raw.length > 80 ? '…' : ''}" (${raw.length}자)`,
        }),
        credentials: 'same-origin',
      })
    }

    document.addEventListener('copy', handleCopy)
    return () => document.removeEventListener('copy', handleCopy)
  }, [userId, userEmail, userFullName])

  return null
}
