import { defineConfig, devices } from '@playwright/test'

/**
 * playwright.config.ts
 *
 * E2E 테스트 설정
 *
 * 실행:
 *   npx playwright test              # 전체 테스트
 *   npx playwright test --ui         # UI 모드
 *   npx playwright test auth         # 파일 필터
 *   npx playwright show-report       # 리포트 보기
 *
 * 환경변수 (.env.test.local):
 *   E2E_BASE_URL          http://localhost:3000
 *   E2E_REPORTER_EMAIL    reporter@segye.com
 *   E2E_REPORTER_PASSWORD xxxxxxxx
 *   E2E_ADMIN_EMAIL       admin@segye.com
 *   E2E_ADMIN_PASSWORD    xxxxxxxx
 */

export default defineConfig({
  testDir:    './e2e',
  fullyParallel: false,   // 순서 의존성 있는 테스트 포함 → 직렬 실행
  forbidOnly: !!process.env.CI,
  retries:    process.env.CI ? 2 : 0,
  workers:    process.env.CI ? 1 : 1,

  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL:       process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace:         'on-first-retry',
    screenshot:    'only-on-failure',
    video:         'on-first-retry',
    // 브라우저 사이즈 (데스크톱)
    viewport:      { width: 1280, height: 800 },
    // 테스트용 쿠키: OTP 우회 (개발 환경에서만)
    extraHTTPHeaders: { 'X-Test-Mode': '1' },
  },

  projects: [
    // 1) 인증 상태 없이 실행: auth.spec.ts
    {
      name: 'setup',
      testMatch: '**/auth.setup.ts',
    },
    // 2) reporter 권한으로 실행
    {
      name: 'reporter',
      testMatch: ['**/sources.spec.ts', '**/permissions.spec.ts', '**/export.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/reporter.json',
      },
      dependencies: ['setup'],
    },
    // 3) admin 권한으로 실행
    {
      name: 'admin',
      testMatch: ['**/admin.spec.ts', '**/audit.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup'],
    },
  ],

  // 테스트 전 dev 서버 자동 시작 (로컬 실행 시)
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url:     'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 30_000,
  },
})
