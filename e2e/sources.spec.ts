/**
 * e2e/sources.spec.ts
 *
 * 취재원 CRUD 흐름 E2E 테스트 (reporter 권한)
 *
 * 테스트 시나리오:
 *  1. 취재원 목록 페이지 진입
 *  2. 신규 취재원 등록
 *  3. 등록된 취재원 상세 확인
 *  4. 취재원 수정
 *  5. 검색 필터 동작
 *  6. 즐겨찾기 토글
 */

import { test, expect } from '@playwright/test'

const TEST_SOURCE = {
  full_name:            '홍길동E2E',
  current_organization: 'E2E테스트기관',
  current_position:     '테스트기자',
  phone_primary:        '010-9999-0000',
}

test.describe('취재원 CRUD (reporter)', () => {
  let createdSourceId = ''

  test('목록 페이지 로드', async ({ page }) => {
    await page.goto('/sources')
    await page.waitForLoadState('networkidle')

    // 검색 입력창 존재
    await expect(page.getByPlaceholder(/검색/i)).toBeVisible()
    // 등록 버튼 존재
    await expect(page.getByRole('link', { name: /등록/i })).toBeVisible()
  })

  test('취재원 신규 등록', async ({ page }) => {
    await page.goto('/sources/new')
    await page.waitForLoadState('networkidle')

    // 이름 입력
    await page.getByLabel(/이름|성명/i).fill(TEST_SOURCE.full_name)
    // 소속 입력
    const orgInput = page.getByLabel(/소속|기관/i).first()
    if (await orgInput.isVisible()) await orgInput.fill(TEST_SOURCE.current_organization)

    // 직책
    const posInput = page.getByLabel(/직책/i).first()
    if (await posInput.isVisible()) await posInput.fill(TEST_SOURCE.current_position)

    // 저장
    await page.getByRole('button', { name: /저장|등록/i }).click()

    // 등록 후 상세 페이지로 이동
    await page.waitForURL('/sources/**')
    createdSourceId = page.url().split('/sources/')[1]?.split('?')[0] ?? ''

    await expect(page.getByText(TEST_SOURCE.full_name)).toBeVisible()
    console.log(`✅ 등록된 취재원 ID: ${createdSourceId}`)
  })

  test('즐겨찾기 토글', async ({ page }) => {
    if (!createdSourceId) test.skip()

    await page.goto(`/sources/${createdSourceId}`)
    await page.waitForLoadState('networkidle')

    const bookmarkBtn = page.getByRole('button', { name: /즐겨찾기/i })
    await expect(bookmarkBtn).toBeVisible()

    // 추가
    await bookmarkBtn.click()
    await expect(bookmarkBtn).toContainText('★')

    // 해제
    await bookmarkBtn.click()
    await expect(bookmarkBtn).toContainText('☆')
  })

  test('취재원 검색', async ({ page }) => {
    await page.goto('/sources')
    await page.waitForLoadState('networkidle')

    const input = page.getByPlaceholder(/검색/i)
    await input.fill('홍길동E2E')
    await page.getByRole('button', { name: /^검색$/ }).click()

    await page.waitForLoadState('networkidle')
    // 검색 결과에 등록한 취재원이 있어야 함
    await expect(page.getByText('홍길동E2E')).toBeVisible({ timeout: 8_000 })
  })

  test('취재원 수정', async ({ page }) => {
    if (!createdSourceId) test.skip()

    await page.goto(`/sources/${createdSourceId}/edit`)
    await page.waitForLoadState('networkidle')

    // 직책 변경
    const posInput = page.getByLabel(/직책/i).first()
    if (await posInput.isVisible()) {
      await posInput.clear()
      await posInput.fill('수정된직책')
    }

    await page.getByRole('button', { name: /저장|수정/i }).click()

    // 변경 내용 확인
    await page.waitForURL(`/sources/${createdSourceId}`)
    await expect(page.getByText('수정된직책')).toBeVisible({ timeout: 5_000 })
  })

  test('등록 취재원 정리 (소프트 딜리트)', async ({ page }) => {
    if (!createdSourceId) test.skip()

    const res = await page.request.delete(`/api/sources/${createdSourceId}`)
    expect(res.status()).toBe(200)
  })
})
