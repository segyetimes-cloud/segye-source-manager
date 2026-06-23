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

/** 빈 문자열을 null로 변환하는 preprocess 헬퍼 (이메일·날짜 필드 공통) */
const emptyToNull = (v: unknown) =>
  typeof v === 'string' && v.trim() === '' ? null : v

/**
 * request body를 JSON으로 파싱하고 Zod 스키마로 검증합니다.
 * 실패 시 400 NextResponse를 포함한 { ok: false } 를 반환합니다.
 *
 * - Content-Length > 1 MB 이면 413 반환 (DoS 방어)
 * - 첫 번째 에러는 { error, field } 로, 전체 에러는 { errors } 배열로 함께 반환
 */
export async function parseBody<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
): Promise<ParseResult<z.infer<S>>> {
  const contentLength = request.headers.get('content-length')
  if (contentLength && Number(contentLength) > 1_000_000) {
    return {
      ok: false,
      response: NextResponse.json({ error: '요청 페이로드가 너무 큽니다 (최대 1 MB)' }, { status: 413 }),
    }
  }

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
    const issue  = result.error.issues[0]
    const field  = issue.path.length > 0 ? issue.path.join('.') : undefined
    const errors = result.error.issues.map(i => ({
      field:   i.path.length > 0 ? i.path.join('.') : undefined,
      message: i.message,
    }))
    return {
      ok: false,
      response: NextResponse.json(
        { error: issue.message, ...(field ? { field } : {}), errors },
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
  email_primary:        z.preprocess(emptyToNull, z.string().trim().email('올바른 이메일 형식이 아닙니다').max(200).nullish()),
  email_secondary:      z.preprocess(emptyToNull, z.string().trim().email('올바른 이메일 형식이 아닙니다').max(200).nullish()),
  birthday:             z.preprocess(emptyToNull, z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '날짜 형식은 YYYY-MM-DD 입니다').nullish()),
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

export type CreateSourceInput = z.infer<typeof CreateSourceSchema>

// ── 정보보고 ─────────────────────────────────────────────────────────────────

export const CreateReportSchema = z.object({
  title:      z.string({ error: '제목을 입력해 주세요' }).trim().min(1, '제목을 입력해 주세요').max(200),
  content:    z.string().trim().max(100_000).default(''),
  tags:       z.array(z.string().trim().max(50)).max(30).optional(),
  visibility: z.enum(['author_only', 'desk_above', 'my_desk', 'team', 'all']).default('my_desk'),
  source_ids: z.array(z.string().uuid()).max(50).optional(),
  allowed_user_ids: z.array(z.string().uuid()).max(100).optional(),
})

export type CreateReportInput = z.infer<typeof CreateReportSchema>

// ── 열람 신청 승인/거절 ──────────────────────────────────────────────────────

export const ApprovalDecisionSchema = z.object({
  approval_id:   z.string().uuid('잘못된 approval_id 형식입니다'),
  action:        z.enum(['approve', 'reject']),
  reject_reason: z.string().trim().max(500).optional(),
})

export type ApprovalDecisionInput = z.infer<typeof ApprovalDecisionSchema>

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

export type CreateUserInput = z.infer<typeof CreateUserSchema>

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

export type CreateHelpInput = z.infer<typeof CreateHelpSchema>

// ── 노트 ─────────────────────────────────────────────────────────────────────

export const CreateNoteSchema = z.object({
  content:      z.string().trim().min(1, '내용을 입력해주세요').max(10_000),
  is_sensitive: z.boolean().default(false),
})

export type CreateNoteInput = z.infer<typeof CreateNoteSchema>
