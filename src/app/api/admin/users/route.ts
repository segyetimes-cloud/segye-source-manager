// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

// POST /api/admin/users — 계정 생성 (admin/superadmin만 가능)
export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const callerRole = (profile as any)?.role as string | undefined
  const isAdmin = ['admin', 'section_editor', 'editor', 'publisher', 'superadmin'].includes(callerRole)
  const isSuperadmin = callerRole === 'superadmin'

  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { email, password, full_name, role, department, desk_name, employee_id, phone } = body

  if (!email || !password || !full_name) {
    return NextResponse.json({ error: 'email, password, full_name은 필수입니다' }, { status: 400 })
  }

  // 역할 권한 체계: admin은 reporter/deputy만, superadmin은 전체
  const targetRole = (role as string | undefined) ?? 'reporter'
  const allowedRoles = isSuperadmin
    ? ['reporter', 'deputy', 'admin', 'section_editor', 'editor', 'publisher', 'superadmin']
    : ['reporter', 'deputy']
  if (!allowedRoles.includes(targetRole)) {
    return NextResponse.json({ error: '데스크는 기자/차장 계정만 생성할 수 있습니다' }, { status: 403 })
  }

  const serviceClient = createServiceClient()

  // Supabase Auth에 유저 생성
  const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  const newUserId = authData.user?.id
  if (!newUserId) {
    return NextResponse.json({ error: '유저 생성 실패' }, { status: 500 })
  }

  // profiles 테이블 upsert
  const { data: newProfile, error: profileError } = await serviceClient
    .from('profiles')
    .upsert({
      id: newUserId,
      email,
      full_name,
      role: targetRole,
      department: department ?? null,
      desk_name: desk_name ?? null,
      employee_id: employee_id ?? null,
      phone: phone ?? null,
      is_active: true,
    })
    .select()
    .single()

  if (profileError) {
    // Auth 유저는 생성됐지만 profile 실패 — auth 유저 정리
    await serviceClient.auth.admin.deleteUser(newUserId)
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // 감사 로그
  await supabase.from('audit_logs').insert({
    user_id: user.id,
    user_email: user.email,
    user_role: callerRole,
    action: 'create',
    resource_type: 'profiles',
    resource_id: newUserId,
    ip_address: request.headers.get('x-forwarded-for') ?? null,
    is_vpn_access: false,
    metadata: { email, full_name, role: targetRole },
  })

  return NextResponse.json(newProfile, { status: 201 })
}

