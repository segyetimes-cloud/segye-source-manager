import type { UserRole } from '@/types/database'

/**
 * 취재원 관리시스템 — 역할별 권한 매트릭스
 *
 * 역할 계층: superadmin > publisher > editor > section_editor > admin(부장) > deputy(차장) > reporter(기자)
 */

// ── 취재원 권한 ─────────────────────────────────────────────────────────────

/** 공유+민감(private) 취재원 열람 가능 (부장 이상) */
export const CAN_VIEW_SENSITIVE_SOURCE: ReadonlyArray<UserRole> = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
]

/** personal_notes 열람 가능 (차장 이상 — 기자는 데스크 승인 필요) */
export const CAN_VIEW_PERSONAL_NOTES: ReadonlyArray<UserRole> = [
  'deputy', 'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
]

/** 타인 취재원 수정 가능 (부장 이상) */
export const CAN_EDIT_ANY_SOURCE: ReadonlyArray<UserRole> = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
]

/** 취재원 삭제 가능 (부장 이상) */
export const CAN_DELETE_SOURCE: ReadonlyArray<UserRole> = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
]

// ── 정보보고 권한 ────────────────────────────────────────────────────────────

/** 정보보고 심사(승인/반려) 가능 (부국장 이상) */
export const CAN_APPROVE_REPORT: ReadonlyArray<UserRole> = [
  'section_editor', 'editor', 'publisher', 'superadmin',
]

/** 모든 정보보고 열람 (부장 이상) */
export const CAN_VIEW_ALL_REPORTS: ReadonlyArray<UserRole> = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
]

/** 정보보고 포인트 지급 가능 (부장 이상) */
export const CAN_AWARD_POINTS: ReadonlyArray<UserRole> = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
]

// ── 내보내기 권한 ────────────────────────────────────────────────────────────

/** 내보내기 가능 (전원 — 역할별 행 수·횟수 제한 다름) */
export const CAN_EXPORT: ReadonlyArray<UserRole> = [
  'reporter', 'deputy', 'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
]

/** 내보내기 최대 행 수 (역할별, env로 오버라이드 가능) */
export const EXPORT_MAX_ROWS: Readonly<Record<UserRole, number>> = {
  reporter:       100,
  deputy:         200,
  admin:          500,
  section_editor: 1000,
  editor:         2000,
  publisher:      2000,
  superadmin:     5000,
}

/** 내보내기 일일 횟수 제한 (역할별) */
export const EXPORT_DAILY_LIMIT: Readonly<Record<UserRole, number>> = {
  reporter:       3,
  deputy:         5,
  admin:          10,
  section_editor: 20,
  editor:         20,
  publisher:      20,
  superadmin:     999,
}

// ── 관리자 권한 ─────────────────────────────────────────────────────────────

/** 열람 승인 처리 가능 (부장 이상) */
export const CAN_APPROVE_ACCESS: ReadonlyArray<UserRole> = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
]

/** 감사 로그 열람 가능 (부장 이상) */
export const CAN_VIEW_AUDIT_LOGS: ReadonlyArray<UserRole> = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
]

/** 계정 관리 가능 (최고관리자 전용) */
export const CAN_MANAGE_USERS: ReadonlyArray<UserRole> = ['superadmin']

/** 도움 보너스 지급/관리 (부장 이상) */
export const CAN_MANAGE_HELP_REWARDS: ReadonlyArray<UserRole> = [
  'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
]

// ── 헬퍼 함수 ───────────────────────────────────────────────────────────────

/**
 * 역할이 권한 목록에 포함되는지 확인합니다.
 * Supabase는 role을 string으로 반환하므로 호출부 캐스트 없이 쓸 수 있도록 string도 허용합니다.
 *
 * @example
 * if (!can(userRole, CAN_EDIT_ANY_SOURCE)) return 403
 */
export function can(
  role: string | null | undefined,
  permission: ReadonlyArray<UserRole>,
): boolean {
  return !!role && (permission as ReadonlyArray<string>).includes(role)
}

/**
 * 역할별 내보내기 최대 행 수를 안전하게 조회합니다.
 * 알 수 없는 역할은 reporter 기본값(100)을 반환합니다.
 */
export function getExportMaxRows(role: string | null | undefined): number {
  if (!role) return EXPORT_MAX_ROWS.reporter
  return EXPORT_MAX_ROWS[role as UserRole] ?? EXPORT_MAX_ROWS.reporter
}

/**
 * 역할별 내보내기 일일 횟수 한도를 안전하게 조회합니다.
 */
export function getExportDailyLimit(role: string | null | undefined): number {
  if (!role) return EXPORT_DAILY_LIMIT.reporter
  return EXPORT_DAILY_LIMIT[role as UserRole] ?? EXPORT_DAILY_LIMIT.reporter
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
