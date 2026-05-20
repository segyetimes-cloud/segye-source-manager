/**
 * src/lib/copyWatermark.ts
 *
 * 클립보드 복사 추적 워터마크 — 2중 레이어
 *
 * ┌────────────────────────────────────────────────────────────────────┐
 * │ 1차 (완전 불가시): Zero-width 문자 fingerprint                       │
 * │   ⁠ (마커) + ​ (비트 0) + ‌ (비트 1) × 32            │
 * │   → 붙여넣기 후에도 ZW 문자가 유지 → 역추적 가능                     │
 * │                                                                    │
 * │ 2차 (준가시, CSS로 숨김): 단어 경계 쉼표/마침표 삽입                   │
 * │   → 화면에서는 배경색 동일 → 보이지 않음                              │
 * │   → 평문 파일·이메일 등에서는 패턴으로 식별 가능                       │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * 역추적 API:
 *   extractZWFingerprints(text)   → 삽입된 fingerprint 숫자 배열
 *   identifyLeaker(text, users)   → 매칭된 userId
 */

// ── 공통 해시 ─────────────────────────────────────────────────────────────────

/** FNV-1a 32-bit — 경량, 결정적 */
function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h
}

/** 시드 기반 의사난수 [0, 1) (xorshift32 변형) */
function seededRnd(seed: number, index: number): number {
  let s = (seed ^ (index * 0x9e3779b9 + 0x6d2b79f5)) >>> 0
  s ^= s << 13; s ^= s >>> 17; s ^= s << 5
  return (s >>> 0) / 0x100000000
}

/**
 * userId → 32-bit 정수 fingerprint
 * 동일 userId는 항상 동일한 값 → 역추적 키
 */
function userFingerprint(userId: string): number {
  return fnv1a(userId) >>> 0
}

/**
 * userId → 쉼표/마침표 패턴 시드 (상위·하위 16비트 XOR 혼합)
 */
function userSeed(userId: string): number {
  const h = fnv1a(userId)
  return ((h >>> 16) ^ (h & 0xffff)) | ((h & 0xff00) << 8)
}

// ── 1차: Zero-width character watermark ───────────────────────────────────────

const ZW_MARKER = '⁠'  // Word joiner — 시작/끝 구분
const ZW_ZERO   = '​'  // Zero-width space — 비트 0
const ZW_ONE    = '‌'  // Zero-width non-joiner — 비트 1

/**
 * 32-bit 정수 → ZW 문자열
 * 형식: ⁠ + 32×(​|‌) + ⁠
 */
function encodeFingerprint(n: number): string {
  let bits = ZW_MARKER
  for (let i = 31; i >= 0; i--) {
    bits += ((n >>> i) & 1) ? ZW_ONE : ZW_ZERO
  }
  bits += ZW_MARKER
  return bits
}

/**
 * userId의 fingerprint를 ZW 문자열로 인코딩
 */
export function encodeUserFingerprint(userId: string): string {
  return encodeFingerprint(userFingerprint(userId))
}

/**
 * 텍스트에서 ZW fingerprint를 모두 추출 → 32-bit 정수 배열
 * 중복 삽입된 사본 모두 반환 (majority vote용)
 */
export function extractZWFingerprints(text: string): number[] {
  const results: number[] = []
  // ⁠ + 32개의 ​|‌ + ⁠
  const RE = /⁠([​‌]{32})⁠/g
  let m: RegExpExecArray | null
  while ((m = RE.exec(text)) !== null) {
    let n = 0
    for (const c of m[1]) {
      n = (n * 2) | (c === ZW_ONE ? 1 : 0)
    }
    results.push(n >>> 0)
  }
  return results
}

/**
 * 복사된 텍스트에 ZW fingerprint를 N곳에 삽입합니다.
 *
 * 삽입 위치:
 *   - 첫 번째 단어 뒤
 *   - 텍스트 중간 (각 ~150자마다 1개)
 *   - 마지막 단어 앞
 *
 * 텍스트가 짧으면 삽입 횟수를 줄여 자연스러움 유지
 */
export function injectZeroWidthWatermark(text: string, userId: string): string {
  if (!userId || !text || text.trim().length < 4) return text

  const fp = encodeFingerprint(userFingerprint(userId))
  const INTERVAL = 100  // 약 100자마다 삽입 (더 많은 사본 = 더 높은 내구성)

  // 삽입 위치 결정: 공백 경계 기준
  const insertions = new Set<number>()

  // 첫 번째 공백 이후 (맨 앞 사본)
  const firstSpace = text.search(/\s/)
  if (firstSpace > 0) insertions.add(firstSpace + 1)

  // 중간 지점들 (INTERVAL 간격)
  for (let pos = INTERVAL; pos < text.length - 10; pos += INTERVAL) {
    // 가장 가까운 공백 위치로 이동
    const nearSpace = text.indexOf(' ', pos)
    if (nearSpace > 0 && nearSpace < text.length - 5) {
      insertions.add(nearSpace + 1)
    } else {
      insertions.add(pos)
    }
  }

  // 마지막 공백 이전 (마지막 사본 보장)
  if (text.length > 20) {
    const lastSpace = text.lastIndexOf(' ')
    if (lastSpace > 0) insertions.add(lastSpace)
  }

  // 짧은 텍스트: 맨 앞에 삽입
  if (insertions.size === 0) {
    return fp + text
  }

  // 위치 정렬 후 삽입 (뒤에서부터 삽입하면 offset 불변)
  const sortedPositions = [...insertions].sort((a, b) => b - a)
  let result = text
  for (const pos of sortedPositions) {
    result = result.slice(0, pos) + fp + result.slice(pos)
  }
  return result
}

