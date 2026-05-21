'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * 루트 레이아웃 자체에서 에러 발생 시 표시되는 최후 방어선
 * Next.js App Router — global-error.tsx 규약
 * 이 파일은 html/body 태그를 직접 포함해야 합니다.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // 최후 방어선 — Sentry로 즉시 전송
    Sentry.captureException(error)
    if (process.env.NODE_ENV !== 'production') {
      console.error('[GlobalError]', error)
    }
  }, [error])

  return (
    <html lang="ko">
      <body
        style={{
          background: '#0D1520',
          color: '#CDD5E0',
          fontFamily: 'system-ui, sans-serif',
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '16px',
          textAlign: 'center',
          padding: '2rem',
        }}
      >
        <div style={{ fontSize: '48px' }}>🔒</div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>
          시스템 오류가 발생했습니다
        </h1>
        <p style={{ fontSize: '13px', color: '#5A7099', margin: 0 }}>
          세계일보 취재원관리시스템에 일시적 오류가 발생했습니다.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            background: '#4A7CC0',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: '8px',
          }}
        >
          다시 시도
        </button>
      </body>
    </html>
  )
}
