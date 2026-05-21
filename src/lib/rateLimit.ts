/**
 * Supabase 기반 분산 Rate Limiter
 *
 * public.rate_limit_check() Postgres 함수를 통해 모든 Vercel 인스턴스가
 * 동일한 카운터를 공유합니다. 메모리 기반 대비 완전한 분산 제한이 가능합니다.
 *
 * DB 호출이 실패(네트워크 오류 등)하면 failOpen=true 옵션에 따라
 * 기본적으로 요청을 허용합니다(서비스 가용성 우선).
 */

import { createServiceClient } from '@/lib/supabase/server'

export interface RateLimitOptions {
  /** 키 접두사 (엔드포인트 식별용) */
  prefix: string
  /** 허용 요청 수 */
  limit: number
  /** 윈도우 크기 (밀리초) */
  windowMs: number
  /**
   * DB 오류 시 요청을 허용할지 여부 (기본: true)
   * false로 설정 시 DB 오류가 곧 거부(deny-closed)가 됩니다.
   */
  failOpen?: boolean
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * Supabase DB 기반 Rate Limit 확인 (분산 환경 지원)
 *
 * @example
 * const rl = await checkRateLimit(`${user.id}:${ip}`, { prefix: 'ocr-batch', limit: 5, windowMs: 60_000 })
 * if (!rl.allowed) return NextResponse.json({ error: '요청이 너무 많습니다.' }, { status: 429 })
 */
export async function checkRateLimit(
  identifier: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const key = `${opts.prefix}:${identifier}`
  const failOpen = opts.failOpen !== false // default: true

  try {
    const supabase = createServiceClient()
    const { data, error } = await supabase.rpc('rate_limit_check', {
      p_key: key,
      p_limit: opts.limit,
      p_window_ms: opts.windowMs,
    } as unknown as undefined)

    if (error) {
      console.error('[rateLimit] DB error:', error.message)
      return {
        allowed: failOpen,
        remaining: failOpen ? opts.limit : 0,
        resetAt: Date.now() + opts.windowMs,
      }
    }

    const rawData = data as Array<{ allowed: boolean; count: number; reset_at: string }> | null
    const row = Array.isArray(rawData) ? rawData[0] : null
    const resetMs = row?.reset_at ? new Date(row.reset_at).getTime() : Date.now() + opts.windowMs
    const count: number = row?.count ?? 1

    return {
      allowed: row?.allowed ?? failOpen,
      remaining: Math.max(0, opts.limit - count),
      resetAt: resetMs,
    }
  } catch (err) {
    console.error('[rateLimit] unexpected error:', err)
    return {
      allowed: failOpen,
      remaining: failOpen ? opts.limit : 0,
      resetAt: Date.now() + opts.windowMs,
    }
  }
}

/**
 * NextRequest에서 클라이언트 IP를 추출합니다.
 */
export function getClientIp(req: { headers: { get(name: string): string | null } }): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}
