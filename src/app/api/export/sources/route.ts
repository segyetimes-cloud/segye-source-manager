import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import { EXPORT_MAX_ROWS, EXPORT_DAILY_LIMIT } from '@/lib/permissions'
import { decryptNullable } from '@/lib/crypto'
import { auditLog } from '@/lib/audit'

// GET /api/export/sources
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profileRaw } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()
  const profile = profileRaw as { role: string; full_name: string } | null
  if (!profile?.role) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const role = profile.role
  const maxRows = EXPORT_MAX_ROWS[role] ?? 100
  const dailyLimit = EXPORT_DAILY_LIMIT[role] ?? 3

  // 데이터 조회 (공개 필드만)
  const sp = request.nextUrl.searchParams
  const filter = sp.get('filter') ?? 'all'   // 'all' | 'mine'
  const q = sp.get('q') ?? ''

  let query = supabase
    .from('sources')
    .select('full_name, current_organization, current_position, current_department, phone_primary, email_primary, university, high_school, exam_batch, tags, hometown_province, birthday, updated_at')
    .eq('is_deleted', false)
    .limit(maxRows)

  if (filter === 'mine') query = query.eq('owner_id', user.id)
  else query = query.or(`visibility.eq.shared,owner_id.eq.${user.id}`)

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,current_organization.ilike.%${q}%`)
  }

  type ExportRow = { full_name: string; current_organization: string | null; current_position: string | null; current_department: string | null; phone_primary: string | null; email_primary: string | null; university: string | null; high_school: string | null; exam_batch: string | null; hometown_province: string | null; birthday: string | null; tags: string[]; updated_at: string }
  const { data: sourcesRaw, error } = await query
  const sourcesDecrypted = sourcesRaw as ExportRow[] | null
  const sources = sourcesDecrypted?.map(s => ({
    ...s,
    phone_primary: decryptNullable(s.phone_primary),
  })) ?? null
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 요청 IP (감사 추적용)
  const exportIP =
    request.headers.get('x-real-ip') ||
    (request.headers.get('x-forwarded-for') ?? '').split(',').pop()?.trim() ||
    'unknown'

  // 워터마크 ID 생성
  const watermarkId = Buffer.from(`${user.id}:${user.email}:${exportIP}:${Date.now()}`).toString('base64').slice(0, 32)

  // ── 원자적 내보내기 한도 확인 + 로그 기록 (TOCTOU 방지) ─────────────────
  // DB 함수가 트랜잭션 내에서 SELECT FOR UPDATE + INSERT를 수행
  // supabase-js v2 rpc() 타입 추론 한계로 함수명에 캐스팅 적용
  type ExportCheckResult = { today_count: number; allowed: boolean }
  const { data: exportCheckRaw, error: exportErr } = await supabase.rpc(
    'try_log_export' as 'try_log_export',
    {
      p_user_id:       user.id,
      p_daily_limit:   dailyLimit,
      p_row_count:     sources?.length ?? 0,
      p_filter_params: { filter, q } as Record<string, unknown>,
      p_watermark_id:  watermarkId,
    } as any
  )
  const exportCheck = exportCheckRaw as ExportCheckResult | null

  if (exportErr) {
    console.error('[export] try_log_export error:', exportErr.message)
    return NextResponse.json({ error: '내보내기 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }

  const todayCount: number = exportCheck?.today_count ?? 0
  if (!exportCheck?.allowed) {
    return NextResponse.json({
      error: `오늘 내보내기 한도(${dailyLimit}회)를 초과했습니다. 내일 다시 시도해주세요.`
    }, { status: 429 })
  }

  // Excel 생성
  const wb = XLSX.utils.book_new()

  // 데이터 시트
  const wsData = [
    ['이름', '소속', '직책', '부서', '전화번호', '이메일', '대학', '고교', '고시기수', '출신지역', '생년월일', '태그', '최종수정'],
    ...(sources ?? []).map(s => [
      s.full_name,
      s.current_organization ?? '',
      s.current_position ?? '',
      s.current_department ?? '',
      s.phone_primary ?? '',
      s.email_primary ?? '',
      s.university ?? '',
      s.high_school ?? '',
      s.exam_batch ?? '',
      s.hometown_province ?? '',
      s.birthday ?? '',
      (s.tags ?? []).join(', '),
      s.updated_at ? new Date(s.updated_at).toLocaleDateString('ko-KR') : '',
    ])
  ]

  const ws = XLSX.utils.aoa_to_sheet(wsData)

  // 컬럼 너비 설정
  ws['!cols'] = [
    { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 12 },
    { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 15 },
    { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 12 },
  ]

  XLSX.utils.book_append_sheet(wb, ws, '취재원목록')

  // 메타 시트 (워터마크용)
  const metaData = [
    ['내보낸 사용자',  user.email],
    ['사용자 이름',    profile.full_name ?? ''],
    ['내보낸 시간',    new Date().toLocaleString('ko-KR')],
    ['접속 IP',        exportIP],
    ['워터마크 ID',    watermarkId],
    ['총 행 수',       sources?.length ?? 0],
    ['',               ''],
    ['⚠ 주의',        '이 파일은 열람자 정보가 기록되어 있습니다. 무단 배포 시 책임을 질 수 있습니다.'],
  ]
  const wsMeta = XLSX.utils.aoa_to_sheet(metaData)
  XLSX.utils.book_append_sheet(wb, wsMeta, '메타정보')

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  // audit_logs insert
  void auditLog(supabase, {
    user_id: user.id,
    user_email: user.email,
    action: 'export',
    resource_type: 'source',
    export_row_count: sources?.length ?? 0,
    watermark_token: watermarkId,
    metadata: { filter, query: q, role, daily_count: todayCount, ip: exportIP },
  })

  const filename = `취재원목록_${new Date().toLocaleDateString('ko-KR').replace(/\./g, '').replace(/ /g, '')}.xlsx`

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'X-Remaining-Exports': String(dailyLimit - todayCount),
    },
  })
}
