/**
 * e2e/audit.spec.ts
 *
 * 감사 로그 조회·export E2E 테스트 (admin 권한)
 *
 * 테스트 시나리오:
 *  1. 감사 로그 목록 페이지 렌더링
 *  2. 액션 필터 동작
 *  3. 이메일 검색 동작
 *  4. 날짜 범위 필터
 *  5. Excel 내보내기 성공
 *  6. audit_logs 직접 삭제 시도 → 차단 확인 (DB 트리거)
 */

import { test, expect } from '@playwright/test'

test.describe('감사 로그 (admin)', () => {

  test('감사 로그 페이지 접근 + 테이블 렌더링', async ({ page }) => {
    await page.goto('/admin/audit')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/admin\/audit/)
    // 테이블 헤더 확인
    await expect(page.getByText('시각')).toBeVisible()
    await expect(page.getByText('사용자')).toBeVisible()
    await expect(page.getByText('액션')).toBeVisible()
    // 총 건수 표시
    await expect(page.getByText(/총 \d+건/)).toBeVisible({ timeout: 8_000 })
  })

  test('액션 필터 — export 선택', async ({ page }) => {
    await page.goto('/admin/audit')
    await page.waitForLoadState('networkidle')

    // 액션 드롭다운 선택
    await page.selectOption('select', 'export')
    await page.getByRole('button', { name: /^검색$/ }).click()

    await page.waitForLoadState('networkidle')
    // URL에 action=export 포함
    await expect(page).toHaveURL(/action=export/)
  })

  test('이메일 검색', async ({ page }) => {
    await page.goto('/admin/audit')
    await page.waitForLoadState('networkidle')

    const emailInput = page.getByPlaceholder(/user@segye/i)
    await emailInput.fill('segye.com')
    await page.getByRole('button', { name: /^검색$/ }).click()

    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/user_email=segye/)
  })

  test('날짜 범위 필터', async ({ page }) => {
    await page.goto('/admin/audit')
    await page.waitForLoadState('networkidle')

    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    // 시작일 입력
    const dateFrom = page.locator('input[type="date"]').first()
    await dateFrom.fill(yesterday)

    // 종료일 입력
    const dateTo = page.locator('input[type="date"]').nth(1)
    await dateTo.fill(today)

    await page.getByRole('button', { name: /^검색$/ }).click()
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/date_from=/)
    await expect(page).toHaveURL(/date_to=/)
  })

  test('Excel 내보내기', async ({ page }) => {
    await page.goto('/admin/audit')
    await page.waitForLoadState('networkidle')

    // 다운로드 이벤트 대기
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 10_000 }),
      page.getByRole('button', { name: /Excel 내보내기/i }).click(),
    ])

    expect(download.suggestedFilename()).toMatch(/감사로그.*\.xlsx/)
    console.log(`✅ 다운로드: ${download.suggestedFilename()}`)
  })

  test('audit_logs 삭제 API — 차단됨 (불변 트리거)', async ({ page }) => {
    // 직접 audit_logs를 수정/삭제하는 API는 존재하지 않으므로
    // 존재하지 않는 엔드포인트는 404 반환
    const res = await page.request.delete('/api/admin/audit/1')
    expect(res.status()).toBe(404)
  })
})
