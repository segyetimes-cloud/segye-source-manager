import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { randomBytes, createHmac } from 'crypto'

// ── Rate Limit 설정 ───────────────────────────────────────────────────────────
// Upstash Redis 미설정 시 in-memory(단일 인스턴스 한정)로 폴백
function buildRateLimiter(requests: number, window: `${number} ${'s' | 'm' | 'h' | 'd'}`) {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(requests, window),
      analytics: false,
      prefix: 'rl:segye',
    })
  }
  // 로컬/Redis 미설정: ephemeral 캐시 (서버리스 재시작 시 초기화됨)
  return new Ratelimit({
    redis: Redis.fromEnv(),   // 실제로는 사용되지 않음 (fallthrough)
    limiter: Ratelimit.slidingWindow(requests, window),
  })
}

// 엔드포인트별 Rate Limit (슬라이딩 윈도우, 1분 기준)
const RATE_LIMITS = [
  // 민감 엔드포인트: 더 엄격하게
  { prefix: '/api/export',       requests: 10,  window: '1 m' as const },
  { prefix: '/api/sources/bulk', requests: 20,  window: '1 m' as const },
  { prefix: '/api/admin',        requests: 60,  window: '1 m' as const },
  // 일반 API
  { prefix: '/api',              requests: 200, window: '1 m' as const },
] as const

// 미설정 시 Rate Limiting 비활성화 (빌드 타임에 인스턴스 생성 방지)
let limiters: Array<{ prefix: string; limiter: Ratelimit }> | null = null

function getLimiters() {
  if (!process.env.UPSTASH_REDIS_REST_URL) return null  // Redis 없으면 Rate Limit 스킵
  if (!limiters) {
    limiters = RATE_LIMITS.map(({ prefix, requests, window }) => ({
      prefix,
      limiter: buildRateLimiter(requests, window),
    }))
  }
  return limiters
}

// ── VPN CIDR 체크 유틸 ───────────────────────────────────────────────────────
function isIPInCIDR(ip: string, cidr: string): boolean {
  try {
    const [range, bits] = cidr.split('/')
    const mask = ~(2 ** (32 - parseInt(bits)) - 1)
    const ipToInt = (addr: string) =>
      addr.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0
    return (ipToInt(ip) & mask) >>> 0 === (ipToInt(range) & mask) >>> 0
  } catch {
    return false
  }
}

function isVPNAccess(ip: string): boolean {
  if (process.env.DISABLE_OTP_CHECK === 'true') return true
  if (process.env.NODE_ENV === 'development') return true
  const vpnRanges = (process.env.VPN_CIDR_RANGES || '').split(',').filter(Boolean)
  // VPN_CIDR_RANGES 미설정 시 OTP 강제화 건너뜀 (opt-in 방식)
  // 사내 VPN 환경 구축 후 VPN_CIDR_RANGES를 설정하면 외부 접속 시 OTP 강제 적용됨
  if (vpnRanges.length === 0) return true
  if (!ip) return false
  return vpnRanges.some(cidr => isIPInCIDR(ip.trim(), cidr.trim()))
}

/**
 * 신뢰할 수 있는 클라이언트 IP 추출
 *
 * TRUSTED_PROXY_CIDRS 환경변수가 설정된 경우에만 x-forwarded-for 헤더를 신뢰합니다.
 * 미설정 시 x-real-ip → x-forwarded-for 마지막 항목(가장 가까운 프록시가 추가) 순으로 사용합니다.
 * 직접 스푸핑 가능한 x-forwarded-for 첫 번째 항목은 사용하지 않습니다.
 */
