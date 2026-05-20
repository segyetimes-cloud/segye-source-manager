/**
 * src/lib/__tests__/permissions.test.ts
 *
 * 권한 매트릭스(lib/permissions.ts) 단위 테스트
 *
 * 검증 범위:
 *  - can() 함수의 역할별 반환값
 *  - EXPORT_MAX_ROWS / EXPORT_DAILY_LIMIT 상수 정합성
 *  - 역할 계층: reporter < deputy < admin < section_editor < editor < publisher < superadmin
 */

import { describe, it, expect } from 'vitest'
import {
  can,
  EXPORT_MAX_ROWS,
  EXPORT_DAILY_LIMIT,
  CAN_VIEW_SENSITIVE_SOURCE,
  CAN_VIEW_PERSONAL_NOTES,
  CAN_EDIT_ANY_SOURCE,
  CAN_DELETE_SOURCE,
  CAN_VIEW_AUDIT_LOGS,
  CAN_EXPORT,
  CAN_MANAGE_USERS,
  CAN_APPROVE_ACCESS,
} from '../permissions'

// ── 역할 목록 ────────────────────────────────────────────────────────────────
const ROLES = ['reporter', 'deputy', 'admin', 'section_editor', 'editor', 'publisher', 'superadmin'] as const
type Role = typeof ROLES[number]

// ── 민감정보 열람(CAN_VIEW_SENSITIVE_SOURCE): admin 이상 ─────────────────────
describe('CAN_VIEW_SENSITIVE_SOURCE', () => {
  const NOT_ALLOWED: Role[] = ['reporter', 'deputy']
  const ALLOWED: Role[]     = ['admin', 'section_editor', 'editor', 'publisher', 'superadmin']

  it.each(NOT_ALLOWED)('%s 는 민감 취재원을 열람할 수 없다', role => {
    expect(can(role, CAN_VIEW_SENSITIVE_SOURCE)).toBe(false)
  })
  it.each(ALLOWED)('%s 는 민감 취재원을 열람할 수 있다', role => {
    expect(can(role, CAN_VIEW_SENSITIVE_SOURCE)).toBe(true)
  })
})

// ── personal_notes 열람(CAN_VIEW_PERSONAL_NOTES): deputy 이상 ───────────────
describe('CAN_VIEW_PERSONAL_NOTES', () => {
  it('reporter 는 personal_notes를 열람할 수 없다', () => {
    expect(can('reporter', CAN_VIEW_PERSONAL_NOTES)).toBe(false)
  })
  it.each(['deputy', 'admin', 'section_editor', 'editor', 'publisher', 'superadmin'] as Role[])(
    '%s 는 personal_notes를 열람할 수 있다', role => {
      expect(can(role, CAN_VIEW_PERSONAL_NOTES)).toBe(true)
    }
  )
})

// ── 타인 취재원 수정(CAN_EDIT_ANY_SOURCE): admin 이상 ───────────────────────
describe('CAN_EDIT_ANY_SOURCE', () => {
  const NOT_ALLOWED: Role[] = ['reporter', 'deputy']
  const ALLOWED: Role[]     = ['admin', 'section_editor', 'editor', 'publisher', 'superadmin']

  it.each(NOT_ALLOWED)('%s 는 타인 취재원을 수정할 수 없다', role => {
    expect(can(role, CAN_EDIT_ANY_SOURCE)).toBe(false)
  })
  it.each(ALLOWED)('%s 는 타인 취재원을 수정할 수 있다', role => {
    expect(can(role, CAN_EDIT_ANY_SOURCE)).toBe(true)
  })
})

// ── 취재원 삭제(CAN_DELETE_SOURCE) ──────────────────────────────────────────
describe('CAN_DELETE_SOURCE', () => {
  it('reporter 는 삭제 권한이 없다', () => {
    expect(can('reporter', CAN_DELETE_SOURCE)).toBe(false)
  })
  it('superadmin 은 삭제 권한이 있다', () => {
    expect(can('superadmin', CAN_DELETE_SOURCE)).toBe(true)
  })
})

// ── 감사 로그 조회(CAN_VIEW_AUDIT_LOGS): admin 이상 ─────────────────────────
describe('CAN_VIEW_AUDIT_LOGS', () => {
  const NOT_ALLOWED: Role[] = ['reporter', 'deputy']
  const ALLOWED: Role[]     = ['admin', 'section_editor', 'editor', 'publisher', 'superadmin']

  it.each(NOT_ALLOWED)('%s 는 감사 로그를 볼 수 없다', role => {
    expect(can(role, CAN_VIEW_AUDIT_LOGS)).toBe(false)
  })
  it.each(ALLOWED)('%s 는 감사 로그를 볼 수 있다', role => {
    expect(can(role, CAN_VIEW_AUDIT_LOGS)).toBe(true)
  })
})