// PATCH /api/admin/users — 계정 활성/비활성, 역할 변경
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = ['admin', 'section_editor', 'editor', 'publisher', 'superadmin'].includes((profile as any)?.role)
  const isSuperadmin = (profile as any)?.role === 'superadmin'

  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { target_user_id, is_active, role, rank, full_name, department, desk_name, send_reset_email, action } = body

  if (!target_user_id) return NextResponse.json({ error: 'target_user_id 필요' }, { status: 400 })

  // ── 가입 승인 (원스텝) ───────────────────────────────────────────────────────
  // action: 'activate'
  //   1) Auth ban 해제
  //   2) 이메일 확인 강제 처리
  //   3) 비밀번호 설정 링크 이메일 자동 발송
  //   → 관리자는 승인 버튼 하나, 사용자는 이메일 링크로 비밀번호 설정 후 로그인
  if (action === 'activate') {
    const serviceClient = createServiceClient()

    // ① Auth ban 해제 + 이메일 확인
    const { error: authErr } = await serviceClient.auth.admin.updateUserById(target_user_id, {
      ban_duration: 'none',
      email_confirm: true,
    })
    if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })

    // ② 프로필 활성화
    const { data: activated, error: profileErr } = await serviceClient
      .from('profiles')
      .update({ is_active: true })
      .eq('id', target_user_id)
      .select()
      .single()
    if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })

    // ③ 비밀번호 설정 링크 이메일 발송 (recovery 링크 = 비밀번호 재설정)
    const targetEmail = (activated as any)?.email
    if (targetEmail) {
      await serviceClient.auth.admin.generateLink({ type: 'recovery', email: targetEmail })
    }

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      user_email: user.email,
      user_role: (profile as any)?.role ?? null,
      action: 'approve',
      resource_type: 'profiles',
      resource_id: target_user_id,
      ip_address: request.headers.get('x-forwarded-for') ?? null,
      is_vpn_access: false,
      metadata: { action: 'activate', notified_email: targetEmail },
    })

    return NextResponse.json(activated)
  }

  // ── 가입 신청 승인 ──────────────────────────────────────────────────────────
  // action: 'approve' — 자가 가입 신청자 승인 + 역할 부여
  if (action === 'approve') {
    const approveRole = role ?? 'reporter'
    // admin은 reporter/deputy만 승인 가능
    const approveAllowed = isSuperadmin
      ? ['reporter', 'deputy', 'admin', 'section_editor', 'editor', 'publisher', 'superadmin']
      : ['reporter', 'deputy']
    if (!approveAllowed.includes(approveRole)) {
      return NextResponse.json({ error: '해당 역할은 슈퍼관리자만 승인할 수 있습니다' }, { status: 403 })
    }

    const serviceClient = createServiceClient()
    // Ban 해제 → 로그인 허용
    await serviceClient.auth.admin.updateUserById(target_user_id, { ban_duration: 'none' })

    // 프로필 활성화 + 역할 부여 (Service Role — RLS 우회)
    const { data: approved, error: approveErr } = await serviceClient
      .from('profiles')
      .update({ is_active: true, role: approveRole })
      .eq('id', target_user_id)
      .select()
      .single()

    if (approveErr) return NextResponse.json({ error: approveErr.message }, { status: 500 })

    await supabase.from('audit_logs').insert({
      user_id: user.id,
      user_email: user.email,
      user_role: (profile as any)?.role ?? null,
      action: 'approve',
      resource_type: 'profiles',
      resource_id: target_user_id,
      ip_address: request.headers.get('x-forwarded-for') ?? null,
      is_vpn_access: false,
      metadata: { role: approveRole },
    })

    return NextResponse.json(approved)
  }

  // 비밀번호 재설정 이메일 발송
  if (send_reset_email) {
    const serviceClient = createServiceClient()
    const { data: targetAuth } = await serviceClient.auth.admin.getUserById(target_user_id)
    const userEmail = targetAuth?.user?.email
    if (!userEmail) {
      return NextResponse.json({ error: '대상 유저를 찾을 수 없습니다' }, { status: 404 })
    }
    await serviceClient.auth.admin.generateLink({ type: 'recovery', email: userEmail })
    return NextResponse.json({ success: true, message: '재설정 링크가 발송되었습니다' })
  }

  // admin은 superadmin 계정을 수정할 수 없음 (Service Role — RLS 우회)
  const svcForCheck = createServiceClient()
  const { data: targetProfile } = await svcForCheck
    .from('profiles')
    .select('role')
    .eq('id', target_user_id)
    .single()

  if ((targetProfile as any)?.role === 'superadmin' && !isSuperadmin) {
    return NextResponse.json({ error: '슈퍼관리자 계정은 슈퍼관리자만 수정할 수 있습니다' }, { status: 403 })
  }

  // role 변경: superadmin은 전체, admin은 reporter/deputy/admin 범위만
  if (role !== undefined) {
    const adminAllowed = ['reporter', 'deputy', 'admin']
    if (!isSuperadmin && !adminAllowed.includes(role as string)) {
      return NextResponse.json({ error: '슈퍼관리자만 해당 역할로 변경할 수 있습니다' }, { status: 403 })
    }
    // admin이 superadmin 역할로 올리는 것은 불가
    if (!isSuperadmin && (role as string) === 'superadmin') {
      return NextResponse.json({ error: '슈퍼관리자 역할 부여는 슈퍼관리자만 가능합니다' }, { status: 403 })
    }
  }

  const updates: Record<string, unknown> = {}
  if (is_active !== undefined) updates.is_active = is_active
  if (role !== undefined) updates.role = role
  if (rank !== undefined) updates.rank = rank   // null 허용 (직급 해제)
  if (full_name !== undefined) updates.full_name = full_name
  if (department !== undefined) updates.department = department
  if (desk_name !== undefined) updates.desk_name = desk_name

  // Service Role 클라이언트 사용 — RLS 우회, 관리자가 다른 유저 프로필 수정 가능
  const serviceClient = createServiceClient()
  const { data: updated, error } = await serviceClient
    .from('profiles')
    .update(updates)
    .eq('id', target_user_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 비활성화 시 Supabase Auth ban
  if (is_active === false) {
    await serviceClient.auth.admin.updateUserById(target_user_id, { ban_duration: '876600h' }) // ~100년
  } else if (is_active === true) {
    await serviceClient.auth.admin.updateUserById(target_user_id, { ban_duration: 'none' })
  }

  // 감사 로그
  await supabase.from('audit_logs').insert({
    user_id: user.id,
    user_email: user.email,
    user_role: (profile as any).role,
    action: 'update',
    resource_type: 'profiles',
    resource_id: target_user_id,
    ip_address: request.headers.get('x-forwarded-for') ?? null,
    is_vpn_access: false,
    metadata: updates,
  })

  return NextResponse.json(updated)
}