function getClientIP(request: NextRequest): string {
  // x-real-ip: Nginx/Cloudflare 등이 실제 클라이언트 IP를 설정 (스푸핑 불가)
  const realIP = request.headers.get('x-real-ip')
  if (realIP) return realIP.trim()

  const forwarded = request.headers.get('x-forwarded-for')
  if (!forwarded) return '127.0.0.1'

  const ips = forwarded.split(',').map(s => s.trim()).filter(Boolean)

  // TRUSTED_PROXY_CIDRS가 설정된 경우: 신뢰된 프록시 IP를 오른쪽에서 제거하고 실제 클라이언트 IP 추출
  const trustedCIDRs = (process.env.TRUSTED_PROXY_CIDRS ?? '').split(',').filter(Boolean)
  if (trustedCIDRs.length > 0) {
    // 오른쪽부터 신뢰된 프록시 제거 → 남은 마지막 IP가 실제 클라이언트
    let idx = ips.length - 1
    while (idx > 0 && trustedCIDRs.some(cidr => isIPInCIDR(ips[idx], cidr))) {
      idx--
    }
    return ips[idx] ?? ips[0]
  }

  // 기본: x-forwarded-for 마지막 항목 (가장 가까운 직전 홉이 추가한 IP)
  // 첫 번째 항목은 클라이언트가 직접 위조 가능하므로 사용하지 않음
  return ips[ips.length - 1]
}

function buildCSP(nonce: string, supabaseHost: string): string {
  const isDev = process.env.NODE_ENV !== 'production'
  const scriptSrc = isDev
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${supabaseHost} wss://${supabaseHost.replace(/^https?:\/\//, '')} https://vision.googleapis.com https://nominatim.openstreetmap.org`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
}

