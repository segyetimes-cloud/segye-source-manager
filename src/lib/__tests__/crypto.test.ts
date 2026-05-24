/**
 * src/lib/__tests__/crypto.test.ts
 *
 * AES-256-GCM 암호화 유틸리티 단위 테스트
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ─── 테스트용 키 (64자리 hex = 32바이트) ────────────────────────────────────
const TEST_KEY = 'a'.repeat(64)  // 0xaaaa...aa (32바이트)
const ALT_KEY  = 'b'.repeat(64)  // 다른 키

// ─── 환경변수 모킹 헬퍼 ──────────────────────────────────────────────────────
function setKey(hex: string | undefined) {
  if (hex === undefined) {
    delete process.env.FIELD_ENCRYPTION_KEY
  } else {
    process.env.FIELD_ENCRYPTION_KEY = hex
  }
}

// ─── 모듈을 각 테스트마다 새로 import (env 변경 반영) ────────────────────────
async function freshCrypto() {
  vi.resetModules()
  return import('../crypto')
}

describe('crypto — encryptField / decryptField', () => {
  afterEach(() => {
    delete process.env.FIELD_ENCRYPTION_KEY
    vi.resetModules()
  })

  it('키 미설정 시 암호화하지 않고 원문 반환', async () => {
    setKey(undefined)
    const { encryptField } = await freshCrypto()
    expect(encryptField('010-1234-5678')).toBe('010-1234-5678')
  })

  it('키 길이가 64자리 미만이면 암호화 비활성화', async () => {
    setKey('aabb')
    const { encryptField } = await freshCrypto()
    expect(encryptField('test')).toBe('test')
  })

  it('암호화된 값은 원문과 달라야 함', async () => {
    setKey(TEST_KEY)
    const { encryptField } = await freshCrypto()
    const cipher = encryptField('010-1234-5678')
    expect(cipher).not.toBe('010-1234-5678')
  })

  it('암호화 후 복호화하면 원문이 나와야 함', async () => {
    setKey(TEST_KEY)
    const { encryptField, decryptField } = await freshCrypto()
    const plain  = '홍길동 비밀 메모'
    const cipher = encryptField(plain)
    expect(decryptField(cipher)).toBe(plain)
  })

  it('같은 원문을 두 번 암호화하면 결과가 달라야 함 (랜덤 IV)', async () => {
    setKey(TEST_KEY)
    const { encryptField } = await freshCrypto()
    const a = encryptField('secret')
    const b = encryptField('secret')
    expect(a).not.toBe(b)
  })

  it('결과는 valid base64 문자열이어야 함', async () => {
    setKey(TEST_KEY)
    const { encryptField } = await freshCrypto()
    const cipher = encryptField('hello')
    expect(() => Buffer.from(cipher, 'base64')).not.toThrow()
  })

  it('base64 크기 = IV(12) + AuthTag(16) + 원문 바이트 길이', async () => {
    setKey(TEST_KEY)
    const { encryptField } = await freshCrypto()
    const plain  = 'abc'  // 3바이트
    const cipher = encryptField(plain)
    const b64 = cipher.startsWith('v1:') ? cipher.slice(3) : cipher
    const decoded = Buffer.from(b64, 'base64')
    expect(decoded.length).toBe(12 + 16 + Buffer.byteLength(plain, 'utf8'))
  })

  it('빈 문자열도 암호화 후 복호화 가능', async () => {
    setKey(TEST_KEY)
    const { encryptField, decryptField } = await freshCrypto()
    const cipher = encryptField('')
    expect(decryptField(cipher)).toBe('')
  })

  it('유니코드(한글) 원문 복호화', async () => {
    setKey(TEST_KEY)
    const { encryptField, decryptField } = await freshCrypto()
    const plain = '이것은 테스트 메모입니다 🔐'
    expect(decryptField(encryptField(plain))).toBe(plain)
  })
})

describe('crypto — decryptField 내성(tamper) 테스트', () => {
  afterEach(() => {
    delete process.env.FIELD_ENCRYPTION_KEY
    vi.resetModules()
  })

  it('키 미설정 시 복호화 없이 원문 반환', async () => {
    setKey(undefined)
    const { decryptField } = await freshCrypto()
    expect(decryptField('plaintext')).toBe('plaintext')
  })

  it('평문이 들어오면 원문 반환 (graceful fallback)', async () => {
    setKey(TEST_KEY)
    const { decryptField } = await freshCrypto()
    // 일반 전화번호 — base64지만 IV+Tag보다 짧아 평문으로 처리
    expect(decryptField('010-1234-5678')).toBe('010-1234-5678')
  })

  it('다른 키로 암호화된 값은 복호화 실패 → 원문 반환', async () => {
    setKey(TEST_KEY)
    const { encryptField } = await freshCrypto()
    const cipher = encryptField('secret')

    // 다른 키로 복호화 시도
    setKey(ALT_KEY)
    const { decryptField } = await freshCrypto()
    // GCM auth tag 검증 실패 → 원본 base64 반환
    expect(decryptField(cipher)).toBe(cipher)
  })

  it('훼손된 base64 값도 graceful fallback', async () => {
    setKey(TEST_KEY)
    const { encryptField, decryptField } = await freshCrypto()
    const cipher = encryptField('secret')
    // 마지막 문자를 바꿔 훼손
    const tampered = cipher.slice(0, -1) + (cipher.endsWith('A') ? 'B' : 'A')
    // 오류 없이 원본(tampered) 반환
    expect(() => decryptField(tampered)).not.toThrow()
  })
})

describe('crypto — encryptNullable / decryptNullable', () => {
  afterEach(() => {
    delete process.env.FIELD_ENCRYPTION_KEY
    vi.resetModules()
  })

  it('null 입력 → null 반환', async () => {
    setKey(TEST_KEY)
    const { encryptNullable, decryptNullable } = await freshCrypto()
    expect(encryptNullable(null)).toBeNull()
    expect(decryptNullable(null)).toBeNull()
  })

  it('undefined 입력 → null 반환', async () => {
    setKey(TEST_KEY)
    const { encryptNullable, decryptNullable } = await freshCrypto()
    expect(encryptNullable(undefined)).toBeNull()
    expect(decryptNullable(undefined)).toBeNull()
  })

  it('빈 문자열 입력 → null 반환', async () => {
    setKey(TEST_KEY)
    const { encryptNullable, decryptNullable } = await freshCrypto()
    expect(encryptNullable('')).toBeNull()
    expect(decryptNullable('')).toBeNull()
  })

  it('정상값 — 암호화 → 복호화 왕복', async () => {
    setKey(TEST_KEY)
    const { encryptNullable, decryptNullable } = await freshCrypto()
    const plain  = '010-9999-8888'
    const cipher = encryptNullable(plain)
    expect(cipher).not.toBeNull()
    expect(decryptNullable(cipher!)).toBe(plain)
  })
})

describe('crypto — isEncryptionEnabled', () => {
  afterEach(() => {
    delete process.env.FIELD_ENCRYPTION_KEY
    vi.resetModules()
  })

  it('키 미설정 → false', async () => {
    setKey(undefined)
    const { isEncryptionEnabled } = await freshCrypto()
    expect(isEncryptionEnabled()).toBe(false)
  })

  it('잘못된 키 길이 → false', async () => {
    setKey('deadbeef')
    const { isEncryptionEnabled } = await freshCrypto()
    expect(isEncryptionEnabled()).toBe(false)
  })

  it('올바른 키 → true', async () => {
    setKey(TEST_KEY)
    const { isEncryptionEnabled } = await freshCrypto()
    expect(isEncryptionEnabled()).toBe(true)
  })
})
