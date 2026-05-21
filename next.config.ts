import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  /* config options here */
}

export default withSentryConfig(nextConfig, {
  // Sentry 조직 / 프로젝트 슬러그 (선택) — 소스맵 업로드 시 사용
  // org: process.env.SENTRY_ORG,
  // project: process.env.SENTRY_PROJECT,

  // 소스맵 업로드 비활성화 (DSN 미설정 환경에서도 빌드 성공 보장)
  silent: true,

  // 번들 크기 최소화 — 사용 안 하는 Sentry 기능 제거
  disableLogger: true,

  // 터널 경로 (광고 차단기 우회) — 필요 시 활성화
  // tunnelRoute: '/monitoring',

  // 소스맵 업로드 비활성화
  sourcemaps: {
    disable: true,
  },
})
