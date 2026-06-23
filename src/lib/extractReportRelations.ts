/**
 * 정보보고 본문에서 Claude로 인물·관계를 추출하고 DB에 저장합니다.
 * after() 콜백 또는 수동 재추출 버튼 양쪽에서 재사용됩니다.
 */
import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

const anthropic = new Anthropic()

/** 복사 워터마크용 영폭(zero-width) 문자 제거 */
function stripZeroWidth(text: string): string {
  // U+200B – U+200D, U+FEFF, U+2060 – U+2065 등
  return text.replace(/[​-‍﻿⁠-⁥]/g, '')
}

export interface ExtractedEntity {
  name: string
  role: string | null
  mentions: string
}

export interface ExtractedRelation {
  from: string
  to: string
  type: string
  detail: string
}

interface ExtractResult {
  entities: ExtractedEntity[]
  relations: ExtractedRelation[]
}

async function callClaude(analysisText: string): Promise<ExtractResult> {
  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1500,
    messages: [{
      role: 'user',
      content: `다음 한국 언론사 정보보고 텍스트에서 인물명과 인물 간 관계를 추출하세요.

텍스트:
"""
${analysisText.slice(0, 4000)}
"""

JSON만 반환(마크다운·설명 없이):
{
  "entities": [
    { "name": "인물명", "role": "직책·역할(없으면 null)", "mentions": "텍스트 내 언급 핵심 맥락 한 줄" }
  ],
  "relations": [
    { "from": "인물명1", "to": "인물명2", "type": "관계유형(동기/친분/상하관계/가족/업무 등)", "detail": "관계 설명 한 줄" }
  ]
}

규칙:
- 텍스트에 실명 또는 직함·호칭으로 등장한 인물만 포함
- 인물 간 관계가 텍스트에서 명확히 드러난 경우만 relations에 포함
- "이 대통령" 같은 호칭도 그대로 인물명으로 사용
- 최대 entities 15명, relations 25개`,
    }],
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return { entities: [], relations: [] }

  const parsed = JSON.parse(jsonMatch[0])
  return {
    entities: Array.isArray(parsed.entities)
      ? (parsed.entities as ExtractedEntity[]).slice(0, 15)
      : [],
    relations: Array.isArray(parsed.relations)
      ? (parsed.relations as Array<{ from: string; to: string; type: string; detail: string }>)
          .slice(0, 25)
          .map(r => ({ from: r.from, to: r.to, type: r.type, detail: r.detail }))
      : [],
  }
}

/**
 * 보고서 한 건의 인물·관계를 추출하고 DB에 upsert합니다.
 * 기존 데이터는 삭제 후 재삽입(보고서 수정 대응).
 */
export async function extractAndStoreRelations(
  supabase: SupabaseClient,
  reportId: string,
  title: string,
  content: string,
  sensitiveContent: string | null,
): Promise<void> {
  const cleanContent   = stripZeroWidth(content)
  const cleanSensitive = sensitiveContent ? stripZeroWidth(sensitiveContent) : null

  let analysisText = `제목: ${title}\n\n${cleanContent}`
  if (cleanSensitive) analysisText += `\n\n[민감정보]\n${cleanSensitive}`

  let result: ExtractResult
  try {
    result = await callClaude(analysisText)
  } catch {
    return // 백그라운드 실패는 조용히 무시
  }

  if (result.entities.length === 0 && result.relations.length === 0) return

  // 기존 추출 데이터 삭제 후 재삽입
  await (supabase as any).from('report_extracted_entities').delete().eq('report_id', reportId)
  await (supabase as any).from('report_extracted_relations').delete().eq('report_id', reportId)

  if (result.entities.length > 0) {
    await (supabase as any).from('report_extracted_entities').insert(
      result.entities.map(e => ({
        report_id: reportId,
        name:      e.name,
        role:      e.role ?? null,
        mentions:  e.mentions,
      }))
    )
  }

  if (result.relations.length > 0) {
    await (supabase as any).from('report_extracted_relations').insert(
      result.relations.map(r => ({
        report_id: reportId,
        from_name: r.from,
        to_name:   r.to,
        rel_type:  r.type,
        detail:    r.detail,
      }))
    )
  }

  // ── 취재원 DB 매칭 → source_relationships 자동 생성 ──────────────────────────
  // 추출된 인물이 취재원에 등록돼 있으면 관계망에도 자동으로 연결
  if (result.relations.length > 0 && result.entities.length > 0) {
    await linkRelationsToSources(supabase, result)
  }
}

