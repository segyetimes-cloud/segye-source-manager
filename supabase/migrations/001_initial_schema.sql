-- ============================================================
-- 세계일보 AI기반 취재원 관리시스템 — 초기 스키마
-- Supabase SQL Editor에서 순서대로 실행
-- ============================================================

-- ============================================================
-- 1. ENUM 타입
-- ============================================================

CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'reporter');
CREATE TYPE source_visibility AS ENUM ('personal', 'shared');
CREATE TYPE sensitivity_level AS ENUM ('public', 'private');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE audit_action AS ENUM (
  'view', 'create', 'update', 'delete',
  'export', 'import', 'view_private', 'approve', 'reject'
);
CREATE TYPE point_type AS ENUM (
  'source_created',
  'source_completed',
  'contribution_used',
  'usefulness_rating',
  'help_provided',
  'help_accepted',
  'daily_login',
  'penalty_deduct'
);
CREATE TYPE help_status AS ENUM ('open', 'resolved', 'closed');

-- ============================================================
-- 2. 프로필 테이블 (auth.users 확장)
-- ============================================================

CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT NOT NULL DEFAULT '',
  role          user_role NOT NULL DEFAULT 'reporter',
  department    TEXT,
  desk_name     TEXT,
  employee_id   TEXT UNIQUE,
  phone         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- auth.users 생성 시 profiles 자동 생성 트리거
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 3. 취재원 기본 정보
-- ============================================================

