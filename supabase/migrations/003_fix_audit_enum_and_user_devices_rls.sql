-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 003: audit_action enum 보완 + user_devices RLS 정책 추가
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. audit_action enum에 누락된 값 추가
--    TypeScript AuditAction 타입에는 존재하지만 DB enum에는 없던 값들
--    이로 인해 audit_logs INSERT 시 PostgreSQL ERROR가 발생하던 문제 수정
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'login_failed';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'logout';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'idle_logout';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'new_device_login';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'session_invalidate_others';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'report_create';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'report_update';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'report_delete';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'report_submit';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'report_approve';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'report_reject';

-- 2. user_devices RLS 정책 추가
--    기존에 SELECT 정책만 있었고 INSERT/UPDATE 정책이 없어
--    모든 사용자의 기기 등록이 403으로 차단되던 문제 수정
CREATE POLICY "users can insert own devices"
  ON user_devices FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can update own devices"
  ON user_devices FOR UPDATE
  USING (auth.uid() = user_id);
