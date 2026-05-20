// @ts-nocheck
/**
 * POST /api/auth/login-audit
 *
 * 로그인·로그아웃 이벤트를 audit_logs에 기록합니다.
 * 클라이언트에서 호출; 인증 없이도 실패 이벤트를 기록할 수 있어야 하므로
 * 인증 오류 시 user_id = null 로 기록합니다.
 *
 * body: { action: 'login' | 'login_failed' | 'logout' | 'idle_logout', email?: string, reason?: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type AuditAction = 'login' | 'login_failed' | 'logout' | 'idle_logout'

export async function POST(request: NextRequest) {
  let body: { action?: AuditAction; email?: string; reason?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { action, email, reason } = body
  if (!action) return NextResponse.json({ error: 'action required' }, { status: 400 })

  // 실제 클라이언트 IP (x-real-ip → x-forwarded-for 순)
  const clientIP =
    request.headers.get('x-real-ip') ||
    (request.headers.get('x-forwarded-for') ?? '').split(',').pop()?.trim() ||
    'unknown'

  const userAgent = request.headers.get('user-agent') ?? 'unknown'

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await (supabase as any).from('audit_logs').insert({
      user_id:       user?.id   ?? null,
      user_email:    user?.email ?? email ?? null,
      action,
      resource_type: 'session',
      metadata: {
        ip:         clientIP,
        user_agent: userAgent,
        reason:     reason ?? null,
        timestamp:  new Date().toISOString(),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    // 감사 로그 실패가 사용자 흐름을 차단해서는 안 됨 — 200 반환
    console.error('[login-audit] failed to write audit log', e?.message)
    return NextResponse.json({ ok: false, error: e?.message }, { status: 200 })
  }
}
