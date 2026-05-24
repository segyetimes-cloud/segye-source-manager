
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { can, CAN_VIEW_AUDIT_LOGS } from '@/lib/permissions'
import * as XLSX from 'xlsx'
import type { Database } from '@/types/database.generated'
import { auditLog } from '@/lib/audit'

/**
 * GET /api/admin/audit/export
 * 감사 로그를 Excel(.xlsx)로 내보냅니다.
 * 최대 5,000건, 관리자(section_editor+) 이상만 접근 가능.
 *
 * Query params (모두 선택):
 *   action, user_email, resource_type, resource_id, date_from, date_to
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const profile = profileRaw as { role: string } | null

  if (!can(profile?.role, CAN_VIEW_AUDIT_LOGS)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const sp = request.nextUrl.searchParams
  const action       = sp.get('action') ?? ''
  const userEmail    = sp.get('user_email') ?? ''
  const resourceType = sp.get('resource_type') ?? ''
  const resourceId   = sp.get('resource_id') ?? ''
  const dateFrom     = sp.get('date_from') ?? ''
  const dateTo       = sp.get('date_to') ?? ''

  let query = supabase
    .from('audit_logs')
    .select('id, created_at, user_email, user_role, action, resource_type, resource_id, ip_address, is_vpn_access, export_row_count, watermark_token, metadata')
    .order('created_at', { ascending: false })
    .limit(5000)

  if (action)       query = query.eq('action', action as Database['public']['Enums']['audit_action'])
  if (userEmail)    query = query.ilike('user_email', `%${userEmail}%`)
  if (resourceType) query = query.eq('resource_type', resourceType)
  if (resourceId)   query = query.ilike('resource_id', `%${resourceId}%`)
  if (dateFrom)     query = query.gte('created_at', new Date(dateFrom).toISOString())
  if (dateTo) {
    const toDate = new Date(dateTo)
    toDate.setDate(toDate.getDate() + 1) // include the entire 'to' day
    query = query.lt('created_at', toDate.toISOString())
  }

  const { data: logs, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // ── Excel 생성 ─────────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new()

  const rows = [
    ['시각', '사용자', '역할', '액션', '리소스 유형', '리소스 ID', 'IP 주소', 'VPN', 'Export 행수', '메타데이터'],
    ...(logs ?? []).map((l: any) => [
      new Date(l.created_at).toLocaleString('ko-KR'),
      l.user_email ?? '',
      l.user_role ?? '',
      l.action,
      l.resource_type,
      l.resource_id ?? '',
      l.ip_address ?? '',
      l.is_vpn_access ? 'Y' : 'N',
      l.export_row_count ?? '',
      l.metadata ? JSON.stringify(l.metadata) : '',
    ]),
  ]

  const ws = XLSX.utils.aoa_to_sheet(rows)
  ws['!cols'] = [
    { wch: 18 }, { wch: 28 }, { wch: 14 }, { wch: 14 },
    { wch: 16 }, { wch: 38 }, { wch: 16 }, { wch: 5 },
    { wch: 10 }, { wch: 40 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, '감사로그')

  // 내보내기 메타 시트
  const meta = [
    ['내보낸 사용자', user.email],
    ['내보낸 시각', new Date().toLocaleString('ko-KR')],
    ['필터 조건', JSON.stringify({ action, userEmail, resourceType, resourceId, dateFrom, dateTo })],
    ['총 행 수', (logs ?? []).length],
  ]
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), '내보내기정보')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  // 이 export 자체도 감사 로그에 기록 (fire-and-forget)
  void auditLog(supabase, {
    user_id: user.id,
    user_email: user.email,
    user_role: profile?.role ?? null,
    action: 'export',
    resource_type: 'audit_logs',
    export_row_count: (logs ?? []).length,
    metadata: { filter: { action, userEmail, resourceType, resourceId, dateFrom, dateTo } },
  })

  const filename = `감사로그_${new Date().toLocaleDateString('ko-KR').replace(/\.\s*/g, '').trim()}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
