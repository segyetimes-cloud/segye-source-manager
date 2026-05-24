
/**
 * GET /api/auth/check-lockout?email=...
 *
 * 최근 15분 이내 로그인 실패가 5회 이상이면 잠금 상태를 반환합니다.
 * 로그인 시도 전에 클라이언트가 호출합니다.
 *
 * 응답: { locked: false } | { locked: true, failCount: number, until: string }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import type { AuditAction } from '@/types/database'

const MAX_FAILURES   = 5
const WINDOW_MINUTES = 15

export async function GET(request: NextRequest) {
  const email = request.nextUrl.searchParams.get('email')?.trim().toLowerCase()
  if (!email) return NextResponse.json({ locked: false })

  try {
    const supabase = createServiceClient()  // Service role — audit_logs RLS 우회

    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()

    const { count } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('action', 'login_failed' as unknown as AuditAction)
      .ilike('user_email', email)
      .gte('created_at', windowStart)

    const failCount = count ?? 0

    if (failCount >= MAX_FAILURES) {
      // 첫 실패 시각 조회 (잠금 해제 시각 계산용)
      const { data: first } = await supabase
        .from('audit_logs')
        .select('created_at')
        .eq('action', 'login_failed' as unknown as AuditAction)
        .ilike('user_email', email)
        .gte('created_at', windowStart)
        .order('created_at', { ascending: true })
        .limit(1)
        .single()

      const lockedSince = first?.created_at ?? new Date().toISOString()
      const until = new Date(new Date(lockedSince).getTime() + WINDOW_MINUTES * 60 * 1000).toISOString()

      return NextResponse.json({ locked: true, failCount, until })
    }

    return NextResponse.json({ locked: false, failCount })
  } catch (e: any) {
    // 체크 실패 시 잠금 해제 — 감사 오류가 로그인 차단하면 안 됨
    console.error('[check-lockout]', e?.message)
    return NextResponse.json({ locked: false })
  }
}
