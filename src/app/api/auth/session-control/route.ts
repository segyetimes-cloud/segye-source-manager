// @ts-nocheck
/**
 * POST /api/auth/session-control
 *
 * 새 로그인 성공 시 이전 세션을 모두 무효화합니다.
 * 하나의 계정이 동시에 여러 곳에서 사용되는 것을 방지합니다.
 *
 * body: {} (인증된 사용자 세션에서 자동으로 user_id 추출)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Service Role로 현재 사용자의 다른 세션 모두 종료
    const adminClient = createServiceClient()
    const { error } = await adminClient.auth.admin.signOut(user.id, 'others')

    if (error) {
      console.error('[session-control] signOut others failed:', error.message)
      // 실패해도 200 반환 — 로그인 흐름 차단 안 함
      return NextResponse.json({ ok: false, error: error.message })
    }

    // 감사 기록
    await supabase.from('audit_logs').insert({
      user_id:       user.id,
      user_email:    user.email,
      action:        'session_invalidate_others',
      resource_type: 'session',
      metadata: {
        ip: request.headers.get('x-real-ip') ||
            (request.headers.get('x-forwarded-for') ?? '').split(',').pop()?.trim() || 'unknown',
        timestamp: new Date().toISOString(),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[session-control] error:', e?.message)
    return NextResponse.json({ ok: false }, { status: 200 })
  }
}
