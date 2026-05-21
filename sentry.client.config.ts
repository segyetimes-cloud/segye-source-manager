/**
 * Sentry 클라이언트 초기화 (브라우저)
 * https://docs.sentry.io/platforms/javascript/guides/nextjs/
 */
import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

Sentry.init({
  dsn: SENTRY_DSN,

  // DSN 미설정 시 완전 비활성화
  enabled: !!SENTRY_DSN,

  // 프로덕션에서만 에러 전송
  environment: process.env.NODE_ENV,

  // 샘플링 — 프로덕션 1%, 나머지는 0%
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.01 : 0,

  // 세션 리플레이 — 프로덕션 에러 발생 시만 캡처
  replaysOnErrorSampleRate: process.env.NODE_ENV === 'production' ? 1.0 : 0,
  replaysSessionSampleRate: 0,

  integrations: [
    Sentry.replayIntegration({
      // 보안: 입력 필드 텍스트는 마스킹
      maskAllText: true,
      blockAllMedia: false,
    }),
  ],

  // PII 전송 방지 — IP 주소, 사용자 이메일 기본 수집 안 함
  sendDefaultPii: false,

  // 개발 환경 콘솔 노이즈 억제
  debug: false,
})