CREATE TABLE public.sources (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 소유권
  owner_id              UUID NOT NULL REFERENCES public.profiles(id),
  visibility            source_visibility NOT NULL DEFAULT 'personal',

  -- 기본 인적사항
  full_name             TEXT NOT NULL,
  name_en               TEXT,
  gender                TEXT,
  birthday              DATE,
  birthday_lunar        BOOLEAN DEFAULT false,
  hometown_province     TEXT,
  hometown_city         TEXT,

  -- 학력 (주요 요약 — 상세는 source_education)
  high_school           TEXT,
  high_school_year      INTEGER,
  university            TEXT,
  university_major      TEXT,
  university_year       INTEGER,
  graduate_school       TEXT,
  graduate_major        TEXT,

  -- 연락처
  phone_primary         TEXT,
  phone_secondary       TEXT,
  email_primary         TEXT,
  email_secondary       TEXT,
  sns_links             JSONB DEFAULT '{}',

  -- 현재 직책 (편의 컬럼, 상세 이력은 source_positions)
  current_organization  TEXT,
  current_position      TEXT,
  current_department    TEXT,

  -- 민감도
  sensitivity           sensitivity_level NOT NULL DEFAULT 'public',

  -- 기자 개인 메모 (소유자만)
  personal_notes        TEXT,

  -- 분류/태그
  tags                  TEXT[] DEFAULT '{}',
  exam_batch            TEXT,
  political_tendency    TEXT,
  specialty_areas       TEXT[] DEFAULT '{}',

  -- 완성도 점수 (트리거 자동계산)
  completeness_score    INTEGER NOT NULL DEFAULT 0,

  -- 크롤링 연동
  last_crawled_at       TIMESTAMPTZ,
  crawl_source_url      TEXT,
  needs_review          BOOLEAN DEFAULT false,

  -- 메타
  is_deleted            BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sources_owner ON public.sources(owner_id);
CREATE INDEX idx_sources_visibility ON public.sources(visibility);
CREATE INDEX idx_sources_sensitivity ON public.sources(sensitivity);
CREATE INDEX idx_sources_tags ON public.sources USING gin(tags);
CREATE INDEX idx_sources_university ON public.sources(university);
CREATE INDEX idx_sources_high_school ON public.sources(high_school);
CREATE INDEX idx_sources_exam_batch ON public.sources(exam_batch);
CREATE INDEX idx_sources_deleted ON public.sources(is_deleted) WHERE is_deleted = false;
CREATE INDEX idx_sources_name_fts ON public.sources
  USING gin(to_tsvector('simple', coalesce(full_name, '') || ' ' ||
    coalesce(current_organization, '') || ' ' ||
    coalesce(current_position, '') || ' ' ||
    coalesce(university, '') || ' ' ||
    coalesce(high_school, '') || ' ' ||
    coalesce(exam_batch, '')));

-- ============================================================
-- 4. 직책 이력
-- ============================================================

CREATE TABLE public.source_positions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id     UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,

  organization  TEXT NOT NULL,
  department    TEXT,
  position      TEXT NOT NULL,
  rank          TEXT,

  started_at    DATE NOT NULL,
  ended_at      DATE,
  is_current    BOOLEAN NOT NULL DEFAULT false,

  change_source TEXT DEFAULT 'manual',
  change_note   TEXT,

  created_by    UUID REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 현직은 source_id당 1개만
CREATE UNIQUE INDEX idx_positions_current
  ON public.source_positions(source_id)
  WHERE is_current = true;

CREATE INDEX idx_positions_source ON public.source_positions(source_id);
CREATE INDEX idx_positions_org ON public.source_positions(organization);

-- ============================================================
-- 5. 학력 상세
-- ============================================================

CREATE TABLE public.source_education (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,

  school_type     TEXT NOT NULL, -- '초등','중학','고등','대학','대학원','기타'
  school_name     TEXT NOT NULL,
  department      TEXT,
  degree          TEXT,
  admission_year  INTEGER,
  graduation_year INTEGER,
  is_graduated    BOOLEAN DEFAULT true,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_education_source ON public.source_education(source_id);
CREATE INDEX idx_education_school ON public.source_education(school_name);

-- ============================================================
-- 6. 취재원 관계 (관계망 그래프)
-- ============================================================

CREATE TABLE public.source_relationships (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_a_id      UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  source_b_id      UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,

  relation_type    TEXT NOT NULL,
  relation_label   TEXT,
  strength         INTEGER DEFAULT 3 CHECK (strength BETWEEN 1 AND 5),
  is_bidirectional BOOLEAN DEFAULT true,

  created_by       UUID REFERENCES public.profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT no_self_relation CHECK (source_a_id != source_b_id),
  CONSTRAINT unique_relation UNIQUE (source_a_id, source_b_id, relation_type)
);

CREATE INDEX idx_rel_source_a ON public.source_relationships(source_a_id);
CREATE INDEX idx_rel_source_b ON public.source_relationships(source_b_id);

-- ============================================================
-- 7. 민감정보 열람 승인
-- ============================================================

CREATE TABLE public.source_access_approvals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id     UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  requester_id  UUID NOT NULL REFERENCES public.profiles(id),
  approver_id   UUID REFERENCES public.profiles(id),

  reason        TEXT NOT NULL,
  status        approval_status NOT NULL DEFAULT 'pending',

  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at    TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  reject_reason TEXT
);

CREATE INDEX idx_approvals_requester ON public.source_access_approvals(requester_id);
CREATE INDEX idx_approvals_source ON public.source_access_approvals(source_id);
CREATE INDEX idx_approvals_status ON public.source_access_approvals(status);

-- ============================================================
-- 8. 감사 로그 (접근 기록)
-- ============================================================

CREATE TABLE public.audit_logs (
  id               BIGSERIAL PRIMARY KEY,
  user_id          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_email       TEXT,
  user_role        user_role,

  action           audit_action NOT NULL,
  resource_type    TEXT NOT NULL,
  resource_id      UUID,

  ip_address       INET,
  user_agent       TEXT,
  is_vpn_access    BOOLEAN DEFAULT true,

  export_row_count INTEGER,
  watermark_token  TEXT,

  metadata         JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_action ON public.audit_logs(action);

-- ============================================================
-- 9. 편집 이력
-- ============================================================

CREATE TABLE public.source_edit_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id   UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  editor_id   UUID NOT NULL REFERENCES public.profiles(id),
  editor_name TEXT NOT NULL,

  field_name  TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  change_note TEXT,

  edited_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_edit_history_source ON public.source_edit_history(source_id);
CREATE INDEX idx_edit_history_editor ON public.source_edit_history(editor_id);
CREATE INDEX idx_edit_history_time ON public.source_edit_history(edited_at DESC);

-- ============================================================
-- 10. 포인트 원장 & 집계
-- ============================================================

CREATE TABLE public.point_transactions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id),

  point_type          point_type NOT NULL,
  points              INTEGER NOT NULL,

  related_source_id   UUID REFERENCES public.sources(id) ON DELETE SET NULL,
  related_request_id  UUID,
  related_user_id     UUID REFERENCES public.profiles(id),

  description         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_points_user ON public.point_transactions(user_id);
CREATE INDEX idx_points_type ON public.point_transactions(point_type);
CREATE INDEX idx_points_source ON public.point_transactions(related_source_id);

CREATE TABLE public.user_points_summary (
  user_id              UUID PRIMARY KEY REFERENCES public.profiles(id),
  total_points         INTEGER NOT NULL DEFAULT 0,
  input_points         INTEGER NOT NULL DEFAULT 0,
  contribution_points  INTEGER NOT NULL DEFAULT 0,
  help_points          INTEGER NOT NULL DEFAULT 0,
  rank_position        INTEGER,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 11. 유용성 평가
-- ============================================================

CREATE TABLE public.source_usefulness_ratings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id  UUID NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
  rater_id   UUID NOT NULL REFERENCES public.profiles(id),
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment    TEXT,
  rated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (source_id, rater_id)
);

CREATE INDEX idx_ratings_source ON public.source_usefulness_ratings(source_id);

-- ============================================================
-- 12. 도움 요청 게시판
-- ============================================================

CREATE TABLE public.help_requests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id         UUID NOT NULL REFERENCES public.profiles(id),

  title                TEXT NOT NULL,
  body                 TEXT,
  request_type         TEXT NOT NULL DEFAULT 'contact',

  target_source_id     UUID REFERENCES public.sources(id),
  target_name          TEXT,
  target_org           TEXT,

  status               help_status NOT NULL DEFAULT 'open',
  accepted_response_id UUID,

  reward_points        INTEGER NOT NULL DEFAULT 10,

  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_help_requester ON public.help_requests(requester_id);
CREATE INDEX idx_help_status ON public.help_requests(status);
CREATE INDEX idx_help_created ON public.help_requests(created_at DESC);

CREATE TABLE public.help_responses (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id         UUID NOT NULL REFERENCES public.help_requests(id) ON DELETE CASCADE,
  responder_id       UUID NOT NULL REFERENCES public.profiles(id),

  body               TEXT NOT NULL,
  attached_source_id UUID REFERENCES public.sources(id),

  is_accepted        BOOLEAN NOT NULL DEFAULT false,
  upvotes            INTEGER NOT NULL DEFAULT 0,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_responses_request ON public.help_responses(request_id);
CREATE INDEX idx_responses_responder ON public.help_responses(responder_id);

-- ============================================================
-- 13. 엑셀 임포트/익스포트 추적
-- ============================================================

CREATE TABLE public.import_jobs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id            UUID NOT NULL REFERENCES public.profiles(id),

  original_filename      TEXT NOT NULL,
  storage_path           TEXT NOT NULL,
  file_size_bytes        BIGINT,
  total_rows             INTEGER,
  processed_rows         INTEGER DEFAULT 0,
  failed_rows            INTEGER DEFAULT 0,

  status                 TEXT NOT NULL DEFAULT 'pending',
  ai_column_mapping      JSONB,
  ai_confidence          JSONB,
  user_confirmed_mapping JSONB,

  error_log              JSONB DEFAULT '[]',
  started_at             TIMESTAMPTZ,
  completed_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.export_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id),
  row_count     INTEGER NOT NULL,
  filter_params JSONB,
  watermark_id  TEXT NOT NULL,
  exported_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_export_user ON public.export_logs(user_id);
CREATE INDEX idx_export_date ON public.export_logs(exported_at DESC);

-- ============================================================
-- 14. 트리거 함수들
-- ============================================================

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_sources_updated_at
  BEFORE UPDATE ON public.sources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_help_requests_updated_at
  BEFORE UPDATE ON public.help_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_help_responses_updated_at
  BEFORE UPDATE ON public.help_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 완성도 점수 자동계산
CREATE OR REPLACE FUNCTION public.calc_completeness_score()
RETURNS TRIGGER AS $$
DECLARE
  score INTEGER := 0;
BEGIN
  IF NEW.full_name IS NOT NULL AND NEW.full_name != '' THEN score := score + 10; END IF;
  IF NEW.phone_primary IS NOT NULL THEN score := score + 15; END IF;
  IF NEW.email_primary IS NOT NULL THEN score := score + 10; END IF;
  IF NEW.birthday IS NOT NULL THEN score := score + 5; END IF;
  IF NEW.current_organization IS NOT NULL AND NEW.current_organization != '' THEN score := score + 15; END IF;
  IF NEW.current_position IS NOT NULL AND NEW.current_position != '' THEN score := score + 15; END IF;
  IF NEW.university IS NOT NULL AND NEW.university != '' THEN score := score + 10; END IF;
  IF NEW.high_school IS NOT NULL AND NEW.high_school != '' THEN score := score + 5; END IF;
  IF NEW.hometown_province IS NOT NULL THEN score := score + 5; END IF;
  IF array_length(NEW.tags, 1) > 0 THEN score := score + 5; END IF;
  IF NEW.sns_links IS NOT NULL AND NEW.sns_links != '{}' THEN score := score + 5; END IF;
  NEW.completeness_score := LEAST(score, 100);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_completeness
  BEFORE INSERT OR UPDATE ON public.sources
  FOR EACH ROW EXECUTE FUNCTION public.calc_completeness_score();

-- 포인트 요약 자동 갱신
CREATE OR REPLACE FUNCTION public.update_points_summary()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_points_summary (user_id, total_points)
  VALUES (NEW.user_id, NEW.points)
  ON CONFLICT (user_id) DO UPDATE
    SET total_points = user_points_summary.total_points + NEW.points,
        updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_points_summary
  AFTER INSERT ON public.point_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_points_summary();

-- ============================================================
-- 15. RLS 활성화
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_access_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_edit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_points_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.source_usefulness_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.help_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.export_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 16. RLS 헬퍼 함수
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT role IN ('admin', 'superadmin')
  FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN AS $$
  SELECT is_active FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_approved_access(p_source_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.source_access_approvals
    WHERE source_id = p_source_id
      AND requester_id = auth.uid()
      AND status = 'approved'
      AND (expires_at IS NULL OR expires_at > NOW())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- 17. RLS 정책
-- ============================================================

-- [profiles]
CREATE POLICY "profiles_self_all" ON public.profiles
  FOR ALL USING (id = auth.uid());

CREATE POLICY "profiles_admin_select" ON public.profiles
  FOR SELECT USING (public.is_admin());

-- [sources]
CREATE POLICY "sources_select" ON public.sources
  FOR SELECT USING (
    is_deleted = false
    AND public.is_active_user()
    AND (
      owner_id = auth.uid()
      OR visibility = 'shared'
      OR public.is_admin()
    )
  );

CREATE POLICY "sources_insert" ON public.sources
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND public.is_active_user()
    AND owner_id = auth.uid()
  );

CREATE POLICY "sources_update" ON public.sources
  FOR UPDATE USING (
    public.is_active_user()
    AND (owner_id = auth.uid() OR public.is_admin())
  );

CREATE POLICY "sources_delete" ON public.sources
  FOR DELETE USING (public.current_user_role() = 'superadmin');

-- [source_positions]
CREATE POLICY "positions_select" ON public.source_positions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sources s
      WHERE s.id = source_id
        AND s.is_deleted = false
        AND (s.owner_id = auth.uid() OR s.visibility = 'shared' OR public.is_admin())
    )
  );

