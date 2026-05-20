/**
 * src/app/api/__tests__/bulk-permissions.test.ts
 *
 * 대량 작업(bulk) 권한 로직 단위 테스트
 *
 * 검증 범위:
 *  - 소유자는 자신의 취재원만 처리 가능
 *  - admin 이상은 모든 취재원 처리 가능
 *  - 잘못된 action/ids → 오류 반환
 *  - 100건 초과 → 오류 반환
 */

import { describe, it, expect } from 'vitest'
import { can, CAN_EDIT_ANY_SOURCE, CAN_DELETE_SOURCE } from '@/lib/permissions'

// ── Bulk 권한 판정 로직 (bulk/route.ts에서 추출) ───────────────────────────
interface Source {
  id: string
  owner_id: string
  tags: string[]
}

function getTargetIds(
  sources: Source[],
  requesterId: string,
  role: string,
): string[] {
  const isAdmin  = can(role, CAN_EDIT_ANY_SOURCE)
  const ownedIds = sources.filter(s => s.owner_id === requesterId).map(s => s.id)
  return isAdmin ? sources.map(s => s.id) : ownedIds
}

function getDeleteIds(
  sources: Source[],
  requesterId: string,
  role: string,
  requestedIds: string[],
): string[] {
  // 라우트 로직 재현: 요청된 ID에 해당하는 소스만 대상으로 삼음
  const requestedSources = sources.filter(s => requestedIds.includes(s.id))
  const canDelete = can(role, CAN_DELETE_SOURCE)
  const isAdmin   = can(role, CAN_EDIT_ANY_SOURCE)
  const ownedIds  = requestedSources.filter(s => s.owner_id === requesterId).map(s => s.id)
  return (canDelete || isAdmin) ? requestedIds : ownedIds
}

function validateBulkInput(ids: unknown, action: unknown): string | null {
  if (!action || !Array.isArray(ids) || ids.length === 0) return 'action과 ids가 필요합니다'
  if (ids.length > 100) return '한 번에 최대 100개까지 처리 가능합니다'
  return null
}

// ── 테스트 픽스처 ────────────────────────────────────────────────────────
const USER_A = 'user-a-uuid'
const USER_B = 'user-b-uuid'
const ADMIN  = 'admin-uuid'

const SOURCES: Source[] = [
  { id: 'src-1', owner_id: USER_A, tags: ['정치', '경제'] },
  { id: 'src-2', owner_id: USER_A, tags: [] },
  { id: 'src-3', owner_id: USER_B, tags: ['사회'] },
  { id: 'src-4', owner_id: USER_B, tags: [] },
]

// ── 수정 가능 대상 (targetIds) ────────────────────────────────────────────
describe('getTargetIds — 수정 가능 대상 결정', () => {
  it('reporter: 본인 취재원만 대상', () => {
    const ids = getTargetIds(SOURCES, USER_A, 'reporter')
    expect(ids).toEqual(['src-1', 'src-2'])
    expect(ids).not.toContain('src-3')
    expect(ids).not.toContain('src-4')
  })

  it('deputy: 본인 취재원만 대상', () => {
    const ids = getTargetIds(SOURCES, USER_A, 'deputy')
    expect(ids).toEqual(['src-1', 'src-2'])
  })

  it('admin: 모든 취재원 대상', () => {
    const ids = getTargetIds(SOURCES, ADMIN, 'admin')
    expect(ids).toHaveLength(4)
    expect(ids).toContain('src-1')
    expect(ids).toContain('src-3')
  })

  it('superadmin: 모든 취재원 대상', () => {
    const ids = getTargetIds(SOURCES, ADMIN, 'superadmin')
    expect(ids).toHaveLength(4)
  })

  it('본인 취재원 없는 reporter: 빈 배열', () => {
    const ids = getTargetIds(SOURCES, 'nobody', 'reporter')
    expect(ids).toHaveLength(0)
  })
})