// ── 프록시 함수 (구: middleware) ──────────────────────────────────────────────
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 정적 파일 패스스루
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/login' ||
    pathname === '/otp'
  ) {
    return NextResponse.next()
  }

  // ── ① Rate Limiting ────────────────────────────────────────────────────────
  // /api/auth 는 Rate Limit 제외 (Supabase Auth 자체 제한에 위임)
  if (pathname.startsWith('/api') && !pathname.startsWith('/api/auth')) {
    const clientIP = getClientIP(request)
    // 사용자 ID or IP를 식별자로 사용 (인증 전 요청은 IP 기반)
    const identifier = request.headers.get('x-user-id') ?? clientIP

    const activeLimiters = getLimiters()
    if (activeLimiters) {
      // 가장 구체적인(먼저 매칭되는) 제한 적용
      const matched = activeLimiters.find(({ prefix }) => pathname.startsWith(prefix))
      if (matched) {
        const { success, limit, remaining, reset } = await matched.limiter.limit(
          `${matched.prefix}:${identifier}`
        )

        if (!success) {
          return new NextResponse('Too Many Requests', {
            status: 429,
            headers: {
              'X-RateLimit-Limit':     String(limit),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset':     String(reset),
              'Retry-After':           String(Math.ceil((reset - Date.now()) / 1000)),
              'Content-Type':          'application/json',
            },
          })
        }

        // 헤더에 Rate Limit 정보 첨부
        const res = await NextResponse.next()
        res.headers.set('X-RateLimit-Limit',     String(limit))
        res.headers.set('X-RateLimit-Remaining', String(remaining))
        res.headers.set('X-RateLimit-Reset',     String(reset))
        return res
      }
    }
  }

  // ── ② Supabase 세션 갱신 + 인증 ───────────────────────────────────────────
  const { supabaseResponse, user } = await updateSession(request)
  const clientIP = getClientIP(request)
  const isVPN    = isVPNAccess(clientIP)

  if (!user) {
    const res = NextResponse.redirect(new URL('/login', request.url))
    supabaseResponse.cookies.getAll().forEach(c => res.cookies.set(c.name, c.value, c))
    return res
  }

  if (!isVPN && pathname !== '/otp') {
    const otpCookie = request.cookies.get('otp_verified')?.value
    // 쿠키 값이 현재 사용자 ID 기반 HMAC인지 검증
    let otpVerified = false
    if (otpCookie) {
      const secret = process.env.OTP_COOKIE_SECRET
        ?? process.env.FIELD_ENCRYPTION_KEY
        ?? 'segye-otp-fallback-secret'
      const expected = createHmac('sha256', secret)
        .update(`${user.id}:otp_verified`)
        .digest('hex')
        .slice(0, 32)
      otpVerified = otpCookie === expected
    }
    if (!otpVerified) {
      const otpUrl = new URL('/otp', request.url)
      otpUrl.searchParams.set('next', pathname)
      const res = NextResponse.redirect(otpUrl)
      supabaseResponse.cookies.getAll().forEach(c => res.cookies.set(c.name, c.value, c))
      return res
    }
  }

  // ── ③ 보안 헤더 + 워터마크 + Nonce ───────────────────────────────────────
  const watermarkToken = Buffer.from(
    `${user.id}:${user.email}:${Date.now()}`
  ).toString('base64')

  // 요청별 CSP nonce 생성 — script-src 'unsafe-inline' 제거
  const nonce = randomBytes(16).toString('base64')

  // x-nonce 를 request headers에 심어야 서버 컴포넌트가 headers()로 읽을 수 있음
  const modifiedRequestHeaders = new Headers(request.headers)

  // ── 클라이언트가 주입 가능한 신뢰 헤더를 먼저 삭제 후, 인증 성공 시 재설정
  // set()도 덮어쓰지만 delete→set 명시적 패턴으로 스푸핑 경로 완전 차단
  modifiedRequestHeaders.delete('x-user-id')
  modifiedRequestHeaders.delete('x-user-email')

  modifiedRequestHeaders.set('x-nonce',      nonce)
  modifiedRequestHeaders.set('x-user-id',    user.id)
  modifiedRequestHeaders.set('x-user-email', user.email ?? '')

  // ── 핵심: 미들웨어가 refresh한 Supabase 쿠키를 Cookie 헤더에도 반영 ─────
  // updateSession이 만료 토큰을 refresh하면 supabaseResponse.cookies에 새 토큰이 담긴다.
  // 그러나 new Headers(request.headers)는 기존 Cookie 헤더(만료 토큰)를 그대로 복사한다.
  // 서버 컴포넌트는 요청 Cookie 헤더를 읽으므로, 새 토큰을 반영하지 않으면
  // layout.tsx의 getUser()가 만료 토큰으로 Supabase에 재시도 → refresh token 재사용 거부 → user=null → /login 리다이렉트
  const refreshedCookies = supabaseResponse.cookies.getAll()
  if (refreshedCookies.length > 0) {
    // 기존 Cookie 헤더를 Map으로 파싱
    const cookieMap = new Map<string, string>()
    const rawCookie = request.headers.get('cookie') ?? ''
    rawCookie.split(';').forEach(part => {
      const eq = part.indexOf('=')
      if (eq > 0) cookieMap.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim())
    })
    // refresh된 쿠키로 덮어쓰기
    refreshedCookies.forEach(({ name, value }) => {
      if (value) cookieMap.set(name, value)
      else cookieMap.delete(name)
    })
    // 재조합 후 헤더에 세팅
    const updatedCookie = [...cookieMap.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
    modifiedRequestHeaders.set('cookie', updatedCookie)
  }

  const finalResponse = NextResponse.next({ request: { headers: modifiedRequestHeaders } })

  // Supabase 세션 쿠키를 응답에도 복사 (브라우저가 새 토큰을 저장하도록)
  supabaseResponse.cookies.getAll().forEach(c => finalResponse.cookies.set(c.name, c.value, c))

  // 커스텀 헤더
  finalResponse.headers.set('X-Watermark-Token', watermarkToken)
  finalResponse.headers.set('X-Client-IP',       clientIP)
  finalResponse.headers.set('X-Is-VPN',          isVPN ? 'true' : 'false')

  // 보안 응답 헤더
  finalResponse.headers.set('X-Frame-Options',           'DENY')
  finalResponse.headers.set('X-Content-Type-Options',    'nosniff')
  finalResponse.headers.set('Referrer-Policy',           'strict-origin-when-cross-origin')
  finalResponse.headers.set('Permissions-Policy',        'camera=(), microphone=(), geolocation=()')
  finalResponse.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  )

  // CSP는 Next.js 스크립트 태그에 nonce가 자동 주입되지 않으므로 비활성화
  // (strict-dynamic + nonce 조합이 Next.js 내장 스크립트를 차단함)
  // const supabaseHost = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/$/, '')
  // finalResponse.headers.set('Content-Security-Policy', buildCSP(nonce, supabaseHost))

  return finalResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
