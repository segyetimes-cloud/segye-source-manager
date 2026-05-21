// @ts-nocheck
/**
 * POST /api/ocr/business-card/batch
 *
 * 명함 여러 장 동시 OCR — Claude Vision API 사용
 * body: FormData { images: File[] }  (최대 20장)
 *
 * 응답: { results: Array<{ index, filename, data, error }> }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

/** 실제 파일 헤더(magic bytes)로 이미지 여부 검증 */
async function isValidImageBytes(file: File): Promise<boolean> {
  const header = Buffer.from(await file.slice(0, 12).arrayBuffer())
  if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) return true  // JPEG
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) return true  // PNG
  if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x38) return true  // GIF
  if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46
    && header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50) return true  // WebP
  return false
}

const MAX_CARDS   = 20
const CONCURRENCY = 3  // Claude API 동시 호출 한도 (rate limit 고려)

const EXTRACT_PROMPT = `이 명함 이미지에서 정보를 추출해 JSON으로만 응답하세요. 설명 없이 JSON만 출력하세요.

추출 필드:
- full_name: 한국어 이름 (2~5자 한글)
- name_en: 영문 이름
- current_organization: 소속 회사/기관명
- current_position: 직책/직위
- department: 부서명
- phone_primary: 휴대폰 번호 (010으로 시작)
- phone_secondary: 사무실/기타 전화번호
- email_primary: 이메일 주소
- address: 주소
- website: 웹사이트 URL

없는 항목은 null로 설정하세요.
응답 형식: {"full_name":"...","name_en":"...","current_organization":"...",...}`

export async function POST(request: NextRequest) {
  // Rate Limit: 사용자당 1분 5회 (Anthropic API 비용 방어)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { checkRateLimit, getClientIp } = await import('@/lib/rateLimit')
  const ip = getClientIp(request)
  const rl = checkRateLimit(`${user.id}:${ip}`, { prefix: 'ocr-batch', limit: 5, windowMs: 60_000 })
  if (!rl.allowed) {
    return NextResponse.json(
      { error: '요청이 너무 많습니다. 1분 후 다시 시도해 주세요.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      }
    )
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Anthropic API 키가 설정되지 않았습니다.' },
      { status: 500 },
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: '요청 파싱 실패' }, { status: 400 })
  }

  const files = formData.getAll('images') as File[]
  if (!files.length) {
    return NextResponse.json({ error: '이미지가 없습니다.' }, { status: 400 })
  }
  if (files.length > MAX_CARDS) {
    return NextResponse.json(
      { error: `한 번에 최대 ${MAX_CARDS}장까지 처리할 수 있습니다.` },
      { status: 400 },
    )
  }

  const anthropic = new Anthropic({ apiKey })

  type OcrResult = {
    index: number
    filename: string
    data: ReturnType<typeof parseBusinessCard> | null
    error: string | null
  }

  async function processOne(file: File, index: number): Promise<OcrResult> {
    try {
      if (!file.type.startsWith('image/') || !await isValidImageBytes(file)) {
        return { index, filename: file.name, data: null, error: '이미지 파일이 아닙니다. (JPEG, PNG, GIF, WebP만 지원)' }
      }

      const arrayBuffer = await file.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')

      // MIME 타입 정규화
      const mimeMap: Record<string, string> = {
        'image/jpeg': 'image/jpeg',
        'image/jpg':  'image/jpeg',
        'image/png':  'image/png',
        'image/gif':  'image/gif',
        'image/webp': 'image/webp',
      }
      const mediaType = (mimeMap[file.type] ?? 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

      const message = await anthropic.messages.create({
        model: 'claude-haiku-4-5',   // 빠르고 저렴한 모델로 OCR
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: EXTRACT_PROMPT },
          ],
        }],
      })

      const raw = message.content[0]?.type === 'text' ? message.content[0].text.trim() : ''
      if (!raw) {
        return { index, filename: file.name, data: null, error: '텍스트를 찾지 못했습니다. 더 밝고 선명하게 찍어주세요.' }
      }

      // JSON 파싱 — 코드블록 감싸여 있을 경우 제거
      const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
      let parsed: Record<string, string | null>
      try {
        parsed = JSON.parse(jsonStr)
      } catch {
        // JSON 파싱 실패 시 텍스트 기반 파싱으로 폴백
        parsed = parseBusinessCard(raw)
      }

      return { index, filename: file.name, data: parsed as any, error: null }
    } catch (e: any) {
      const msg = e?.message ?? '처리 오류'
      // rate limit 안내
      if (msg.includes('rate') || e?.status === 429) {
        return { index, filename: file.name, data: null, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }
      }
      return { index, filename: file.name, data: null, error: msg }
    }
  }

  // concurrency 제한 실행
  const results: OcrResult[] = new Array(files.length)
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const batch = files.slice(i, i + CONCURRENCY)
    const batchResults = await Promise.all(batch.map((f, j) => processOne(f, i + j)))
    batchResults.forEach(r => { results[r.index] = r })
  }

  return NextResponse.json({ results })
}

