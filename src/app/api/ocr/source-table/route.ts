
/**
 * POST /api/ocr/source-table
 * 취재원 표 이미지 OCR — Claude Vision API 사용
 * body: FormData { image: File }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'
import { createMessageWithRetry } from '@/lib/claudeRetry'

async function isValidImageBytes(file: File): Promise<boolean> {
  const header = Buffer.from(await file.slice(0, 12).arrayBuffer())
  if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) return true
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) return true
  if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x38) return true
  if (
    header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
    header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50
  ) return true
  return false
}

const TABLE_EXTRACT_PROMPT = `이 이미지에서 취재원/연락처 목록을 추출해주세요.

표 형식이거나 리스트 형식일 수 있습니다.
각 행을 하나의 인물로 파싱해 JSON 배열로 반환하세요.

각 항목 필드:
- full_name: 이름 (한글 이름, 한자 괄호 제거)
- current_organization: 소속 기관/회사
- current_position: 직책/직위
- phone_primary: 첫 번째 전화번호
- phone_secondary: 두 번째 전화번호 (있을 경우)
- public_notes: 메모/비고 내용

규칙:
- 이름이 없는 행은 건너뜀
- 전화번호 여러 개이면 첫 번째만 phone_primary, 두 번째는 phone_secondary
- 이름의 한자 표기 (예: 金渡坤) 는 제거하고 한글만 남김
- 없는 항목은 null

JSON 배열만 반환 (마크다운, 설명 없이):
[{"full_name":"...","current_organization":"...","current_position":"...","phone_primary":"...","phone_secondary":null,"public_notes":null},...]`

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Anthropic API 키가 설정되지 않았습니다.' }, { status: 500 })
  }

  try {
    const formData = await request.formData()
    const image = formData.get('image') as File | null
    if (!image) return NextResponse.json({ error: '이미지가 없습니다.' }, { status: 400 })

    if (!image.type.startsWith('image/') || !await isValidImageBytes(image)) {
      return NextResponse.json(
        { error: '지원하지 않는 이미지 형식입니다. (JPEG, PNG, GIF, WebP만 지원)' },
        { status: 400 },
      )
    }

    const arrayBuffer = await image.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    const mimeMap: Record<string, string> = {
      'image/jpeg': 'image/jpeg', 'image/jpg': 'image/jpeg',
      'image/png': 'image/png', 'image/gif': 'image/gif', 'image/webp': 'image/webp',
    }
    const mediaType = (mimeMap[image.type] ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

    const anthropic = new Anthropic({ apiKey })
    const msg = await createMessageWithRetry(anthropic, {
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: TABLE_EXTRACT_PROMPT },
        ],
      }],
    })

    const raw = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : ''
    if (!raw) {
      return NextResponse.json(
        { error: '이미지에서 텍스트를 추출하지 못했습니다. 더 선명한 이미지를 사용해주세요.' },
        { status: 422 },
      )
    }

    // 마크다운 코드블록 제거 후 JSON 배열 추출
    const stripped = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
    const match = stripped.match(/\[[\s\S]*\]/)
    if (!match) {
      return NextResponse.json({ error: '취재원 목록을 파싱하지 못했습니다.' }, { status: 500 })
    }

    let contacts: unknown[]
    try {
      contacts = JSON.parse(match[0])
    } catch {
      return NextResponse.json({ error: 'JSON 파싱 실패' }, { status: 500 })
    }

    return NextResponse.json({ contacts })
  } catch (e: unknown) {
    console.error('[OCR source-table]', e)
    const message = e instanceof Error ? e.message : '서버 오류'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