// 직함·호칭 제거 패턴 (이름 매칭 정확도 향상)
const TITLE_PATTERN = /\s*(의원|장관|대표|대통령|총리|차관|수석|실장|국장|부장|기자|교수|원장|이사|회장|사장|전무|상무|팀장|본부장|소장|처장|청장|군수|시장|도지사|판사|검사|변호사|선생|박사|원내대표|간사|위원장|위원|대변인|대표이사|부회장|부사장|청와대|구청장|도의원|시의원|구의원)$/

// 추출된 관계 타입 → source_relationships.relation_type 매핑
function mapRelationType(extracted: string): string {
  const t = extracted.toLowerCase()
  if (/(대학교?|동문|학번|동기|학교동기|졸업|출신학교)/.test(t)) return 'same_university'
  if (/(고교|고등학교|고등학교동기|중학교)/.test(t)) return 'same_highschool'
  if (/(고시동기|시험동기|고시기수)/.test(t)) return 'same_exam'
  if (/(가족|부부|형제|자매|혼인|배우자|친인척)/.test(t)) return 'family'
  if (/(친구|친분|절친|오랜친구|동창)/.test(t)) return 'close_friend'
  if (/(동향|고향|출신지|같은 고향)/.test(t)) return 'same_hometown'
  if (/(스승|제자|멘토|지도|사사|은사)/.test(t)) return 'academic_mentor'
  if (/(동료|직장|업무|같은 회사|상사|부하|소속|직장동료)/.test(t)) return 'same_org'
  return 'mention'
}

async function linkRelationsToSources(
  supabase: SupabaseClient,
  result: ExtractResult,
): Promise<void> {
  // 취재원 전체 이름 목록 조회 (배경 작업이므로 전체 조회 허용)
  const { data: sources, error } = await supabase
    .from('sources')
    .select('id, full_name')
    .eq('is_deleted', false)

  if (error || !sources || sources.length === 0) return

  // 인물명 → source_id 매핑 (직함 제거 후 비교)
  const nameToId: Record<string, string> = {}
  for (const entity of result.entities) {
    const cleanName = entity.name.replace(TITLE_PATTERN, '').trim()

    const match = sources.find(s =>
      s.full_name === entity.name ||                          // 정확 일치
      s.full_name === cleanName ||                            // 직함 제거 후 일치
      (cleanName.length >= 2 && entity.name.startsWith(s.full_name + ' ')) || // "박정하 의원" → "박정하"
      (cleanName.length >= 2 && cleanName === s.full_name),  // 추가 안전장치
    )

    if (match) nameToId[entity.name] = match.id
  }

  // 양쪽 모두 취재원 DB에 있는 관계만 처리
  const toInsert: Array<{
    source_a_id: string
    source_b_id: string
    relation_type: string
    relation_label: string | null
    strength: number
    is_bidirectional: boolean
  }> = []

  for (const rel of result.relations) {
    const aId = nameToId[rel.from]
    const bId = nameToId[rel.to]
    if (!aId || !bId || aId === bId) continue

    // UUID 오름차순 정렬 → A-B와 B-A를 같은 레코드로 취급 (중복 방지)
    const [srcA, srcB] = aId < bId ? [aId, bId] : [bId, aId]

    toInsert.push({
      source_a_id:    srcA,
      source_b_id:    srcB,
      relation_type:  mapRelationType(rel.type),
      relation_label: rel.detail || rel.type,
      strength:       3,
      is_bidirectional: true,
    })
  }

  if (toInsert.length === 0) return

  // 이미 있는 관계는 건너뜀 (보고서 재처리 시 중복 방지)
  await (supabase as any)
    .from('source_relationships')
    .upsert(toInsert, { onConflict: 'source_a_id,source_b_id,relation_type', ignoreDuplicates: true })
}
