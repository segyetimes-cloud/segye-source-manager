/**
 * AI 관계 자동 추출 유틸리티
 *
 * 취재원 메모/정보에서 Claude Haiku를 이용해 인물 관계를 추출하고
 * source_relationships 테이블에 upsert합니다.
 *
 * 실패해도 호출부(노트 저장 등)에는 영향을 주지 않습니다.
 */

import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/server'

interface AIRelation {
  name: string
  relation_type: string
  relation_label: string
  strength: number
}

// source_relationships.relation_type 허용 목록
const VALID_TYPES = new Set([
  'academic_mentor',
  'close_friend',
  'family',
  'same_exam',
  'colleague',
  'mention',
])

/**
 * 텍스트에서 AI로 관계를 추출해 source_relationships에 저장
 *
 * @param sourceId  - 메모/정보의 주인공 취재원 ID
 * @param sourceName - 해당 취재원 이름 (프롬프트 컨텍스트용)
 * @param text       - 분석할 텍스트 (노트 내용 또는 personal_notes)
 */
export async function extractRelationshipsWithAI(
  sourceId: string,
  sourceName: string,
  text: string,
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!text?.trim() || !apiKey) return

  try {
    const svc = createServiceClient()

    // 비교 대상 취재원 목록 조회
    const { data: others } = await svc
      .from('sources')
      .select('id, full_name')
      .eq('is_deleted', false)
      .neq('id', sourceId)
      .limit(400)

    if (!others?.length) return

    const nameToId = new Map(others.map(s => [s.full_name, s.id]))
    const nameList = others.map(s => s.full_name).join(', ')

    const anthropic = new Anthropic({ apiKey })

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `취재원 관리 시스템의 관계 분석 AI입니다.
아래는 취재원 "${sourceName}"에 대한 메모입니다.
이 메모에서 다른 인물과의 관계를 추출하세요.

반드시 아래 목록에 있는 이름만 사용하세요 (목록 외 인물은 무시):
${nameList}

JSON 배열만 반환 (설명 없이):
[{"name":"이름","relation_type":"유형","relation_label":"관계 설명","strength":1~5}]

relation_type 허용값:
- academic_mentor : 지도교수, 사사, 스승, 논문 지도 등
- close_friend    : 절친, 친분, 오랜 친구, 가까운 사이
- family          : 가족/혼인 관계 (장인상, 처남, 배우자, 동서 등)
- same_exam       : 고시·시험 동기, 같은 기수
- colleague       : 직장 동료, 같은 조직
- mention         : 기타 단순 언급

관계가 전혀 없으면 []를 반환하세요.

메모:
${text}`,
        },
      ],
    })

    const raw =
      response.content[0].type === 'text' ? response.content[0].text : ''
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) return

    let rels: AIRelation[]
    try {
      rels = JSON.parse(match[0])
    } catch {
      return
    }
    if (!Array.isArray(rels)) return

    for (const rel of rels) {
      if (!rel.name || !VALID_TYPES.has(rel.relation_type)) continue
      const targetId = nameToId.get(rel.name)
      if (!targetId) continue

      const strength = Math.min(
        5,
        Math.max(1, Math.round(Number(rel.strength)) || 3),
      )

      await svc.from('source_relationships').upsert(
        {
          source_a_id: sourceId,
          source_b_id: targetId,
          relation_type: rel.relation_type,
          relation_label: String(rel.relation_label ?? rel.name).slice(0, 100),
          strength,
          is_bidirectional: true,
        },
        { onConflict: 'source_a_id,source_b_id,relation_type' },
      )
    }
  } catch (err) {
    // 실패해도 노트 저장에 영향 없음
    console.error('[aiRelations]', err)
  }
}