// ── 삭제 가능 대상 (deleteIds) ────────────────────────────────────────────
describe('getDeleteIds — 삭제 가능 대상 결정', () => {
  const ALL_IDS = SOURCES.map(s => s.id)

  it('reporter: 본인 취재원만 삭제 가능', () => {
    const ids = getDeleteIds(SOURCES, USER_A, 'reporter', ALL_IDS)
    expect(ids).toEqual(['src-1', 'src-2'])
  })

  it('admin: 요청된 모든 ID 삭제 가능', () => {
    const ids = getDeleteIds(SOURCES, ADMIN, 'admin', ALL_IDS)
    expect(ids).toEqual(ALL_IDS)
  })

  it('권한 없는 reporter가 타인 ID를 지정해도 본인 것만 삭제', () => {
    const ids = getDeleteIds(SOURCES, USER_A, 'reporter', ['src-3', 'src-4'])
    // USER_A는 src-3, src-4를 소유하지 않으므로 결과 없음
    expect(ids).toHaveLength(0)
  })
})

// ── 입력 유효성 검사 ─────────────────────────────────────────────────────
describe('validateBulkInput', () => {
  it('유효한 입력: null 반환', () => {
    expect(validateBulkInput(['id-1', 'id-2'], 'delete')).toBeNull()
  })

  it('action 없음: 오류 메시지', () => {
    expect(validateBulkInput(['id-1'], null)).toBeTruthy()
  })

  it('ids 빈 배열: 오류 메시지', () => {
    expect(validateBulkInput([], 'delete')).toBeTruthy()
  })

  it('ids가 배열 아님: 오류 메시지', () => {
    expect(validateBulkInput('id-1', 'delete')).toBeTruthy()
  })

  it('101건 초과: 오류 메시지', () => {
    const ids = Array.from({ length: 101 }, (_, i) => `id-${i}`)
    expect(validateBulkInput(ids, 'delete')).toContain('100개')
  })

  it('정확히 100건: 통과', () => {
    const ids = Array.from({ length: 100 }, (_, i) => `id-${i}`)
    expect(validateBulkInput(ids, 'delete')).toBeNull()
  })
})

// ── 태그 추가 로직 ────────────────────────────────────────────────────────
describe('add_tag 로직', () => {
  function addTagToSources(sources: Source[], targetIds: string[], tag: string) {
    return sources
      .filter(s => targetIds.includes(s.id) && !s.tags.includes(tag))
      .map(s => ({ ...s, tags: [...s.tags, tag] }))
  }

  it('이미 태그가 있으면 중복 추가 안 함', () => {
    const result = addTagToSources(SOURCES, ['src-1'], '정치')
    expect(result).toHaveLength(0) // src-1 already has '정치'
  })

  it('없는 태그를 새로 추가', () => {
    const result = addTagToSources(SOURCES, ['src-2'], '신규태그')
    expect(result).toHaveLength(1)
    expect(result[0].tags).toContain('신규태그')
  })

  it('대상이 아닌 취재원은 영향받지 않음', () => {
    const result = addTagToSources(SOURCES, ['src-1'], '신규')
    expect(result.every(s => s.id === 'src-1')).toBe(true)
  })
})

// ── 태그 제거 로직 ────────────────────────────────────────────────────────
describe('remove_tag 로직', () => {
  function removeTagFromSources(sources: Source[], targetIds: string[], tag: string) {
    return sources
      .filter(s => targetIds.includes(s.id))
      .map(s => ({ ...s, tags: s.tags.filter(t => t !== tag) }))
  }

  it('존재하는 태그 제거', () => {
    const result = removeTagFromSources(SOURCES, ['src-1'], '정치')
    expect(result[0].tags).not.toContain('정치')
    expect(result[0].tags).toContain('경제') // 경제는 유지
  })

  it('없는 태그 제거: 기존 태그 유지', () => {
    const result = removeTagFromSources(SOURCES, ['src-1'], '없는태그')
    expect(result[0].tags).toEqual(['정치', '경제'])
  })
})
