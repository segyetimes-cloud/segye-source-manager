import type { SupabaseClient } from '@supabase/supabase-js'

/** 감사 로그 액션 타입 */
export type AuditAction =
  | 'view'           // 일반 열람
  | 'view_private'   // 민감정보 열람
  | 'create'         // 신규 등록
  | 'update'         // 수정
  | 'delete'         // 삭제
  | 'export'         // 내보내기
  | 'list'           // 목록 조회
  | 'login'          // 로그인
  | 'otp_verify'     // OTP 인증
  | 'access_request' // 열람 신청
  | 'access_approve' // 열람 승인

/** 감사 로그 리소스 타입 */
export type AuditResourceType =
  | 'source'
  | 'report'
  | 'user'
  | 'approval'
  | 'contact_log'
  | 'export'
  | 'help'

export interface AuditParams {
  supabase: SupabaseClient
  userId: string
  userEmail?: string | null
  action: AuditAction
  resourceType: AuditResourceType
  resourceId?: string
  metadata?: Record<string, unknown>
}

/**
 * 감사 로그를 기록합니다. Fire-and-forget — 절대 throw하지 않습니다.
 *
 * @example
 * logAudit({ supabase, userId: user.id, userEmail: user.email,
 *   action: 'view_private', resourceType: 'source', resourceId: id })
 */
export function logAudit({
  supabase, userId, userEmail, action, resourceType, resourceId, metadata,
}: AuditParams): void {
  ;(supabase as any)
    .from('audit_logs')
    .insert({
      user_id: userId,
      user_email: userEmail ?? null,
      action,
      resource_type: resourceType,
      resource_id: resourceId ?? null,
      metadata: metadata ?? null,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error && process.env.NODE_ENV !== 'production') {
        console.warn('[audit] 감사 로그 기록 실패:', error.message, { action, resourceType, userId })
      }
      // TODO: 운영환경 — Sentry 또는 Slack webhook으로 누락 알림 연동
    })
    .catch((err: unknown) => {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[audit] logAudit threw:', err)
      }
    })
}
