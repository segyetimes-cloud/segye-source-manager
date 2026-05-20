/**
 * src/lib/__tests__/rls-policy.test.ts
 *
 * RLS 정책 및 민감정보 마스킹 로직 단위 테스트
 *
 * 실제 DB 없이 애플리케이션 레이어의 접근 제어 로직을 검증합니다.
 * (DB 레이어의 RLS는 Supabase Dashboard > SQL Editor에서 별도 확인)
 *
 * 검증 범위:
 *  - 공개 취재원 접근 (모든 인증 사용자)
 *  - 개인(personal) 취재원 접근 제한
 *  - 공유+민감(shared+private) 접근 제한
 *  - personal_notes 마스킹 로직
 */

import { describe, it, expect } from 'vitest'
import { can, CAN_VIEW_SENSITIVE_SOURCE, CAN_VIEW_PERSONAL_NOTES, CAN_EDIT_ANY_SOURCE } from '../permissions'

// ── 테스트용 Source 타입 ──────────────────────────────────────────────────
interface MockSource {
  id: string
  owner_id: string
  visibility: 'shared' | 'personal'
  sensitivity: 'public' | 'private'
  personal_notes: string | null
}

// ── 취재원 접근 권한 판정 (sources/[id]/route.ts GET 로직 재현) ────────────
function canAccessSource(
  source: MockSource,
  userId: string,
  userRole: string,
): { allowed: boolean; reason?: string } {
  const isOwner        = source.owner_id === userId
  const isAdminOrAbove = can(userRole, CAN_VIEW_SENSITIVE_SOURCE)

  // personal 취재원: 소유자 또는 admin+ 만
  if (source.visibility === 'personal' && !isOwner && !isAdminOrAbove) {
    return { allowed: false, reason: 'personal source — owner or admin+ only' }
  }

  // shared + private: 소유자 또는 admin+ 만
  if (source.visibility === 'shared' && source.sensitivity === 'private' && !isOwner && !isAdminOrAbove) {
    return { allowed: false, reason: 'sensitive source — admin+ only' }
  }

  return { allowed: true }
}

// ── personal_notes 마스킹 판정 ────────────────────────────────────────────
function resolvePersonalNotes(
  source: MockSource,
  userId: string,
  userRole: string,
  hasApproval: boolean,
): string | null {
  const isOwner       = source.owner_id === userId
  const isDeputyAbove = can(userRole, CAN_VIEW_PERSONAL_NOTES)
  const canSee        = isOwner || isDeputyAbove || hasApproval
  return canSee ? source.personal_notes : null
}

// ── 픽스처 ─────────────────────────────────────────────────────────────────
const OWNER_ID    = 'owner-uuid'
const OTHER_USER  = 'other-uuid'
const ADMIN_USER  = 'admin-uuid'

const sharedPublicSource: MockSource = {
  id: 'src-1', owner_id: OWNER_ID,
  visibility: 'shared', sensitivity: 'public',
  personal_notes: '비공개 메모',
}

const sharedPrivateSource: MockSource = {
  id: 'src-2', owner_id: OWNER_ID,
  visibility: 'shared', sensitivity: 'private',
  personal_notes: '극비 메모',
}

const personalSource: MockSource = {
  id: 'src-3', owner_id: OWNER_ID,
  visibility: 'personal', sensitivity: 'public',
  personal_notes: null,
}

