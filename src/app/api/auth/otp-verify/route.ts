
/**
 * POST /api/auth/otp-verify
 *
 * OTP 코드 검증 후 HttpOnly 쿠키를 서버에서 설정합니다.
 * 클라이언트에서 document.cookie 로 설정하면 XSS 취약점 발생 가능 —
 * 이 엔드포인트를 통해 Set-Cookie 헤더(HttpOnly;Secure;SameSite=Strict)로 설정합니다.
 *
 * body: { phone: string, otp: string }
 * response: { ok: true } + Set-Cookie header on success
 */

import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { createClient } from '@/lib/supabase/server'

// OTP_MAX_AGE 제거: otp_verified는 세션 쿠키로 설정 (브라우저 종료 시 삭제)

export async function POST(request: NextRequest) {
  let body: { phone?: string; otp?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: '요청 파싱 실패' }, { status: 400 })
  }

  const { phone, otp } = body
  if (!phone || !otp) {
    return NextResponse.json({ error: 'phone 및 otp 필드가 필요합니다.' }, { status: 400 })
  }

  const formatted = phone.startsWith('+82')
    ? phone
    : '+82' + phone.replace(/^0/, '').replace(/-/g, '')

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({
      phone: formatted,
      token: otp,
      type: 'sms',
    })

    if (error) {
      return NextResponse.json(
        { error: '인증 실패: 코드를 다시 확인해주세요.' },
        { status: 401 }
      )
    }

    // OTP 인증 성공 — 현재 사용자 조회
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '세션을 확인할 수 없습니다.' }, { status: 401 })
    }

    // HttpOnly 쿠키 설정 — JavaScript에서 접근 불가
    const isProd = process.env.NODE_ENV === 'production'

    // 쿠키 값을 사용자 ID의 HMAC으로 설정 — 타 사용자 세션 재사용 방지
    const secret = process.env.OTP_COOKIE_SECRET
      ?? process.env.FIELD_ENCRYPTION_KEY
      ?? 'segye-otp-fallback-secret'
    const otpToken = createHmac('sha256', secret)
      .update(`${user.id}:otp_verified`)
      .digest('hex')
      .slice(0, 32)

    const cookieValue = [
      `otp_verified=${otpToken}`,
      `Path=/`,
      // Max-Age 의도적으로 생략 → 세션 쿠키 (브라우저 종료 시 자동 삭제)
      // 영속 쿠키로 두면 브라우저 닫고 재접속해도 OTP 재검증 없이 통과되는 취약점 발생
      `SameSite=Strict`,
      `HttpOnly`,                     // XSS 방어 핵심
      isProd ? `Secure` : '',          // HTTPS 전용 (프로덕션)
    ].filter(Boolean).join('; ')

    const res = NextResponse.json({ ok: true })
    res.headers.set('Set-Cookie', cookieValue)
    return res
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? 'OTP 검증 오류' }, { status: 500 })
  }
}
