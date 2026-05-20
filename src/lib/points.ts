/**
 * 취재원 완성도 점수 & 포인트 계산 통합 모듈
 *
 * 완성도 점수 기준 (최대 60, 필드 기반)
 *   [기본정보 20]  이름 5 · 소속 8 · 직책 5 · 생년월일 2
 *   [연락처  20]   전화(주) 13 · 이메일(주) 7
 *   [학력    20]   대학 8 · 고교 6 · 전공 3 · 대학원 2 · 고시기수 1
 *   (+정보(source_notes) 40점은 별도 산정)
 *
 * 등록 보상 포인트 (3단계)
 *   완성도 55+  →  30pt
 *   완성도 35+  →  15pt
 *   그 외       →   5pt
 */

export type ScorableSource = Partial<Record<string, unknown>>

// ── 완성도 점수 (0 ~ 60) ─────────────────────────────────────────────────────
export function calcCompletenessScore(data: ScorableSource): number {
  let s = 0
  if (data.full_name)            s += 5
  if (data.current_organization) s += 8
  if (data.current_position)     s += 5
  if (data.birthday)             s += 2
  if (data.phone_primary)        s += 13
  if (data.email_primary)        s += 7
  if (data.university)           s += 8
  if (data.high_school)          s += 6
  if (data.university_major)     s += 3
  if (data.graduate_school)      s += 2
  if (data.exam_batch)           s += 1
  return s  // max 60
}

// ── 정보(source_notes) 점수 (0 / 20 / 40) ───────────────────────────────────
export function calcNoteScore(authorCount: number): number {
  if (authorCount >= 2) return 40
  if (authorCount === 1) return 20
  return 0
}

// ── 전체 완성도 (0 ~ 100) ────────────────────────────────────────────────────
export function calcTotalScore(data: ScorableSource, noteAuthorCount = 0): number {
  return calcCompletenessScore(data) + calcNoteScore(noteAuthorCount)
}

// ── 등록 보상 포인트 ─────────────────────────────────────────────────────────
export function calcRegistrationPoints(data: ScorableSource): number {
  const s = calcCompletenessScore(data)
  if (s >= 55) return 30
  if (s >= 35) return 15
  return 5
}

// ── 수정 시 증분 포인트 (새로 채워진 필드별) ────────────────────────────────
// 완성도 기여도와 비례 (합산 기준 최대 약 20pt)
export const INCREMENTAL_POINT_FIELDS: ReadonlyArray<[string, number]> = [
  ['full_name',            1.5],
  ['current_organization', 2.5],
  ['current_position',     1.5],
  ['birthday',             0.5],
  ['phone_primary',        4.0],
  ['email_primary',        2.0],
  ['university',           2.5],
  ['high_school',          2.0],
  ['university_major',     1.0],
  ['graduate_school',      0.5],
  ['exam_batch',           0.5],
  ['hometown_province',    0.5],
  ['hometown_city',        0.5],
] as const
