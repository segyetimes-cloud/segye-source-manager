import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// POST /api/auth/signup — 자가 회원가입 신청
// - Service Role로 Auth 계정 생성
// - profiles.is_active = false (관리자 승인 대기)
export async function POST(request: NextRequest) {
  // Rate Limit: IP당 1시간 5회 (계정 생성 남용 방어)
  const { checkRateLimit, getClientIp } = await import('@/lib/rateLimit')
  const ip = getClientIp(request)
  const rl = await checkRateLimit(ip, { prefix: 'signup', limit: 5, windowMs: 60 * 60_000 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: '회원가입 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' },
      { status: 429 }
    )
  }

  try {
    const body = await request.json()
    const { email, password, full_name } = body

    if (!email?.trim() || !password || !full_name?.trim()) {
      return NextResponse.json({ error: '이름, 이메일, 비밀번호는 필수입니다' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다' }, { status: 400 })
    }

    const service = createServiceClient()

    // ① Auth 계정 생성
    const { data: authData, error: authError } = await service.auth.admin.createUser({
      email: email.trim(),
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name.trim() },
    })

    if (authError) {
      console.error('[signup] auth.admin.createUser error:', authError)
      const msg = authError.message.includes('already registered') ||
                  authError.message.includes('already been registered') ||
                  authError.message.includes('User already registered')
        ? '이미 가입된 이메일입니다.'
        : `계정 생성 오류: ${authError.message}`
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const uid = authData?.user?.id
    if (!uid) {
      console.error('[signup] uid missing after createUser')
      return NextResponse.json({ error: '계정 생성 실패 (uid 없음)' }, { status: 500 })
    }

    // ② 이메일 확인 강제 처리 (createUser의 email_confirm이 간헐적으로 무시되는 케이스 방어)
    await service.auth.admin.updateUserById(uid, { email_confirm: true })

    // ③ profiles upsert — 이미 DB 트리거로 생성된 경우도 ON CONFLICT로 덮어씀
    const { error: profileError } = await (service.from('profiles') as any).upsert(
      {
        id: uid,
        email: email.trim(),
        full_name: full_name.trim(),
        role: 'reporter',
        is_active: false,
        department: null,
        desk_name: null,
        employee_id: null,
        phone: null,
      },
      { onConflict: 'id' }
    )

    if (profileError) {
      console.error('[signup] profiles.upsert error:', profileError)
      // 프로필 실패해도 Auth 계정 정리
      await service.auth.admin.deleteUser(uid)
      return NextResponse.json(
        { error: `프로필 생성 실패: ${profileError.message}` },
        { status: 500 }
      )
    }

    // ④ 가입 직후 ban — 관리자 승인 전까지 로그인 차단
    const { error: banError } = await service.auth.admin.updateUserById(uid, {
      ban_duration: '876600h',
    })
    if (banError) {
      console.error('[signup] ban error:', banError)
      // ban 실패해도 프로필이 is_active=false 이므로 앱 레벨에서는 막힘
      // 계속 진행 (치명적 오류 아님)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[signup] unexpected error:', err)
    return NextResponse.json(
      { error: `서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요. (${String(err)})` },
      { status: 500 }
    )
  }
}
