/**
 * Sentry 서버 초기화 (Node.js 런타임 — API Routes, Server Components)
 */
import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: !!SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // 서버 트레이스 샘플링 — 매우 낮게 유지 (비용 고려)
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0,

  sendDefaultPii: false,
  debug: false,
})
