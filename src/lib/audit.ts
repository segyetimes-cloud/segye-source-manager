/**
 * src/lib/audit.ts
 *
 * audit_logs 테이블 기록 헬퍼 — DB enum에 없는 커스텀 action 포함 지원
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.generated'

/** DB audit_action enum + 시스템 커스텀 액션 */
export type AuditAction =
  | 'view' | 'create' | 'update' | 'delete' | 'export' | 'import'
  | 'view_private' | 'approve' | 'reject'
  | 'login' | 'login_failed' | 'logout' | 'idle_logout'
  | 'new_device_login' | 'session_invalidate_others'
  | 'report_create'
  | 'note_view' | 'note_create' | 'note_delete'
  | 'report_update' | 'report_delete' | 'report_submit' | 'report_approve' | 'report_reject'
  | 'points_award'

export interface AuditEntry {
  user_id?:          string | null
  user_email?:       string | null
  user_role?:        string | null
  action:            AuditAction
  resource_type?:    string | null
  resource_id?:      string | null
  ip_address?:       string | null
  is_vpn_access?:    boolean | null
  export_row_count?: number | null
  watermark_token?:  string | null
  metadata?:         Record<string, unknown> | null
}

/**
 * audit_logs 테이블에 감사 로그를 기록합니다.
 * DB enum에 없는 커스텀 action도 허용합니다 (내부에서 `as any` 처리).
 * metadata는 JSON 직렬화 불가 값이 있어도 안전하게 처리합니다.
 */
export async function auditLog(
  supabase: SupabaseClient<Database>,
  entry: AuditEntry,
): Promise<void> {
  const row = {
    ...entry,
    metadata: entry.metadata ? safeSerialize(entry.metadata) : null,
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('audit_logs').insert(row)
  } catch (err) {
    console.error('[auditLog] insert failed:', err)
  }
}

/** JSON.stringify/parse를 통해 직렬화 불가 값(Date, undefined 등)을 제거합니다. */
function safeSerialize(obj: Record<string, unknown>): Record<string, unknown> | null {
  try {
    return JSON.parse(JSON.stringify(obj))
  } catch {
    return null
  }
}
