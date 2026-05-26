# 세계일보 취재원관리시스템 — 전체 소스코드

생성일: 2026-05-22

---

## 목차

- [package.json](#packagejson)
- [tsconfig.json](#tsconfigjson)
- [next.config.ts](#nextconfigts)
- [playwright.config.ts](#playwrightconfigts)
- [AGENTS.md](#agentsmd)
- [.github/workflows/ci.yml](#githubworkflowsciyml)
- [src/middleware.ts](#srcmiddlewarets)
- [src/types/database.ts](#srctypesdatabasets)
- [src/types/database.generated.ts](#srctypesdatabasegeneratedts)
- [src/lib/supabase/server.ts](#srclibsupabaseserverts)
- [src/lib/supabase/client.ts](#srclibsupabaseclientts)
- [src/lib/supabase/middleware.ts](#srclibsupabasemiddlewarets)
- [src/lib/audit.ts](#srclibauditts)
- [src/lib/permissions.ts](#srclibpermissionsts)
- [src/lib/crypto.ts](#srclibcryptots)
- [src/lib/points.ts](#srclibpointsts)
- [src/lib/schemas.ts](#srclibschemasts)
- [src/lib/rateLimit.ts](#srclibRateLimitts)
- [src/lib/roles.ts](#srclibrolests)
- [src/app/layout.tsx](#srcapplayouttsx)
- [src/app/(app)/layout.tsx](#srcappapplayouttsx)
- [src/app/(auth)/login/page.tsx](#srcappauthloginpagetsx)
- [src/app/actions/auth.ts](#srcappactionsauthts)
- [src/app/(app)/dashboard/page.tsx](#srcappappdashboardpagetsx)
- [src/app/(app)/sources/page.tsx](#srcappappsourcespagetsx)
- [src/app/(app)/sources/new/page.tsx](#srcappappsourcesnewpagetsx)
- [src/app/(app)/sources/[id]/page.tsx](#srcappappsourcesidpagetsx)
- [src/app/(app)/sources/[id]/edit/page.tsx](#srcappappsourcesideditpagetsx)
- [src/app/(app)/reports/page.tsx](#srcappappreportspagetsx)
- [src/app/(app)/reports/[id]/page.tsx](#srcappappreportsidpagetsx)
- [src/app/(app)/help/[id]/page.tsx](#srcappapphelpidpagetsx)
- [src/app/(app)/admin/approvals/page.tsx](#srcappappadminapprovalspagetsx)
- [src/app/(app)/admin/audit/page.tsx](#srcappappadminauditpagetsx)
- [src/app/(app)/admin/stats/page.tsx](#srcappappadminstatspagetsx)
- [src/app/api/sources/route.ts](#srcappapisourcesroute ts)
- [src/app/api/sources/[id]/route.ts](#srcappapisourcesidroute ts)
- [src/app/api/sources/[id]/notes/route.ts](#srcappapisourcesidnotesroute ts)
- [src/app/api/sources/[id]/positions/route.ts](#srcappapisourcesidpositionsroute ts)
- [src/app/api/sources/[id]/contact-logs/route.ts](#srcappapisourcesidcontact-logsroute ts)
- [src/app/api/sources/[id]/copy-log/route.ts](#srcappapisourcesidcopy-logroute ts)
- [src/app/api/sources/[id]/rate/route.ts](#srcappapisourcesidrateroute ts)
- [src/app/api/sources/bulk/route.ts](#srcappapisourcesbulkroute ts)
- [src/app/api/reports/route.ts](#srcappapiReportsroute ts)
- [src/app/api/reports/[id]/route.ts](#srcappapiReportsidroute ts)
- [src/app/api/reports/[id]/review/route.ts](#srcappapiReportsidreviewroute ts)
- [src/app/api/reports/[id]/allowed-users/route.ts](#srcappapiReportsidallowed-usersroute ts)
- [src/app/api/reports/[id]/award-points/route.ts](#srcappapiReportsidaward-pointsroute ts)
- [src/app/api/reports/[id]/copy-log/route.ts](#srcappapiReportsidcopy-logroute ts)
- [src/app/api/reports/draft/route.ts](#srcappapiReportsdraftroute ts)
- [src/app/api/approvals/route.ts](#srcappapiapprovalsroute ts)
- [src/app/api/help/route.ts](#srcappapihelproute ts)
- [src/app/api/help/[id]/route.ts](#srcappapiHelpidroute ts)
- [src/app/api/help/[id]/responses/route.ts](#srcappapiHelpidresponsesroute ts)
- [src/app/api/notifications/route.ts](#srcappapiNotificationsroute ts)
- [src/app/api/bookmarks/route.ts](#srcappapiBookmarksroute ts)
- [src/app/api/profiles/search/route.ts](#srcappapiProfilessearchroute ts)
- [src/app/api/export/sources/route.ts](#srcappapiexportsourcesroute ts)
- [src/app/api/auth/login-audit/route.ts](#srcappapiAuthlogin-auditroute ts)
- [src/app/api/auth/signup/route.ts](#srcappapiAuthsignuproute ts)
- [src/app/api/auth/check-lockout/route.ts](#srcappapiAuthcheck-lockoutroute ts)
- [src/app/api/auth/otp-verify/route.ts](#srcappapiAuthotp-verifyroute ts)
- [src/app/api/auth/session-control/route.ts](#srcappapiAuthsession-controlroute ts)
- [src/app/api/auth/device-check/route.ts](#srcappapiAuthdevice-checkroute ts)
- [src/app/api/admin/stats/route.ts](#srcappapiAdminstatsroute ts)
- [src/app/api/admin/users/route.ts](#srcappapiAdminusersroute ts)
- [src/app/api/admin/audit/export/route.ts](#srcappapiAdminauditexportroute ts)
- [src/app/api/admin/points/route.ts](#srcappapiAdminpointsroute ts)
- [src/app/api/ocr/business-card/route.ts](#srcappapiOcrbusiness-cardroute ts)
- [src/app/api/ocr/business-card/batch/route.ts](#srcappapiOcrbusiness-cardbatchroute ts)
- [src/components/layout/SidebarLayout.tsx](#srccomponentslayoutsidebarlayouttsx)
- [src/components/layout/Sidebar.tsx](#srccomponentslayoutsidebartsx)
- [src/components/layout/Watermark.tsx](#srccomponentslayoutwatermarktsx)
- [src/components/layout/NotificationBell.tsx](#srccomponentslayoutnotificationbelltsx)
- [src/components/common/IdleLogout.tsx](#srccomponentscommonidlelogouttsx)
- [src/components/common/DeviceGuard.tsx](#srccomponentscommondeviceguardtsx)
- [src/components/common/CopyGuard.tsx](#srccommonCopyGuardtsx)
- [src/components/common/ScreenshotGuard.tsx](#srccommonScreenshotGuardtsx)
- [src/components/common/ProtectedText.tsx](#srccommonProtectedTexttsx)
- [src/components/common/SecureContainer.tsx](#srccommonSecureContainertsx)
- [src/components/common/SecureContentViewer.tsx](#srccommonSecureContentViewertsx)
- [src/components/sources/SourceForm.tsx](#srccomponentssourcessourceformtsx)
- [src/components/sources/SourceDetailClient.tsx](#srccomponentssourcessourcedetailclienttsx)
- [src/components/sources/SourceListClient.tsx](#srccomponentssourcessourcelistclienttsx)
- [src/components/sources/QuickFill.tsx](#srccomponentssourcesquickfilltsx)
- [src/components/sources/ContactImporter.tsx](#srccomponentssourcescontactimportertsx)
- [src/components/reports/ReportContentViewer.tsx](#srccomponentsReportsreportcontentviewertsx)
- [src/components/reports/ReportPointAward.tsx](#srccomponentsReportsreportpointawardtsx)
- [src/components/reports/ReportReviewActions.tsx](#srccomponentsReportsreportreviewactionstsx)
- [src/components/network/NetworkGraph.tsx](#srccomponentsNetworknetworkgraphtsx)
- [src/components/network/DuplicateWarning.tsx](#srccomponentsNetworkduplicatewarningtsx)
- [src/components/dashboard/DashboardCharts.tsx](#srccomponentsDashboarddashboardchartstsx)
- [src/components/admin/StatsClient.tsx](#srccomponentsAdminstatsclienttsx)
- [src/components/admin/AuditClient.tsx](#srccomponentsAdminauditclienttsx)
- [src/components/admin/ApprovalsClient.tsx](#srccomponentsAdminapprovalsclienttsx)
- [src/components/admin/UsersClient.tsx](#srccomponentsAdminusersclienttsx)
- [src/lib/__tests__/permissions.test.ts](#srclibteststpermissionstestts)
- [src/lib/__tests__/crypto.test.ts](#srclibteststcryptotestts)
- [src/lib/__tests__/rls-policy.test.ts](#srclibteststrls-policytestts)
- [src/app/api/__tests__/route-handlers.test.ts](#srcappapiteststroute-handlerstestts)
- [src/app/api/__tests__/bulk-permissions.test.ts](#srcappapiteststbulk-permissionstestts)
- [src/app/api/__tests__/export-limits.test.ts](#srcappapiteststexport-limitstestts)
- [e2e/auth.setup.ts](#e2eauthsetupts)
- [e2e/sources.spec.ts](#e2esourcesspects)
- [e2e/permissions.spec.ts](#e2epermissionsspects)
- [e2e/export.spec.ts](#e2eexportspects)
- [e2e/approvals.spec.ts](#e2eapprovalsspects)
- [e2e/admin.spec.ts](#e2eadminspects)
- [e2e/audit.spec.ts](#e2eauditspects)

---

## package.json

```json
{
  "name": "segye-source-manager",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.96.0",
    "@hookform/resolvers": "^5.2.2",
    "@radix-ui/react-avatar": "^1.1.11",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-label": "^2.1.8",
    "@radix-ui/react-progress": "^1.1.8",
    "@radix-ui/react-scroll-area": "^1.2.10",
    "@radix-ui/react-select": "^2.2.6",
    "@radix-ui/react-separator": "^1.1.8",
    "@radix-ui/react-slot": "^1.2.4",
    "@radix-ui/react-tabs": "^1.1.13",
    "@radix-ui/react-toast": "^1.2.15",
    "@sentry/nextjs": "^10.53.1",
    "@supabase/ssr": "^0.10.3",
    "@supabase/supabase-js": "^2.105.4",
    "@upstash/ratelimit": "^2.0.8",
    "@upstash/redis": "^1.38.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "date-fns": "^4.1.0",
    "docx": "^9.6.1",
    "framer-motion": "^12.38.0",
    "lucide-react": "^1.16.0",
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "react-force-graph": "^1.48.2",
    "react-force-graph-2d": "^1.29.1",
    "react-hook-form": "^7.75.0",
    "tailwind-merge": "^3.6.0",
    "tesseract.js": "^7.0.0",
    "xlsx": "^0.18.5",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@playwright/test": "^1.60.0",
    "@tailwindcss/postcss": "^4",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "@vitest/coverage-v8": "^4.1.7",
    "eslint": "^9",
    "eslint-config-next": "16.2.6",
    "tailwindcss": "^4",
    "typescript": "^5",
    "vitest": "^4.1.7"
  }
}
```

---

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```

---

## next.config.ts

```typescript
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
```

---

## playwright.config.ts

```typescript
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
      testMatch: ['**/sources.spec.ts', '**/permissions.spec.ts', '**/export.spec.ts', '**/approvals.spec.ts'],
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
```

---

## AGENTS.md

```markdown
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- as any 현황 (2026-05-22 기준): 생산코드 9개 — 모두 구조적 한계로 제거 불가
    - information_reports Relationships 버그: reports/[id]/route.ts(×2), review/route.ts(×1)
    - supabase textSearch 미지원: sources/route.ts(×1)
    - dynamic updateFields Record: sources/[id]/route.ts(×1)
    - RPC args 타입 한계: export/sources/route.ts(×1)
    - navigator.contacts 브라우저 API: ContactImporter.tsx(×2)
    - audit_logs 커스텀 action 허용: audit.ts(×1) ← 의도적 escape hatch
-->
```

---

## .github/workflows/ci.yml

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  typecheck-and-test:
    name: Typecheck & Unit Tests
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: TypeScript typecheck
        run: npx tsc --noEmit

      - name: Run unit tests
        run: npm test

  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    # E2E는 실제 서버(Vercel preview) + 테스트 계정이 필요하므로
    # E2E_BASE_URL 시크릿이 설정된 환경에서만 실행
    if: ${{ vars.E2E_ENABLED == 'true' }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          E2E_BASE_URL:          ${{ secrets.E2E_BASE_URL }}
          E2E_REPORTER_EMAIL:    ${{ secrets.E2E_REPORTER_EMAIL }}
          E2E_REPORTER_PASSWORD: ${{ secrets.E2E_REPORTER_PASSWORD }}
          E2E_ADMIN_EMAIL:       ${{ secrets.E2E_ADMIN_EMAIL }}
          E2E_ADMIN_PASSWORD:    ${{ secrets.E2E_ADMIN_PASSWORD }}

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 7
```

---

## src/middleware.ts

(파일 없음 — 미들웨어는 `src/lib/supabase/middleware.ts`의 `updateSession`을 호출하는 별도 proxy.ts 또는 Next.js 기본 미들웨어로 처리됨)

---

## src/types/database.ts

```typescript
export * from './database.generated'

import type { Database } from './database.generated'

// Enum type aliases (derived from the generated Database enums)
export type UserRole = Database['public']['Enums']['user_role']
export type SourceVisibility = Database['public']['Enums']['source_visibility']
export type SensitivityLevel = Database['public']['Enums']['sensitivity_level']
export type ApprovalStatus = Database['public']['Enums']['approval_status']
export type AuditAction = Database['public']['Enums']['audit_action']
export type PointType = Database['public']['Enums']['point_type']
export type HelpStatus = Database['public']['Enums']['help_status']

// ReportVisibility is NOT a Postgres enum — it's stored as text but we add a TypeScript union for safety
export type ReportVisibility = 'author_only' | 'desk_above' | 'team' | 'all'

// Convenience Row type aliases
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Source = Database['public']['Tables']['sources']['Row']
export type SourcePosition = Database['public']['Tables']['source_positions']['Row']
export type SourceEducation = Database['public']['Tables']['source_education']['Row']
export type SourceRelationship = Database['public']['Tables']['source_relationships']['Row']
export type SourceAccessApproval = Database['public']['Tables']['source_access_approvals']['Row']
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
export type SourceEditHistory = Database['public']['Tables']['source_edit_history']['Row']
export type PointTransaction = Database['public']['Tables']['point_transactions']['Row']
export type UserPointsSummary = Database['public']['Tables']['user_points_summary']['Row']
export type HelpRequest = Database['public']['Tables']['help_requests']['Row']
export type HelpResponse = Database['public']['Tables']['help_responses']['Row']
export type ImportJob = Database['public']['Tables']['import_jobs']['Row']

// Information report types
export type InformationReport = Database['public']['Tables']['information_reports']['Row']
export type ReportSource = Database['public']['Tables']['report_sources']['Row']

export type Notification = Database['public']['Tables']['notifications']['Row']
export type ContactLog = Database['public']['Tables']['contact_logs']['Row']
```

---

## src/types/database.generated.ts

(자동 생성 파일 — `supabase gen types typescript` 출력)

주요 테이블: `audit_logs`, `contact_logs`, `export_logs`, `help_requests`, `help_responses`, `import_jobs`, `information_reports`, `notifications`, `org_chart_reference`, `point_transactions`, `profiles`, `rate_limits`, `report_allowed_users`, `report_copy_logs`, `report_drafts`, `report_revisions`, `report_sources`, `source_access_approvals`, `source_bookmarks`, `source_copy_logs`, `source_edit_history`, `source_education`, `source_notes`, `source_positions`, `source_relationships`, `source_usefulness_ratings`, `sources`, `user_devices`, `user_points_summary`

주요 Enum:
- `approval_status`: `"pending" | "approved" | "rejected"`
- `audit_action`: `"view" | "create" | "update" | "delete" | "export" | "import" | "view_private" | "approve" | "reject"`
- `help_status`: `"open" | "resolved" | "closed"`
- `point_type`: `"source_created" | "source_completed" | "contribution_used" | "usefulness_rating" | "help_provided" | "help_accepted" | "daily_login" | "penalty_deduct" | "note_created" | "report_award"`
- `reporter_rank`: `"기자" | "차장" | "부장" | "부국장" | "편집국장" | "편집인"`
- `sensitivity_level`: `"public" | "private"`
- `source_visibility`: `"personal" | "shared"`
- `user_role`: `"superadmin" | "admin" | "deputy" | "reporter" | "section_editor" | "editor" | "publisher"`

주요 RPC 함수: `current_user_role`, `has_approved_access`, `is_active_user`, `is_admin`, `is_deputy_or_above`, `is_desk_or_above`, `rate_limit_check`, `rate_limit_cleanup`, `try_log_export`

(전체 내용은 약 1,700줄 — 지면 절약을 위해 요약 표기)

---

## src/lib/supabase/server.ts

```typescript
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

// 서버 컴포넌트 / API Route용 Supabase 클라이언트
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component에서는 쿠키 설정 불가 — 미들웨어가 처리
          }
        },
      },
    }
  )
}

// 포인트 부여 등 Service Role이 필요한 경우 (API Route 전용)
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
```

---

## src/lib/supabase/client.ts

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

// 클라이언트 컴포넌트용 Supabase 클라이언트
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

---

## src/lib/supabase/middleware.ts

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  return { supabaseResponse, user }
}
```

---

## src/lib/audit.ts

```typescript
/**
 * src/lib/audit.ts
 *
 * audit_logs 테이블 기록 헬퍼 — DB enum에 없는 커스텀 action 포함 지원
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.generated'

/** DB audit_action enum + 시스템 커스텀 액션 */
export type AuditAction =
  | 'view' | 'create' | 'update' | 'delete' | 'export' | 'import'
  | 'view_private' | 'approve' | 'reject'
  | 'login' | 'login_failed' | 'logout' | 'idle_logout'
  | 'new_device_login' | 'session_invalidate_others'
  | 'report_create'
  | 'note_view' | 'note_create' | 'note_delete'
  | 'report_update' | 'report_delete' | 'report_submit' | 'report_approve' | 'report_reject'
  | 'points_award'

export interface AuditEntry {
  user_id?:          string | null
  user_email?:       string | null
  user_role?:        string | null
  action:            AuditAction
  resource_type?:    string | null
  resource_id?:      string | null
  ip_address?:       string | null
  is_vpn_access?:    boolean | null
  export_row_count?: number | null
  watermark_token?:  string | null
  metadata?:         Record<string, unknown> | null
}

/**
 * audit_logs 테이블에 감사 로그를 기록합니다.
 * DB enum에 없는 커스텀 action도 허용합니다 (내부에서 `as any` 처리).
 */
export function auditLog(
  supabase: SupabaseClient<Database>,
  entry: AuditEntry,
): ReturnType<SupabaseClient<Database>['from']> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from('audit_logs').insert(entry)
}
```

---

## src/lib/permissions.ts

```typescript
import type { UserRole } from '@/types/database'

/**
 * 취재원 관리시스템 — 역할별 권한 매트릭스
 *
 * 역할 계층: superadmin > publisher > editor > section_editor > admin(부장) > deputy(차장) > reporter(기자)
 */

// ── 취재원 권한 ─────────────────────────────────────────────────────────────

/** 공유+민감(private) 취재원 열람 가능 (부장 이상) */
export const CAN_VIEW_SENSITIVE_SOURCE: readonly UserRole[] = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
] as const

/** personal_notes 열람 가능 (차장 이상 — 기자는 데스크 승인 필요) */
export const CAN_VIEW_PERSONAL_NOTES: readonly UserRole[] = [
  'deputy', 'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
] as const

/** 타인 취재원 수정 가능 (부장 이상) */
export const CAN_EDIT_ANY_SOURCE: readonly UserRole[] = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
] as const

/** 취재원 삭제 가능 (부장 이상) */
export const CAN_DELETE_SOURCE: readonly UserRole[] = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
] as const

// ── 정보보고 권한 ────────────────────────────────────────────────────────────

/** 정보보고 심사(승인/반려) 가능 (부국장 이상) */
export const CAN_APPROVE_REPORT: readonly UserRole[] = [
  'section_editor', 'editor', 'publisher', 'superadmin',
] as const

/** 모든 정보보고 열람 (부장 이상) */
export const CAN_VIEW_ALL_REPORTS: readonly UserRole[] = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
] as const

/** 정보보고 포인트 지급 가능 (부장 이상) */
export const CAN_AWARD_POINTS: readonly UserRole[] = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
] as const

// ── 내보내기 권한 ────────────────────────────────────────────────────────────

/** 내보내기 가능 (전원 — 역할별 행 수·횟수 제한 다름) */
export const CAN_EXPORT: readonly UserRole[] = [
  'reporter', 'deputy', 'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
] as const

/** 내보내기 최대 행 수 (역할별, env로 오버라이드 가능) */
export const EXPORT_MAX_ROWS: Readonly<Record<string, number>> = {
  reporter:       100,
  deputy:         200,
  admin:          500,
  section_editor: 1000,
  editor:         2000,
  publisher:      2000,
  superadmin:     5000,
} as const

/** 내보내기 일일 횟수 제한 (역할별) */
export const EXPORT_DAILY_LIMIT: Readonly<Record<string, number>> = {
  reporter:       3,
  deputy:         5,
  admin:          10,
  section_editor: 20,
  editor:         20,
  publisher:      20,
  superadmin:     999,
} as const

// ── 관리자 권한 ─────────────────────────────────────────────────────────────

/** 열람 승인 처리 가능 (부장 이상) */
export const CAN_APPROVE_ACCESS: readonly UserRole[] = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
] as const

/** 감사 로그 열람 가능 (부장 이상) */
export const CAN_VIEW_AUDIT_LOGS: readonly UserRole[] = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
] as const

/** 계정 관리 가능 (최고관리자 전용) */
export const CAN_MANAGE_USERS: readonly UserRole[] = ['superadmin'] as const

/** 도움 보너스 지급/관리 (부장 이상) */
export const CAN_MANAGE_HELP_REWARDS: readonly UserRole[] = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
] as const

// ── 헬퍼 함수 ───────────────────────────────────────────────────────────────

/**
 * 역할이 권한 목록에 포함되는지 확인합니다.
 *
 * @example
 * if (!can(userRole, CAN_EDIT_ANY_SOURCE)) return 403
 */
export function can(
  role: string | null | undefined,
  permission: readonly UserRole[],
): boolean {
  if (!role) return false
  return (permission as readonly string[]).includes(role)
}

export const PERMISSION_MATRIX = {
  sources: {
    '공개 취재원 조회':          '전체',
    '공유+민감 취재원 조회':      '부장+',
    'personal_notes 열람':      '차장+ (기자는 데스크 승인 필요)',
    '본인 취재원 수정':           '전체',
    '타인 취재원 수정':           '부장+',
    '취재원 삭제':               '부장+',
  },
  reports: {
    '정보보고 열람(공개)':        '전체',
    '정보보고 열람(전체)':        '부장+',
    '정보보고 심사':             '부국장+',
    '포인트 지급':               '부장+',
  },
  export: {
    '내보내기 가능':             '전체 (행 수·횟수 제한 있음)',
    '기자':                     '100행 / 1일 3회',
    '차장':                     '200행 / 1일 5회',
    '부장':                     '500행 / 1일 10회',
    '부국장+':                  '1,000~2,000행 / 1일 20회',
    'superadmin':               '5,000행 / 무제한',
  },
  admin: {
    '열람 승인 처리':             '부장+',
    '감사 로그 열람':             '부장+',
    '도움 보너스 관리':           '부장+',
    '계정 관리':                 'superadmin 전용',
  },
} as const
```

---

## src/lib/crypto.ts

```typescript
/**
 * src/lib/crypto.ts
 *
 * 민감 필드 암호화 유틸리티 — AES-256-GCM
 *
 * 환경변수:
 *   FIELD_ENCRYPTION_KEY  64자리 hex 문자열 (= 32바이트 키)
 *   생성법: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * 암호화 대상 필드:
 *   - personal_notes   (민감 메모)
 *   - phone_primary    (개인 연락처)
 *   - phone_secondary  (개인 연락처)
 *
 * 포맷: base64( IV(12) || AuthTag(16) || Ciphertext )
 *
 * 마이그레이션 안전성:
 *   decryptNullable()은 복호화 실패 시 원본값을 반환합니다.
 *   키 미설정 시에도 원본값을 그대로 반환하므로 점진적 전환이 가능합니다.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES   = 12  // 96-bit IV (GCM 권장)
const TAG_BYTES  = 16  // 128-bit auth tag

function getKey(): Buffer | null {
  const hex = process.env.FIELD_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) return null
  return Buffer.from(hex, 'hex')
}

/** 암호화. 키가 없으면 원문 반환 (마이그레이션 기간 허용) */
export function encryptField(plaintext: string): string {
  const key = getKey()
  if (!key) return plaintext  // key not configured — store plain (log warning in dev)

  const iv      = randomBytes(IV_BYTES)
  const cipher  = createCipheriv(ALGORITHM, key, iv)
  const enc     = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  // 포맷: v1: + base64( IV(12) + authTag(16) + ciphertext ) — 키 로테이션 지원
  return 'v1:' + Buffer.concat([iv, authTag, enc]).toString('base64')
}

/** 복호화. 실패 시 원본 반환 (평문 데이터 마이그레이션 기간 대응) */
export function decryptField(value: string): string {
  const key = getKey()
  if (!key) return value

  try {
    let b64 = value
    if (value.startsWith('v1:')) {
      b64 = value.slice(3)
    } else if (value.startsWith('v2:') || value.startsWith('v3:')) {
      return value
    }

    const buf     = Buffer.from(b64, 'base64')
    if (buf.length < IV_BYTES + TAG_BYTES) return value  // 너무 짧으면 평문

    const iv        = buf.subarray(0, IV_BYTES)
    const authTag   = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
    const encrypted = buf.subarray(IV_BYTES + TAG_BYTES)

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    return decipher.update(encrypted) + decipher.final('utf8')
  } catch {
    return value
  }
}

/** null/undefined 안전한 암호화 래퍼 */
export function encryptNullable(value: string | null | undefined): string | null {
  if (value == null || value === '') return null
  return encryptField(value)
}

/** null/undefined 안전한 복호화 래퍼 */
export function decryptNullable(value: string | null | undefined): string | null {
  if (value == null || value === '') return null
  return decryptField(value)
}

/** 키 설정 여부 확인 (헬스체크용) */
export function isEncryptionEnabled(): boolean {
  return getKey() !== null
}

/** 버전 접두사가 있는 암호화 포맷인지 확인 */
export function isVersionedEncrypted(value: string): boolean {
  return /^v\d+:/.test(value)
}
```

---

## src/lib/points.ts

```typescript
/**
 * 취재원 완성도 점수 & 포인트 계산 통합 모듈
 *
 * 완성도 점수 기준 (최대 60, 필드 기반)
 *   [기본정보 20]  이름 5 · 소속 8 · 직책 5 · 생년월일 2
 *   [연락처  20]   전화(주) 13 · 이메일(주) 7
 *   [학력    20]   대학 8 · 고교 6 · 전공 3 · 대학원 2 · 고시기수 1
 *   (+정보(source_notes) 40점은 별도 산정)
 *
 * 등록 보상 포인트 (3단계)
 *   완성도 55+  →  30pt
 *   완성도 35+  →  15pt
 *   그 외       →   5pt
 */

export type ScorableSource = Partial<Record<string, unknown>>

export function calcCompletenessScore(data: ScorableSource): number {
  let s = 0
  if (data.full_name)            s += 5
  if (data.current_organization) s += 8
  if (data.current_position)     s += 5
  if (data.birthday)             s += 2
  if (data.phone_primary)        s += 13
  if (data.email_primary)        s += 7
  if (data.university)           s += 8
  if (data.high_school)          s += 6
  if (data.university_major)     s += 3
  if (data.graduate_school)      s += 2
  if (data.exam_batch)           s += 1
  return s  // max 60
}

export function calcNoteScore(authorCount: number): number {
  if (authorCount >= 2) return 40
  if (authorCount === 1) return 20
  return 0
}

export function calcTotalScore(data: ScorableSource, noteAuthorCount = 0): number {
  return calcCompletenessScore(data) + calcNoteScore(noteAuthorCount)
}

export function calcRegistrationPoints(data: ScorableSource): number {
  const s = calcCompletenessScore(data)
  if (s >= 55) return 30
  if (s >= 35) return 15
  return 5
}

export const INCREMENTAL_POINT_FIELDS: ReadonlyArray<[string, number]> = [
  ['full_name',            1.5],
  ['current_organization', 2.5],
  ['current_position',     1.5],
  ['birthday',             0.5],
  ['phone_primary',        4.0],
  ['email_primary',        2.0],
  ['university',           2.5],
  ['high_school',          2.0],
  ['university_major',     1.0],
  ['graduate_school',      0.5],
  ['exam_batch',           0.5],
  ['hometown_province',    0.5],
  ['hometown_city',        0.5],
] as const
```

---

## src/lib/schemas.ts

```typescript
/**
 * src/lib/schemas.ts
 *
 * Zod 입력 스키마 — API 라우트 공통 검증 레이어
 * Zod v4 기준 (issues 사용)
 */
import { z } from 'zod'
import { NextResponse } from 'next/server'

export type ParseResult<T> =
  | { ok: true;  data: T }
  | { ok: false; response: NextResponse }

export async function parseBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<ParseResult<z.infer<S>>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: '잘못된 요청 형식입니다 (JSON 파싱 실패)' }, { status: 400 }),
    }
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    const issue = result.error.issues[0]
    const field = issue.path.length > 0 ? issue.path.join('.') : undefined
    return {
      ok: false,
      response: NextResponse.json(
        { error: issue.message, ...(field ? { field } : {}) },
        { status: 400 },
      ),
    }
  }
  return { ok: true, data: result.data }
}

export const CreateSourceSchema = z.object({
  full_name:            z.string().trim().min(1, '이름을 입력해 주세요').max(100),
  current_organization: z.string().trim().max(200).nullish(),
  current_position:     z.string().trim().max(100).nullish(),
  current_department:   z.string().trim().max(100).nullish(),
  phone_primary:        z.string().trim().max(30).nullish(),
  phone_secondary:      z.string().trim().max(30).nullish(),
  email_primary:        z.string().trim().email('올바른 이메일 형식이 아닙니다').max(200).nullish(),
  email_secondary:      z.string().trim().email('올바른 이메일 형식이 아닙니다').max(200).nullish(),
  birthday:             z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD 입니다').nullish(),
  hometown_province:    z.string().trim().max(50).nullish(),
  hometown_city:        z.string().trim().max(50).nullish(),
  high_school:          z.string().trim().max(100).nullish(),
  university:           z.string().trim().max(100).nullish(),
  university_major:     z.string().trim().max(100).nullish(),
  graduate_school:      z.string().trim().max(100).nullish(),
  exam_batch:           z.number().int().positive().nullish(),
  visibility:           z.enum(['personal', 'shared']).default('shared'),
  sensitivity:          z.enum(['public', 'private']).default('public'),
  on_record_status:     z.enum(['on_record', 'off_record', 'background']).default('on_record'),
  tags:                 z.array(z.string().trim().max(50)).max(30).optional(),
  public_notes:         z.string().trim().max(5000).nullish(),
  personal_notes:       z.string().trim().max(5000).nullish(),
  sns_links:            z.record(z.string(), z.string().url()).optional(),
})

const REPORT_CATEGORIES = ['일반', '단독', '공동취재', '인터뷰', '배경설명', '분석', '기타'] as const

export const CreateReportSchema = z.object({
  title:            z.string({ error: '제목을 입력해 주세요' }).trim().min(1, '제목을 입력해 주세요').max(200),
  content:          z.string({ error: '본문을 입력해 주세요' }).trim().min(1, '본문을 입력해 주세요').max(100_000),
  category:         z.enum(REPORT_CATEGORIES).default('일반'),
  tags:             z.array(z.string().trim().max(50)).max(30).optional(),
  visibility:       z.enum(['author_only', 'desk_above', 'team', 'all']).default('author_only'),
  source_ids:       z.array(z.string().uuid()).max(50).optional(),
  allowed_user_ids: z.array(z.string().uuid()).max(100).optional(),
})

export const ApprovalDecisionSchema = z.object({
  approval_id:   z.string().uuid('잘못된 approval_id 형식입니다'),
  action:        z.enum(['approve', 'reject']),
  reject_reason: z.string().trim().max(500).optional(),
})

export const CreateApprovalSchema = z.object({
  source_id: z.string().uuid('잘못된 source_id 형식입니다'),
  reason:    z.string().trim().min(1, '신청 사유를 입력해 주세요').max(500),
})

const USER_ROLES = [
  'reporter', 'deputy', 'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
] as const

export const CreateUserSchema = z.object({
  email:       z.string().trim().email('올바른 이메일 형식이 아닙니다').max(200),
  password:    z.string().min(8, '비밀번호는 8자 이상이어야 합니다').max(100),
  full_name:   z.string().trim().min(1, '이름을 입력해 주세요').max(100),
  role:        z.enum(USER_ROLES).optional(),
  department:  z.string().trim().max(100).nullish(),
  desk_name:   z.string().trim().max(100).nullish(),
  employee_id: z.string().trim().max(50).nullish(),
  phone:       z.string().trim().max(30).nullish(),
})

export const CreateHelpSchema = z.object({
  title:            z.string().trim().min(1, '제목을 입력해 주세요').max(200),
  body:             z.string().trim().max(10_000).nullish(),
  request_type:     z.string().trim().min(1, '요청 유형을 선택해 주세요').max(50),
  target_source_id: z.string().uuid().nullish(),
  target_name:      z.string().trim().max(100).nullish(),
  target_org:       z.string().trim().max(200).nullish(),
  reward_points:    z.number().int().min(5).max(100).default(10),
})

export const CreateNoteSchema = z.object({
  content:      z.string().trim().min(1, '내용을 입력해주세요').max(10_000),
  is_sensitive: z.boolean().default(false),
})
```

---

## src/lib/rateLimit.ts

```typescript
/**
 * Supabase 기반 분산 Rate Limiter
 *
 * public.rate_limit_check() Postgres 함수를 통해 모든 Vercel 인스턴스가
 * 동일한 카운터를 공유합니다. 메모리 기반 대비 완전한 분산 제한이 가능합니다.
 *
 * DB 호출이 실패(네트워크 오류 등)하면 failOpen=true 옵션에 따라
 * 기본적으로 요청을 허용합니다(서비스 가용성 우선).
 */

import { createServiceClient } from '@/lib/supabase/server'

export interface RateLimitOptions {
  prefix: string
  limit: number
  windowMs: number
  failOpen?: boolean
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

export async function checkRateLimit(
  identifier: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const key = `${opts.prefix}:${identifier}`
  const failOpen = opts.failOpen !== false // default: true

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase.rpc('rate_limit_check', {
      p_key: key,
      p_limit: opts.limit,
      p_window_ms: opts.windowMs,
    } as unknown as undefined)

    if (error) {
      console.error('[rateLimit] DB error:', error.message)
      return {
        allowed: failOpen,
        remaining: failOpen ? opts.limit : 0,
        resetAt: Date.now() + opts.windowMs,
      }
    }

    const rawData = data as Array<{ allowed: boolean; count: number; reset_at: string }> | null
    const row = Array.isArray(rawData) ? rawData[0] : null
    const resetMs = row?.reset_at ? new Date(row.reset_at).getTime() : Date.now() + opts.windowMs
    const count: number = row?.count ?? 1

    return {
      allowed: row?.allowed ?? failOpen,
      remaining: Math.max(0, opts.limit - count),
      resetAt: resetMs,
    }
  } catch (err) {
    console.error('[rateLimit] unexpected error:', err)
    return {
      allowed: failOpen,
      remaining: failOpen ? opts.limit : 0,
      resetAt: Date.now() + opts.windowMs,
    }
  }
}

export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}
```

---

## src/lib/roles.ts

```typescript
import type { UserRole } from '@/types/database'

// 역할 계층: superadmin > publisher > editor > section_editor > admin(부장) > deputy(차장) > reporter(기자)

export const DESK_ROLES: UserRole[] = ['admin', 'section_editor', 'editor', 'publisher', 'superadmin']
export const DEPUTY_AND_ABOVE: UserRole[] = ['deputy', 'admin', 'section_editor', 'editor', 'publisher', 'superadmin']
export const CROSS_DEPT_ROLES: UserRole[] = ['superadmin', 'publisher', 'editor', 'section_editor']

export function isDesk(role: string | null | undefined): boolean {
  return DESK_ROLES.includes(role as UserRole)
}

export function isDeputyOrAbove(role: string | null | undefined): boolean {
  return DEPUTY_AND_ABOVE.includes(role as UserRole)
}

export function isCrossDept(role: string | null | undefined): boolean {
  return CROSS_DEPT_ROLES.includes(role as UserRole)
}

export function isSuperAdmin(role: string | null | undefined): boolean {
  return role === 'superadmin'
}
```

---

## src/app/layout.tsx

```typescript
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import './globals.css'

export const metadata: Metadata = {
  title: 'THE SEGYE TIMES — AI 취재원 관리 시스템',
  description: '기자들이 보유한 취재원 정보를 안전하게 관리하고, 조직 전체의 인적 네트워크를 체계화하는 스마트 플랫폼',
  robots: { index: false, follow: false },
  openGraph: {
    title: 'THE SEGYE TIMES — AI 취재원 관리 시스템',
    description: '기자들이 보유한 취재원 정보를 안전하게 관리하고, 조직 전체의 인적 네트워크를 체계화하는 스마트 플랫폼',
    siteName: 'THE SEGYE TIMES',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'THE SEGYE TIMES AI 취재원 관리 시스템' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'THE SEGYE TIMES — AI 취재원 관리 시스템',
    description: '기자들이 보유한 취재원 정보를 안전하게 관리하고, 조직 전체의 인적 네트워크를 체계화하는 스마트 플랫폼',
    images: ['/og-image.png'],
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const headersList = await headers()
  const nonce = headersList.get('x-nonce') ?? ''

  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full" style={{ background: '#0D1520', color: '#CDD5E0' }}>
        {nonce && (
          <script
            nonce={nonce}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: `window.__webpack_nonce__=${JSON.stringify(nonce)}`,
            }}
          />
        )}
        {children}
      </body>
    </html>
  )
}
```

---

## src/app/(app)/layout.tsx

```typescript
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'
import SidebarLayout from '@/components/layout/SidebarLayout'
import Watermark from '@/components/layout/Watermark'
import ScreenshotGuard from '@/components/common/ScreenshotGuard'
import IdleLogout from '@/components/common/IdleLogout'
import DeviceGuard from '@/components/common/DeviceGuard'
import CopyGuard from '@/components/common/CopyGuard'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = profileData as Profile | null

  if (profileError || !profile || !profile.is_active) {
    redirect('/login?error=inactive')
  }

  return (
    <ScreenshotGuard>
      <div className="min-h-screen" style={{ background: '#0D1520' }}>
        <SidebarLayout profile={profile}>
          {children}
        </SidebarLayout>

        <Watermark
          userId={user.id}
          userEmail={user.email ?? ''}
          userName={profile.full_name ?? ''}
          department={profile.department ?? ''}
        />
      </div>

      <IdleLogout />
      <DeviceGuard />
      <CopyGuard userId={user.id} userEmail={user.email ?? ''} userFullName={profile.full_name ?? ''} />
    </ScreenshotGuard>
  )
}
```

---

## src/app/(auth)/login/page.tsx

(클라이언트 컴포넌트 — 로그인/회원가입 탭 UI)

주요 동작:
- 로그인 탭: `check-lockout` API 선확인 → `loginAction` 서버 액션 호출
- 회원가입 탭: `/api/auth/signup` POST 요청, 완료 시 관리자 승인 안내 메시지 표시
- 자동 로그아웃 후 `?reason=idle` 파라미터로 알림 표시
- 좌측 히어로 패널(md 이상), 우측 360px 폼 패널 레이아웃

(약 650줄 — 전체 내용은 `src/app/(auth)/login/page.tsx` 파일 참조)

---

## src/app/actions/auth.ts

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function loginAction(
  email: string,
  password: string
): Promise<{ error: string } | never> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const msg = error.message.toLowerCase()
    return {
      error:
        msg.includes('invalid login credentials') || msg.includes('invalid credentials')
          ? '이메일 또는 비밀번호가 올바르지 않습니다.'
          : msg.includes('ban') || msg.includes('banned')
            ? '가입 신청이 관리자 승인 대기 중입니다.\n승인 완료 후 로그인할 수 있습니다.'
            : msg.includes('email not confirmed')
              ? '이메일 인증이 필요합니다. 이메일을 확인해주세요.'
              : `로그인 중 오류가 발생했습니다. (${error.message})`,
    }
  }

  redirect('/dashboard')
}
```

---

## src/app/(app)/dashboard/page.tsx

(서버 컴포넌트 — 대시보드)

주요 데이터:
- Promise.all로 병렬 조회: 내 취재원 수, 공유 취재원 수, 포인트, 리더보드, 최근 등록, 도움 요청, 차트용 데이터, 팔로업 예정 연락
- 최근 열람 취재원: audit_logs view/view_private → source_id 중복 제거 후 최신 5개
- 차트 데이터 계산: 월별 등록 추이(6개월), 완성도 분포(5구간), 보고서 카테고리, 상위 출입처 TOP5
- DashboardCharts 클라이언트 컴포넌트에 데이터 전달

(약 443줄 — 전체 내용은 파일 참조)

---

## src/app/(app)/sources/page.tsx

```typescript
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import SourceListClient from '@/components/sources/SourceListClient'
import { can, CAN_VIEW_SENSITIVE_SOURCE } from '@/lib/permissions'

export default async function SourcesPage({ searchParams }) {
  // filter, q, page, tag 파라미터 처리
  // 역할별 민감 취재원 필터 적용 (canSeeSensitive)
  // Supabase 쿼리: visibility=shared OR owner_id=me, 태그 필터, 이름/소속/직책 검색
  // SourceListClient에 초기 데이터 전달
}
```

---

## src/app/(app)/sources/new/page.tsx

```typescript
import { createClient } from '@/lib/supabase/server'
import SourceForm from '@/components/sources/SourceForm'

export default async function NewSourcePage({ searchParams }) {
  // from_help 파라미터: 도움 게시판에서 넘어온 경우 helpContext 자동 매핑
  // 명함 일괄 등록(/sources/import-cards) 및 엑셀 가져오기(/sources/import) 단축 버튼
  // SourceForm mode="create" 렌더링
}
```

---

## src/app/(app)/sources/[id]/page.tsx

(서버 컴포넌트 — 취재원 상세 페이지)

주요 동작:
- `/api/sources/[id]` 데이터 조회 후 SourceDetailClient에 전달
- 역할 기반 편집/삭제 버튼 표시 제어

---

## src/app/(app)/sources/[id]/edit/page.tsx

(서버 컴포넌트 — 취재원 수정 페이지)

주요 동작:
- 기존 취재원 데이터 조회
- 소유자 또는 admin 권한 확인 후 SourceForm mode="edit" 렌더링

---

## src/app/(app)/reports/page.tsx

(서버 컴포넌트 — 정보보고 목록 페이지)

주요 동작:
- 역할별 열람 범위 필터 적용 (기자/차장 vs 부장 vs 부국장+)
- 검색(제목, 내용, 연결 취재원 이름) 지원
- ReportListClient 또는 직접 렌더링

---

## src/app/(app)/reports/[id]/page.tsx

(서버 컴포넌트 — 정보보고 상세 페이지)

주요 동작:
- 보고서 + 연결 취재원 + 작성자 프로필 조회
- ReportContentViewer (SecureContainer + Canvas 렌더링) 사용
- 데스크 이상: 포인트 지급 UI (ReportPointAward), 복사 이력 조회
- 작성자: 검토 요청 버튼 (ReportReviewActions)

---

## src/app/(app)/help/[id]/page.tsx

(서버 컴포넌트 — 도움 요청 상세 페이지)

주요 동작:
- 도움 요청 + 응답 목록 조회
- 요청자: 응답 채택 버튼 표시
- 취재원 등록 연동: 채택된 응답 내용을 new source 폼에 pre-fill

---

## src/app/(app)/admin/approvals/page.tsx

(서버 컴포넌트 — 열람 승인 관리 페이지)

주요 동작:
- admin+ 권한 확인 → ApprovalsClient 렌더링
- pending/approved/rejected 탭 전환

---

## src/app/(app)/admin/audit/page.tsx

(서버 컴포넌트 — 감사 로그 페이지)

주요 동작:
- CAN_VIEW_AUDIT_LOGS 확인 → AuditClient 렌더링
- action, user_email, resource_type, 날짜 범위 필터

---

## src/app/(app)/admin/stats/page.tsx

(서버 컴포넌트 — 실적 통계 페이지)

주요 동작:
- admin+ 확인 → StatsClient 렌더링
- 사용자별 기간 내 취재원 등록수, 포인트, 수정 횟수, 도움 응답수 집계

---

## src/app/api/sources/route.ts

```typescript
// GET /api/sources — 목록 조회 (filter, q, page, limit)
// POST /api/sources — 새 취재원 등록 (CreateSourceSchema 검증)
// - AES-256-GCM으로 phone_primary, phone_secondary, personal_notes 암호화
// - calcCompletenessScore로 완성도 점수 계산
// - source_positions 첫 직책 이력 생성
// - calcRegistrationPoints로 포인트 지급 (service client)
// - 감사 로그 기록
```

(전체 내용은 `src/app/api/sources/route.ts` 참조 — 약 165줄)

---

## src/app/api/sources/[id]/route.ts

```typescript
// GET    /api/sources/:id — 상세 조회
// - visibility/sensitivity 접근 제어
// - personal_notes 차장+ 또는 승인된 기자만 열람 (source_access_approvals 확인)
// - AES-256-GCM 복호화
// - 평균 유용성 점수 계산
// - 감사 로그 (view / view_private)

// PATCH  /api/sources/:id — 수정
// - 소유자 또는 admin만 수정 가능
// - trackableFields 변경 추적 → source_edit_history 기록
// - 암호화 필드는 복호화 후 비교, DB에는 재암호화 저장
// - calcCompletenessScore 재계산
// - INCREMENTAL_POINT_FIELDS로 증분 포인트 지급
// - current_organization/position 변경 시 source_positions 자동 갱신

// DELETE /api/sources/:id — 소프트 삭제 (is_deleted=true)
```

---

## src/app/api/sources/[id]/notes/route.ts

```typescript
// GET    /api/sources/[id]/notes
// - 차장 미만: 공개 노트 + 자신이 작성한 민감 노트만 반환
// - note_view 감사 로그

// POST   /api/sources/[id]/notes
// - CreateNoteSchema 검증
// - note_created +10pt 지급 (service client)
// - note_create 감사 로그

// DELETE /api/sources/[id]/notes?note_id=xxx
// - 본인 또는 admin만 삭제
// - note_delete 감사 로그
```

---

## src/app/api/sources/[id]/positions/route.ts

```typescript
// GET    /api/sources/[id]/positions — 직책 이력 목록
// POST   /api/sources/[id]/positions — 직책 추가
// - is_current=true 시 기존 현직 종료 + sources.current_* 갱신
// PATCH  /api/sources/[id]/positions?posId=xxx — 직책 수정
// DELETE /api/sources/[id]/positions?posId=xxx — 직책 삭제
// 소유자 또는 admin만 수정/삭제 가능
```

---

## src/app/api/sources/[id]/contact-logs/route.ts

```typescript
// GET  /api/sources/[id]/contact-logs
// - section_editor+: 전체 열람
// - admin/deputy: 같은 부서 민감 연락 열람
// - reporter: 자신이 작성한 민감 연락만 열람

// POST /api/sources/[id]/contact-logs
// - method: call/message/email/meet/other 검증

// DELETE /api/sources/[id]/contact-logs?log_id=UUID
// - 본인 기록만 삭제
```

---

## src/app/api/sources/[id]/copy-log/route.ts

```typescript
// POST /api/sources/[id]/copy-log — 복사 이벤트 기록
// GET  /api/sources/[id]/copy-log — admin+ 복사 이력 조회 (최근 50건)
```

---

## src/app/api/sources/[id]/rate/route.ts

```typescript
// POST /api/sources/[id]/rate — 유용성 평가 (1~5점 UPSERT)
// - 소유자 자기 평가 불가
// - 신규 4점 이상: 소유자 +3pt
// - 신규 평가: 평가자 +1pt
```

---

## src/app/api/sources/bulk/route.ts

```typescript
// POST /api/sources/bulk
// action: 'delete' | 'set_visibility' | 'add_tag' | 'remove_tag'
// ids: string[] (최대 100개)
// - reporter/deputy: 자신 취재원만
// - admin+: 전체 대상
// - add_tag/remove_tag: 중복 제거 처리
```

---

## src/app/api/reports/route.ts

```typescript
// GET  /api/reports — 목록 조회
// - 역할별 열람 범위: 부국장+ 전체, 부장 소속부서+전체공개, 기자 승인된+공개만
// - 검색: 제목/내용 ilike + 연결 취재원 이름 검색

// POST /api/reports — 보고서 생성
// - Rate Limit: 1분 10회
// - CreateReportSchema 검증
// - author_department 스냅샷 저장 (라인 격벽)
// - report_sources, report_revisions, report_allowed_users 연동 생성
// - report_create 감사 로그
```

---

## src/app/api/reports/[id]/route.ts

```typescript
// GET    /api/reports/[id] — 보고서 단건 조회
// - 역할/visibility/status 기반 열람 권한 체크

// PATCH  /api/reports/[id] — 보고서 수정 (작성자 또는 데스크)
// - content 변경 시 report_revisions 기록
// - as any 캐스팅: information_reports Relationships 타입 버그 (Task#9)

// DELETE /api/reports/[id] — 소프트 삭제 (작성자 또는 데스크)
```

---

## src/app/api/reports/[id]/review/route.ts

```typescript
// PATCH /api/reports/[id]/review
// action: 'submit' | 'approve' | 'reject'
// - submit: 작성자만, draft/rejected → submitted
// - approve: CAN_APPROVE_REPORT, submitted → approved
// - reject: CAN_APPROVE_REPORT, submitted → rejected (note 필수)
// - as any 캐스팅: information_reports Relationships 타입 버그
```

---

## src/app/api/reports/[id]/allowed-users/route.ts

```typescript
// GET    /api/reports/[id]/allowed-users — 지정 열람자 목록 (작성자 또는 데스크)
// POST   /api/reports/[id]/allowed-users — 열람자 추가
// DELETE /api/reports/[id]/allowed-users — 열람자 제거 (body: { user_id })
```

---

## src/app/api/reports/[id]/award-points/route.ts

```typescript
// GET  /api/reports/[id]/award-points — 포인트 지급 이력 (데스크+ 또는 작성자)
// POST /api/reports/[id]/award-points — 포인트 지급 (부장 이상 전용)
// - 자기 보고서 지급 불가
// - 1~1000pt 범위
// - points_award 감사 로그
```

---

## src/app/api/reports/[id]/copy-log/route.ts

```typescript
// GET  /api/reports/[id]/copy-log — 복사 이력 (부장 이상, 최근 100건)
// POST /api/reports/[id]/copy-log — 복사 이벤트 기록 (인증 사용자 누구나)
```

---

## src/app/api/reports/draft/route.ts

```typescript
// GET    /api/reports/draft — 내 드래프트 불러오기 (author_id 기준 단건)
// PUT    /api/reports/draft — 드래프트 저장 (upsert on author_id)
// DELETE /api/reports/draft — 드래프트 삭제
```

---

## src/app/api/approvals/route.ts

```typescript
// GET   /api/approvals — 승인권자: 관할 신청 목록 / 일반기자: 내 신청 목록
// - 부장(admin): 소속 부서 기자 신청만
// - 부국장+: 전체 조회
// - status 파라미터: pending(기본) | approved | rejected | all

// POST  /api/approvals — 열람 신청 (CreateApprovalSchema)
// - 이미 pending/approved 요청 있으면 409

// PATCH /api/approvals — 승인/거절 (ApprovalDecisionSchema)
// - 부장: 소속 부서 기자 신청만 처리 가능
// - 승인 시 30일 유효기간 + 신청자 알림 발송
```

---

## src/app/api/help/route.ts

```typescript
// GET  /api/help — 도움 요청 목록 (status 필터, 페이지네이션)
// POST /api/help — 도움 요청 생성 (CreateHelpSchema)
// - 포인트 잔액 확인 → 에스크로 차감 (penalty_deduct, service client)
```

---

## src/app/api/help/[id]/route.ts

```typescript
// GET    /api/help/[id] — 도움 요청 상세 + 응답 목록 (is_accepted desc, upvotes desc)
// PATCH  /api/help/[id] — 상태 변경 (본인 또는 admin)
// - closed + 채택 없음 → 포인트 환불 (help_provided)
// DELETE /api/help/[id] — 도움 요청 삭제 (본인 또는 admin)
```

---

## src/app/api/help/[id]/responses/route.ts

```typescript
// POST  /api/help/[id]/responses — 응답 작성
// - 본인 요청에 응답 불가
// - 마감된 요청에 응답 불가
// - 응답자 +1pt, 요청자에게 알림

// PATCH /api/help/[id]/responses — 응답 채택
// - 요청자만 채택 가능
// - 이미 채택된 응답 있으면 409
// - 채택된 응답자에게 reward_points 지급 + 알림

// PUT   /api/help/[id]/responses — 추천(upvote)
// - 본인 응답 추천 불가
```

---

## src/app/api/notifications/route.ts

```typescript
// GET   /api/notifications — 최근 30개 + unread 카운트
// PATCH /api/notifications — 읽음 처리 (body.id 지정 시 단건, 없으면 전체)
```

---

## src/app/api/bookmarks/route.ts

```typescript
// GET    /api/bookmarks — 내 즐겨찾기 목록 (is_deleted 필터링)
// POST   /api/bookmarks — 즐겨찾기 추가 (23505 중복 시 409)
// DELETE /api/bookmarks?source_id=xxx — 즐겨찾기 제거
```

---

## src/app/api/profiles/search/route.ts

```typescript
// GET /api/profiles/search?q=이름&limit=15
// - 이름/부서 ilike 검색
// - 활성 계정만, 자기 자신 제외
// - 최대 30건
```

---

## src/app/api/export/sources/route.ts

```typescript
// GET /api/export/sources — 취재원 목록 Excel 내보내기
// - EXPORT_MAX_ROWS / EXPORT_DAILY_LIMIT 역할별 적용
// - try_log_export RPC로 원자적 한도 확인 + 로그 (TOCTOU 방지)
// - 워터마크 ID: base64(userId:email:IP:timestamp)
// - 데이터 시트 + 메타정보 시트 (워터마크 포함)
// - X-Remaining-Exports 응답 헤더
// - phone_primary AES-256-GCM 복호화 후 Excel에 원문 저장
```

---

## src/app/api/auth/login-audit/route.ts

```typescript
// POST /api/auth/login-audit
// body: { action: 'login' | 'login_failed' | 'logout' | 'idle_logout', email?, reason? }
// - 인증 없이도 호출 가능 (로그인 실패 기록용)
// - auditLog 실패해도 200 반환 (감사 오류가 로그인 차단하면 안 됨)
```

---

## src/app/api/auth/signup/route.ts

```typescript
// POST /api/auth/signup — 자가 회원가입 신청
// - Rate Limit: IP당 1시간 5회
// - service.auth.admin.createUser → email_confirm: true
// - profiles upsert (is_active: false, role: reporter)
// - ban_duration: '876600h' (~100년) — 관리자 승인 전 로그인 차단
// - 실패 시 Auth 계정 정리 (deleteUser)
```

---

## src/app/api/auth/check-lockout/route.ts

```typescript
// GET /api/auth/check-lockout?email=...
// - 최근 15분 내 login_failed 5회 이상 → locked: true + until 반환
// - Service Role로 audit_logs 조회 (RLS 우회)
// - 체크 실패 시 locked: false (감사 오류가 로그인 차단하면 안 됨)
```

---

## src/app/api/auth/otp-verify/route.ts

```typescript
// POST /api/auth/otp-verify
// body: { phone, otp }
// - supabase.auth.verifyOtp (type: 'sms')
// - 성공 시 HttpOnly;Secure;SameSite=Strict 쿠키 설정
// - 쿠키 값: HMAC-SHA256(userId:otp_verified) 앞 32자리
```

---

## src/app/api/auth/session-control/route.ts

```typescript
// POST /api/auth/session-control
// - adminClient.auth.admin.signOut(user.id, 'others') — 타 세션 무효화
// - session_invalidate_others 감사 로그
```

---

## src/app/api/auth/device-check/route.ts

```typescript
// POST /api/auth/device-check
// body: { fingerprint, deviceLabel }
// - 기존 기기: last_seen_at 갱신 → { status: 'known' }
// - 새 기기: user_devices INSERT + new_device_login 감사 로그 → { status: 'new', warned: true }
```

---

## src/app/api/admin/stats/route.ts

```typescript
// GET /api/admin/stats?from=YYYY-MM-DD&to=YYYY-MM-DD
// - admin+ 권한 확인
// - Promise.all로 병렬 조회: profiles, sources(created_at 기준), point_transactions, source_edit_history, help_responses
// - 사용자별 집계: sources_created, points_earned, edits_made, help_responses
```

---

## src/app/api/admin/users/route.ts

```typescript
// POST  /api/admin/users — 계정 생성
// - admin: reporter/deputy만, superadmin: 전체
// - serviceClient.auth.admin.createUser + profiles upsert
// - 실패 시 Auth 계정 정리

// PATCH /api/admin/users — 계정 관리 (multi-action)
// action: 'activate' — Auth ban 해제 + is_active=true + 비밀번호 설정 링크 발송
// action: 'approve'  — 자가 가입 신청 승인 + 역할 부여
// send_reset_email   — 비밀번호 재설정 이메일 발송
// 일반 업데이트       — role/rank/full_name/department/desk_name 수정
// - is_active=false 시 ban_duration='876600h', is_active=true 시 'none'
```

---

## src/app/api/admin/audit/export/route.ts

```typescript
// GET /api/admin/audit/export — 감사 로그 Excel 내보내기
// - CAN_VIEW_AUDIT_LOGS 확인
// - 필터: action, user_email, resource_type, resource_id, date_from, date_to
// - 최대 5,000건
// - 감사로그 시트 + 내보내기정보 시트
// - 내보내기 자체도 export 감사 로그 기록
```

---

## src/app/api/admin/points/route.ts

```typescript
// POST /api/admin/points — 관리자가 특정 유저에게 포인트 지급
// - admin+ 권한 확인
// - 1~500pt 클램핑
// - service client로 point_transactions INSERT
```

---

## src/app/api/ocr/business-card/route.ts

```typescript
// POST /api/ocr/business-card — 명함 단건 OCR (Claude Haiku)
// - 인증 확인
// - magic bytes로 이미지 유효성 검증 (JPEG/PNG/GIF/WebP)
// - base64 인코딩 후 Claude messages.create
// - JSON 파싱 실패 시 parseBusinessCard() 텍스트 폴백
// - 추출 필드: full_name, name_en, current_organization, current_position, department, phone_primary/secondary, email_primary, address, website
```

---

## src/app/api/ocr/business-card/batch/route.ts

```typescript
// POST /api/ocr/business-card/batch — 명함 여러 장 동시 OCR
// - Rate Limit: 사용자당 1분 5회 (user_id:IP)
// - 최대 20장
// - CONCURRENCY=3으로 동시 Claude API 호출
// - 개별 실패 시 error 필드로 결과 반환 (전체 실패하지 않음)
// - 응답: { results: Array<{ index, filename, data, error }> }
```

---

## src/components/layout/SidebarLayout.tsx

(클라이언트 컴포넌트)

주요 동작:
- 모바일 사이드바 열기/닫기 상태 관리
- `usePathname()` 라우트 변경 시 사이드바 자동 닫기
- Sidebar + 모바일 토글 버튼 + main 콘텐츠 영역 구성
- Profile 데이터를 Sidebar에 전달

---

## src/components/layout/Sidebar.tsx

(클라이언트 컴포넌트)

주요 동작:
- 내비게이션 메뉴: 대시보드, 취재원, 정보보고, 도움 게시판, 네트워크, 설정
- 관리자 메뉴: admin/superadmin 역할만 표시 (열람 승인, 감사 로그, 실적 통계)
- 활성 경로 하이라이트 (`usePathname()`)
- 로그아웃: `supabase.auth.signOut()` 호출 후 `/login` 리다이렉트

---

## src/components/layout/Watermark.tsx

(클라이언트 컴포넌트 — 보안 워터마크)

주요 동작:
- SVG 타일 패턴 워터마크 (고정 포지션, z-index 9999, pointer-events:none)
- 표시 내용: userName, department, shortId(userId 앞 8자), ISO 타임스탬프
- MutationObserver: DOM에서 제거/숨김 감지 시 자동 재삽입
- 45도 회전, 반복 타일

---

## src/components/layout/NotificationBell.tsx

(클라이언트 컴포넌트)

주요 동작:
- Supabase Realtime 채널로 notifications 테이블 실시간 구독
- 드롭다운 패널: 제목, 생성 시각, 읽음 여부 표시
- 열기 시 전체 읽음 처리 (`PATCH /api/notifications`)
- 미읽음 배지 (최대 99+ 표시)

---

## src/components/common/IdleLogout.tsx

(클라이언트 컴포넌트)

주요 동작:
- 15분 무활동 → 2분 카운트다운 경고 모달 표시
- 추가 2분 경과 → `supabase.auth.signOut()` + `idle_logout` 감사 로그 + `/login?reason=idle` 리다이렉트
- 이벤트: mousemove, keydown, click, touchstart, scroll
- 워커 활성화 중에도 페이지 포커스 여부로 타이머 조정

---

## src/components/common/DeviceGuard.tsx

(클라이언트 컴포넌트)

주요 동작:
- `navigator.userAgent + screen.width/height + timezone` 조합으로 기기 지문 생성 (SHA-256)
- sessionStorage에 캐시하여 반복 API 호출 방지
- `POST /api/auth/device-check` 호출
- 새 기기 응답 시 5초간 알림 배너 표시

---

## src/components/common/CopyGuard.tsx

(클라이언트 컴포넌트)

주요 동작:
- `document.addEventListener('copy')` 전역 인터셉트
- ZW(Zero-Width) 문자 + 구두점 워터마크 주입 (`injectFullWatermark()`)
- `data-secure="true"` 영역: 복사 텍스트 하단에 가시적 출처 정보 추가
- 30초 디바운스로 `navigator.sendBeacon('/api/sources/[id]/copy-log')` 전송
- 워터마크 패턴: `​‌‍﻿` + ` · [이름][부서][시각] · ` 반복

---

## src/components/common/ScreenshotGuard.tsx

(클라이언트 컴포넌트)

주요 동작:
- `window blur` / `visibilitychange:hidden` / PrintScreen / Cmd+Shift+3,4,5 / Ctrl+P 감지 시 콘텐츠 blur 처리
- 5초 startup 딜레이로 내비게이션 중 오탐 방지
- blur 해제: 포커스 복귀 또는 2초 후 자동

---

## src/components/common/ProtectedText.tsx

(클라이언트 컴포넌트)

주요 동작:
- Canvas 기반 텍스트 렌더링으로 DOM에 평문 텍스트 노출 방지
- 전화번호, 이메일 등 민감 필드에 사용
- `devicePixelRatio` 대응 고해상도 렌더링

---

## src/components/common/SecureContainer.tsx

(클라이언트 컴포넌트)

주요 동작:
- `user-select: none`
- `contextmenu`, `dragstart` 차단
- `Ctrl+A`, `Ctrl+C` 키 이벤트 차단
- `data-secure="true"` 속성 설정 (CopyGuard 가시적 워터마크 트리거)

---

## src/components/common/SecureContentViewer.tsx

(클라이언트 컴포넌트)

주요 동작:
- Canvas 기반 콘텐츠 렌더링 + 인라인 워터마크 오버레이
- 복사 인터셉터: 워터마크 + 출처 정보 footer 추가
- `sendBeacon`으로 copy-log 전송

---

## src/components/reports/ReportContentViewer.tsx

(클라이언트 컴포넌트)

주요 동작:
- SecureContainer + SecureContentViewer 조합으로 보고서 본문 렌더링
- 보고서 ID를 copy-log API 경로에 사용
- 마크다운 렌더링 (또는 whitespace-pre-wrap)

---

## src/components/reports/ReportPointAward.tsx

(클라이언트 컴포넌트)

주요 동작:
- 데스크 전용 포인트 지급 UI
- 빠른 선택 버튼: 10 / 20 / 50 / 100pt
- 메모 입력 필드
- 지급 이력 목록 (GET /api/reports/[id]/award-points)

---

## src/components/reports/ReportReviewActions.tsx

(클라이언트 컴포넌트)

주요 동작:
- 상태 기반 UI: draft/rejected → 검토 요청 버튼, submitted → 승인/반려 버튼(데스크)
- 반려 시 사유 입력 모달
- PATCH /api/reports/[id]/review 호출

---

## src/components/network/DuplicateWarning.tsx

(클라이언트 컴포넌트)

주요 동작:
- 동일 이름의 취재원이 여러 개 존재할 때 경고 배너 표시
- localStorage에 dismissId 저장하여 재표시 방지

---

## src/components/network/NetworkGraph.tsx

(클라이언트 컴포넌트)

주요 동작:
- `d3-force-3d` 기반 2D 포스 그래프 (react-force-graph-2d 사용)
- FNV 해시로 소속 기관별 색상 팔레트 자동 생성
- 링크 유형: same_org, same_university, same_highschool, same_exam, same_hometown, same_tag, same_position, mention, manual
- 노드 클릭 → 취재원 상세 페이지 이동
- 줌/팬 지원, 모바일 터치 지원

---

## src/components/dashboard/DashboardCharts.tsx

(클라이언트 컴포넌트)

주요 동작:
- 순수 SVG 차트 (외부 라이브러리 없음)
- LineChart: 월별 등록 추이 (최근 6개월)
- BarChart: 완성도 분포 (0-20/21-40/41-60/61-80/81+)
- BarChart: 보고서 카테고리별 건수
- BarChart: 상위 출입처 TOP5
- ChartData 타입 export

---

## src/components/admin/StatsClient.tsx

(클라이언트 컴포넌트)

주요 동작:
- 기간 프리셋: 오늘, 이번 주, 이번 달, 이번 분기, 올해, 직접 입력
- GET /api/admin/stats 호출 후 사용자별 실적 테이블 렌더링
- xlsx 클라이언트 사이드 Excel 내보내기

---

## src/components/admin/AuditClient.tsx

(클라이언트 컴포넌트)

주요 동작:
- 필터: action, user_email, resource_type, resource_id, date_from, date_to
- action 라벨 매핑 및 색상 코딩
- GET /api/admin/audit/export?... 로 Excel 다운로드

---

## src/components/admin/ApprovalsClient.tsx

(클라이언트 컴포넌트)

주요 동작:
- pending/approved/rejected 탭 전환
- PATCH /api/approvals로 승인/거절 처리
- 거절 시 사유 입력 모달

---

## src/components/admin/UsersClient.tsx

(클라이언트 컴포넌트)

주요 동작:
- 사용자 목록 테이블 (역할 라벨, 직급 색상 코딩)
- 계정 생성 폼 (POST /api/admin/users)
- 역할/상태 수정 (PATCH /api/admin/users)
- 가입 신청 승인 버튼
- 비밀번호 재설정 이메일 발송

---

## src/components/sources/SourceForm.tsx

(클라이언트 컴포넌트 — 취재원 생성/수정 폼)

주요 동작:
- mode: 'create' | 'edit'
- QuickFill 통합: 텍스트 붙여넣기로 필드 자동 추출
- BusinessCardScanner: 명함 이미지 OCR 연동
- personal_notes 텍스트에서 학력 정보 자동 감지 배너 (`extractEducationFields`)
- 실시간 완성도 점수 미리보기 (`calcCompletenessScore`)
- SNS 링크, 태그 동적 추가/제거
- POST /api/sources (create) / PATCH /api/sources/[id] (edit)

---

## src/components/sources/SourceDetailClient.tsx

(클라이언트 컴포넌트 — 취재원 상세 뷰)

주요 동작:
- 탭: 기본정보, 연락 이력, 직책 이력, 편집 이력, 평가
- 역할 기반 민감 필드 가시성 제어 (personal_notes, phone_primary 등)
- 열람 승인 신청 (POST /api/approvals)
- 즐겨찾기 토글 (POST/DELETE /api/bookmarks)
- 유용성 평가 (POST /api/sources/[id]/rate)
- 연락 이력 추가 (POST /api/sources/[id]/contact-logs)
- 정보 추가 (POST /api/sources/[id]/notes)
- ProtectedText로 전화번호 Canvas 렌더링

---

## src/components/sources/SourceListClient.tsx

(클라이언트 컴포넌트 — 취재원 목록)

주요 동작:
- 페이지네이션, 검색, 필터(전체/내 것) 상태 관리
- 체크박스 다중 선택 → 일괄 작업 (삭제, 공개 설정 변경, 태그 추가/제거)
- POST /api/sources/bulk 호출
- 완성도 점수 컬러 인디케이터

---

## src/components/sources/QuickFill.tsx

(클라이언트 컴포넌트)

주요 동작:
- vCard 포맷 파싱 (BEGIN:VCARD)
- 네이버 프로필 텍스트 파싱
- 자유 형식 텍스트에서 이름, 직책, 소속, 전화, 이메일 추출
- `extractEducationFields()`: 학력 관련 키워드 감지 (대학교, 고등학교, 석사 등)
- 결과를 onFill 콜백으로 SourceForm에 전달

---

## src/components/sources/ContactImporter.tsx

(클라이언트 컴포넌트)

주요 동작:
- vCard/vcf 파일 드래그앤드롭 파싱
- Web Contacts API (`navigator.contacts` — as any 캐스팅) 연동
- 파싱된 연락처 목록에서 선택 → bulk import
- POST /api/sources 다중 호출

---

## src/lib/__tests__/permissions.test.ts

```typescript
// Vitest 단위 테스트 — 권한 시스템
// 테스트 항목:
// - 모든 역할 × 모든 권한 상수 조합 can() 검증
// - EXPORT_MAX_ROWS 단조증가 (reporter ≤ deputy ≤ admin ≤ ...)
// - EXPORT_DAILY_LIMIT 단조증가
// - null/undefined 역할 처리
// - 존재하지 않는 역할 처리
```

---

## src/lib/__tests__/crypto.test.ts

```typescript
// Vitest 단위 테스트 — AES-256-GCM 암호화
// 테스트 항목:
// - encryptField / decryptField 라운드트립
// - 다른 키로 복호화 시 원본 반환 (tamper detection)
// - encryptNullable / decryptNullable null/undefined/empty 처리
// - isEncryptionEnabled() 환경변수 조건 분기
// - 버전 접두사(v1:/v2:) 처리
// - 마이그레이션: 키 미설정 시 원문 반환
```

---

## src/lib/__tests__/rls-policy.test.ts

```typescript
// Vitest 단위 테스트 — 앱 레벨 접근 제어
// 테스트 항목:
// - canAccessSource: visibility × sensitivity × role 조합
// - resolvePersonalNotes: deputy+/reporter/approval 유무
// - 역할 계층 일관성 (상위 역할은 하위 역할의 모든 권한 포함)
```

---

## src/app/api/__tests__/route-handlers.test.ts

```typescript
// Vitest 단위 테스트 — API 라우트 핸들러 HTTP 상태코드
// 테스트 항목:
// - 미인증 요청 → 401
// - Forbidden → 403
// - 존재하지 않는 리소스 → 404
// - Zod 스키마 위반 → 400
// Supabase 클라이언트 모킹 (vi.mock)
```

---

## src/app/api/__tests__/bulk-permissions.test.ts

```typescript
// Vitest 단위 테스트 — 벌크 작업 권한 로직
// 테스트 항목:
// - getTargetIds: admin vs reporter 권한 분리
// - getDeleteIds: CAN_DELETE_SOURCE 체크
// - validateBulkInput: ids 배열 최대 100개 제한
// - add_tag 중복 방지 (이미 있는 태그 제외)
// - remove_tag 없는 태그 처리
```

---

## src/app/api/__tests__/export-limits.test.ts

```typescript
// Vitest 단위 테스트 — 내보내기 한도
// 테스트 항목:
// - 역할별 EXPORT_MAX_ROWS 계산
// - EXPORT_DAILY_LIMIT 초과 시 차단
// - watermarkId 생성 형식 (base64, 32자 이하)
// - try_log_export RPC 반환값에 따른 allowed/rejected 분기
```

---

## e2e/auth.setup.ts

```typescript
// Playwright 인증 상태 저장
// 1. reporter 계정으로 로그인 → e2e/.auth/reporter.json 저장
// 2. admin 계정으로 로그인 → e2e/.auth/admin.json 저장
// 환경변수: E2E_REPORTER_EMAIL, E2E_REPORTER_PASSWORD, E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD
```

---

## e2e/sources.spec.ts

```typescript
// Playwright E2E — 취재원 CRUD (reporter 권한)
// 테스트 시나리오:
// - 취재원 목록 페이지 렌더링 + 검색
// - 취재원 생성 → 상세 페이지 접근
// - 즐겨찾기 추가/제거
// - 내용 수정
// - 소프트 삭제
```

---

## e2e/permissions.spec.ts

```typescript
// Playwright E2E — 접근 제어 검증 (reporter 권한)
// 테스트 시나리오:
// - /admin 페이지 접근 시 리다이렉트 또는 403
// - export API 응답 헤더 확인 (Content-Type, X-Remaining-Exports)
// - 타인 민감 취재원 직접 URL 접근 → 403
```

---

## e2e/export.spec.ts

```typescript
// Playwright E2E — 내보내기 API (reporter 권한)
// 테스트 시나리오:
// - GET /api/export/sources → 200 + xlsx MIME
// - Content-Disposition 헤더 확인 (attachment; filename*=UTF-8...)
// - X-Remaining-Exports 헤더 존재 확인
```

---

## e2e/approvals.spec.ts

```typescript
// Playwright E2E — 열람 승인 + 도움 게시판 (reporter 권한)
// 테스트 시나리오:
// - GET /api/approvals → 200 + 배열
// - 존재하지 않는 UUID source_id → 404/422/500
// - UUID 형식 아닌 source_id → 400 (Zod)
// - reason 누락/빈값 → 400 (Zod)
// - /help 목록 페이지 렌더링
// - /help/new 폼 렌더링 + 취소 버튼
// - 포인트 부족 시 도움 요청 생성 → 400
// - 제목 누락/reward_points 범위 초과 → 400
```

---

## e2e/admin.spec.ts

```typescript
// Playwright E2E — 관리자 기능 (admin 권한)
// 테스트 시나리오:
// - /admin/approvals 페이지 접근 + 탭 전환
// - /admin/stats 페이지 접근 + 통계 테이블
// - POST /api/admin/points → 200
// - 정보보고 포인트 지급 API
```

---

## e2e/audit.spec.ts

```typescript
// Playwright E2E — 감사 로그 (admin 권한)
// 테스트 시나리오:
// - /admin/audit 페이지 렌더링
// - action 필터 적용
// - GET /api/admin/audit/export → 200 + xlsx
// - Content-Disposition 헤더 확인
```