CREATE POLICY "positions_insert" ON public.source_positions
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND public.is_active_user()
  );

CREATE POLICY "positions_update" ON public.source_positions
  FOR UPDATE USING (
    created_by = auth.uid() OR public.is_admin()
  );

-- [source_education] — positions와 동일 패턴
CREATE POLICY "education_select" ON public.source_education
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sources s
      WHERE s.id = source_id
        AND (s.owner_id = auth.uid() OR s.visibility = 'shared' OR public.is_admin())
    )
  );

CREATE POLICY "education_insert" ON public.source_education
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND public.is_active_user());

-- [source_relationships]
CREATE POLICY "relationships_select" ON public.source_relationships
  FOR SELECT USING (auth.uid() IS NOT NULL AND public.is_active_user());

CREATE POLICY "relationships_insert" ON public.source_relationships
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND public.is_active_user());

CREATE POLICY "relationships_update" ON public.source_relationships
  FOR UPDATE USING (created_by = auth.uid() OR public.is_admin());

-- [source_access_approvals]
CREATE POLICY "approvals_select" ON public.source_access_approvals
  FOR SELECT USING (
    requester_id = auth.uid() OR public.is_admin()
  );

CREATE POLICY "approvals_insert" ON public.source_access_approvals
  FOR INSERT WITH CHECK (
    requester_id = auth.uid() AND public.is_active_user()
  );

