import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 300

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

// 현재 시각 기준 KST 주간 범위 계산 (지난 토요일 00:00 ~ 오늘 23:59)
function getWeekRange(): { startUTC: Date; endUTC: Date; startLabel: string; endLabel: string } {
  const nowKST = new Date(Date.now() + KST_OFFSET_MS)

  const endKST = new Date(nowKST)
  endKST.setUTCHours(23, 59, 59, 999)

  const startKST = new Date(nowKST)
  startKST.setUTCDate(nowKST.getUTCDate() - 6)
  startKST.setUTCHours(0, 0, 0, 0)

  const fmt = (d: Date) =>
    new Date(d.getTime() - KST_OFFSET_MS).toLocaleDateString('ko-KR', {
      timeZone: 'UTC',
      month: 'long',
      day: 'numeric',
    })

  return {
    startUTC: new Date(startKST.getTime() - KST_OFFSET_MS),
    endUTC:   new Date(endKST.getTime()   - KST_OFFSET_MS),
    startLabel: fmt(startKST),
    endLabel:   fmt(endKST),
  }
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth   = request.headers.get('authorization')
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { startUTC, endUTC, startLabel, endLabel } = getWeekRange()

  const { data: reports, error: fetchError } = await supabase
    .from('information_reports')
    .select(`
      id, title, content, category, tags, created_at, author_department,
      profiles!author_id(full_name, department)
    `)
    .eq('is_deleted', false)
    .not('status', 'eq', 'rejected')
    .not('tags', 'cs', '{"자동생성"}')
    .gte('created_at', startUTC.toISOString())
    .lte('created_at', endUTC.toISOString())
    .order('created_at', { ascending: true })

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!reports || reports.length === 0) {
    return NextResponse.json({ message: '이번 주 등록된 보고서가 없습니다.', period: `${startLabel} ~ ${endLabel}` })
  }

  type Profile = { full_name: string; department: string } | null

  const reportText = reports
    .map((r, i) => {
      const profile = r.profiles as Profile
      return [
        `[${i + 1}] ${r.title}`,
        `부서: ${(profile?.department) ?? r.author_department ?? '미상'} | 작성자: ${profile?.full_name ?? '미상'} | 날짜: ${new Date(r.created_at).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}`,
        r.content,
        '---',
      ].join('\n')
    })
    .join('\n\n')

  const anthropic = new Anthropic()

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 4000,
    system: '당신은 언론사 편집국의 주간 현안 보고서를 작성하는 전문 에디터입니다. 각 부서의 보고서를 종합해 핵심 현안 위주로 명료하게 정리합니다.',
    messages: [{
      role: 'user',
      content: `아래는 ${startLabel}부터 ${endLabel}까지 각 부서가 제출한 정보보고 ${reports.length}건입니다. 이를 종합한 주간 현안 보고서를 작성해 주세요.

작성 지침:
- 주요 현안을 주제 또는 부서별로 묶어 정리하세요
- 각 현안의 핵심 내용과 의미를 간결하게 요약하세요 (중복 제거)
- 특히 중요도가 높은 현안은 별도로 강조하세요
- 전체 2,000~3,000자 분량으로 작성하세요
- 마크다운 형식으로 작성하세요 (## 제목, **강조** 등)

제출 보고서:
${reportText}`,
    }],
  })

  const block = message.content[0]
  if (block.type !== 'text') {
    return NextResponse.json({ error: 'Claude 응답 오류' }, { status: 500 })
  }

  // 자동 작성자: 환경변수 → superadmin 첫 번째 계정 순으로 폴백
  let authorId = process.env.CRON_AUTHOR_ID ?? null
  if (!authorId) {
    const { data: sysUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'superadmin')
      .limit(1)
      .single()
    authorId = sysUser?.id ?? null
  }
  if (!authorId) {
    return NextResponse.json({ error: '작성자 계정을 찾을 수 없습니다.' }, { status: 500 })
  }

  const title = `[주간현안] ${startLabel} ~ ${endLabel}`

  const { data: newReport, error: insertError } = await supabase
    .from('information_reports')
    .insert({
      author_id:         authorId,
      title,
      content:           block.text,
      category:          '분석',
      tags:              ['주간현안', '자동생성'],
      visibility:        'all',
      status:            'approved',
      author_department: '편집국',
    })
    .select('id')
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({
    success:       true,
    report_id:     newReport.id,
    title,
    source_count:  reports.length,
    period:        `${startLabel} ~ ${endLabel}`,
  })
}
