import type { UserRole } from '@/types/database'

// 데스크 이상 (승인 권한 있음)
export const DESK_ROLES: UserRole[] = ['admin', 'section_editor', 'editor', 'publisher', 'superadmin']

// 전 부서 승인 가능 (부장 제외)
export const CROSS_DEPT_ROLES: UserRole[] = ['superadmin', 'publisher', 'editor', 'section_editor']

export function isDesk(role: string | null | undefined): boolean {
  return DESK_ROLES.includes(role as UserRole)
}

export function isCrossDept(role: string | null | undefined): boolean {
  return CROSS_DEPT_ROLES.includes(role as UserRole)
}

export function isSuperAdmin(role: string | null | undefined): boolean {
  return role === 'superadmin'
}
