// @ts-nocheck
/**
 * POST /api/auth/device-check
 *
 * 현재 사용자의 기기 지문을 등록하거나 기존 기기 여부를 확인합니다.
 *
 * body: { fingerprint: string, deviceLabel: string }
 *
 * 응답:
 *   { status: 'known' }           — 이미 알려진 기기
 *   { status: 'new', warned: true } — 새 기기 (감사 로그 기록)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  let body: { fingerprint?: string; deviceLabel?: string } = {}
  try { body = await request.json() } catch { return NextResponse.json({ status: 'error' }) }

  const { fingerprint, deviceLabel } = body
  if (!fingerprint) return NextResponse.json({ status: 'error' })

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ status: 'unauthenticated' }, { status: 401 })

    const clientIP =
      request.headers.get('x-real-ip') ||
      (request.headers.get('x-forwarded-for') ?? '').split(',').pop()?.trim() || 'unknown'

    // 기존 기기 조회
    const { data: existing } = await supabase
      .from('user_devices')
      .select('id, last_seen_at')
      .eq('user_id', user.id)
      .eq('fingerprint_hash', fingerprint)
      .maybeSingle()

    if (existing) {
      // 마지막 접속 시각 갱신
      await supabase
        .from('user_devices')
        .update({ last_seen_at: new Date().toISOString(), ip_address: clientIP })
        .eq('id', existing.id)

      return NextResponse.json({ status: 'known' })
    }

    // 새 기기 — 등록 + 감사 기록
    await supabase.from('user_devices').insert({
      user_id:          user.id,
      fingerprint_hash: fingerprint,
      device_label:     deviceLabel ?? 'Unknown Device',
      ip_address:       clientIP,
    })

    // 새 기기 접속 감사 로그
    await supabase.from('audit_logs').insert({
      user_id:       user.id,
      user_email:    user.email,
      action:        'new_device_login',
      resource_type: 'session',
      metadata: {
        fingerprint,
        device_label: deviceLabel,
        ip: clientIP,
        timestamp: new Date().toISOString(),
      },
    })

    return NextResponse.json({ status: 'new', warned: true })
  } catch (e: any) {
    console.error('[device-check]', e?.message)
    return NextResponse.json({ status: 'error' })
  }
}
