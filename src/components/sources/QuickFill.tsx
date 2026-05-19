'use client'

/**
 * QuickFill — 연락처 텍스트 붙여넣기 간편 입력
 *
 * 연락처 앱 공유 → 텍스트 복사 → 붙여넣기 → 자동 파싱
 * 이름 / 소속 / 직책 / 전화 / 이메일 자동 분류
 */

import { useRef, useState } from 'react'

interface FillData {
  full_name?: string
  current_organization?: string
  current_position?: string
  phone?: string
  email?: string
}

interface Props {
  onFill: (data: FillData) => void
}

// ── 공유 텍스트 파싱 ──────────────────────────────────────────────────────────
// 지원 형식:
//  A) 레이블+값 같은 줄  "이름: 홍길동"
//  B) 레이블 단독 줄     "이름\n홍길동"   ← 삼성/갤럭시 연락처 공유
//  C) 레이블 없는 줄 나열 "홍길동\n기획재정부\n예산실장\n010-..."
function parseContactText(raw: string): FillData {
  const lines = raw.split(/[\n\r]/).map(l => l.trim()).filter(Boolean)

  // ── 레이블 사전 ─────────────────────────────────────────────────────────────
  const LBLS = {
    name:  ['이름','성명','name'],
    phone: ['전화','전화번호','연락처','모바일','휴대폰','핸드폰','휴대전화','직통','cell','mobile','tel','phone'],
    email: ['이메일','email','e-mail'],
    org:   ['소속','회사','직장','기관','부처','근무지','organization','company','work'],
    pos:   ['직책','직함','직위','직급','보직','title'],
    dept:  ['부서','department'],
    etc:   ['주소','address','팩스','fax','홈','home','집'],
  }
  const ALL_LBLS = Object.values(LBLS).flat().map(s => s.toLowerCase())

  // 레이블 전용 줄인지 확인 → 해당 카테고리 키 반환, 아니면 null
  function labelOf(line: string): string | null {
    // "이름:" 또는 "이름" 형태 모두 처리
    const clean = line.replace(/[:：\s]+$/, '').toLowerCase()
    for (const [cat, arr] of Object.entries(LBLS)) {
      if (arr.some(l => l.toLowerCase() === clean)) return cat
    }
    return null
  }

  // ── 키-값 맵 구성 ───────────────────────────────────────────────────────────
  const kv: Record<string, string> = {}   // cat → value

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 형식 A: "레이블: 값" 또는 "레이블값" (콜론 있음)
    const colonMatch = line.match(
      /^(이름|성명|name|전화|전화번호|연락처|모바일|mobile|휴대폰|핸드폰|이메일|e-?mail|소속|회사|직장|기관|부처|organization|company|직책|직함|직위|직급|보직|title|부서|department)\s*[:：]\s*(.+)/i
    )
    if (colonMatch) {
      const cat = labelOf(colonMatch[1]) ?? colonMatch[1].toLowerCase()
      if (!kv[cat]) kv[cat] = colonMatch[2].trim()
      continue
    }

    // 형식 B: 레이블 단독 줄 → 다음 줄이 값
    const cat = labelOf(line)
    if (cat && i + 1 < lines.length) {
      const next = lines[i + 1]
      if (!labelOf(next)) {           // 다음 줄이 또 레이블이면 건너뜀
        if (!kv[cat]) kv[cat] = next.trim()
        i++                           // 값 줄 소비
      }
    }
  }

  // ── 전화·이메일: raw 전체에서 정규식 추출 (가장 신뢰도 높음) ──────────────
  const email = raw.match(/[\w.+\-]+@[\w\-]+\.[\w.]{2,}/i)?.[0]?.toLowerCase()

  const allNums = raw.match(/0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g) ?? []
  let phone: string | undefined
  for (const p of allNums) {
    if (/^010/.test(p.replace(/[-.\s]/g, ''))) { phone = p; break }
  }
  if (!phone) for (const p of allNums) {
    if (/^01[16789]/.test(p.replace(/[-.\s]/g, ''))) { phone = p; break }
  }
  if (!phone && allNums.length > 0) phone = allNums[0]

  // ── 이름 ───────────────────────────────────────────────────────────────────
  // 1순위: kv 맵에서
  let full_name: string | undefined = kv['name']

  // 2순위: 레이블이 아닌 한글 2~5자 단독 줄
  if (!full_name) {
    for (const line of lines) {
      if (labelOf(line)) continue                       // 레이블 줄 제외
      if (ALL_LBLS.includes(line.toLowerCase())) continue  // 레이블 단어 제외
      if (/^[가-힣]{2,5}$/.test(line) && !/\d/.test(line)) {
        full_name = line; break
      }
    }
  }

  // ── 소속 ───────────────────────────────────────────────────────────────────
  const ORG_KW = /주식회사|㈜|\(주\)|법무법인|법인|기업|그룹|병원|대학교|대학|연구소|협회|재단|공사|공단|방송|신문|일보|뉴스|미디어|컨설팅|위원회|국회|청와대/

  let current_organization: string | undefined = kv['org']
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
    '기자','편집장','변호사','회계사','세무사','사무총장','부회장','회장']

  let current_position: string | undefined = kv['pos']
  if (!current_position) {
    for (const line of lines) {
      if (labelOf(line)) continue
      for (const kw of POS_KWS) {
        if (line.includes(kw)) { current_position = line.length <= 20 ? line : kw; break }
      }
      if (current_position) break
    }
  }

  return { full_name, current_organization, current_position, phone, email }
}

