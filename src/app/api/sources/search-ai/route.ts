import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { can, CAN_VIEW_SENSITIVE_SOURCE } from '@/lib/permissions'

const anthropic = new Anthropic()

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { query } = await request.json()
  if (!query || typeof query !== 'string' || query.trim().length < 2) {
    return NextResponse.json({ error: '검색어를 2자 이상 입력하세요.' }, { status: 400 })
  }

  const { data: callerProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const callerRole = callerProfile?.role ?? 'reporter'
  const canSeeSensitive = can(callerRole, CAN_VIEW_SENSITIVE_SOURCE)

  // AI로 검색 의도 분석 및 검색어 확장
  let intent = ''
  let expandedOrgs: string[] = []
  let expandedPositions: string[] = []
  let expandedKeywords: string[] = []

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `당신은 한국 언론사 취재원 데이터베이스 검색 도우미입니다.

사용자 검색어: "${query.slice(0, 200)}"

취재원 DB 필드: 이름(full_name), 소속기관(current_organization), 직책(current_position), 고시기수(exam_batch), 대학교(university), 태그(tags)

검색 의도를 파악하고 관련 검색어를 확장해주세요. JSON만 반환:
{
  "intent": "한 줄 검색 의도 요약",
  "organizations": ["관련 기관명 1", "관련 기관명 2"],
  "positions": ["관련 직책 1", "관련 직책 2"],
  "keywords": ["핵심 키워드 1", "핵심 키워드 2"]
}`,
      }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      intent = parsed.intent ?? ''
      expandedOrgs = Array.isArray(parsed.organizations) ? parsed.organizations.slice(0, 5) : []
      expandedPositions = Array.isArray(parsed.positions) ? parsed.positions.slice(0, 5) : []
      expandedKeywords = Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 5) : []
    }
  } catch {
    // AI 실패 시 원본 쿼리로 폴백
    expandedKeywords = [query]
  }

  // 확장된 검색어로 OR 조건 구성
  const allTerms = [query, ...expandedOrgs, ...expandedPositions, ...expandedKeywords]
    .map(t => t.trim()).filter(Boolean).slice(0, 15)

  const orConditions = allTerms.flatMap(term => {
    const esc = term.replace(/[%_\\]/g, '\\$&')
    return [
      `full_name.ilike.%${esc}%`,
      `current_organization.ilike.%${esc}%`,
      `current_position.ilike.%${esc}%`,
      `university.ilike.%${esc}%`,
      `exam_batch.ilike.%${esc}%`,
    ]
  }).join(',')

  let q = supabase
    .from('sources')
    .select('id, full_name, current_organization, current_position, phone_primary, email_primary, visibility, sensitivity, completeness_score, tags, exam_batch, updated_at, owner_id')
    .eq('is_deleted', false)
    .or(`visibility.eq.shared,owner_id.eq.${user.id}`)
    .limit(30)

  if (!canSeeSensitive) q = q.neq('sensitivity', 'private')
  if (orConditions) q = q.or(orConditions)

  const { data: sources, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    sources: sources ?? [],
    intent,
    expandedTerms: allTerms.slice(1), // 원본 제외한 확장 검색어
  })
}
