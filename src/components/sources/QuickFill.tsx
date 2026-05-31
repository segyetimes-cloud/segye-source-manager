'use client'

/**
 * QuickFill — 연락처/웹 텍스트 붙여넣기 간편 입력
 *
 * 지원 입력 형식:
 *  - 연락처 앱 공유 텍스트 (삼성/갤럭시 등)
 *  - 네이버 인물정보 복사 ("출생1963년...", "학력서울대...")
 *  - 네이버/구글 뉴스·블로그 복사 (비구조적 문장)
 *  - 자유 형식 텍스트 (이름·소속·전화·이메일 포함)
 */

import { useRef, useState, useCallback } from 'react'

/** 탭 구분 다행 입력 여부 감지 */
function isMultiTabRow(raw: string): boolean {
  const lines = raw.split(/\n/).map(l => l.trim()).filter(Boolean)
  return lines.length >= 2 && lines.filter(l => l.includes('\t')).length >= 2
}

/** 탭 구분 단일 행 → FillData 파싱 */
function parseTabRow(line: string): FillData {
  const cols = line.split('\t')
  const org   = cols[0]?.trim() || undefined
  const pos   = cols[1]?.trim() || undefined
  const nameRaw = cols[2]?.trim() || ''
  // 한자 괄호 제거: 金渡坤, 全氏 등
  const name  = nameRaw.replace(/\([一-鿿·\s]+\)/g, '').trim() || undefined
  const phoneRaw = (cols[3] ?? '').replace(/^,+/, '').trim()
  const phones = phoneRaw.split(',').map(p => p.trim()).filter(Boolean)
  const unique = [...new Set(phones)]
  const notes = cols[4]?.trim() || undefined
  return {
    current_organization: org,
    current_position:     pos,
    full_name:            name,
    phone:                unique[0],
    phone_secondary:      unique[1] !== unique[0] ? unique[1] : undefined,
    public_notes:         notes,
  }
}

export interface FillData {
  full_name?: string
  current_organization?: string
  current_position?: string
  current_department?: string
  phone?: string
  phone_secondary?: string
  email?: string
  email_secondary?: string
  exam_batch?: string
  university?: string
  university_major?: string
  graduate_school?: string
  high_school?: string
  birthday?: string
  hometown_province?: string
  hometown_city?: string
  personal_notes?: string
  public_notes?: string
}

interface Props {
  onFill: (data: FillData) => void
}

