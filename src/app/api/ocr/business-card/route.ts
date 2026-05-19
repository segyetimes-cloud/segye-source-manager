// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/ocr/business-card
// body: FormData { image: File }
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google Vision API 키가 설정되지 않았습니다.' },
      { status: 500 }
    )
  }

  try {
    const formData = await request.formData()
    const file = formData.get('image') as File | null
    if (!file) return NextResponse.json({ error: '이미지가 없습니다.' }, { status: 400 })

    // 파일 → base64
    const arrayBuffer = await file.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    // Google Cloud Vision API 호출
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
      }
    )

    if (!visionRes.ok) {
      const errBody = await visionRes.json().catch(() => ({}))
      console.error('Vision API error:', errBody)
      return NextResponse.json(
        { error: `Vision API 오류: ${errBody?.error?.message ?? visionRes.statusText}` },
        { status: 502 }
      )
    }

    const visionData = await visionRes.json()
    const fullText: string = visionData.responses?.[0]?.fullTextAnnotation?.text ?? ''

    if (!fullText.trim()) {
      return NextResponse.json(
        { error: '명함에서 텍스트를 추출하지 못했습니다. 사진을 더 밝고 선명하게 찍어주세요.' },
        { status: 422 }
      )
    }

    const extracted = parseBusinessCard(fullText)
    return NextResponse.json({ data: extracted })
  } catch (err: any) {
    console.error('OCR error:', err)
    return NextResponse.json(
      { error: err.message ?? '처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

// ── 명함 텍스트 파싱 ──────────────────────────────────────────────────────────

function parseBusinessCard(text: string) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // ① 이메일
  const emailMatch = text.match(/[\w.+\-]+@[\w\-]+\.[\w.]{2,}/i)
  const email = emailMatch?.[0]?.toLowerCase() ?? null

  // ② 웹사이트 (이메일 제외)
  const websiteMatch = text
    .replace(email ?? '', '')
    .match(/(?:https?:\/\/)?(?:www\.)?[\w\-]+\.(?:com|co\.kr|kr|net|org|io|go\.kr)[\w/\-.]*/i)
  const website = websiteMatch?.[0] ?? null

  // ③ 전화번호 — 모바일(010/011…) vs 사무실 분리
  const allPhones = text.match(/0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g) ?? []
  let phone: string | null = null
  let office_phone: string | null = null
  for (const p of allPhones) {
    const cleaned = p.replace(/[-.\s]/g, '')
    if (/^01[016789]/.test(cleaned)) {
      if (!phone) phone = p
    } else {
      if (!office_phone) office_phone = p
    }
  }

  // ④ 이름 (한글 2~5자 단독 라인)
  const koreanNameRe = /^[가-힣]{2,5}$/
  let full_name: string | null = null
  for (const line of lines) {
    if (koreanNameRe.test(line)) { full_name = line; break }
  }

  // ⑤ 영문 이름 (2단어 이상 알파벳, 짧음)
  let name_en: string | null = null
  for (const line of lines) {
    if (/^[A-Za-z]+(?:\s+[A-Za-z]+)+$/.test(line) && line.length < 35 && !line.includes('@')) {
      name_en = line; break
    }
  }

  // ⑥ 직책 키워드 매칭
  const positionKeywords = [
    '대표이사', '전무이사', '상무이사', '대표', '사장', '부사장', '전무', '상무',
    '부장', '차장', '팀장', '과장', '대리', '주임', '사원',
    '이사', '본부장', '실장', '국장', '처장', '원장', '소장',
    '교수', '연구원', '연구위원', '위원', '논설위원',
    '기자', '편집장', '편집인', '주필', '특파원',
    '변호사', '회계사', '세무사', '법무사',
    '사무총장', '부회장', '회장', '총장',
  ]
  let current_position: string | null = null
  for (const line of lines) {
    if (current_position) break
    for (const kw of positionKeywords) {
      if (line.includes(kw)) {
        current_position = line.length <= 20 ? line : kw
        break
      }
    }
  }

  // ⑦ 부서명
  let department: string | null = null
  for (const line of lines) {
    if (/(?:부|팀|실|국|처|과|센터|본부|파트)$/.test(line) && line.length <= 20 && line !== full_name) {
      department = line; break
    }
  }

  // ⑧ 기관/회사명
  const orgKeywords = /주식회사|㈜|\(주\)|법무법인|법인|기업|그룹|병원|학교|대학교|대학|연구소|연구원|협회|재단|공사|공단|청|방송|신문|일보|뉴스|미디어|컨설팅|파트너스|어소시에이츠/
  let current_organization: string | null = null
  for (const line of lines) {
    if (orgKeywords.test(line) && line.length <= 50) {
      current_organization = line; break
    }
  }

  // ⑨ 주소 (시/도/구/동/로/길 포함 라인 합치기)
  const addrParts: string[] = []
  for (const line of lines) {
    if (
      /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/.test(line) ||
      /\d+\s*(?:층|호|번지|번|동)/.test(line) ||
      /(로|길|대로|avenue|st\.|blvd)\s/i.test(line)
    ) {
      addrParts.push(line)
    }
  }
  const address = addrParts.length > 0 ? addrParts.join(' ') : null

  return {
    full_name,
    name_en,
    current_organization,
    current_position,
    department,
    phone,
    office_phone,
    email,
    address,
    website,
  }
}
