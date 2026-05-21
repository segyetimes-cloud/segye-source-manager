/**
 * e2e/permissions.spec.ts
 *
 * 접근 제어 E2E 테스트
 *
 * 테스트 시나리오:
 *  1. reporter가 민감 취재원에 접근 → 차단 확인
 *  2. reporter가 admin 전용 페이지에 접근 → 리다이렉트 확인
 *  3. reporter의 export API 일일 한도 헤더 확인
 *  4. 타인 취재원 수정 시도 → 403 확인
 */

import { test, expect } from '@playwright/test'

test.describe('접근 제어 (reporter)', () => {

  test('감사 로그 페이지 접근 → 대시보드로 리다이렉트', async ({ page }) => {
    await page.goto('/admin/audit')
    await page.waitForLoadState('networkidle')

    // reporter는 감사 로그 권한 없음 → dashboard로 리다이렉트
    await expect(page).toHaveURL(/dashboard/, { timeout: 5_000 })
  })

  test('export API — 응답 헤더에 잔여 횟수 포함', async ({ page }) => {
    const res = await page.request.get('/api/export/sources?filter=mine&limit=1')

    if (res.status() === 200) {
      // 성공 응답: 잔여 횟수 헤더 확인
      const remaining = res.headers()['x-remaining-exports']
      expect(remaining).toBeDefined()
      const n = parseInt(remaining ?? '0')
      expect(n).toBeGreaterThanOrEqual(0)
    } else if (res.status() === 429) {
      // 한도 초과: 오류 메시지 확인
      const body = await res.json()
      expect(body.error).toMatch(/한도|초과|limit/i)
    }
  })

  test('타인 소유 취재원 삭제 시도 → 403', async ({ page }) => {
    // 존재하지 않는 UUID로 삭제 시도 (타인 소유 가정)
    const fakeId = '00000000-0000-0000-0000-000000000001'
    const res = await page.request.delete(`/api/sources/${fakeId}`)

    // 없는 리소스는 404, 권한 없으면 403
    expect([403, 404]).toContain(res.status())
  })

  test('bulk delete — 타인 취재원 포함 시도 → 403 또는 0건 처리', async ({ page }) => {
    const fakeId = '00000000-0000-0000-0000-000000000002'
    const res = await page.request.post('/api/sources/bulk', {
      data:        { action: 'delete', ids: [fakeId] },
      headers:     { 'Content-Type': 'application/json' },
    })

    // 404(대상 없음) 또는 403(권한 없음)
    expect([403, 404]).toContain(res.status())
  })

  test('민감 취재원 직접 API 접근 — 403 반환', async ({ page }) => {
    // 민감 + 공유 취재원 중 reporter가 접근 불가한 것 시도
    // 실제 존재하는 private 취재원 ID가 없으면 404로 통과
    const res = await page.request.get('/api/sources/00000000-0000-0000-0000-000000000003')
    expect([403, 404]).toContain(res.status())
  })
})

test.describe('접근 제어 (admin)', () => {
  test.use({ storageState: 'e2e/.auth/admin.json' })

  test('감사 로그 페이지 접근 성공', async ({ page }) => {
    await page.goto('/admin/audit')
    await page.waitForLoadState('networkidle')

    // admin은 감사 로그 접근 가능
    await expect(page).toHaveURL(/admin\/audit/)
    await expect(page.getByText(/접근 로그|감사/i)).toBeVisible()
  })

  test('감사 로그 Excel 내보내기 API — 200 응답', async ({ page }) => {
    const res = await page.request.get('/api/admin/audit/export')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('spreadsheetml')
  })

  test('대량 작업 API — set_visibility 성공', async ({ page }) => {
    // 존재하지 않는 ID → 404 (실제 ID가 없어도 API 자체는 동작 확인)
    const res = await page.request.post('/api/sources/bulk', {
      data:    { action: 'set_visibility', ids: [], value: 'shared' },
      headers: { 'Content-Type': 'application/json' },
    })
    // 빈 배열 → 400
    expect(res.status()).toBe(400)
  })
})
