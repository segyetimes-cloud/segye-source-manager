/**
 * src/lib/schemas.ts
 *
 * Zod 입력 스키마 — API 라우트 공통 검증 레이어
 * Zod v4 기준 (issues 사용)
 */
import { z } from 'zod'
import { NextResponse } from 'next/server'

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

export type ParseResult<T> =
  | { ok: true;  data: T }
  | { ok: false; response: NextResponse }

/**
 * request body를 JSON으로 파싱하고 Zod 스키마로 검증합니다.
 * 실패 시 400 NextResponse를 포함한 { ok: false } 를 반환합니다.
 */
export async function parseBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<ParseResult<z.infer<S>>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: '잘못된 요청 형식입니다 (JSON 파싱 실패)' }, { status: 400 }),
    }
  }
  const result = schema.safeParse(raw)
  if (!result.success) {
    const issue = result.error.issues[0]
    const field = issue.path.length > 0 ? issue.path.join('.') : undefined
    return {
      ok: false,
      response: NextResponse.json(
        { error: issue.message, ...(field ? { field } : {}) },
        { status: 400 },
      ),
    }
  }
  return { ok: true, data: result.data }
}

// ── 취재원 ───────────────────────────────────────────────────────────────────

export const CreateSourceSchema = z.object({
  full_name:            z.string().trim().min(1, '이름을 입력해 주세요').max(100),
  current_organization: z.string().trim().max(200).nullish(),
  current_position:     z.string().trim().max(100).nullish(),
  current_department:   z.string().trim().max(100).nullish(),
  phone_primary:        z.string().trim().max(30).nullish(),
  phone_secondary:      z.string().trim().max(30).nullish(),
  email_primary:        z.preprocess(v => (typeof v === 'string' && v.trim() === '') ? null : v, z.string().trim().email('올바른 이메일 형식이 아닙니다').max(200).nullish()),
  email_secondary:      z.preprocess(v => (typeof v === 'string' && v.trim() === '') ? null : v, z.string().trim().email('올바른 이메일 형식이 아닙니다').max(200).nullish()),
  birthday:             z.preprocess(v => (typeof v === 'string' && v.trim() === '') ? null : v, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD 입니다').nullish()),
  hometown_province:    z.string().trim().max(50).nullish(),
  hometown_city:        z.string().trim().max(50).nullish(),
  high_school:          z.string().trim().max(100).nullish(),
  university:           z.string().trim().max(100).nullish(),
  university_major:     z.string().trim().max(100).nullish(),
  graduate_school:      z.string().trim().max(100).nullish(),
  exam_batch:           z.number().int().positive().nullish(),
  visibility:           z.enum(['personal', 'shared']).default('shared'),
  sensitivity:          z.enum(['public', 'private']).default('public'),
  on_record_status:     z.preprocess(v => (v === null || v === '') ? undefined : v, z.enum(['on_record', 'off_record', 'background']).default('on_record')),
  tags:                 z.array(z.string().trim().max(50)).max(30).optional(),
  public_notes:         z.string().trim().max(5000).nullish(),
  personal_notes:       z.string().trim().max(5000).nullish(),
  sns_links:            z.record(z.string(), z.string().url()).optional(),
})

// ── 정보보고 ─────────────────────────────────────────────────────────────────

const REPORT_CATEGORIES = ['일반', '단독', '공동취재', '인터뷰', '배경설명', '분석', '기타'] as const

export const CreateReportSchema = z.object({
  title:             z.string({ error: '제목을 입력해 주세요' }).trim().min(1, '제목을 입력해 주세요').max(200),
  content:           z.string().trim().max(100_000).default(''),
  sensitive_content: z.string().trim().max(100_000).nullish(),
  category:          z.enum(REPORT_CATEGORIES).default('일반'),
  tags:              z.array(z.string().trim().max(50)).max(30).optional(),
  visibility:        z.enum(['author_only', 'desk_above', 'team', 'all']).default('author_only'),
  source_ids:        z.array(z.string().uuid()).max(50).optional(),
  allowed_user_ids:  z.array(z.string().uuid()).max(100).optional(),
})

// ── 열람 신청 승인/거절 ──────────────────────────────────────────────────────

export const ApprovalDecisionSchema = z.object({
  approval_id:   z.string().uuid('잘못된 approval_id 형식입니다'),
  action:        z.enum(['approve', 'reject']),
  reject_reason: z.string().trim().max(500).optional(),
})

export const CreateApprovalSchema = z.object({
  source_id: z.string().uuid('잘못된 source_id 형식입니다'),
  reason:    z.string().trim().min(1, '신청 사유를 입력해 주세요').max(500),
})

// ── 계정 관리 ────────────────────────────────────────────────────────────────

const USER_ROLES = [
  'reporter', 'deputy', 'admin', 'section_editor', 'editor', 'publisher', 'superadmin',
] as const

export const CreateUserSchema = z.object({
  email:       z.string().trim().email('올바른 이메일 형식이 아닙니다').max(200),
  password:    z.string().min(8, '비밀번호는 8자 이상이어야 합니다').max(100),
  full_name:   z.string().trim().min(1, '이름을 입력해 주세요').max(100),
  role:        z.enum(USER_ROLES).optional(),
  department:  z.string().trim().max(100).nullish(),
  desk_name:   z.string().trim().max(100).nullish(),
  employee_id: z.string().trim().max(50).nullish(),
  phone:       z.string().trim().max(30).nullish(),
})

// ── 도움 요청 ────────────────────────────────────────────────────────────────

export const CreateHelpSchema = z.object({
  title:            z.string().trim().min(1, '제목을 입력해 주세요').max(200),
  body:             z.string().trim().max(10_000).nullish(),
  request_type:     z.string().trim().min(1, '요청 유형을 선택해 주세요').max(50),
  target_source_id: z.string().uuid().nullish(),
  target_name:      z.string().trim().max(100).nullish(),
  target_org:       z.string().trim().max(200).nullish(),
  reward_points:    z.number().int().min(5).max(100).default(10),
})

// ── 노트 ─────────────────────────────────────────────────────────────────────

export const CreateNoteSchema = z.object({
  content:      z.string().trim().min(1, '내용을 입력해주세요').max(10_000),
  is_sensitive: z.boolean().default(false),
})
