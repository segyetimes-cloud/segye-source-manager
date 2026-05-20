import type { UserRole } from '@/types/database'

// 역할 계층: superadmin > publisher > editor > section_editor > admin(부장) > deputy(차장) > reporter(기자)

// 데스크 이상 (승인·민감정보 접근 권한)
export const DESK_ROLES: UserRole[] = ['admin', 'section_editor', 'editor', 'publisher', 'superadmin']

// 차장 이상 (민감 노트·연락이력 열람 권한)
export const DEPUTY_AND_ABOVE: UserRole[] = ['deputy', 'admin', 'section_editor', 'editor', 'publisher', 'superadmin']

// 전 부서 승인 가능 (부장 제외 — 부장은 소속 부서 한정)
export const CROSS_DEPT_ROLES: UserRole[] = ['superadmin', 'publisher', 'editor', 'section_editor']

export function isDesk(role: string | null | undefined): boolean {
  return DESK_ROLES.includes(role as UserRole)
}

export function isDeputyOrAbove(role: string | null | undefined): boolean {
  return DEPUTY_AND_ABOVE.includes(role as UserRole)
}

export function isCrossDept(role: string | null | undefined): boolean {
  return CROSS_DEPT_ROLES.includes(role as UserRole)
}

export function isSuperAdmin(role: string | null | undefined): boolean {
  return role === 'superadmin'
}