// ── Export(CAN_EXPORT): 모든 역할 가능, 한도만 다름 ─────────────────────────
describe('CAN_EXPORT', () => {
  it.each(ROLES)('%s 는 export 권한을 가진다', role => {
    expect(can(role, CAN_EXPORT)).toBe(true)
  })
})

// ── 사용자 관리(CAN_MANAGE_USERS): superadmin 전용 ──────────────────────────
describe('CAN_MANAGE_USERS', () => {
  const NOT_ALLOWED: Role[] = ['reporter', 'deputy', 'admin', 'section_editor', 'editor', 'publisher']

  it.each(NOT_ALLOWED)('%s 는 사용자 관리 권한이 없다', role => {
    expect(can(role, CAN_MANAGE_USERS)).toBe(false)
  })
  it('superadmin 은 사용자 관리 권한이 있다', () => {
    expect(can('superadmin', CAN_MANAGE_USERS)).toBe(true)
  })
})

// ── 승인 권한(CAN_APPROVE_ACCESS): admin 이상 ───────────────────────────────
describe('CAN_APPROVE_ACCESS', () => {
  it.each(['reporter', 'deputy'] as Role[])('%s 는 승인 권한이 없다', role => {
    expect(can(role, CAN_APPROVE_ACCESS)).toBe(false)
  })
  it.each(['admin', 'section_editor', 'editor', 'publisher', 'superadmin'] as Role[])(
    '%s 는 승인 권한이 있다', role => {
      expect(can(role, CAN_APPROVE_ACCESS)).toBe(true)
    }
  )
})

// ── 엣지 케이스 ──────────────────────────────────────────────────────────────
describe('can() 엣지 케이스', () => {
  it('undefined 역할은 모든 권한이 false', () => {
    expect(can(undefined, CAN_VIEW_SENSITIVE_SOURCE)).toBe(false)
    expect(can(undefined, CAN_MANAGE_USERS)).toBe(false)
  })
  it('null 역할은 모든 권한이 false', () => {
    expect(can(null as any, CAN_EDIT_ANY_SOURCE)).toBe(false)
  })
  it('알 수 없는 역할은 모든 권한이 false', () => {
    expect(can('unknown_role', CAN_VIEW_SENSITIVE_SOURCE)).toBe(false)
  })
})

// ── EXPORT_MAX_ROWS 정합성 ────────────────────────────────────────────────────
describe('EXPORT_MAX_ROWS', () => {
  it('역할이 많을수록 최대 행수가 크거나 같다', () => {
    expect(EXPORT_MAX_ROWS['reporter'])      .toBeLessThanOrEqual(EXPORT_MAX_ROWS['deputy'])
    expect(EXPORT_MAX_ROWS['deputy'])        .toBeLessThanOrEqual(EXPORT_MAX_ROWS['admin'])
    expect(EXPORT_MAX_ROWS['admin'])         .toBeLessThanOrEqual(EXPORT_MAX_ROWS['section_editor'])
    expect(EXPORT_MAX_ROWS['section_editor']).toBeLessThanOrEqual(EXPORT_MAX_ROWS['editor'])
    expect(EXPORT_MAX_ROWS['editor'])        .toBeLessThanOrEqual(EXPORT_MAX_ROWS['publisher'])
    expect(EXPORT_MAX_ROWS['publisher'])     .toBeLessThanOrEqual(EXPORT_MAX_ROWS['superadmin'])
  })
  it('reporter 최대 export는 100행 이상', () => {
    expect(EXPORT_MAX_ROWS['reporter']).toBeGreaterThanOrEqual(100)
  })
  it('superadmin 최대 export는 1000행 이상', () => {
    expect(EXPORT_MAX_ROWS['superadmin']).toBeGreaterThanOrEqual(1000)
  })
})

// ── EXPORT_DAILY_LIMIT 정합성 ─────────────────────────────────────────────────
describe('EXPORT_DAILY_LIMIT', () => {
  it('reporter 일일 한도는 1 이상 10 이하', () => {
    expect(EXPORT_DAILY_LIMIT['reporter']).toBeGreaterThanOrEqual(1)
    expect(EXPORT_DAILY_LIMIT['reporter']).toBeLessThanOrEqual(10)
  })
  it('superadmin 일일 한도는 reporter보다 크다', () => {
    expect(EXPORT_DAILY_LIMIT['superadmin']).toBeGreaterThan(EXPORT_DAILY_LIMIT['reporter'])
  })
  it('모든 정의된 역할에 한도가 존재한다', () => {
    for (const role of ROLES) {
      expect(EXPORT_DAILY_LIMIT[role]).toBeDefined()
      expect(EXPORT_DAILY_LIMIT[role]).toBeGreaterThan(0)
    }
  })
})
