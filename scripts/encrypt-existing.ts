/**
 * scripts/encrypt-existing.ts
 *
 * 기존 평문 데이터를 AES-256-GCM으로 암호화하는 1회성 마이그레이션 스크립트
 *
 * 사용법:
 *   FIELD_ENCRYPTION_KEY=<64자리hex> npx tsx scripts/encrypt-existing.ts
 *
 * 옵션:
 *   --dry-run   실제로 저장하지 않고 변환 결과만 출력
 *   --batch=50  배치 크기 (기본값 50)
 *   --resume=<last_processed_id>  특정 id 이후부터 재개
 *
 * 안전 원칙:
 *  - 이미 암호화된 값은 건드리지 않는다 (isAlreadyEncrypted 판별)
 *  - 변환 전·후 값을 audit_logs에 기록한다
 *  - 실패한 행은 skip하고 마지막에 요약 출력
 */

import { createClient } from '@supabase/supabase-js'
import { createCipheriv, randomBytes } from 'node:crypto'

// ─── 환경변수 검증 ──────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY
const KEY_HEX      = process.env.FIELD_ENCRYPTION_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다.')
  process.exit(1)
}
if (!KEY_HEX || KEY_HEX.length !== 64) {
  console.error('❌ FIELD_ENCRYPTION_KEY 가 없거나 64자리 hex가 아닙니다.')
  console.error('   생성 명령: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"')
  process.exit(1)
}

const ENCRYPTION_KEY = Buffer.from(KEY_HEX, 'hex')

// ─── CLI 플래그 파싱 ─────────────────────────────────────────────────────────

const args     = process.argv.slice(2)
const DRY_RUN  = args.includes('--dry-run')
const BATCH    = parseInt(args.find(a => a.startsWith('--batch='))?.split('=')[1] ?? '50')
const RESUME   = args.find(a => a.startsWith('--resume='))?.split('=')[1]

console.log(`\n세계일보 취재원 시스템 — 암호화 마이그레이션`)
console.log(`=`.repeat(50))
console.log(`모드: ${DRY_RUN ? '🔵 DRY RUN (저장 없음)' : '🔴 LIVE (실제 저장)'}`)
console.log(`배치 크기: ${BATCH}`)
if (RESUME) console.log(`재개 지점: ${RESUME} 이후`)
console.log()

// ─── 암호화 유틸리티 ─────────────────────────────────────────────────────────

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES  = 12
const TAG_BYTES = 16

/**
 * 이미 암호화된 값인지 판별
 * base64 디코딩 후 최소 길이(IV + Tag + 최소 1바이트 = 29바이트) 이상이면 암호화된 것으로 간주
 */
function isAlreadyEncrypted(value: string): boolean {
  try {
    const buf = Buffer.from(value, 'base64')
    // base64가 아닌 일반 텍스트는 디코딩 결과가 이상하거나 너무 짧음
    if (buf.length < IV_BYTES + TAG_BYTES + 1) return false
    // 추가 휴리스틱: 원본 문자열이 base64 문자 집합만으로 이루어져야 함
    return /^[A-Za-z0-9+/]+=*$/.test(value)
  } catch {
    return false
  }
}

function encryptField(plaintext: string): string {
  const iv       = randomBytes(IV_BYTES)
  const cipher   = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag  = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

// ─── Supabase 클라이언트 (service role — RLS 우회) ───────────────────────────

const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, {
  auth: { persistSession: false },
})

// ─── 암호화 대상 필드 ────────────────────────────────────────────────────────

const FIELDS_TO_ENCRYPT = ['phone_primary', 'phone_secondary', 'personal_notes'] as const
type EncryptField = typeof FIELDS_TO_ENCRYPT[number]

// ─── 통계 ────────────────────────────────────────────────────────────────────

const stats = {
  total:     0,
  encrypted: 0,
  skipped:   0,  // 이미 암호화됨
  blank:     0,  // null/빈 값
  failed:    0,
  errors:    [] as string[],
}