CREATE POLICY "approvals_update" ON public.source_access_approvals
  FOR UPDATE USING (public.is_admin());

-- [audit_logs] — INSERT만 허용, SELECT는 admin
CREATE POLICY "audit_insert" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "audit_select_admin" ON public.audit_logs
  FOR SELECT USING (public.is_admin());

-- [source_edit_history]
CREATE POLICY "edit_history_select" ON public.source_edit_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sources s
      WHERE s.id = source_id
        AND (s.owner_id = auth.uid() OR s.visibility = 'shared' OR public.is_admin())
    )
  );

CREATE POLICY "edit_history_insert" ON public.source_edit_history
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- [point_transactions] — 클라이언트 INSERT 불가 (Service Role만)
CREATE POLICY "points_select_self" ON public.point_transactions
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

-- [user_points_summary]
CREATE POLICY "points_summary_select" ON public.user_points_summary
  FOR SELECT USING (auth.uid() IS NOT NULL);  -- 리더보드는 전체 공개

-- [source_usefulness_ratings]
CREATE POLICY "ratings_select" ON public.source_usefulness_ratings
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "ratings_insert" ON public.source_usefulness_ratings
  FOR INSERT WITH CHECK (
    rater_id = auth.uid() AND public.is_active_user()
  );

CREATE POLICY "ratings_update" ON public.source_usefulness_ratings
  FOR UPDATE USING (rater_id = auth.uid());

