/**
 * e2e/admin.spec.ts
 *
 * 관리자 전용 기능 E2E 테스트 (admin 권한)
 *
 * 테스트 시나리오:
 *  1. 사용자 계정 관리 페이지 렌더링
 *  2. 승인 관리 페이지 탭 전환
 *  3. 실적 통계 페이지 접근
 *  4. 도움 보너스 포인트 페이지
 *  5. 존재하지 않는 사용자 역할 변경 → 404
 */

import { test, expect } from '@playwright/test'

// ── 사용자 계정 관리 ───────────────────────────────────────────────────────────

test.describe('사용자 계정 관리 (admin)', () => {

  test('계정 관리 페이지 접근 + 테이블 렌더링', async ({ page }) => {
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/admin\/users/)

    // 페이지 제목 확인
    await expect(page.getByText('계정 관리')).toBeVisible()

    // 사용자 목록이 표시되는 테이블/리스트 영역 확인
    // 헤더 텍스트 또는 컬럼 레이블 중 하나 이상 존재해야 함
    const hasTable = await page.locator('table').count() > 0
    const hasListItem = await page.locator('[data-testid="user-row"], tr, .user-row').count() > 0

    // 테이블이 렌더링 되거나, 계정 목록 구성 요소가 보여야 함
    // (데이터 없을 경우 "등록된 계정이 없습니다" 메시지도 허용)
    const hasContent = hasTable || hasListItem
    const hasEmpty = await page.getByText(/없습니다|없음|No user/i).isVisible().catch(() => false)

    expect(hasContent || hasEmpty).toBe(true)
  })

  test('계정 관리 API — reporter 미접근 확인 (admin storageState)', async ({ page }) => {
    // admin 권한으로 사용자 목록 페이지에 접근하면 리다이렉트 없이 그대로 유지
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')

    // admin 권한이면 /admin/users URL 유지 (reporter라면 /dashboard로 리다이렉트됨)
    await expect(page).toHaveURL(/admin\/users/)
  })

  test('존재하지 않는 사용자 역할 변경 API → 오류 응답', async ({ page }) => {
    // PATCH /api/admin/users 에 존재하지 않는 target_user_id → DB에서 단일 row 없으면 500 또는 404
    // target_user_id가 UUID 형식이어야 하고, 실제 존재하지 않으면 Supabase .single()이 오류
    const nonExistentId = '00000000-0000-0000-0000-000000000099'
    const res = await page.request.patch('/api/admin/users', {
      data: {
        target_user_id: nonExistentId,
        role: 'reporter',
      },
      headers: { 'Content-Type': 'application/json' },
    })

    // DB에 해당 row가 없으므로 500(Supabase single() 오류) 또는 구현에 따라 404
    expect([404, 500]).toContain(res.status())
  })

  test('잘못된 형식의 target_user_id → 400', async ({ page }) => {
    const res = await page.request.patch('/api/admin/users', {
      data: {
        target_user_id: '',   // 빈 값 → 400 expected
        role: 'reporter',
      },
      headers: { 'Content-Type': 'application/json' },
    })

    // target_user_id가 없으면 route에서 400 반환
    expect(res.status()).toBe(400)
  })
})

// ── 승인 관리 ─────────────────────────────────────────────────────────────────

