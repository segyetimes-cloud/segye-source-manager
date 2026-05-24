'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import * as Sentry from '@sentry/nextjs'

interface ErrorProps {
  error: Error & { digest?: string }
  /** Next.js 16 — re-fetches and re-renders the segment (preferred over `reset`) */
  unstable_retry: () => void
}

/**
 * (app) 라우트 그룹 전역 에러 바운더리
 * Next.js App Router — error.tsx 규약
 * 렌더링 중 uncaught 에러 발생 시 이 컴포넌트가 표시됩니다.
 */
export default function AppError({ error, unstable_retry }: ErrorProps) {
  useEffect(() => {
    // Sentry로 에러 전송 (DSN 미설정 시 no-op)
    Sentry.captureException(error)
    if (process.env.NODE_ENV !== 'production') {
      console.error('[AppError]', error)
    }
  }, [error])

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '48px', lineHeight: 1 }}>⚠️</div>

      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#CDD5E0', margin: '0 0 8px' }}>
          페이지를 불러오는 중 오류가 발생했습니다
        </h2>
        <p style={{ fontSize: '13px', color: '#5A7099', margin: 0 }}>
          {process.env.NODE_ENV !== 'production' && error?.message
            ? error.message
            : '잠시 후 다시 시도해 주세요.'}
        </p>
        {error?.digest && (
          <p style={{ fontSize: '11px', color: '#485870', marginTop: '4px', fontFamily: 'monospace' }}>
            오류 코드: {error.digest}
          </p>
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => unstable_retry()}
          style={{
            background: 'linear-gradient(135deg, #4A7CC0, #0066CC)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '9px 20px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          다시 시도
        </button>
        <Link
          href="/dashboard"
          style={{
            background: '#182035',
            border: '1px solid #1A2838',
            color: '#687898',
            borderRadius: '8px',
            padding: '9px 20px',
            fontSize: '13px',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          대시보드로 이동
        </Link>
      </div>
    </div>
  )
}
