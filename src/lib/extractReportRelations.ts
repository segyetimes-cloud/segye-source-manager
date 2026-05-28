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
}