// ─── 메인 ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('📊 마이그레이션 대상 건수 조회 중...')

  const { count, error: countErr } = await supabase
    .from('sources')
    .select('id', { count: 'exact', head: true })
    .is('deleted_at', null)

  if (countErr) {
    console.error('❌ 건수 조회 실패:', countErr.message)
    process.exit(1)
  }

  console.log(`✅ 총 ${count}개 취재원 처리 예정\n`)
  stats.total = count ?? 0

  let cursor: string | null = RESUME ?? null
  let processed = 0

  while (true) {
    // ─── 배치 조회 ──────────────────────────────────────────────────────────
    let query = supabase
      .from('sources')
      .select(`id, phone_primary, phone_secondary, personal_notes, created_by`)
      .is('deleted_at', null)
      .order('id', { ascending: true })
      .limit(BATCH)

    if (cursor) {
      query = query.gt('id', cursor)
    }

    const { data: rows, error: fetchErr } = await query

    if (fetchErr) {
      console.error('❌ 배치 조회 실패:', fetchErr.message)
      break
    }
    if (!rows || rows.length === 0) break

    // ─── 배치 처리 ──────────────────────────────────────────────────────────
    for (const row of rows) {
      const updates: Partial<Record<EncryptField, string | null>> = {}
      let hasUpdate = false

      for (const field of FIELDS_TO_ENCRYPT) {
        const value = row[field] as string | null | undefined

        if (!value) {
          stats.blank++
          continue
        }

        if (isAlreadyEncrypted(value)) {
          stats.skipped++
          console.log(`  ⏭️  ${row.id} [${field}] — 이미 암호화됨`)
          continue
        }

        try {
          updates[field] = encryptField(value)
          hasUpdate = true
        } catch (e) {
          stats.failed++
          const msg = `${row.id} [${field}]: ${e instanceof Error ? e.message : String(e)}`
          stats.errors.push(msg)
          console.error(`  ❌ 암호화 실패: ${msg}`)
        }
      }

      if (!hasUpdate) continue

      if (DRY_RUN) {
        console.log(`  🔵 [DRY] ${row.id} — ${Object.keys(updates).join(', ')} 암호화 예정`)
        stats.encrypted++
        continue
      }

      // ─── 실제 저장 ────────────────────────────────────────────────────────
      const { error: updateErr } = await supabase
        .from('sources')
        .update(updates)
        .eq('id', row.id)

      if (updateErr) {
        stats.failed++
        const msg = `${row.id}: ${updateErr.message}`
        stats.errors.push(msg)
        console.error(`  ❌ 저장 실패: ${msg}`)
        continue
      }

      stats.encrypted++
      processed++

      // audit_logs 기록 (service role 사용 — RLS 우회)
      await supabase.from('audit_logs').insert({
        user_id:       '00000000-0000-0000-0000-000000000000',  // system
        user_email:    'system@migration',
        action:        'encrypt_migration',
        resource_type: 'source',
        resource_id:   row.id,
        detail: {
          fields: Object.keys(updates),
          script: 'scripts/encrypt-existing.ts',
        },
      })

      if (processed % 10 === 0) {
        process.stdout.write(`\r  진행: ${processed} / ${stats.total} (${Math.round(processed / (stats.total || 1) * 100)}%)`)
      }
    }

    cursor = rows[rows.length - 1].id
  }

  // ─── 결과 요약 ────────────────────────────────────────────────────────────
  console.log('\n\n' + '='.repeat(50))
  console.log('📋 마이그레이션 결과 요약')
  console.log('='.repeat(50))
  console.log(`  전체 취재원:      ${stats.total.toLocaleString()}건`)
  console.log(`  암호화 완료:      ${stats.encrypted.toLocaleString()}건`)
  console.log(`  이미 암호화됨:    ${stats.skipped.toLocaleString()}건`)
  console.log(`  빈 필드 (skip):   ${stats.blank.toLocaleString()}건`)
  console.log(`  실패:             ${stats.failed.toLocaleString()}건`)

  if (stats.errors.length > 0) {
    console.log('\n⚠️  오류 목록:')
    stats.errors.forEach(e => console.log(`  - ${e}`))
    process.exit(1)
  }

  if (DRY_RUN) {
    console.log('\n🔵 DRY RUN 완료. 실제 적용하려면 --dry-run 플래그를 제거하고 재실행하세요.')
  } else {
    console.log('\n✅ 암호화 마이그레이션 완료!')
    console.log('   다음 단계: 기존 env에서 암호화 전 DB 스냅샷을 보관하고')
    console.log('   FIELD_ENCRYPTION_KEY 를 Vercel/운영 환경에 적용하세요.')
  }
}

main().catch(err => {
  console.error('\n💥 예기치 않은 오류:', err)
  process.exit(1)
})