test.describe('승인 관리 페이지 (admin)', () => {

  test('승인 관리 페이지 접근 + 기본 탭 렌더링', async ({ page }) => {
    await page.goto('/admin/approvals')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/admin\/approvals/)

    // 페이지 헤딩 확인
    await expect(page.getByText('승인 관리')).toBeVisible()

    // 취재원 열람 승인 탭 존재
    await expect(page.getByText('취재원 열람 승인')).toBeVisible()
    // 정보보고 검토 탭 존재
    await expect(page.getByText('정보보고 검토')).toBeVisible()
  })

  test('취재원 열람 탭 (기본) — sources 탭 활성', async ({ page }) => {
    await page.goto('/admin/approvals?tab=sources')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/tab=sources/)

    // 취재원 열람 승인 탭이 활성 상태
    await expect(page.getByText('취재원 열람 승인')).toBeVisible()
  })

  test('정보보고 탭 전환 — URL에 tab=reports 포함', async ({ page }) => {
    await page.goto('/admin/approvals')
    await page.waitForLoadState('networkidle')

    // 정보보고 검토 탭 클릭
    await page.getByText('정보보고 검토').click()
    await page.waitForLoadState('networkidle')

    // URL에 tab=reports 반영
    await expect(page).toHaveURL(/tab=reports/)
  })

  test('다시 취재원 열람 탭으로 전환', async ({ page }) => {
    await page.goto('/admin/approvals?tab=reports')
    await page.waitForLoadState('networkidle')

    // 취재원 열람 승인 탭 클릭
    await page.getByText('취재원 열람 승인').click()
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/tab=sources/)
  })

  test('승인 결정 API — 존재하지 않는 approval_id로 승인 시도 → 오류', async ({ page }) => {
    const res = await page.request.patch('/api/approvals', {
      data: {
        approval_id: '00000000-0000-0000-0000-000000000099',
        action: 'approve',
      },
      headers: { 'Content-Type': 'application/json' },
    })

    // 존재하지 않는 row → 500 또는 구현에 따라 404
    expect([404, 500]).toContain(res.status())
  })
})

// ── 실적 통계 ─────────────────────────────────────────────────────────────────

test.describe('실적 통계 페이지 (admin)', () => {

  test('통계 페이지 접근 + 헤딩 렌더링', async ({ page }) => {
    await page.goto('/admin/stats')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/admin\/stats/)

    // 페이지 제목 확인 (이모지 포함 텍스트 매칭)
    await expect(page.getByText(/실적 집계/)).toBeVisible()
  })

  test('통계 페이지 — 기간 선택 컨트롤 존재', async ({ page }) => {
    await page.goto('/admin/stats')
    await page.waitForLoadState('networkidle')

    // StatsClient가 렌더링 되면 날짜 또는 프리셋 버튼이 존재해야 함
    // "이번 달", "오늘", "올해" 등 프리셋 버튼 또는 날짜 입력 확인
    const hasPreset = await page.getByText(/이번 달|오늘|올해|이번 주/).count() > 0
    const hasDateInput = await page.locator('input[type="date"]').count() > 0

    expect(hasPreset || hasDateInput).toBe(true)
  })

  test('통계 API 직접 호출 — 200 + stats 배열 반환', async ({ page }) => {
    const today = new Date().toISOString().split('T')[0]
    const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const res = await page.request.get(`/api/admin/stats?from=${monthAgo}&to=${today}`)

    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty('stats')
    expect(Array.isArray(body.stats)).toBe(true)
    // 날짜 범위가 응답에 포함
    expect(body).toHaveProperty('from', monthAgo)
    expect(body).toHaveProperty('to', today)
  })

  test('통계 API — 날짜 파라미터 없이 호출 → 200 + 빈 범위', async ({ page }) => {
    const res = await page.request.get('/api/admin/stats')

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('stats')
  })
})

// ── 도움 보너스 포인트 ────────────────────────────────────────────────────────

test.describe('도움 보너스 포인트 페이지 (admin)', () => {

  test('도움 보너스 포인트 페이지 접근', async ({ page }) => {
    await page.goto('/admin/help-rewards')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/admin\/help-rewards/)

    // 페이지 제목 확인
    await expect(page.getByText(/도움 보너스 포인트/)).toBeVisible()
  })

  test('도움 보너스 포인트 — 설명 문구 렌더링', async ({ page }) => {
    await page.goto('/admin/help-rewards')
    await page.waitForLoadState('networkidle')

    // 부가 설명 텍스트 확인
    await expect(page.getByText(/추가 포인트/i)).toBeVisible()
  })

  test('포인트 지급 API — 빈 배열 body → 400', async ({ page }) => {
    // /api/admin/points 엔드포인트 존재 확인 + 잘못된 입력 → 400
    const res = await page.request.post('/api/admin/points', {
      data: {},
      headers: { 'Content-Type': 'application/json' },
    })

    // body 필드 누락 → validation 오류 400
    expect([400, 422]).toContain(res.status())
  })
})
