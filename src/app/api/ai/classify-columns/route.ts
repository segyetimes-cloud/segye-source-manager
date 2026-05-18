import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const TARGET_FIELDS = [
  { field: 'full_name', label: '이름' },
  { field: 'current_organization', label: '소속 기관' },
  { field: 'current_position', label: '직책/직위' },
  { field: 'current_department', label: '부서' },
  { field: 'phone_primary', label: '전화번호 (주)' },
  { field: 'phone_secondary', label: '전화번호 (보조)' },
  { field: 'email_primary', label: '이메일 (주)' },
  { field: 'email_secondary', label: '이메일 (보조)' },
  { field: 'birthday', label: '생년월일' },
  { field: 'hometown_province', label: '출신 광역시도' },
  { field: 'hometown_city', label: '출신 시군구' },
  { field: 'high_school', label: '출신 고교' },
  { field: 'university', label: '출신 대학' },
  { field: 'university_major', label: '학과/전공' },
  { field: 'graduate_school', label: '대학원' },
  { field: 'exam_batch', label: '고시/기수' },
  { field: 'tags', label: '태그/키워드' },
  { field: 'personal_notes', label: '메모/비고' },
  { field: 'skip', label: '(건너뜀 — 불필요한 컬럼)' },
]

// 키워드 기반 로컬 매핑 (Claude API 없을 때 폴백)
const KEYWORD_MAP: { field: string; keywords: string[] }[] = [
  { field: 'full_name',            keywords: ['이름', '성명', '성함', '취재원', 'name', '姓名'] },
  { field: 'current_organization', keywords: ['소속', '기관', '회사', '직장', '단체', '부처', '조직', 'org', 'company', '所屬'] },
  { field: 'current_position',     keywords: ['직책', '직위', '직급', '포지션', '직함', 'position', 'title', '職責'] },
  { field: 'current_department',   keywords: ['부서', '팀', '국', '과', '실', 'dept', 'department', '部署'] },
  { field: 'phone_primary',        keywords: ['전화', '연락처', '휴대폰', '핸드폰', '모바일', 'phone', 'tel', 'mobile', '電話', '주전화', '전화1'] },
  { field: 'phone_secondary',      keywords: ['전화2', '보조전화', '사무실', '직통', '팩스', 'fax', '부전화'] },
  { field: 'email_primary',        keywords: ['이메일', '메일', 'email', 'e-mail', 'mail', '주이메일', '이메일1', '電子메일'] },
  { field: 'email_secondary',      keywords: ['이메일2', '보조이메일', '개인메일', '직장메일'] },
  { field: 'birthday',             keywords: ['생년월일', '생일', '출생', '생년', 'birth', 'dob', '生年月日'] },
  { field: 'hometown_province',    keywords: ['출신지', '고향', '출신광역', '출신시도', '광역시도', '출신도', 'hometown', 'region'] },
  { field: 'hometown_city',        keywords: ['출신시군구', '출신시', '출신군', '고향시', '출신구'] },
  { field: 'high_school',          keywords: ['고교', '고등학교', '출신고교', '고등', 'high school', '高校'] },
  { field: 'university',           keywords: ['대학', '학교', '출신대학', '대학교', '학부', 'university', 'college', '大學'] },
  { field: 'university_major',     keywords: ['전공', '학과', '계열', '학부전공', 'major', 'dept', '專攻'] },
  { field: 'graduate_school',      keywords: ['대학원', '석사', '박사', '석박', 'graduate', 'master', 'phd', '大學院'] },
  { field: 'exam_batch',           keywords: ['기수', '사시', '행시', '고시', '사법', '행정', '외무', '고시기수', 'exam', 'batch', '期數'] },
  { field: 'tags',                 keywords: ['태그', '키워드', '분류', '카테고리', '특기', 'tag', 'keyword', '분야'] },
  { field: 'personal_notes',       keywords: ['메모', '비고', '참고', '기타', '노트', '특이사항', 'note', 'memo', 'remark', '備考'] },
]

function heuristicMap(headers: string[]): { header: string; field: string; confidence: number; reason: string }[] {
  return headers.map(header => {
    const h = header.toLowerCase().replace(/\s+/g, '')
    let bestField = 'skip'
    let bestScore = 0
    let bestReason = '매핑되는 필드를 찾지 못했습니다'

    for (const { field, keywords } of KEYWORD_MAP) {
      for (const kw of keywords) {
        const k = kw.toLowerCase().replace(/\s+/g, '')
        if (h === k) {
          // 완전 일치
          return { header, field, confidence: 0.95, reason: `헤더가 "${kw}"와 정확히 일치` }
        }
        if (h.includes(k) || k.includes(h)) {
          const score = Math.min(h.length, k.length) / Math.max(h.length, k.length)
          if (score > bestScore) {
            bestScore = score
            bestField = field
            bestReason = `"${kw}" 키워드 포함`
          }
        }
      }
    }

    if (bestScore > 0) {
      return { header, field: bestField, confidence: Math.min(0.85, bestScore * 0.9), reason: bestReason }
    }
    return { header, field: 'skip', confidence: 0, reason: '매핑되는 필드 없음' }
  })
}

// POST /api/ai/classify-columns
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { headers, sampleRows } = await request.json()

  if (!headers?.length) {
    return NextResponse.json({ error: 'headers required' }, { status: 400 })
  }

  // Claude API 키가 없으면 로컬 휴리스틱 사용
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey || apiKey.trim() === '') {
    const mappings = heuristicMap(headers)
    return NextResponse.json({ mappings, source: 'heuristic' })
  }

  try {
    const anthropic = new Anthropic({ apiKey })

    const prompt = `당신은 취재원 관리 시스템의 데이터 분류 전문가입니다.

아래는 기자가 업로드한 엑셀 파일의 헤더와 샘플 데이터입니다.
각 헤더를 아래 시스템 필드 중 가장 적합한 것으로 매핑해 주세요.

## 업로드된 엑셀 헤더:
${JSON.stringify(headers)}

## 샘플 데이터 (최대 3행):
${JSON.stringify(sampleRows.slice(0, 3))}

## 매핑 가능한 시스템 필드:
${TARGET_FIELDS.map(f => `- ${f.field}: ${f.label}`).join('\n')}

## 규칙:
1. 각 헤더를 위 필드 중 하나에 매핑하세요
2. 적합한 필드가 없으면 "skip"으로 매핑하세요
3. confidence는 0~1 사이 숫자 (0.8 이상이면 자동 적용, 미만이면 사용자에게 확인 요청)
4. 반드시 JSON 형식만 반환하세요 (설명 텍스트 없이)

응답 형식:
{
  "mappings": [
    {"header": "원본헤더명", "field": "시스템필드명", "confidence": 0.95, "reason": "매핑 이유 간략히"}
  ]
}`

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    let result
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      result = JSON.parse(jsonMatch?.[0] ?? text)
    } catch {
      // AI 응답 파싱 실패 시 휴리스틱으로 폴백
      const mappings = heuristicMap(headers)
      return NextResponse.json({ mappings, source: 'heuristic_fallback' })
    }

    return NextResponse.json({ ...result, source: 'ai' })

  } catch (err) {
    // API 호출 자체 실패 시 휴리스틱으로 폴백
    console.error('Claude API error:', err)
    const mappings = heuristicMap(headers)
    return NextResponse.json({ mappings, source: 'heuristic_fallback' })
  }
}
