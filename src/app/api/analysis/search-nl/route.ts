import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { can, CAN_VIEW_SENSITIVE_SOURCE } from '@/lib/permissions'

const anthropic = new Anthropic()

// relation_type 우선순위 (낮을수록 먼저)
const RELATION_TYPE_PRIORITY: Record<string, number> = {
  family: 1,
  colleague: 2,
  alumni: 3,
  acquaintance: 4,
  direct_mention: 5,
  other: 6,
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const query: string = body?.query ?? ''
  if (!query || query.trim().length < 2) {
    return NextResponse.json({ error: '검색어를 2자 이상 입력하세요.' }, { status: 400 })
  }

  // 사용자 역할 확인 (취재원 가시성 필터용)
  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const userRole = (profileRaw as any)?.role ?? 'reporter'
  const canSeeSensitive = can(userRole, CAN_VIEW_SENSITIVE_SOURCE)

  // ── 1. Claude로 쿼리 파싱 ──────────────────────────────────────────────────
  let personName = ''
  let relationType = 'all'
  let description = query

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `You are a Korean journalist source database assistant.
User query: "${query.slice(0, 300)}"

Identify the relationship query intent. Return JSON only:
{
  "personName": "name to search for (e.g. 한동훈)",
  "relationType": "all|direct|colleague|alumni|hometown|exam|organization",
  "description": "one-line Korean description of what was searched"
}`,
      }],
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      personName = (parsed.personName ?? '').trim()
      relationType = parsed.relationType ?? 'all'
      description = parsed.description ?? query
    }
  } catch {
    // Claude 실패 시 쿼리 그대로 인명으로 사용
    personName = query.trim()
  }

  if (!personName) {
    return NextResponse.json({ error: 'AI가 검색 의도를 파악하지 못했습니다.' }, { status: 422 })
  }

  // ── 2. DB에서 해당 인물 검색 ───────────────────────────────────────────────
  const escapedName = personName.replace(/[%_\\]/g, '\\$&')

  let personQuery = supabase
    .from('sources')
    .select('id, full_name, current_organization, current_position')
    .ilike('full_name', `%${escapedName}%`)
    .eq('is_deleted', false)
    .limit(10)

  if (!canSeeSensitive) {
    personQuery = personQuery.or(`visibility.eq.shared,owner_id.eq.${user.id}`)
  }

  const { data: candidates, error: candidatesError } = await personQuery
  if (candidatesError) {
    return NextResponse.json({ error: candidatesError.message }, { status: 500 })
  }

  const found = candidates ?? []

  // 0명
  if (found.length === 0) {
    return NextResponse.json({
      needSelection: false,
      sourceId: null,
      sourceName: personName,
      description,
      results: [],
    })
  }

  // 여러 명 — 클라이언트에서 선택하도록 반환
  if (found.length > 1) {
    // 정확히 일치하는 이름이 있으면 자동 선택
    const exact = found.find(s => s.full_name === personName)
    if (!exact) {
      return NextResponse.json({
        needSelection: true,
        candidates: found,
        description,
      })
    }
    // 정확 일치 1명 → 그대로 진행
    found.splice(0, found.length, exact)
  }

  const person = found[0]

  // ── 3. 해당 인물의 관계 로드 ──────────────────────────────────────────────
  const { data: relsRaw, error: relsError } = await supabase
    .from('source_relationships')
    .select(`
      id, relation_type, relation_label, is_bidirectional, strength,
      source_a_id, source_b_id,
      source_a:sources!source_relationships_source_a_id_fkey(id, full_name, current_organization, current_position),
      source_b:sources!source_relationships_source_b_id_fkey(id, full_name, current_organization, current_position)
    `)
    .or(`source_a_id.eq.${person.id},source_b_id.eq.${person.id}`)

  if (relsError) {
    return NextResponse.json({ error: relsError.message }, { status: 500 })
  }

  const rels = relsRaw ?? []

  // relationType 필터 적용
  const allowedRelationTypes = resolveAllowedRelationTypes(relationType)

  // 상대방 정보 추출
  const rawResults = rels
    .filter(rel => {
      if (allowedRelationTypes === null) return true // 'all' — 전부 포함
      return allowedRelationTypes.includes(rel.relation_type)
    })
    .map(rel => {
      const isA = rel.source_a_id === person.id
      const other = (isA ? rel.source_a : rel.source_b) as any
      if (!other) return null
      return {
        id: other.id as string,
        full_name: other.full_name as string,
        current_organization: (other.current_organization ?? null) as string | null,
        current_position: (other.current_position ?? null) as string | null,
        relation_type: rel.relation_type as string,
        relation_label: (rel.relation_label ?? null) as string | null,
        strength: (rel.strength ?? 1) as number,
        is_bidirectional: (rel.is_bidirectional ?? false) as boolean,
      }
    })
    .filter(Boolean) as Array<{
      id: string
      full_name: string
      current_organization: string | null
      current_position: string | null
      relation_type: string
      relation_label: string | null
      strength: number
      is_bidirectional: boolean
    }>

  // 가시성 필터: 상대방 취재원도 접근 권한 확인
  // (source_relationships join된 sources는 RLS가 적용되므로 이미 필터되어 있지만
  //  혹시 모를 경우 대비해 user가 볼 수 있는 source id 목록으로 재확인)
  let visibleIds: Set<string> | null = null
  if (!canSeeSensitive && rawResults.length > 0) {
    const otherIds = rawResults.map(r => r.id)
    const { data: visCheck } = await supabase
      .from('sources')
      .select('id')
      .in('id', otherIds)
      .eq('is_deleted', false)
      .or(`visibility.eq.shared,owner_id.eq.${user.id}`)
    visibleIds = new Set((visCheck ?? []).map(s => s.id))
  }

  const filteredResults = visibleIds
    ? rawResults.filter(r => visibleIds!.has(r.id))
    : rawResults

  // strength DESC, 그 다음 relation_type 우선순위 ASC 정렬
  filteredResults.sort((a, b) => {
    if (b.strength !== a.strength) return b.strength - a.strength
    const pa = RELATION_TYPE_PRIORITY[a.relation_type] ?? 99
    const pb = RELATION_TYPE_PRIORITY[b.relation_type] ?? 99
    return pa - pb
  })

  return NextResponse.json({
    needSelection: false,
    sourceId: person.id,
    sourceName: person.full_name,
    description,
    results: filteredResults,
  })
}

/**
 * relationType 문자열을 실제 DB relation_type 값 배열로 변환합니다.
 * null 반환 시 필터 없음 (all).
 */
function resolveAllowedRelationTypes(relationType: string): string[] | null {
  switch (relationType) {
    case 'all':         return null
    case 'direct':      return ['direct_mention', 'acquaintance']
    case 'colleague':   return ['colleague']
    case 'alumni':      return ['alumni']
    case 'organization':return ['colleague']
    // hometown, exam은 source_relationships에 직접 매핑되지 않으므로 전체 반환
    case 'hometown':    return null
    case 'exam':        return null
    default:            return null
  }
}