// ── 접근 권한 테스트 ──────────────────────────────────────────────────────
describe('canAccessSource', () => {
  // 공개 취재원
  it('공유+공개 취재원은 기자도 접근 가능', () => {
    expect(canAccessSource(sharedPublicSource, OTHER_USER, 'reporter').allowed).toBe(true)
  })

  // 민감 취재원
  it('공유+민감 취재원: 기자 접근 불가', () => {
    const result = canAccessSource(sharedPrivateSource, OTHER_USER, 'reporter')
    expect(result.allowed).toBe(false)
  })

  it('공유+민감 취재원: 소유자 접근 가능', () => {
    expect(canAccessSource(sharedPrivateSource, OWNER_ID, 'reporter').allowed).toBe(true)
  })

  it('공유+민감 취재원: admin 접근 가능', () => {
    expect(canAccessSource(sharedPrivateSource, ADMIN_USER, 'admin').allowed).toBe(true)
  })

  it('공유+민감 취재원: deputy 접근 불가 (admin+ 필요)', () => {
    expect(canAccessSource(sharedPrivateSource, OTHER_USER, 'deputy').allowed).toBe(false)
  })

  // personal 취재원
  it('personal 취재원: 기자 접근 불가', () => {
    expect(canAccessSource(personalSource, OTHER_USER, 'reporter').allowed).toBe(false)
  })

  it('personal 취재원: 소유자 접근 가능', () => {
    expect(canAccessSource(personalSource, OWNER_ID, 'reporter').allowed).toBe(true)
  })

  it('personal 취재원: admin+ 접근 가능', () => {
    expect(canAccessSource(personalSource, ADMIN_USER, 'admin').allowed).toBe(true)
  })

  it('personal 취재원: deputy 접근 불가 (admin+ 필요)', () => {
    expect(canAccessSource(personalSource, OTHER_USER, 'deputy').allowed).toBe(false)
  })
})

// ── personal_notes 마스킹 테스트 ─────────────────────────────────────────
describe('resolvePersonalNotes', () => {
  it('소유자: personal_notes 항상 열람 가능', () => {
    const notes = resolvePersonalNotes(sharedPrivateSource, OWNER_ID, 'reporter', false)
    expect(notes).toBe('극비 메모')
  })

  it('기자 + 승인 없음: null 반환', () => {
    const notes = resolvePersonalNotes(sharedPrivateSource, OTHER_USER, 'reporter', false)
    expect(notes).toBeNull()
  })

  it('기자 + 승인 있음: 열람 가능', () => {
    const notes = resolvePersonalNotes(sharedPrivateSource, OTHER_USER, 'reporter', true)
    expect(notes).toBe('극비 메모')
  })

  it('deputy: 승인 없이 열람 가능', () => {
    const notes = resolvePersonalNotes(sharedPrivateSource, OTHER_USER, 'deputy', false)
    expect(notes).toBe('극비 메모')
  })

  it('superadmin: 무조건 열람 가능', () => {
    const notes = resolvePersonalNotes(sharedPrivateSource, ADMIN_USER, 'superadmin', false)
    expect(notes).toBe('극비 메모')
  })

  it('personal_notes가 null이면 null 그대로', () => {
    const notes = resolvePersonalNotes(personalSource, OWNER_ID, 'superadmin', false)
    expect(notes).toBeNull()
  })
})

// ── 역할 계층 일관성 ─────────────────────────────────────────────────────
describe('역할 계층 일관성', () => {
  const hierarchy = ['reporter', 'deputy', 'admin', 'section_editor', 'editor', 'publisher', 'superadmin']

  it('CAN_VIEW_SENSITIVE_SOURCE: 상위 역할은 모두 포함', () => {
    // admin 이상은 모두 포함되어야 함
    const senIdx = hierarchy.indexOf('admin')
    for (let i = senIdx; i < hierarchy.length; i++) {
      expect(can(hierarchy[i], CAN_VIEW_SENSITIVE_SOURCE)).toBe(true)
    }
  })

  it('CAN_VIEW_PERSONAL_NOTES: deputy 이상은 모두 포함', () => {
    const depIdx = hierarchy.indexOf('deputy')
    for (let i = depIdx; i < hierarchy.length; i++) {
      expect(can(hierarchy[i], CAN_VIEW_PERSONAL_NOTES)).toBe(true)
    }
  })

  it('reporter는 CAN_VIEW_SENSITIVE_SOURCE 권한 없음', () => {
    expect(can('reporter', CAN_VIEW_SENSITIVE_SOURCE)).toBe(false)
  })
})
