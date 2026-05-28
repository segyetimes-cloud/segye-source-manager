import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { text } = await req.json()
  if (!text || typeof text !== 'string' || text.length < 20) {
    return NextResponse.json({ error: '텍스트가 너무 짧습니다.' }, { status: 400 })
  }

  const msg = await anthropic.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `다음 한국 인사 경력 소개글을 간결한 메모 형식으로 압축하세요.

원문:
"""
${text.slice(0, 3000)}
"""

규칙:
- 각 경력을 "연도+직책/소속" 형태의 짧은 단문으로 압축
- 예시 출력: "전남 보성 출신. 서울대 외교학과. 조지워싱턴대 국제무역 석사. 외무고시 29회 합격. 2004년 주미대사관 1등서기관. 2011년 외교부 북미2과장. 2025년 외교부 제1차관."
- 학력·출신지·시험도 포함 (이미 별도 필드에 들어가지만 메모에도 남기기)
- 마침표로 구분, 연도 순서 유지
- 200자 이내

JSON만 반환 (마크다운 없이):
{"memo": "압축된 메모 텍스트"}`
    }],
  })

  const raw = msg.content[0].type === 'text' ? msg.content[0].text : ''
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return NextResponse.json({ error: '압축 실패' }, { status: 500 })

  try {
    const parsed = JSON.parse(match[0])
    return NextResponse.json({ memo: parsed.memo ?? '' })
  } catch {
    return NextResponse.json({ error: '파싱 실패' }, { status: 500 })
  }
}
