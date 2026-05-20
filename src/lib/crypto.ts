/**
 * src/lib/crypto.ts
 *
 * 민감 필드 암호화 유틸리티 — AES-256-GCM
 *
 * 환경변수:
 *   FIELD_ENCRYPTION_KEY  64자리 hex 문자열 (= 32바이트 키)
 *   생성법: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * 암호화 대상 필드:
 *   - personal_notes   (민감 메모)
 *   - phone_primary    (개인 연락처)
 *   - phone_secondary  (개인 연락처)
 *
 * 포맷: base64( IV(12) || AuthTag(16) || Ciphertext )
 *
 * 마이그레이션 안전성:
 *   decryptNullable()은 복호화 실패 시 원본값을 반환합니다.
 *   키 미설정 시에도 원본값을 그대로 반환하므로 점진적 전환이 가능합니다.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES   = 12  // 96-bit IV (GCM 권장)
const TAG_BYTES  = 16  // 128-bit auth tag

function getKey(): Buffer | null {
  const hex = process.env.FIELD_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) return null
  return Buffer.from(hex, 'hex')
}

/** 암호화. 키가 없으면 원문 반환 (마이그레이션 기간 허용) */
export function encryptField(plaintext: string): string {
  const key = getKey()
  if (!key) return plaintext  // key not configured — store plain (log warning in dev)

  const iv      = randomBytes(IV_BYTES)
  const cipher  = createCipheriv(ALGORITHM, key, iv)
  const enc     = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  // 포맷: v1: + base64( IV(12) + authTag(16) + ciphertext ) — 키 로테이션 지원
  return 'v1:' + Buffer.concat([iv, authTag, enc]).toString('base64')
}

/** 복호화. 실패 시 원본 반환 (평문 데이터 마이그레이션 기간 대응) */
export function decryptField(value: string): string {
  const key = getKey()
  if (!key) return value

  try {
    // v1: 접두사 처리 (새 포맷) — 나머지는 구형 포맷으로 처리 (하위 호환)
    let b64 = value
    if (value.startsWith('v1:')) {
      b64 = value.slice(3)
    } else if (value.startsWith('v2:') || value.startsWith('v3:')) {
      // 미래 키 버전 — 현재는 지원 안 함, 원본 반환
      return value
    }
    // 구형 포맷은 b64 그대로 사용 (기존 암호화 데이터 하위 호환)

    const buf     = Buffer.from(b64, 'base64')
    if (buf.length < IV_BYTES + TAG_BYTES) return value  // 너무 짧으면 평문

    const iv        = buf.subarray(0, IV_BYTES)
    const authTag   = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
    const encrypted = buf.subarray(IV_BYTES + TAG_BYTES)

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)
    return decipher.update(encrypted) + decipher.final('utf8')
  } catch {
    return value
  }
}

/** null/undefined 안전한 암호화 래퍼 */
export function encryptNullable(value: string | null | undefined): string | null {
  if (value == null || value === '') return null
  return encryptField(value)
}

/** null/undefined 안전한 복호화 래퍼 */
export function decryptNullable(value: string | null | undefined): string | null {
  if (value == null || value === '') return null
  return decryptField(value)
}

/** 키 설정 여부 확인 (헬스체크용) */
export function isEncryptionEnabled(): boolean {
  return getKey() !== null
}

/** 버전 접두사가 있는 암호화 포맷인지 확인 */
export function isVersionedEncrypted(value: string): boolean {
  return /^v\d+:/.test(value)
}
