import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { randomBytes, createHmac } from 'crypto'

// ── Rate Limit 설정 ───────────────────────────────────────────────────────────
function buildRateLimiter(requests: number, window: `${number} ${'s' | 'm' | 'h' | 'd'}`) {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(requests, window),
      analytics: false,
      prefix: 'rl:segye',
    })
  }
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(requests, window),
  })
}

const RATE_LIMITS = [
  { prefix: '/api/export',       requests: 10,  window: '1 m' as const },
  { prefix: '/api/sources/bulk', requests: 20,  window: '1 m' as const },
  { prefix: '/api/admin',        requests: 60,  window: '1 m' as const },
  { prefix: '/api',              requests: 200, window: '1 m' as const },
] as const

let limiters: Array<{ prefix: string; limiter: Ratelimit }> | null = null

function getLimiters() {
  if (!process.env.UPSTASH_REDIS_REST_URL) return null
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
  if (vpnRanges.length === 0) return true
  if (!ip) return false
  return vpnRanges.some(cidr => isIPInCIDR(ip.trim(), cidr.trim()))
}

/**
 * 신뢰할 수 있는 클라이언트 IP 추출
 */
function getClientIP(request: NextRequest): string {
  const realIP = request.headers.get('x-real-ip')
  if (realIP) return realIP.trim()

  const forwarded = request.headers.get('x-forwarded-for')
  if (!forwarded) return '127.0.0.1'

  const ips = forwarded.split(',').map(s => s.trim()).filter(Boolean)

  const trustedCIDRs = (process.env.TRUSTED_PROXY_CIDRS ?? '').split(',').filter(Boolean)
  if (trustedCIDRs.length > 0) {
    let idx = ips.length - 1
    while (idx > 0 && trustedCIDRs.some(cidr => isIPInCIDR(ips[idx], cidr))) {
      idx--
    }
    return ips[idx] ?? ips[0]
  }

  return ips[ips.length - 1]
}

// ── 프록시 함수 ──────────────────────────────────────────────────────────────
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 정적 파일 + 인증 페이지 + 인증 API 패스스루
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname === '/login' ||
    pathname === '/otp' ||
    pathname === '/lottery' ||
    pathname.startsWith('/api/auth/')   // 회원가입·로그인·OTP 등 인증 API는 인증 없이 허용
  ) {
    return NextResponse.next()
  }

  // ── ① Rate Limiting (/api/auth 제외) ──────────────────────────────────────
  if (pathname.startsWith('/api') && !pathname.startsWith('/api/auth')) {
    const clientIP = getClientIP(request)
    const activeLimiters = getLimiters()
    if (activeLimiters) {
      const matched = activeLimiters.find(({ prefix }) => pathname.startsWith(prefix))
      if (matched) {
        const { success, limit, remaining, reset } = await matched.limiter.limit(
          `${matched.prefix}:${clientIP}`
        )
        if (!success) {
          return new NextResponse('Too Many Requests', {
            status: 429,
            headers: {
              'X-RateLimit-Limit':     String(limit),
              'X-RateLimit-Remaining': '0',
              'X-RateLimit-Reset':     String(reset),
              'Retry-After':           String(Math.ceil((reset - Date.now()) / 1000)),
            },
          })
        }
      }
    }
  }

  // ── ② Supabase 세션 갱신 ──────────────────────────────────────────────────
  //     updateSession: 만료 토큰 갱신 + 갱신된 쿠키를 응답에 반영
  //     실제 getUser() 인증은 layout에서 한 번만 수행 (race condition 방지)
  const { supabaseResponse, user } = await updateSession(request)
  const clientIP = getClientIP(request)
  const isVPN    = isVPNAccess(clientIP)

  if (!user) {
    const res = NextResponse.redirect(new URL('/login', request.url))
    supabaseResponse.cookies.getAll().forEach(c => res.cookies.set(c.name, c.value, c))
    return res
  }

  // ── ③ OTP 검증 ────────────────────────────────────────────────────────────
  if (!isVPN && pathname !== '/otp') {
    const otpCookie = request.cookies.get('otp_verified')?.value
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

  // ── ④ nonce + 갱신된 쿠키를 요청 헤더에 반영 ─────────────────────────────
  //     updateSession이 토큰 갱신 시 supabaseResponse.cookies에 새 토큰이 담김
  //     layout의 createClient()는 Cookie 요청 헤더를 읽으므로 여기서 병합 필수
  const nonce = randomBytes(16).toString('base64')
  const modifiedRequestHeaders = new Headers(request.headers)
  modifiedRequestHeaders.set('x-nonce', nonce)

  const cookieMap = new Map<string, string>()
  const rawCookie = request.headers.get('cookie') ?? ''
  rawCookie.split(';').forEach(part => {
    const eq = part.indexOf('=')
    if (eq > 0) cookieMap.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim())
  })
  supabaseResponse.cookies.getAll().forEach(({ name, value }) => {
    if (value) cookieMap.set(name, value)
    else        cookieMap.delete(name)
  })
  modifiedRequestHeaders.set(
    'cookie',
    [...cookieMap.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  )

  // ── ⑤ finalResponse ───────────────────────────────────────────────────────
  const finalResponse = NextResponse.next({ request: { headers: modifiedRequestHeaders } })

  // 갱신된 Supabase 쿠키를 브라우저에도 전달
  supabaseResponse.cookies.getAll().forEach(c => finalResponse.cookies.set(c.name, c.value, c))

  // ── ⑥ 보안 응답 헤더 ──────────────────────────────────────────────────────
  const watermarkToken = Buffer.from(
    `${user.id}:${user.email}:${Date.now()}`
  ).toString('base64')

  finalResponse.headers.set('X-Watermark-Token',       watermarkToken)
  finalResponse.headers.set('X-Client-IP',             clientIP)
  finalResponse.headers.set('X-Is-VPN',                isVPN ? 'true' : 'false')
  finalResponse.headers.set('X-Frame-Options',          'DENY')
  finalResponse.headers.set('X-Content-Type-Options',  'nosniff')
  finalResponse.headers.set('Referrer-Policy',          'strict-origin-when-cross-origin')
  finalResponse.headers.set('Permissions-Policy',       'camera=(), microphone=(), geolocation=()')
  finalResponse.headers.set(
    'Strict-Transport-Security',
    'max-age=63072000; includeSubDomains; preload'
  )

  return finalResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
