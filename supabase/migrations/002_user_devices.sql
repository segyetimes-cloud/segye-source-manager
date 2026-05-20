-- 사용자 기기 지문 테이블
-- 새 기기 접속 감지 및 디바이스 관리에 사용

CREATE TABLE IF NOT EXISTS public.user_devices (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fingerprint_hash TEXT        NOT NULL,
  device_label     TEXT,
  ip_address       TEXT,
  first_seen_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_seen_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL,

  UNIQUE (user_id, fingerprint_hash)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_devices_user_id
  ON public.user_devices (user_id);

-- RLS 활성화
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

-- 본인의 기기 목록만 조회 가능
CREATE POLICY "users can view own devices"
  ON public.user_devices FOR SELECT
  USING (auth.uid() = user_id);

-- 삽입/갱신은 API Route(Service Role)에서만 수행 — 일반 사용자 정책 없음

COMMENT ON TABLE public.user_devices IS '사용자 브라우저 기기 지문 등록 테이블 (새 기기 접속 감지용)';
