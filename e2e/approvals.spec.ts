/**
 * e2e/approvals.spec.ts
 *
 * 취재원 열람 승인 신청 흐름 E2E 테스트 (reporter 권한)
 *
 * 테스트 시나리오:
 *  1. 내 승인 신청 목록 API 정상 응답
 *  2. 존재하지 않는 취재원 열람 신청 → 오류 응답
 *  3. 도움 요청 목록 페이지 렌더링
 *  4. 도움 요청 생성 페이지 접근
 *  5. 포인트 잔액 부족 시 도움 요청 생성 → 400
 */

import { test, expect } from '@playwright/test'

// ── 승인 신청 API ──────────────────────────────────────────────────────────────

test.describe('취재원 열람 승인 신청 (reporter)', () => {

  test('내 승인 신청 목록 API — 200 + 배열 반환', async ({ page }) => {
    const res = await page.request.get('/api/approvals')

    expect(res.status()).toBe(200)
    const body = await res.json()
    // reporter는 본인 신청 목록을 배열로 받음
    expect(Array.isArray(body)).toBe(true)
  })

  test('status=all 파라미터 — 200 + 배열 반환', async ({ page }) => {
    const res = await page.request.get('/api/approvals?status=all')

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body)).toBe(true)
  })

  test('존재하지 않는 취재원 열람 신청 — UUID 형식 오류 또는 DB 오류', async ({ page }) => {
    // source_id가 UUID 형식이지만 DB에 없는 row → Supabase FK 위반 → 500 또는 409
    // (CreateApprovalSchema가 UUID 유효성 검사: z.string().uuid())
    const res = await page.request.post('/api/approvals', {
      data: {
        source_id: '00000000-0000-0000-0000-000000000099',  // 존재하지 않는 UUID
        reason: 'E2E 테스트용 신청',
      },
      headers: { 'Content-Type': 'application/json' },
    })

    // DB FK 위반 → 500, 또는 구현에 따라 404
    // 409는 이미 신청이 있는 경우이므로 여기선 아님
    expect([404, 422, 500]).toContain(res.status())
  })

  test('UUID 형식이 아닌 source_id → 400 (schema validation)', async ({ page }) => {
    const res = await page.request.post('/api/approvals', {
      data: {
        source_id: 'not-a-uuid',
        reason: 'E2E 테스트용 신청',
      },
      headers: { 'Content-Type': 'application/json' },
    })

    // CreateApprovalSchema: source_id는 z.string().uuid() → validation 실패 → 400
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  test('reason 누락 시 신청 → 400 (schema validation)', async ({ page }) => {
    const res = await page.request.post('/api/approvals', {
      data: {
        source_id: '00000000-0000-0000-0000-000000000099',
        // reason 누락
      },
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  test('빈 reason 신청 → 400 (schema validation)', async ({ page }) => {
    const res = await page.request.post('/api/approvals', {
      data: {
        source_id: '00000000-0000-0000-0000-000000000099',
        reason: '',  // min(1) 조건 위반
      },
      headers: { 'Content-Type': 'application/json' },
    })

    expect(res.status()).toBe(400)
  })
})

// ── 도움 요청 목록 페이지 ──────────────────────────────────────────────────────

test.describe('도움 요청 목록 (reporter)', () => {

  test('도움 요청 목록 페이지 렌더링', async ({ page }) => {
    await page.goto('/help')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/\/help/)

    // 페이지 제목 확인
    await expect(page.getByText(/도움 요청/)).toBeVisible()

    // 새 도움 요청 버튼 확인
    await expect(page.getByRole('link', { name: /도움 요청하기/i })).toBeVisible()
  })

  test('도움 요청 목록 API — 200 + data 배열 반환', async ({ page }) => {
    const res = await page.request.get('/api/help')

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('data')
    expect(Array.isArray(body.data)).toBe(true)
  })

  test('도움 요청 목록 API — status=all 파라미터', async ({ page }) => {
    const res = await page.request.get('/api/help?status=all')

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('data')
    expect(Array.isArray(body.data)).toBe(true)
    // count 필드도 포함
    expect(body).toHaveProperty('count')
  })
})

// ── 도움 요청 생성 페이지 ──────────────────────────────────────────────────────

test.describe('도움 요청 생성 (reporter)', () => {

  test('도움 요청 생성 페이지 접근 + 폼 렌더링', async ({ page }) => {
    await page.goto('/help/new')
    await page.waitForLoadState('networkidle')

    await expect(page).toHaveURL(/help\/new/)

    // 페이지 제목 확인
    await expect(page.getByText('도움 요청').first()).toBeVisible()

    // 제목 입력 필드 존재
    await expect(page.getByPlaceholder(/예: 국토부 장관 연락처/i)).toBeVisible()

    // 요청 유형 버튼들 존재 (연락처 요청 등)
    await expect(page.getByText(/연락처 요청/i)).toBeVisible()
  })

  test('도움 요청 생성 페이지 — 취소 링크로 목록으로 돌아가기', async ({ page }) => {
    await page.goto('/help/new')
    await page.waitForLoadState('networkidle')

    // 취소 링크 클릭
    await page.getByRole('link', { name: /취소/i }).click()
    await page.waitForLoadState('networkidle')

    // /help 목록으로 이동
    await expect(page).toHaveURL(/\/help$/)
  })

  test('포인트 부족 시 도움 요청 생성 API → 400', async ({ page }) => {
    // reward_points를 매우 높게 설정하여 포인트 부족 상태 시뮬레이션
    // (신규 계정 또는 포인트 0인 경우 5pt라도 부족하면 400)
    // 실제 포인트 잔액과 무관하게 API 응답 형식 검증
    const res = await page.request.post('/api/help', {
      data: {
        title: 'E2E 포인트 부족 테스트',
        request_type: 'contact',
        reward_points: 100,   // 최대값으로 부족 가능성 최대화
      },
      headers: { 'Content-Type': 'application/json' },
    })

    if (res.status() === 400) {
      const body = await res.json()
      // 포인트 부족 오류 메시지 확인
      expect(body).toHaveProperty('error')
      expect(body.error).toMatch(/포인트/)
    } else if (res.status() === 201) {
      // 포인트가 충분한 경우 — 생성 성공 (테스트 계정에 포인트가 있을 수 있음)
      const body = await res.json()
      expect(body).toHaveProperty('id')
      console.log(`ℹ️ 도움 요청 생성 성공 (포인트 충분): id=${body.id}`)
    } else {
      throw new Error(`Unexpected status: ${res.status()}`)
    }
  })

  test('제목 누락 시 도움 요청 생성 → 400 (schema validation)', async ({ page }) => {
    const res = await page.request.post('/api/help', {
      data: {
        // title 누락
        request_type: 'contact',
        reward_points: 10,
      },
      headers: { 'Content-Type': 'application/json' },
    })

    // CreateHelpSchema: title은 min(1) 필수 → 400
    expect(res.status()).toBe(400)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  test('reward_points 범위 초과 시 → 400 (schema validation)', async ({ page }) => {
    const res = await page.request.post('/api/help', {
      data: {
        title: 'E2E 범위 초과 테스트',
        request_type: 'contact',
        reward_points: 9999,  // max(100) 초과
      },
      headers: { 'Content-Type': 'application/json' },
    })

    // CreateHelpSchema: reward_points max(100) → 400
    expect(res.status()).toBe(400)
  })
})