// ── 미리보기 행 ───────────────────────────────────────────────────────────────
function PreviewRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div style={{ display: 'flex', gap: '8px', fontSize: '12px', padding: '3px 0' }}>
      <span style={{ color: '#4A6080', flexShrink: 0, width: '50px' }}>{label}</span>
      <span style={{ color: '#C8D8F8', fontWeight: 500 }}>{value}</span>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export default function QuickFill({ onFill }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [open,    setOpen]    = useState(false)
  const [text,    setText]    = useState('')
  const [preview, setPreview] = useState<FillData | null>(null)
  const [done,    setDone]    = useState(false)
  const [doneLabel, setDoneLabel] = useState('')

  function analyze() {
    if (!text.trim()) return
    const result = parseContactText(text)
    setPreview(result)
  }

  function apply() {
    if (!preview) return
    onFill(preview)
    setDoneLabel(preview.full_name || '연락처')
    setDone(true); setOpen(false); setText(''); setPreview(null)
  }

  function reset() {
    setDone(false); setDoneLabel(''); setOpen(false)
    setText(''); setPreview(null)
  }

  // ── 완료 ────────────────────────────────────────────────────────────────────
  if (done) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '10px', background: 'rgba(0,204,102,0.08)', border: '1px solid rgba(0,204,102,0.3)' }}>
      <span style={{ fontSize: '13px', color: '#00CC66', fontWeight: 600 }}>✅ {doneLabel} 정보 입력 완료</span>
      <button type="button" onClick={reset} style={{ fontSize: '11px', color: '#4A6080', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>다시</button>
    </div>
  )

  // ── 붙여넣기 패널 ────────────────────────────────────────────────────────────
  if (open) return (
    <div style={{ borderRadius: '10px', border: '1px solid rgba(0,204,102,0.3)', overflow: 'hidden', background: 'rgba(0,204,102,0.03)' }}>

      {/* 안내 */}
      <div style={{ padding: '10px 14px 0' }}>
        <p style={{ fontSize: '13px', fontWeight: 600, color: '#00CC66', marginBottom: '3px' }}>
          📋 연락처 텍스트 붙여넣기
        </p>
        <p style={{ fontSize: '11px', color: '#4A6080', lineHeight: 1.6 }}>
          연락처 앱 → 해당 연락처 → <strong style={{ color: '#8899BB' }}>공유</strong> → <strong style={{ color: '#8899BB' }}>텍스트 복사</strong> 후 아래에 붙여넣으세요
        </p>
      </div>

      {/* 텍스트 입력 */}
      <div style={{ padding: '8px 14px' }}>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => { setText(e.target.value); setPreview(null) }}
          placeholder={`예시)\n홍길동\n기획재정부\n예산실장\n010-1234-5678\nhong@example.com`}
          rows={5}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '10px 12px', resize: 'vertical',
            background: '#1A3050', border: '1px solid #243858',
            borderRadius: '8px', color: '#E8F0FE',
            fontSize: '13px', lineHeight: 1.6, outline: 'none',
            fontFamily: 'inherit',
          }}
          autoFocus
        />
      </div>

      {/* 추출 결과 미리보기 */}
      {preview && (
        <div style={{ margin: '0 14px 8px', padding: '10px 12px', background: 'rgba(30,144,255,0.07)', border: '1px solid rgba(30,144,255,0.2)', borderRadius: '8px' }}>
          <p style={{ fontSize: '11px', color: '#4A6080', marginBottom: '6px' }}>추출된 정보 확인</p>
          <PreviewRow label="이름"   value={preview.full_name} />
          <PreviewRow label="소속"   value={preview.current_organization} />
          <PreviewRow label="직책"   value={preview.current_position} />
          <PreviewRow label="전화"   value={preview.phone} />
          <PreviewRow label="이메일" value={preview.email} />
          {!preview.full_name && !preview.phone && !preview.email && (
            <p style={{ fontSize: '12px', color: '#FF8888' }}>⚠ 인식된 정보가 없습니다. 텍스트를 확인해주세요.</p>
          )}
        </div>
      )}

      {/* 버튼 */}
      <div style={{ padding: '0 14px 12px', display: 'flex', gap: '8px' }}>
        {!preview ? (
          <>
            <button type="button" onClick={analyze} disabled={!text.trim()}
              style={{ flex: 1, padding: '10px', background: !text.trim() ? '#1A3050' : '#00CC66', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: text.trim() ? 'pointer' : 'default', opacity: text.trim() ? 1 : 0.5 }}>
              🔍 자동 분석
            </button>
            <button type="button" onClick={() => { setOpen(false); setText(''); setPreview(null) }}
              style={{ padding: '10px 14px', background: 'none', border: '1px solid #1A3050', borderRadius: '8px', color: '#4A6080', fontSize: '12px', cursor: 'pointer' }}>
              취소
            </button>
          </>
        ) : (
          <>
            {(preview.full_name || preview.phone || preview.email) && (
              <button type="button" onClick={apply}
                style={{ flex: 1, padding: '10px', background: '#1E90FF', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                ✅ 입력 적용
              </button>
            )}
            <button type="button" onClick={() => setPreview(null)}
              style={{ padding: '10px 14px', background: 'none', border: '1px solid #1A3050', borderRadius: '8px', color: '#4A6080', fontSize: '12px', cursor: 'pointer' }}>
              수정
            </button>
            <button type="button" onClick={() => { setOpen(false); setText(''); setPreview(null) }}
              style={{ padding: '10px 14px', background: 'none', border: '1px solid #1A3050', borderRadius: '8px', color: '#4A6080', fontSize: '12px', cursor: 'pointer' }}>
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
        <p style={{ fontSize: '13px', color: '#C8D8F8', fontWeight: 600, margin: 0 }}>연락처 붙여넣기</p>
        <p style={{ fontSize: '10px', color: '#4A6080', margin: 0 }}>연락처 앱 공유 텍스트 → 이름·소속·전화 자동 입력</p>
      </div>
      <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#4A6080' }}>탭하여 열기 →</span>
    </button>
  )
}
