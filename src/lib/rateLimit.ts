/**
 * 메모리 기반 Rate Limiter (Vercel Serverless 환경)
 *
 * Vercel 서버리스는 인스턴스가 분산되므로 완벽한 전역 제한은 불가능하지만,
 * 동일 인스턴스 내 폭발적 호출(burst) 방어 효과가 있습니다.
 * 추후 Upstash Redis 등 외부 스토어로 교체하면 완전한 분산 제한이 가능합니다.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

// 인스턴스 메모리 내 카운터
const store = new Map<string, RateLimitEntry>()

// 오래된 엔트리 주기적 정리 (메모리 누수 방지)
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 60_000)

export interface RateLimitOptions {
  /** 키 접두사 (엔드포인트 식별용) */
  prefix: string
  /** 허용 요청 수 */
  limit: number
  /** 윈도우 크기 (밀리초) */
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

/**
 * IP 또는 userId 기반 Rate Limit 확인
 *
 * @example
 * const { allowed } = checkRateLimit('ocr', ip, { prefix: 'ocr', limit: 10, windowMs: 60_000 })
 * if (!allowed) return NextResponse.json({ error: '요청이 너무 많습니다.' }, { status: 429 })
 */
export function checkRateLimit(
  identifier: string,
  opts: RateLimitOptions,
): RateLimitResult {
  const key = `${opts.prefix}:${identifier}`
  const now = Date.now()

  let entry = store.get(key)
  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + opts.windowMs }
    store.set(key, entry)
  }

  entry.count += 1

  return {
    allowed: entry.count <= opts.limit,
    remaining: Math.max(0, opts.limit - entry.count),
    resetAt: entry.resetAt,
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