// ── 텍스트 기반 파싱 폴백 (JSON 파싱 실패 시) ───────────────────────────────

function parseBusinessCard(text: string): Record<string, string | null> {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  const emailMatch = text.match(/[\w.+\-]+@[\w\-]+\.[\w.]{2,}/i)
  const email = emailMatch?.[0]?.toLowerCase() ?? null

  const websiteMatch = text
    .replace(email ?? '', '')
    .match(/(?:https?:\/\/)?(?:www\.)?[\w\-]+\.(?:com|co\.kr|kr|net|org|io|go\.kr)[\w/\-.]*/i)
  const website = websiteMatch?.[0] ?? null

  const allPhones = text.match(/0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g) ?? []
  let phone: string | null = null
  let office_phone: string | null = null
  for (const p of allPhones) {
    const cleaned = p.replace(/[-.\s]/g, '')
    if (/^01[016789]/.test(cleaned)) { if (!phone) phone = p }
    else { if (!office_phone) office_phone = p }
  }

  const koreanNameRe = /^[가-힣]{2,5}$/
  let full_name: string | null = null
  for (const line of lines) {
    if (koreanNameRe.test(line)) { full_name = line; break }
  }

  let name_en: string | null = null
  for (const line of lines) {
    if (/^[A-Za-z]+(?:\s+[A-Za-z]+)+$/.test(line) && line.length < 35 && !line.includes('@')) {
      name_en = line; break
    }
  }

  const positionKeywords = [
    '대표이사', '전무이사', '상무이사', '대표', '사장', '부사장', '전무', '상무',
    '부장', '차장', '팀장', '과장', '대리', '주임', '사원',
    '이사', '본부장', '실장', '국장', '처장', '원장', '소장',
    '교수', '연구원', '연구위원', '위원', '논설위원',
    '기자', '편집장', '편집인', '주필', '특파원',
    '변호사', '회계사', '세무사', '법무사', '사무총장', '부회장', '회장', '총장',
  ]
  let current_position: string | null = null
  for (const line of lines) {
    if (current_position) break
    for (const kw of positionKeywords) {
      if (line.includes(kw)) { current_position = line.length <= 20 ? line : kw; break }
    }
  }

  let department: string | null = null
  for (const line of lines) {
    if (/(?:부|팀|실|국|처|과|센터|본부|파트)$/.test(line) && line.length <= 20 && line !== full_name) {
      department = line; break
    }
  }

  const orgKeywords = /주식회사|㈜|\(주\)|법무법인|법인|기업|그룹|병원|학교|대학교|대학|연구소|연구원|협회|재단|공사|공단|청|방송|신문|일보|뉴스|미디어|컨설팅|파트너스|어소시에이츠/
  let current_organization: string | null = null
  for (const line of lines) {
    if (orgKeywords.test(line) && line.length <= 50) { current_organization = line; break }
  }

  const addrParts: string[] = []
  for (const line of lines) {
    if (
      /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/.test(line) ||
      /\d+\s*(?:층|호|번지|번|동)/.test(line) ||
      /(로|길|대로)\s/i.test(line)
    ) { addrParts.push(line) }
  }

  return {
    full_name, name_en, current_organization, current_position,
    department, phone_primary: phone, phone_secondary: office_phone,
    email_primary: email, address: addrParts.join(' ') || null, website,
  }
}
