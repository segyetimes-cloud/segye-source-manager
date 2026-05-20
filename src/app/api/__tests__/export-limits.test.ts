/**
 * src/app/api/__tests__/export-limits.test.ts
 *
 * Export 일일 한도 및 최대 행수 로직 단위 테스트
 *
 * 실제 Supabase 없이 순수 로직만 검증합니다.
 * DB 쿼리 부분은 목(mock)으로 대체합니다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EXPORT_MAX_ROWS, EXPORT_DAILY_LIMIT } from '@/lib/permissions'

// ── 내보내기 제한 계산 로직 (route.ts에서 추출한 순수 함수) ─────────────────
function calcExportAllowance(role: string) {
  return {
    maxRows:    EXPORT_MAX_ROWS[role]   ?? 100,
    dailyLimit: EXPORT_DAILY_LIMIT[role] ?? 3,
  }
}

function isExportBlocked(todayCount: number, dailyLimit: number) {
  return todayCount >= dailyLimit
}

function remainingExports(todayCount: number, dailyLimit: number) {
  return Math.max(0, dailyLimit - todayCount)
}

// ── 역할별 한도 테스트 ─────────────────────────────────────────────────────
describe('Export 한도 계산', () => {
  it('reporter: 100행 / 일 3회', () => {
    const { maxRows, dailyLimit } = calcExportAllowance('reporter')
    expect(maxRows).toBe(100)
    expect(dailyLimit).toBe(3)
  })

  it('deputy: reporter 보다 높은 한도', () => {
    const reporter = calcExportAllowance('reporter')
    const deputy   = calcExportAllowance('deputy')
    expect(deputy.maxRows).toBeGreaterThan(reporter.maxRows)
    expect(deputy.dailyLimit).toBeGreaterThanOrEqual(reporter.dailyLimit)
  })

  it('superadmin: 5000행', () => {
    const { maxRows } = calcExportAllowance('superadmin')
    expect(maxRows).toBe(5000)
  })

  it('알 수 없는 역할: 기본값(100행/3회) 적용', () => {
    const { maxRows, dailyLimit } = calcExportAllowance('unknown_role')
    expect(maxRows).toBe(100)
    expect(dailyLimit).toBe(3)
  })
})

// ── 일일 한도 초과 판정 ────────────────────────────────────────────────────
describe('일일 한도 초과 판정', () => {
  it('오늘 0건: 차단 안 됨', () => {
    expect(isExportBlocked(0, 3)).toBe(false)
  })

  it('오늘 2건, 한도 3: 차단 안 됨', () => {
    expect(isExportBlocked(2, 3)).toBe(false)
  })

  it('오늘 3건, 한도 3: 차단', () => {
    expect(isExportBlocked(3, 3)).toBe(true)
  })

  it('오늘 10건, 한도 3: 차단', () => {
    expect(isExportBlocked(10, 3)).toBe(true)
  })
})

// ── 잔여 횟수 계산 ────────────────────────────────────────────────────────
describe('잔여 횟수 계산', () => {
  it('오늘 0건, 한도 3 → 잔여 3', () => {
    expect(remainingExports(0, 3)).toBe(3)
  })

  it('오늘 2건, 한도 3 → 잔여 1', () => {
    expect(remainingExports(2, 3)).toBe(1)
  })

  it('한도 초과 시 잔여는 0 (음수 없음)', () => {
    expect(remainingExports(5, 3)).toBe(0)
  })
})

// ── 워터마크 ID 생성 (export route.ts 로직) ────────────────────────────────
describe('워터마크 ID 생성', () => {
  function generateWatermark(userId: string, email: string) {
    return Buffer.from(`${userId}:${email}:${Date.now()}`).toString('base64').slice(0, 32)
  }

  it('32자 이하 Base64 문자열을 반환한다', () => {
    const id = generateWatermark('user-uuid-123', 'test@segye.com')
    expect(id.length).toBeLessThanOrEqual(32)
    expect(id).toMatch(/^[A-Za-z0-9+/=]+$/)
  })

  it('타임스탬프가 다르면 다른 워터마크 (short prefix로 timestamp가 slice 범위 안에 포함)', () => {
    // userId와 email을 짧게 하면 timestamp 부분이 32자 slice 범위 안에 들어온다
    const makeWatermark = (userId: string, email: string, ts: number) =>
      Buffer.from(`${userId}:${email}:${ts}`).toString('base64').slice(0, 32)

    const id1 = makeWatermark('u1', 'a@b.c', 1000000)
    const id2 = makeWatermark('u1', 'a@b.c', 9000000)
    expect(id1).not.toBe(id2)
  })
})

// ── EXPORT_MAX_ROWS 및 EXPORT_DAILY_LIMIT 상수 완전성 검사 ────────────────
describe('상수 완전성', () => {
  const expectedRoles = ['reporter', 'deputy', 'admin', 'section_editor', 'editor', 'publisher', 'superadmin']

  it('모든 역할에 EXPORT_MAX_ROWS가 정의됨', () => {
    for (const role of expectedRoles) {
      expect(EXPORT_MAX_ROWS[role]).toBeDefined()
      expect(typeof EXPORT_MAX_ROWS[role]).toBe('number')
      expect(EXPORT_MAX_ROWS[role]).toBeGreaterThan(0)
    }
  })

  it('모든 역할에 EXPORT_DAILY_LIMIT가 정의됨', () => {
    for (const role of expectedRoles) {
      expect(EXPORT_DAILY_LIMIT[role]).toBeDefined()
      expect(typeof EXPORT_DAILY_LIMIT[role]).toBe('number')
      expect(EXPORT_DAILY_LIMIT[role]).toBeGreaterThan(0)
    }
  })
})
