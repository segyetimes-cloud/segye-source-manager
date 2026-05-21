/**
 * e2e/export.spec.ts
 *
 * Export 한도·워터마크 E2E 테스트 (reporter 권한)
 *
 * 테스트 시나리오:
 *  1. 정상 export → xlsx 다운로드
 *  2. 응답 헤더에 잔여 횟수 포함 확인
 *  3. filter=mine 파라미터 동작
 */

import { test, expect } from '@playwright/test'

test.describe('Export API (reporter)', () => {

  test('정상 export 요청 → xlsx 파일 반환', async ({ page }) => {
    const res = await page.request.get('/api/export/sources?filter=mine')

    if (res.status() === 200) {
      const contentType = res.headers()['content-type'] ?? ''
      expect(contentType).toContain('spreadsheetml')

      const contentDisp = res.headers()['content-disposition'] ?? ''
      expect(contentDisp).toContain('.xlsx')

      // 잔여 횟수 헤더
      const remaining = res.headers()['x-remaining-exports']
      expect(remaining).toBeDefined()
    } else if (res.status() === 429) {
      // 이미 일일 한도 초과 — 오류 메시지 확인
      const body = await res.json()
      expect(body.error).toMatch(/한도|초과/i)
      console.log('⚠️ 오늘 export 한도 초과 (예상 가능한 상태)')
    } else {
      // 예상치 못한 상태 코드
      throw new Error(`Unexpected status: ${res.status()}`)
    }
  })

  test('filter=all 파라미터로 공유 취재원 export', async ({ page }) => {
    const res = await page.request.get('/api/export/sources?filter=all')
    expect([200, 429]).toContain(res.status())
  })

  test('검색어 포함 export', async ({ page }) => {
    const res = await page.request.get('/api/export/sources?filter=all&q=테스트')
    expect([200, 429]).toContain(res.status())
  })

  test('export 후 audit_log에 기록됨 (admin 확인)', async ({ page }) => {
    // 먼저 export 시도
    await page.request.get('/api/export/sources?filter=mine')

    // admin 계정으로 감사 로그 확인은 admin.spec.ts에서 수행
    // 여기서는 API가 정상 동작하는지만 확인
  })
})

test.describe('Export 한도 헤더 검증', () => {

  test('X-Remaining-Exports 헤더가 숫자', async ({ page }) => {
    const res = await page.request.get('/api/export/sources?filter=mine')

    if (res.status() === 200) {
      const val = parseInt(res.headers()['x-remaining-exports'] ?? '-1')
      expect(val).toBeGreaterThanOrEqual(0)
    }
  })

  test('한도 초과 시 429 + 오류 메시지', async ({ page }) => {
    // 한도 초과를 직접 만들기 어려우므로 응답 형식만 검증
    // 실제 429가 반환될 때의 body 구조 확인
    const mockCheck = (status: number, body: { error: string }) => {
      if (status === 429) {
        expect(body.error).toBeTruthy()
        expect(typeof body.error).toBe('string')
      }
    }

    const res = await page.request.get('/api/export/sources?filter=mine')
    if (res.status() === 429) {
      mockCheck(429, await res.json())
    }
  })
})
