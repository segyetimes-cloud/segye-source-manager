import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { can, CAN_APPROVE_REPORT } from '@/lib/permissions'

const anthropic = new Anthropic()

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { query, tab } = await request.json()
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return NextResponse.json({ error: '검색어를 2자 이상 입력하세요.' }, { status: 400 })
  }

  const { data: callerProfileRaw } = await supabase
    .from('profiles').select('role, department').eq('id', user.id).single()
  const callerProfile = callerProfileRaw as { role: string; department: string | null } | null
  const callerRole = callerProfile?.role ?? 'reporter'
  const myDept = callerProfile?.department ?? null
  const isAboveAdmin = can(callerRole, CAN_APPROVE_REPORT)
  const isAdminRole = callerRole === 'admin'

  // AI로 검색 의도 분석 및 검색어 확장
  let intent = ''
  let expandedKeywords: string[] = []
  let expandedCategories: string[] = []
  let expandedTags: string[] = []

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `당신은 한국 언론사 정보보고 데이터베이스 검색 도우미입니다.

사용자 검색어: "${query.slice(0, 200)}"

정보보고 DB 필드: 제목(title), 본문(content), 카테고리(category: 단독/인터뷰/기획/일반), 태그(tags), 연결 취재원(sources)

검색 의도를 파악하고 관련 검색어를 확장해주세요. JSON만 반환:
{
  "intent": "한 줄 검색 의도 요약",
  "keywords": ["핵심 키워드 1", "핵심 키워드 2", "핵심 키워드 3"],
  "categories": ["관련 카테고리"],
  "tags": ["관련 태그 1", "관련 태그 2"]
}`,
      }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      intent = parsed.intent ?? ''
      expandedKeywords = Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 5) : []
      expandedCategories = Array.isArray(parsed.categories) ? parsed.categories.slice(0, 3) : []
      expandedTags = Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : []
    }
  } catch {
    expandedKeywords = [query]
  }

  const allTerms = [query, ...expandedKeywords].map(t => t.trim()).filter(Boolean).slice(0, 10)

  // 확장된 키워드로 제목+본문 검색
  const orConditions = allTerms.flatMap(term => {
    const esc = term.replace(/[%_\\]/g, '\\$&')
    return [`title.ilike.%${esc}%`, `content.ilike.%${esc}%`]
  }).join(',')

  // 연결 취재원 이름 검색
  const { data: matchingSources } = await supabase
    .from('sources')
    .select('id')
    .or(allTerms.map(t => `full_name.ilike.%${t.replace(/[%_\\]/g, '\\$&')}%`).join(','))
    .eq('is_deleted', false)
    .limit(50)
  const matchingSourceIds = (matchingSources ?? []).map(s => s.id)
  let matchingReportIds: string[] = []
  if (matchingSourceIds.length > 0) {
    const { data: links } = await supabase
      .from('report_sources').select('report_id').in('source_id', matchingSourceIds)
    matchingReportIds = [...new Set<string>((links ?? []).map(l => l.report_id))]
  }

  // 텍스트 매치 보고서 ID
  const { data: textMatches } = await supabase
    .from('information_reports').select('id')
    .eq('is_deleted', false)
    .or(orConditions)
  const textMatchIds = (textMatches ?? []).map(r => r.id)
  const allMatchIds = [...new Set<string>([...textMatchIds, ...matchingReportIds])]

  if (allMatchIds.length === 0) {
    return NextResponse.json({ reports: [], intent, expandedTerms: allTerms.slice(1) })
  }

  // 권한별 쿼리
  let q = supabase
    .from('information_reports')
    .select(`
      id, title, content, category, tags, visibility, author_id, author_department, created_at,
      profiles!author_id(full_name, department),
      report_sources(source_id, sources!source_id(id, full_name))
    `)
    .eq('is_deleted', false)
    .in('id', allMatchIds)
    .order('created_at', { ascending: false })
    .limit(30)

  if (tab === 'mine') {
    q = q.eq('author_id', user.id)
  } else if (isAboveAdmin) {
    // 전체 열람
  } else if (isAdminRole) {
    if (myDept) {
      const safeDept = `"${myDept.replace(/"/g, '')}"`
      q = q.or(`author_id.eq.${user.id},visibility.eq.all,and(visibility.in.(desk_above,team),author_department.eq.${safeDept})`)
    } else {
      q = q.or(`author_id.eq.${user.id},visibility.eq.all`)
    }
  } else {
    if (myDept) {
      const safeDept = `"${myDept.replace(/"/g, '')}"`
      q = q.or(`author_id.eq.${user.id},and(status.eq.approved,visibility.eq.all),and(status.eq.approved,visibility.eq.team,author_department.eq.${safeDept})`)
    } else {
      q = q.or(`author_id.eq.${user.id},and(status.eq.approved,visibility.eq.all)`)
    }
  }

  const { data: reports, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    reports: reports ?? [],
    intent,
    expandedTerms: allTerms.slice(1),
  })
}