-- [help_requests]
CREATE POLICY "help_requests_select" ON public.help_requests
  FOR SELECT USING (auth.uid() IS NOT NULL AND public.is_active_user());

CREATE POLICY "help_requests_insert" ON public.help_requests
  FOR INSERT WITH CHECK (
    requester_id = auth.uid() AND public.is_active_user()
  );

CREATE POLICY "help_requests_update" ON public.help_requests
  FOR UPDATE USING (requester_id = auth.uid() OR public.is_admin());

-- [help_responses]
CREATE POLICY "help_responses_select" ON public.help_responses
  FOR SELECT USING (auth.uid() IS NOT NULL AND public.is_active_user());

CREATE POLICY "help_responses_insert" ON public.help_responses
  FOR INSERT WITH CHECK (
    responder_id = auth.uid() AND public.is_active_user()
  );

CREATE POLICY "help_responses_update" ON public.help_responses
  FOR UPDATE USING (responder_id = auth.uid() OR public.is_admin());

-- [import_jobs]
CREATE POLICY "import_jobs_own" ON public.import_jobs
  FOR ALL USING (uploader_id = auth.uid() OR public.is_admin());

-- [export_logs]
CREATE POLICY "export_logs_own" ON public.export_logs
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "export_logs_insert" ON public.export_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());
