/**
 * e2e/auth.setup.ts
 *
 * 테스트 전 로그인 상태 저장 (storageState)
 * 이 파일이 먼저 실행되어 각 역할의 인증 쿠키를 파일로 저장합니다.
 *
 * 실행: npx playwright test --project=setup
 */

import { test as setup, expect } from '@playwright/test'
import path from 'path'

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

async function loginAs(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
  saveAs: string,
) {
  await page.goto(`${BASE_URL}/login`)
  await page.waitForLoadState('networkidle')

  // 이메일 입력
  await page.getByLabel(/이메일/i).fill(email)
  await page.getByLabel(/비밀번호/i).fill(password)
  await page.getByRole('button', { name: /로그인/i }).click()

  // OTP 페이지 처리 (개발 환경에서는 DISABLE_OTP_CHECK=true 로 우회)
  // OTP 페이지가 뜨면 개발용 고정 OTP 입력
  try {
    await page.waitForURL('**/otp**', { timeout: 3000 })
    const otpInput = page.getByPlaceholder(/OTP|인증코드/i)
    if (await otpInput.isVisible()) {
      // 테스트 환경 OTP (실제 운영에서는 이메일로 발송됨)
      await otpInput.fill(process.env.E2E_OTP_CODE ?? '000000')
      await page.getByRole('button', { name: /인증|확인/i }).click()
    }
  } catch {
    // OTP 페이지 없으면 통과
  }

  // 대시보드 도달 확인
  await page.waitForURL('**/dashboard**', { timeout: 10_000 })
  await expect(page).toHaveURL(/dashboard/)

  // 인증 상태 저장
  await page.context().storageState({ path: saveAs })
  console.log(`✅ 로그인 상태 저장: ${saveAs}`)
}

setup('reporter 로그인 상태 저장', async ({ page }) => {
  const email    = process.env.E2E_REPORTER_EMAIL    ?? 'reporter@segye.com'
  const password = process.env.E2E_REPORTER_PASSWORD ?? 'test1234!'
  const savePath = path.join('e2e', '.auth', 'reporter.json')
  await loginAs(page, email, password, savePath)
})

setup('admin 로그인 상태 저장', async ({ page }) => {
  const email    = process.env.E2E_ADMIN_EMAIL    ?? 'admin@segye.com'
  const password = process.env.E2E_ADMIN_PASSWORD ?? 'test1234!'
  const savePath = path.join('e2e', '.auth', 'admin.json')
  await loginAs(page, email, password, savePath)
})
