import type { UserRole } from '@/types/database'

/**
 * 취재원 관리시스템 — 역할별 권한 매트릭스
 *
 * 역할 계층: superadmin > publisher > editor > section_editor > admin(부장) > deputy(차장) > reporter(기자)
 */

// ── 취재원 권한 ─────────────────────────────────────────────────────────────

/** 공유+민감(private) 취재원 열람 가능 (부장 이상) */
export const CAN_VIEW_SENSITIVE_SOURCE: readonly UserRole[] = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
] as const

/** personal_notes 열람 가능 (차장 이상 — 기자는 데스크 승인 필요) */
export const CAN_VIEW_PERSONAL_NOTES: readonly UserRole[] = [
  'deputy', 'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
] as const

/** 타인 취재원 수정 가능 (부장 이상) */
export const CAN_EDIT_ANY_SOURCE: readonly UserRole[] = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
] as const

/** 취재원 삭제 가능 (부장 이상) */
export const CAN_DELETE_SOURCE: readonly UserRole[] = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
] as const

// ── 정보보고 권한 ────────────────────────────────────────────────────────────

/** 정보보고 심사(승인/반려) 가능 (부국장 이상) */
export const CAN_APPROVE_REPORT: readonly UserRole[] = [
  'section_editor', 'editor', 'publisher', 'superadmin',
] as const

/** 모든 정보보고 열람 (부장 이상) */
export const CAN_VIEW_ALL_REPORTS: readonly UserRole[] = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
] as const

/** 정보보고 포인트 지급 가능 (부장 이상) */
export const CAN_AWARD_POINTS: readonly UserRole[] = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
] as const

// ── 내보내기 권한 ────────────────────────────────────────────────────────────

/** 내보내기 가능 (전원 — 역할별 행 수·횟수 제한 다름) */
export const CAN_EXPORT: readonly UserRole[] = [
  'reporter', 'deputy', 'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
] as const

/** 내보내기 최대 행 수 (역할별, env로 오버라이드 가능) */
export const EXPORT_MAX_ROWS: Readonly<Record<string, number>> = {
  reporter:       100,
  deputy:         200,
  admin:          500,
  section_editor: 1000,
  editor:         2000,
  publisher:      2000,
  superadmin:     5000,
} as const

/** 내보내기 일일 횟수 제한 (역할별) */
export const EXPORT_DAILY_LIMIT: Readonly<Record<string, number>> = {
  reporter:       3,
  deputy:         5,
  admin:          10,
  section_editor: 20,
  editor:         20,
  publisher:      20,
  superadmin:     999,
} as const

// ── 관리자 권한 ─────────────────────────────────────────────────────────────

/** 열람 승인 처리 가능 (부장 이상) */
export const CAN_APPROVE_ACCESS: readonly UserRole[] = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
] as const

/** 감사 로그 열람 가능 (부장 이상) */
export const CAN_VIEW_AUDIT_LOGS: readonly UserRole[] = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
] as const

/** 계정 관리 가능 (최고관리자 전용) */
export const CAN_MANAGE_USERS: readonly UserRole[] = ['superadmin'] as const

/** 도움 보너스 지급/관리 (부장 이상) */
export const CAN_MANAGE_HELP_REWARDS: readonly UserRole[] = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
] as const

// ── 헬퍼 함수 ───────────────────────────────────────────────────────────────

/**
 * 역할이 권한 목록에 포함되는지 확인합니다.
 *
 * @example
 * if (!can(userRole, CAN_EDIT_ANY_SOURCE)) return 403
 */
export function can(
  role: string | null | undefined,
  permission: readonly UserRole[],
): boolean {
  if (!role) return false
  return (permission as readonly string[]).includes(role)
}

// ── 권한 요약 (문서화·UI 표시용) ────────────────────────────────────────────

export const PERMISSION_MATRIX = {
  sources: {
    '공개 취재원 조회':          '전체',
    '공유+민감 취재원 조회':      '부장+',
    'personal_notes 열람':      '차장+ (기자는 데스크 승인 필요)',
    '본인 취재원 수정':           '전체',
    '타인 취재원 수정':           '부장+',
    '취재원 삭제':               '부장+',
  },
  reports: {
    '정보보고 열람(공개)':        '전체',
    '정보보고 열람(전체)':        '부장+',
    '정보보고 심사':             '부국장+',
    '포인트 지급':               '부장+',
  },
  export: {
    '내보내기 가능':             '전체 (행 수·횟수 제한 있음)',
    '기자':                     '100행 / 1일 3회',
    '차장':                     '200행 / 1일 5회',
    '부장':                     '500행 / 1일 10회',
    '부국장+':                  '1,000~2,000행 / 1일 20회',
    'superadmin':               '5,000행 / 무제한',
  },
  admin: {
    '열람 승인 처리':             '부장+',
    '감사 로그 열람':             '부장+',
    '도움 보너스 관리':           '부장+',
    '계정 관리':                 'superadmin 전용',
  },
} as const