// ── 2차: 쉼표/마침표 watermark (secondary) ───────────────────────────────────

/** 마커 결정: 시드에 따라 ',' 또는 '.' */
function pickMarker(seed: number, idx: number): string {
  return seededRnd(seed, idx * 13 + 7) > 0.5 ? ',' : '.'
}

/**
 * 복사된 텍스트에 사용자 식별 마커(쉼표/마침표)를 삽입합니다.
 * CSS로 배경색과 동일하게 처리해 화면에서는 보이지 않음.
 *
 * - 평균 2~4 단어마다 마커 1개 삽입
 * - 이미 구두점으로 끝나는 단어 뒤에는 중복 삽입 안 함
 */
export function injectCopyWatermark(text: string, userId: string): string {
  if (!userId || !text || text.trim().length < 8) return text

  const seed = userSeed(userId)

  const tokens = text.split(/(\s+)/)
  const result: string[] = []
  let wordCount = 0
  let markerIdx = 0
  let nextThreshold = 2 + Math.floor(seededRnd(seed, 0) * 2)

  for (const token of tokens) {
    result.push(token)

    if (/\S/.test(token)) {
      wordCount++

      if (wordCount >= nextThreshold) {
        const lastChar = token[token.length - 1]
        if (!/[.,!?;:。、]/.test(lastChar)) {
          result.push(pickMarker(seed, markerIdx))
        }
        markerIdx++
        wordCount = 0
        nextThreshold = 2 + Math.floor(seededRnd(seed, markerIdx * 5) * 2)
      }
    }
  }

  return result.join('')
}

/**
 * 두 레이어 watermark를 모두 적용합니다.
 * 1차(ZW) + 2차(쉼표/마침표) 순서로 삽입
 *
 * @param text    복사된 원본 텍스트
 * @param userId  현재 사용자 ID
 */
export function injectFullWatermark(text: string, userId: string): string {
  const step1 = injectZeroWidthWatermark(text, userId)
  const step2 = injectCopyWatermark(step1, userId)
  return step2
}

// ── 역추적 API ───────────────────────────────────────────────────────────────

/**
 * 쉼표/마침표 패턴 추출 (2차 watermark 역추적)
 * @returns '0'(쉼표) '1'(마침표) 이진 문자열
 */
export function extractWatermarkPattern(text: string): string {
  const markers = [...text.matchAll(/([,.])\s/g)]
  return markers.map(m => m[1] === ',' ? '0' : '1').join('')
}

/**
 * 특정 userId의 예상 쉼표/마침표 패턴 (2차 watermark 검증용)
 */
export function expectedPattern(userId: string, length: number): string {
  const seed = userSeed(userId)
  return Array.from({ length }, (_, i) =>
    seededRnd(seed, i * 13 + 7) > 0.5 ? '1' : '0'
  ).join('')
}

/**
 * 유출 텍스트에서 발신자를 자동 식별합니다.
 *
 * ┌───────────────────────────────────────────────────────────┐
 * │ 자동 식별: ZW fingerprint 직접 비교 (정확도 100%)            │
 * │   → 과반수(≥50%) ZW 사본이 동일 fingerprint → 식별 성공      │
 * │                                                           │
 * │ 쉼표/마침표 패턴은 자동 매칭에서 제외                          │
 * │   이유: 원문의 자연 구두점이 섞여 오탐지 발생                  │
 * │   용도: 인간 포렌식 분석용 시각적 보조 레이어로만 활용           │
 * └───────────────────────────────────────────────────────────┘
 *
 * @param text       분석할 텍스트 (유출본)
 * @param candidates 후보 userId 목록
 * @returns 식별된 경우 { userId, matchRate: 1.0, method: 'zw' }, 아니면 null
 */
export function identifyLeaker(
  text: string,
  candidates: string[]
): { userId: string; matchRate: number; method: 'zw' } | null {
  const extracted = extractZWFingerprints(text)
  if (extracted.length === 0) return null

  for (const userId of candidates) {
    const expected = userFingerprint(userId)
    const matches = extracted.filter(fp => fp === expected).length
    // 과반수 이상 사본이 일치 (노이즈·일부 손실에도 내구성 있음)
    if (matches > 0 && matches / extracted.length >= 0.5) {
      return { userId, matchRate: 1.0, method: 'zw' }
    }
  }

  return null
}

/**
 * 쉼표/마침표 패턴을 인간이 읽기 쉬운 형태로 출력합니다.
 * 자동 매칭이 아닌 포렌식 분석자의 수동 검토용입니다.
 *
 * 주의: 원문 자연 구두점이 섞이므로 자동 매칭에 사용하지 마세요.
 *
 * @param text       분석할 텍스트
 * @param candidates 후보 userId 목록
 * @returns 각 후보의 패턴 일치 정보 (수동 검토용)
 */
export function analyzePunctuationHint(
  text: string,
  candidates: string[]
): Array<{ userId: string; matchRate: number; pattern: string; expected: string }> {
  const pattern = extractWatermarkPattern(text)
  if (!pattern.length) return []

  return candidates.map(userId => {
    const exp = expectedPattern(userId, pattern.length)
    let matches = 0
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i] === exp[i]) matches++
    }
    return { userId, matchRate: matches / pattern.length, pattern, expected: exp }
  }).sort((a, b) => b.matchRate - a.matchRate)
}
