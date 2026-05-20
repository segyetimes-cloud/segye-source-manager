// @ts-nocheck
/**
 * POST /api/ocr/business-card/batch
 *
 * 명함 여러 장 동시 OCR 처리
 * body: FormData { images: File[] }  (최대 20장)
 *
 * 응답: { results: Array<{ index, filename, data, error }> }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/** 실제 파일 헤더(magic bytes)로 이미지 여부 검증 — MIME 스푸핑 방어 */
async function isValidImageBytes(file: File): Promise<boolean> {
  const header = Buffer.from(await file.slice(0, 12).arrayBuffer())
  // JPEG: FF D8 FF
  if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) return true
  // PNG:  89 50 4E 47 0D 0A 1A 0A
  if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) return true
  // GIF:  47 49 46 38
  if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x38) return true
  // WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
  if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46
    && header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50) return true
  return false
}

const MAX_CARDS   = 20
const CONCURRENCY = 5   // Vision API 동시 호출 한도

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google Vision API 키가 설정되지 않았습니다.' },
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

  // ── 병렬 OCR (concurrency 제한) ────────────────────────────────────────────
  type OcrResult = { index: number; filename: string; data: ReturnType<typeof parseBusinessCard> | null; error: string | null }

  async function processOne(file: File, index: number): Promise<OcrResult> {
    try {
      if (!file.type.startsWith('image/') || !await isValidImageBytes(file)) {
        return { index, filename: file.name, data: null, error: '이미지 파일이 아닙니다. (JPEG, PNG, GIF, WebP만 지원)' }
      }

      const arrayBuffer = await file.arrayBuffer()
      const base64 = Buffer.from(arrayBuffer).toString('base64')

      const visionRes = await fetch(
        `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            requests: [{
              image: { content: base64 },
              features: [{ type: 'DOCUMENT_TEXT_DETECTION', maxResults: 1 }],
              imageContext: { languageHints: ['ko', 'en'] },
            }],
          }),
        },
      )

      if (!visionRes.ok) {
        const err = await visionRes.json().catch(() => ({}))
        return { index, filename: file.name, data: null, error: `Vision API 오류: ${err?.error?.message ?? visionRes.statusText}` }
      }

      const visionData = await visionRes.json()
      const fullText: string = visionData.responses?.[0]?.fullTextAnnotation?.text ?? ''

      if (!fullText.trim()) {
        return { index, filename: file.name, data: null, error: '텍스트를 찾지 못했습니다. 더 밝고 선명하게 찍어주세요.' }
      }

      return { index, filename: file.name, data: parseBusinessCard(fullText), error: null }
    } catch (e: any) {
      return { index, filename: file.name, data: null, error: e?.message ?? '처리 오류' }
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

// ── 명함 텍스트 파싱 (단일 카드와 동일 로직) ────────────────────────────────

function parseBusinessCard(text: string) {
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
