import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

// VPN CIDR 체크 유틸
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
  // OTP 체크 명시적 비활성화 옵션 (개발·테스트 환경 한정)
  if (process.env.DISABLE_OTP_CHECK === 'true') return true
  // 개발 환경에서는 항상 통과
  if (process.env.NODE_ENV === 'development') return true

  const vpnRanges = (process.env.VPN_CIDR_RANGES || '').split(',').filter(Boolean)

  // 프로덕션에서 VPN 범위 미설정 → OTP 우회 불가 (보안 기본값)
  // 사내 VPN 없이 사용하는 환경은 DISABLE_OTP_CHECK=true 로 명시 설정 필요
  if (vpnRanges.length === 0) return false

  if (!ip) return false
  return vpnRanges.some(cidr => isIPInCIDR(ip.trim(), cidr.trim()))
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') || '127.0.0.1'
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 정적 파일, API 라우트 일부는 통과
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/api/auth') ||
    pathname === '/login' ||
    pathname === '/otp'
  ) {
    return NextResponse.next()
  }

  // Supabase 세션 갱신
  const { supabaseResponse, user } = await updateSession(request)

  const clientIP = getClientIP(request)
  const isVPN = isVPNAccess(clientIP)

  // 비인증 사용자 → 로그인 페이지
  if (!user) {
    const res = NextResponse.redirect(new URL('/login', request.url))
    supabaseResponse.cookies.getAll().forEach(c => res.cookies.set(c.name, c.value, c))
    return res
  }

  // VPN 외부 접속 → OTP 인증 페이지
  if (!isVPN && pathname !== '/otp') {
    const otpVerified = request.cookies.get('otp_verified')?.value
    if (!otpVerified) {
      const otpUrl = new URL('/otp', request.url)
      otpUrl.searchParams.set('next', pathname)
      const res = NextResponse.redirect(otpUrl)
      supabaseResponse.cookies.getAll().forEach(c => res.cookies.set(c.name, c.value, c))
      return res
    }
  }

  // 워터마크 토큰 헤더 주입 (layout.tsx에서 읽어 CSS overlay 생성)
  const watermarkToken = Buffer.from(
    `${user.id}:${user.email}:${Date.now()}`
  ).toString('base64')

  supabaseResponse.headers.set('X-Watermark-Token', watermarkToken)
  supabaseResponse.headers.set('X-Client-IP', clientIP)
  supabaseResponse.headers.set('X-Is-VPN', isVPN ? 'true' : 'false')

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * 다음을 제외한 모든 경로에 미들웨어 적용:
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