// ── 공유 텍스트 파싱 ──────────────────────────────────────────────────────────
function parseContactText(raw: string): FillData {
  // ▲ 불릿 구분자를 줄바꿈으로 정규화
  const normalized = raw.replace(/▲\s*/g, '\n')
  const lines = normalized.split(/[\n\r]/).map(l => l.trim()).filter(Boolean)

  // ── 레이블 사전 ─────────────────────────────────────────────────────────────
  const LBLS: Record<string, string[]> = {
    name:      ['이름','성명','name'],
    phone:     ['전화','전화번호','연락처','모바일','휴대폰','핸드폰','휴대전화','직통','cell','mobile','tel','phone'],
    phone2:    ['집전화','자택','사무','사무실','office','fax','팩스'],
    email:     ['이메일','email','e-mail'],
    org:       ['소속','회사','직장','기관','부처','근무지','organization','company','work'],
    pos:       ['직책','직함','직위','직급','보직','title','현직','직업','직종'],
    dept:      ['부서','department'],
    exam:      ['기수','고시','행시','사시'],
    univ:      ['대학','university','학교','학력'],
    hs:        ['고교','고등학교','출신고'],
    birth:     ['생년월일','생년','birthday','birth','출생'],
    province:  ['출신지','고향','지역'],
    addr:      ['주소','address','집','자택주소'],
    career:    ['경력','약력','이력'],
    etc:       ['홈','home'],
  }
  const ALL_LBLS = Object.values(LBLS).flat().map(s => s.toLowerCase())

  function labelOf(line: string): string | null {
    const clean = line.replace(/[:：\s]+$/, '').toLowerCase()
    for (const [cat, arr] of Object.entries(LBLS)) {
      if (arr.some(l => l.toLowerCase() === clean)) return cat
    }
    return null
  }

  // ── 키-값 맵 구성 ───────────────────────────────────────────────────────────
  const kv: Record<string, string[]> = {}

  function kvPush(cat: string, val: string) {
    if (!kv[cat]) kv[cat] = []
    kv[cat].push(val)
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // "[레이블] 값" 형식
    const bracketMatch = line.match(/^\[([^\]]+)\]\s*(.*)/)
    if (bracketMatch) {
      const cat = labelOf(bracketMatch[1]) ?? bracketMatch[1].toLowerCase()
      const val = bracketMatch[2].trim()
      if (val) {
        kvPush(cat, val)
      } else if (i + 1 < lines.length && !lines[i+1].startsWith('[')) {
        kvPush(cat, lines[i+1].trim())
        i++
      }
      continue
    }

    // "레이블: 값" 형식
    const colonMatch = line.match(
      /^(이름|성명|name|전화|전화번호|연락처|모바일|mobile|휴대폰|핸드폰|휴대전화|이메일|e-?mail|소속|회사|직장|기관|부처|organization|company|직책|직함|직위|직급|보직|title|현직|직업|부서|department|기수|고시|행시|사시|대학|university|학력|고교|생년월일|출생|출신지|주소|address)\s*[:：]\s*(.+)/i
    )
    if (colonMatch) {
      const cat = labelOf(colonMatch[1]) ?? colonMatch[1].toLowerCase()
      kvPush(cat, colonMatch[2].trim())
      continue
    }

    // ── 네이버 형식: 레이블이 값에 바로 붙은 형식 ─────────────────────────────
    // 예) "출생1963년 3월 5일"  "학력서울대학교 법학과"  "현직기획재정부 장관"
    const naverMatch = line.match(
      /^(출생|현직|직업|직종|학력|소속|경력|약력|이력|국적|수상)\s*(.{2,})/
    )
    if (naverMatch) {
      const cat = labelOf(naverMatch[1]) ?? naverMatch[1].toLowerCase()
      kvPush(cat, naverMatch[2].trim())
      continue
    }

    // ── 경력 섹션: "경력" 단독 줄 이후 여러 줄 수집 ──────────────────────────
    const careerCat = labelOf(line)
    if (careerCat === 'career' && i + 1 < lines.length) {
      const careerLines: string[] = []
      let j = i + 1
      while (j < lines.length && !labelOf(lines[j]) && !lines[j].startsWith('[')) {
        careerLines.push(lines[j])
        j++
      }
      if (careerLines.length > 0) {
        kvPush('career', careerLines.join('\n'))
        i = j - 1
      }
      continue
    }

    // 레이블 단독 줄 → 다음 줄이 값
    const cat = labelOf(line)
    if (cat && i + 1 < lines.length) {
      const next = lines[i + 1]
      if (!labelOf(next)) {
        kvPush(cat, next.trim())
        i++
      }
    }
  }

  // ── 전화번호 전체 추출 ───────────────────────────────────────────────────────
  const allPhones = [...normalized.matchAll(/0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g)]
    .map(m => m[0].replace(/[-.\s]/g, '').replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3'))
  // 010 우선, 그 외 순
  const phones010 = allPhones.filter(p => p.startsWith('010'))
  const phonesOther = allPhones.filter(p => !p.startsWith('010'))
  const phonesSorted = [...phones010, ...phonesOther]

  const phone = phonesSorted[0]
  const phone_secondary = phonesSorted.length > 1 ? phonesSorted[1] : undefined

  // ── 이메일 ───────────────────────────────────────────────────────────────────
  const emails = [...normalized.matchAll(/[\w.+\-]+@[\w\-]+\.[\w.]{2,}/gi)].map(m => m[0].toLowerCase())
  const email = emails[0]
  const email_secondary = emails.length > 1 ? emails[1] : undefined

  // ── 고시/기수 ────────────────────────────────────────────────────────────────
  // 우선순위: kv['exam'] → 텍스트 패턴 추출
  let exam_batch: string | undefined = kv['exam']?.[0]

  if (!exam_batch) {
    // "사시 28회", "행시 32회", "외시 28기", "행정고시 28기" 등
    const examPattern = normalized.match(
      /(행정고시|사법시험|외무고시|기술고시|행시|사시|외시|입법고시|회계사|변호사)[\s·]?(\d+)[회기]/
    )
    if (examPattern) {
      exam_batch = `${examPattern[1]} ${examPattern[2]}${examPattern[0].slice(-1)}`
    }
  }

  if (!exam_batch) {
    // "28기 99년" 같은 패턴: 숫자+기 앞에 고시 관련 키워드가 있는 줄
    for (const line of lines) {
      if (/사시|행시|외시|고시|기수/.test(line)) {
        const m = line.match(/(\d+)[회기]/)
        if (m) { exam_batch = m[0]; break }
      }
    }
  }

  // ── 이름 ───────────────────────────────────────────────────────────────────
  let full_name: string | undefined = kv['name']?.[0]

  if (!full_name) {
    for (const line of lines) {
      if (labelOf(line)) continue
      if (line.startsWith('[')) continue
      if (ALL_LBLS.includes(line.toLowerCase())) continue
      if (/^[가-힣]{2,5}$/.test(line) && !/\d/.test(line)) {
        full_name = line; break
      }
    }
  }

  // "[이름] 강찬우 평산" 에서 이름 추출 (별명 제거)
  if (!full_name) {
    // normalized 전체에서 "[이름] XXX" 패턴
    const nameInBracket = normalized.match(/\[이름\]\s*([가-힣]{2,5})/)
    if (nameInBracket) full_name = nameInBracket[1]
  }

  if (full_name) {
    const nameOnly = full_name.match(/^[가-힣]{2,5}/)
    if (nameOnly) full_name = nameOnly[0]
  }

  // ── 소속 ───────────────────────────────────────────────────────────────────
  const ORG_KW = /주식회사|㈜|\(주\)|법무법인|법인|기업|그룹|병원|대학교|대학|연구소|협회|재단|공사|공단|방송|신문|일보|뉴스|미디어|컨설팅|위원회|국회|청와대|행안부|법무부|기재부|외교부|검찰청|경찰청|국방부|교육부|복지부/
  let current_organization: string | undefined = kv['org']?.[0]
  if (!current_organization) {
    for (const line of lines) {
      if (labelOf(line)) continue
      if (ORG_KW.test(line) && line.length <= 50 && !line.includes('@')) {
        current_organization = line; break
      }
    }
  }

  // ── 직책 ───────────────────────────────────────────────────────────────────
  const POS_KWS = ['대표이사','전무이사','상무이사','대표','사장','부장','차장','팀장',
    '과장','대리','이사','본부장','실장','국장','원장','교수','연구원','위원',
    '기자','편집장','변호사','회계사','세무사','사무총장','부회장','회장',
    '장관','차관','검사장','검사','지검장','부장검사','총장','청장','원장']

  let current_position: string | undefined = kv['pos']?.[0]
  if (!current_position) {
    for (const line of lines) {
      if (labelOf(line)) continue
      for (const kw of POS_KWS) {
        if (line.includes(kw)) { current_position = line.length <= 20 ? line : kw; break }
      }
      if (current_position) break
    }
  }

  // ── 부서 ───────────────────────────────────────────────────────────────────
  const current_department = kv['dept']?.[0]

  // ── 대학 / 전공 / 대학원 ─────────────────────────────────────────────────────
  let university: string | undefined = kv['univ']?.[0]
  if (!university) {
    const univMatch = normalized.match(/([가-힣]{2,10}(?:대학교|대학))/)
    if (univMatch) university = univMatch[1]
  }
  if (!university) {
    // 약칭 표기: 서울대, 고려대, 연세대 등
    // 뒤에 학과·학부·전공이 오거나, 공백·쉼표·줄끝이 오는 경우
    const abbrMatch = normalized.match(
      /([가-힣]{2,5}대)(?=\s+[가-힣]{2,15}(?:학과|학부|전공|과)|\s*(?:,|\n|$|\(|\[))/
    )
    if (abbrMatch) university = abbrMatch[1]
  }

  // 전공: "서울대학교 법학과", "경제학부", "XX전공" 등에서 추출
  let university_major: string | undefined
  if (university) {
    const majorMatch = normalized.match(new RegExp(university + '\\s+([가-힣]{2,15}(?:학과|학부|전공|과))'))
    if (majorMatch) university_major = majorMatch[1]
  }
  if (!university_major) {
    const majorMatch2 = normalized.match(/([가-힣]{2,15}(?:학과|학부|전공))(?:\s|$|,|졸)/)
    if (majorMatch2) {
      let major = majorMatch2[1]
      // 앞에 대학 약칭이 붙어있으면 제거 (예: "서울대외교학과" → "외교학과")
      if (university && major.startsWith(university)) {
        major = major.slice(university.length)
      }
      if (major.length >= 2) university_major = major
    }
  }

  // 대학원
  let graduate_school: string | undefined
  const gradMatch = normalized.match(/([가-힣]{2,10}(?:대학원))/)
  if (gradMatch) graduate_school = gradMatch[1]
  if (!graduate_school && kv['univ'] && kv['univ'].length > 1) {
    graduate_school = kv['univ'][1]
  }

  // ── 고교 ───────────────────────────────────────────────────────────────────
  let high_school: string | undefined = kv['hs']?.[0]
  if (!high_school) {
    // "진주고", "서울고등학교" 등
    const hsMatch = normalized.match(/([가-힣]{2,10}(?:고등학교|고교|여고|남고|고(?!\s*시)))/)
    if (hsMatch) high_school = hsMatch[1]
  }

  // ── 생년월일 ─────────────────────────────────────────────────────────────────
  let birthday: string | undefined = kv['birth']?.[0]
  if (!birthday) {
    const bdMatch = normalized.match(/(19|20)\d{2}[.\-/]?\d{1,2}[.\-/]?\d{1,2}/)
    if (bdMatch) birthday = bdMatch[0]
  }

  // ── 출신 광역시도 + 시군구 ─────────────────────────────────────────────────
  const PROVINCES = ['서울','부산','대구','인천','광주','대전','울산','세종','경기','강원','충북','충남','전북','전남','경북','경남','제주']
  const PROVINCE_MAP: Record<string, string> = {
    '서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구',
    '인천광역시': '인천', '광주광역시': '광주', '대전광역시': '대전',
    '울산광역시': '울산', '세종특별자치시': '세종', '세종시': '세종',
    '경기도': '경기', '강원도': '강원', '강원특별자치도': '강원',
    '충청북도': '충북', '충청남도': '충남',
    '전라북도': '전북', '전북특별자치도': '전북', '전라남도': '전남',
    '경상북도': '경북', '경상남도': '경남', '제주특별자치도': '제주', '제주도': '제주',
  }
  let hometown_province: string | undefined = kv['province']?.[0]
  let hometown_city: string | undefined
  if (!hometown_province) {
    for (const line of lines) {
      if (labelOf(line)) continue
      const trimLine = line.trim().replace(/\(\d+\)/g, '').trim()  // (55) 같은 숫자 제거
      if (trimLine.length > 35) continue
      // "1963 경상남도 하동" 같은 연도+지역 형식 처리
      const yearPrefix = trimLine.match(/^((19|20)\d{2})\s+/)
      const searchLine = yearPrefix ? trimLine.slice(yearPrefix[0].length) : trimLine
      let abbr: string | undefined
      let rest = searchLine
      for (const [full, a] of Object.entries(PROVINCE_MAP)) {
        if (searchLine.startsWith(full)) { abbr = a; rest = searchLine.slice(full.length).trim(); break }
      }
      if (!abbr) {
        const found = PROVINCES.find(p => searchLine.startsWith(p))
        if (found) { abbr = found; rest = searchLine.slice(found.length).trim() }
      }
      if (abbr) {
        hometown_province = abbr
        if (rest && /^[가-힣]{1,10}$/.test(rest)) hometown_city = rest
        // 같은 줄에 연도가 있으면 생년월일로 활용
        if (yearPrefix && !birthday) birthday = yearPrefix[1]
        break
      }
    }
  }

  // ── 주소 / 경력 배경 → personal_notes ───────────────────────────────────────
  const noteParts: string[] = []

  // [집] 주소 누적
  const addrValues = kv['addr'] ?? []
  if (addrValues.length > 0) {
    noteParts.push(`[주소] ${addrValues.join(' / ')}`)
  }

  // 네이버 경력 섹션 (career 키)
  const careerSection = kv['career']
  if (careerSection && careerSection.length > 0) {
    noteParts.push(`[경력]\n${careerSection.join('\n')}`)
  }

  // 긴 경력 서술 문장 (30자 이상이고 연도·직책 키워드 포함, 경력 섹션 없을 때)
  if (!careerSection) {
    const careerLines = lines.filter(line => {
      if (labelOf(line)) return false
      if (line.startsWith('[')) return false
      if (line.length < 30) return false
      return /\d{2,4}[년.\/\-]|\d+기|고시|검사|장관|실장|부장|국장|교수|위원/.test(line)
    })
    if (careerLines.length > 0) {
      noteParts.push(careerLines.join('\n'))
    }
  }

  const personal_notes = noteParts.length > 0 ? noteParts.join('\n') : undefined

  return {
    full_name, current_organization, current_position, current_department,
    phone, phone_secondary,
    email, email_secondary,
    exam_batch,
    university, university_major, graduate_school, high_school,
    birthday, hometown_province, hometown_city,
    personal_notes,
  }
}

// 정보 창 붙여넣기 감지용 — 학력·배경·소속·고향 필드 반환
export function extractEducationFields(text: string): Pick<FillData,
  'exam_batch' | 'university' | 'university_major' | 'graduate_school' |
  'high_school' | 'birthday' | 'hometown_province' | 'hometown_city' |
  'current_organization' | 'current_position'
> {
  const full = parseContactText(text)
  return {
    exam_batch:           full.exam_batch,
    university:           full.university,
    university_major:     full.university_major,
    graduate_school:      full.graduate_school,
    high_school:          full.high_school,
    birthday:             full.birthday,
    hometown_province:    full.hometown_province,
    hometown_city:        full.hometown_city,
    current_organization: full.current_organization,
    current_position:     full.current_position,
  }
}

// ── 수정 가능한 미리보기 행 ──────────────────────────────────────────────────
function EditablePreviewRow({
  label, fieldKey, value, onUpdate,
}: {
  label: string
  fieldKey: keyof FillData
  value?: string
  onUpdate: (key: keyof FillData, val: string | undefined) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')

  if (!value) return null

  if (editing) {
    return (
      <div style={{ display: 'flex', gap: '6px', fontSize: '12px', padding: '3px 0', alignItems: 'center' }}>
        <span style={{ color: '#607898', flexShrink: 0, width: '64px' }}>{label}</span>
        <input
          value={draft}
          onChange={e => setDraft(e.target.value)}
          autoFocus
          style={{
            flex: 1, background: '#1A2838', border: '1px solid #4A7CC0',
            color: '#CDD5E0', borderRadius: '4px', padding: '2px 8px',
            fontSize: '12px', outline: 'none', minWidth: 0,
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') { onUpdate(fieldKey, draft.trim() || undefined); setEditing(false) }
            if (e.key === 'Escape') { setDraft(value); setEditing(false) }
          }}
        />
        <button type="button"
          onClick={() => { onUpdate(fieldKey, draft.trim() || undefined); setEditing(false) }}
          style={{ fontSize: '11px', color: '#4A7CC0', background: 'none', border: 'none', cursor: 'pointer', padding: '0 3px', fontWeight: 700 }}>
          ✓
        </button>
        <button type="button"
          onClick={() => { setDraft(value); setEditing(false) }}
          style={{ fontSize: '13px', color: '#607898', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px' }}>
          ✕
        </button>
      </div>
    )
  }

  return (
    <div
      style={{ display: 'flex', gap: '8px', fontSize: '12px', padding: '3px 0', alignItems: 'center', borderRadius: '4px' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <span style={{ color: '#607898', flexShrink: 0, width: '64px' }}>{label}</span>
      <span style={{ color: '#A8B8C8', fontWeight: 500, flex: 1, lineHeight: 1.5 }}>{value}</span>
      {/* 수정 버튼 */}
      <button type="button"
        onClick={() => { setDraft(value); setEditing(true) }}
        title="수정"
        style={{ fontSize: '10px', color: '#4A7099', background: 'none', border: 'none', cursor: 'pointer', padding: '0 3px', opacity: 0.7, flexShrink: 0 }}>
        ✏️
      </button>
      {/* 삭제 버튼 */}
      <button type="button"
        onClick={() => onUpdate(fieldKey, undefined)}
        title="삭제"
        style={{ fontSize: '13px', color: '#C04040', background: 'none', border: 'none', cursor: 'pointer', padding: '0 3px', opacity: 0.7, flexShrink: 0, lineHeight: 1 }}>
        ×
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export default function QuickFill({ onFill }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [open,       setOpen]       = useState(false)
  const [text,       setText]       = useState('')
  const [preview,    setPreview]    = useState<FillData | null>(null)
  const [done,       setDone]       = useState(false)
  const [doneLabel,  setDoneLabel]  = useState('')
  const [compressing, setCompressing] = useState(false)
  const [compressErr, setCompressErr] = useState('')
  const [batchRows,       setBatchRows]       = useState<FillData[]>([])
  const [batchMode,       setBatchMode]       = useState(false)
  const [batchSubmitting, setBatchSubmitting] = useState(false)
  const [batchResult,     setBatchResult]     = useState<{ok:number; fail:number} | null>(null)

  function analyze() {
    if (!text.trim()) return
    if (isMultiTabRow(text)) {
      const rows = text.split(/\n/).map(l => l.trim()).filter(Boolean)
        .map(parseTabRow).filter(r => !!r.full_name)
      setBatchRows(rows)
      setBatchMode(true)
      setPreview(null)
    } else {
      setBatchMode(false)
      setBatchRows([])
      const result = parseContactText(text)
      setPreview(result)
    }
  }

  async function compressBio() {
    if (!text.trim()) return
    setCompressing(true)
    setCompressErr('')
    try {
      const res = await fetch('/api/sources/compress-bio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (!res.ok) { setCompressErr(data.error ?? '압축 실패'); return }
      setPreview(prev => prev ? { ...prev, public_notes: data.memo, personal_notes: undefined } : prev)
    } catch {
      setCompressErr('네트워크 오류')
    } finally {
      setCompressing(false)
    }
  }

  const updateField = useCallback((key: keyof FillData, val: string | undefined) => {
    setPreview(prev => prev ? { ...prev, [key]: val } : prev)
  }, [])

  function apply() {
    if (!preview) return
    onFill(preview)
    setDoneLabel(preview.full_name || '연락처')
    setDone(true); setOpen(false); setText(''); setPreview(null)
  }

  async function submitBatch() {
    if (batchRows.length === 0) return
    setBatchSubmitting(true)
    let ok = 0, fail = 0
    for (const row of batchRows) {
      try {
        const res = await fetch('/api/sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name:            row.full_name,
            current_organization: row.current_organization,
            current_position:     row.current_position,
            phone_primary:        row.phone,
            phone_secondary:      row.phone_secondary,
            public_notes:         row.public_notes,
            visibility:           'shared',
            sensitivity:          'public',
          }),
        })
        if (res.ok) ok++; else fail++
      } catch { fail++ }
    }
    setBatchResult({ ok, fail })
    setBatchSubmitting(false)
  }

  function reset() {
    setDone(false); setDoneLabel(''); setOpen(false)
    setText(''); setPreview(null)
    setBatchMode(false); setBatchRows([]); setBatchResult(null)
  }

  // 추출된 필드 수 계산
  function countFields(d: FillData): number {
    return Object.values(d).filter(v => v && String(v).trim()).length
  }

  // ── 완료 ────────────────────────────────────────────────────────────────────
  if (done) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '10px', background: 'rgba(0,204,102,0.08)', border: '1px solid rgba(0,204,102,0.3)' }}>
      <span style={{ fontSize: '13px', color: '#3D9E6A', fontWeight: 600 }}>✅ {doneLabel} 정보 입력 완료</span>
      <button type="button" onClick={reset} style={{ fontSize: '11px', color: '#607898', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>다시</button>
    </div>
  )

  // ── 붙여넣기 패널 ────────────────────────────────────────────────────────────
  if (open) return (
    <div style={{ borderRadius: '10px', border: '1px solid rgba(0,204,102,0.3)', overflow: 'hidden', background: 'rgba(0,204,102,0.03)' }}>

      <div style={{ padding: '10px 14px 0' }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#3D9E6A', marginBottom: '3px' }}>
          📋 연락처 텍스트 붙여넣기
        </p>
        <p style={{ fontSize: '11px', color: '#607898', lineHeight: 1.6 }}>
          연락처 앱 공유 텍스트, 네이버 인물정보, 뉴스·블로그 복사 등 어떤 형식이든 붙여넣으세요
        </p>
      </div>

      <div style={{ padding: '8px 14px' }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => { setText(e.target.value); setPreview(null) }}
          placeholder={`연락처 앱·네이버·뉴스 등 어디서든 복사 후 붙여넣으세요\n\n예1) 연락처 앱\n홍길동\n법무부 기획실장\n010-1234-5678\n\n예2) 네이버 인물정보\n출생1963년 3월 5일\n학력서울대학교 법학과\n현직기획재정부 장관\n경력\n2018 국세청 차장\n2022 기재부 장관`}
          rows={6}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '10px 12px', resize: 'vertical',
            background: '#1A2838', border: '1px solid #202C3A',
            borderRadius: '8px', color: '#CDD5E0',
            fontSize: '13px', lineHeight: 1.6, outline: 'none',
            fontFamily: 'inherit',
          }}
          autoFocus
        />
      </div>

      {/* 다행 일괄 등록 모드 */}
      {batchMode && !batchResult && (
        <div style={{ margin: '0 14px 8px', padding: '10px 12px', background: 'rgba(74,124,192,0.07)', border: '1px solid rgba(74,124,192,0.25)', borderRadius: '8px' }}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#4A7CC0', marginBottom: '8px' }}>
            👥 {batchRows.length}명 감지 — 일괄 등록 모드
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(74,124,192,0.2)' }}>
                  {['이름','소속','직책','전화','메모'].map(h => (
                    <th key={h} style={{ padding: '4px 6px', textAlign: 'left', color: '#607898', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batchRows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(74,124,192,0.1)' }}>
                    <td style={{ padding: '4px 6px', color: '#CDD5E0', fontWeight: 600 }}>{r.full_name}</td>
                    <td style={{ padding: '4px 6px', color: '#8AAAC8' }}>{r.current_organization ?? '-'}</td>
                    <td style={{ padding: '4px 6px', color: '#8AAAC8' }}>{r.current_position ?? '-'}</td>
                    <td style={{ padding: '4px 6px', color: '#8AAAC8' }}>{r.phone ?? '-'}</td>
                    <td style={{ padding: '4px 6px', color: '#607898', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.public_notes ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 일괄 등록 완료 결과 */}
      {batchResult && (
        <div style={{ margin: '0 14px 8px', padding: '10px 12px', background: 'rgba(61,158,106,0.08)', border: '1px solid rgba(61,158,106,0.3)', borderRadius: '8px' }}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#3D9E6A' }}>
            ✅ 등록 완료: {batchResult.ok}명 성공{batchResult.fail > 0 ? ` / ${batchResult.fail}명 실패` : ''}
          </p>
          <a href="/sources" style={{ fontSize: '12px', color: '#4A7CC0', textDecoration: 'none' }}>→ 취재원 목록 보기</a>
        </div>
      )}

      {/* 추출 결과 미리보기 */}
      {preview && (
        <div style={{ margin: '0 14px 8px', padding: '10px 12px', background: 'rgba(30,144,255,0.07)', border: '1px solid rgba(30,144,255,0.2)', borderRadius: '8px' }}>
          <p style={{ fontSize: '11px', color: '#607898', marginBottom: '6px' }}>
            추출된 정보 확인 ({countFields(preview)}개 항목)
            <span style={{ marginLeft: '6px', color: '#385070', fontWeight: 400 }}>— 행 위에 올려 ✏️ 수정 · × 삭제</span>
          </p>
          <EditablePreviewRow label="이름"      fieldKey="full_name"           value={preview.full_name}           onUpdate={updateField} />
          <EditablePreviewRow label="소속"      fieldKey="current_organization" value={preview.current_organization} onUpdate={updateField} />
          <EditablePreviewRow label="직책"      fieldKey="current_position"    value={preview.current_position}    onUpdate={updateField} />
          <EditablePreviewRow label="부서"      fieldKey="current_department"  value={preview.current_department}  onUpdate={updateField} />
          <EditablePreviewRow label="전화(주)"  fieldKey="phone"               value={preview.phone}               onUpdate={updateField} />
          <EditablePreviewRow label="전화(보조)" fieldKey="phone_secondary"    value={preview.phone_secondary}     onUpdate={updateField} />
          <EditablePreviewRow label="이메일"    fieldKey="email"               value={preview.email}               onUpdate={updateField} />
          <EditablePreviewRow label="이메일(2)" fieldKey="email_secondary"     value={preview.email_secondary}     onUpdate={updateField} />
          <EditablePreviewRow label="고시/기수" fieldKey="exam_batch"          value={preview.exam_batch}          onUpdate={updateField} />
          <EditablePreviewRow label="대학"      fieldKey="university"          value={preview.university}          onUpdate={updateField} />
          <EditablePreviewRow label="전공"      fieldKey="university_major"    value={preview.university_major}    onUpdate={updateField} />
          <EditablePreviewRow label="대학원"    fieldKey="graduate_school"     value={preview.graduate_school}     onUpdate={updateField} />
          <EditablePreviewRow label="고교"      fieldKey="high_school"         value={preview.high_school}         onUpdate={updateField} />
          <EditablePreviewRow label="생년월일"  fieldKey="birthday"            value={preview.birthday}            onUpdate={updateField} />
          <EditablePreviewRow label="출신지역"  fieldKey="hometown_province"   value={preview.hometown_province}   onUpdate={updateField} />
          {/* 경력 메모 영역 + AI 압축 버튼 */}
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(30,144,255,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <p style={{ fontSize: '11px', color: '#607898', margin: 0 }}>📝 경력 메모 (공개 정보에 저장)</p>
              <button
                type="button"
                onClick={compressBio}
                disabled={compressing}
                style={{
                  fontSize: '11px', fontWeight: 600, padding: '3px 9px',
                  borderRadius: '5px', cursor: compressing ? 'default' : 'pointer',
                  background: compressing ? 'rgba(100,70,200,0.08)' : 'rgba(100,70,200,0.12)',
                  color: '#9B7DE8', border: '1px solid rgba(100,70,200,0.3)',
                  opacity: compressing ? 0.6 : 1,
                }}
              >
                {compressing ? '⚙️ 압축 중…' : '🤖 AI 메모 압축'}
              </button>
            </div>
            {compressErr && <p style={{ fontSize: '11px', color: '#C04040', marginBottom: '4px' }}>{compressErr}</p>}
            {(preview.public_notes ?? preview.personal_notes) ? (
              <p style={{ fontSize: '12px', color: '#8AAAC8', lineHeight: 1.5, whiteSpace: 'pre-wrap', margin: 0 }}>
                {(preview.public_notes ?? preview.personal_notes ?? '').slice(0, 300)}{(preview.public_notes ?? preview.personal_notes ?? '').length > 300 ? '…' : ''}
              </p>
            ) : (
              <p style={{ fontSize: '11px', color: '#4A5A70', margin: 0 }}>
                경력 텍스트가 없습니다 — AI 메모 압축을 누르면 붙여넣은 텍스트 전체에서 경력을 추출합니다.
              </p>
            )}
          </div>
          {!preview.full_name && !preview.phone && !preview.email && countFields(preview) === 0 && (
            <p style={{ fontSize: '12px', color: '#C07070', marginTop: '4px' }}>⚠ 인식된 정보가 없습니다. 텍스트를 확인해주세요.</p>
          )}
        </div>
      )}

      <div style={{ padding: '0 14px 12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {batchMode && !batchResult ? (
          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
            <button type="button" onClick={submitBatch} disabled={batchSubmitting || batchRows.length === 0}
              style={{ flex: 1, padding: '10px', background: batchSubmitting ? '#1A2838' : '#4A7CC0', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: batchSubmitting ? 'default' : 'pointer', opacity: batchSubmitting ? 0.6 : 1 }}>
              {batchSubmitting ? '⏳ 등록 중…' : `👥 ${batchRows.length}명 일괄 등록`}
            </button>
            <button type="button" onClick={() => { setBatchMode(false); setBatchRows([]); setPreview(null) }}
              style={{ padding: '10px 14px', background: 'none', border: '1px solid #1A2838', borderRadius: '8px', color: '#607898', fontSize: '12px', cursor: 'pointer' }}>
              수정
            </button>
            <button type="button" onClick={() => { setOpen(false); setText(''); setBatchMode(false); setBatchRows([]); setBatchResult(null) }}
              style={{ padding: '10px 14px', background: 'none', border: '1px solid #1A2838', borderRadius: '8px', color: '#607898', fontSize: '12px', cursor: 'pointer' }}>
              취소
            </button>
          </div>
        ) : batchResult ? (
          <button type="button" onClick={reset}
            style={{ width: '100%', padding: '10px', background: 'none', border: '1px solid #1A2838', borderRadius: '8px', color: '#607898', fontSize: '12px', cursor: 'pointer' }}>
            닫기
          </button>
        ) : !preview ? (
          <>
            <button type="button" onClick={analyze} disabled={!text.trim()}
              style={{ flex: 1, padding: '10px', background: !text.trim() ? '#1A2838' : '#3D9E6A', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: text.trim() ? 'pointer' : 'default', opacity: text.trim() ? 1 : 0.5 }}>
              🔍 자동 분석
            </button>
            <button type="button" onClick={() => { setOpen(false); setText(''); setPreview(null) }}
              style={{ padding: '10px 14px', background: 'none', border: '1px solid #1A2838', borderRadius: '8px', color: '#607898', fontSize: '12px', cursor: 'pointer' }}>
              취소
            </button>
          </>
        ) : (
          <>
            {countFields(preview) > 0 && (
              <button type="button" onClick={apply}
                style={{ flex: 1, padding: '10px', background: '#4A7CC0', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                ✅ 입력 적용
              </button>
            )}
            <button type="button" onClick={() => setPreview(null)}
              style={{ padding: '10px 14px', background: 'none', border: '1px solid #1A2838', borderRadius: '8px', color: '#607898', fontSize: '12px', cursor: 'pointer' }}>
              수정
            </button>
            <button type="button" onClick={() => { setOpen(false); setText(''); setPreview(null) }}
              style={{ padding: '10px 14px', background: 'none', border: '1px solid #1A2838', borderRadius: '8px', color: '#607898', fontSize: '12px', cursor: 'pointer' }}>
              취소
            </button>
          </>
        )}
      </div>
    </div>
  )

  // ── 기본: 버튼 하나 ──────────────────────────────────────────────────────────
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      style={{
        width: '100%', padding: '14px 16px',
        display: 'flex', alignItems: 'center', gap: '12px',
        borderRadius: '10px', cursor: 'pointer',
        border: '1px dashed rgba(0,204,102,0.4)',
        background: 'rgba(0,204,102,0.04)',
      }}
    >
      <span style={{ fontSize: '26px', flexShrink: 0 }}>📋</span>
      <div style={{ textAlign: 'left' }}>
        <p style={{ fontSize: '13px', color: '#A8B8C8', fontWeight: 600, margin: 0 }}>연락처 붙여넣기</p>
        <p style={{ fontSize: '10px', color: '#607898', margin: 0 }}>연락처·네이버·뉴스 복사 → 이름·소속·전화·기수·경력 자동 추출</p>
      </div>
      <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#607898' }}>탭하여 열기 →</span>
    </button>
  )
}
