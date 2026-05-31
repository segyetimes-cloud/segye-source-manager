'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ── 타입 ──────────────────────────────────────────────────────────────────────

type Sensitivity = 'public' | 'private'

interface ParsedRow {
  full_name: string
  current_organization: string
  current_position: string
  phone_primary: string
  phone_secondary: string
  public_notes: string
  tags: string[]
  visibility: 'shared'
  sensitivity: Sensitivity
  /** 파싱 오류 메시지 (있으면 빨간색 표시) */
  error?: string
  /** 원본 줄 문자열 (디버그용) */
  _raw: string
}

// ── 상수 ──────────────────────────────────────────────────────────────────────

/** 민감 정보 감지 키워드 */
const SENSITIVE_KEYWORDS = [
  '부인', '아내', '배우자', '주소', 'suite', '자금', '핵심', '비자금',
  '내연', '혼외', '비밀', '은닉', '세탁', '뇌물', '청탁',
]

/** `:카테고리/...` 태그 추출 패턴 */
const TAG_PATTERN = /:[가-힣A-Za-z0-9_/]+/g

// ── 파싱 함수 ─────────────────────────────────────────────────────────────────

/**
 * 이름에서 한자 괄호 제거 + 한글 설명 괄호는 메모로 분리
 * 예) "김도곤(金渡坤)" → { name: "김도곤", extra: "" }
 *     "홍길동(전 국과수 원장)" → { name: "홍길동", extra: "전 국과수 원장" }
 */
function parseName(raw: string): { name: string; extra: string } {
  const chineseParenRe = /\([一-鿿·]+\)/g
  const koreanParenRe = /\(([^)]+)\)/

  // 한자만 있는 괄호는 완전 제거
  let name = raw.replace(chineseParenRe, '').trim()

  // 남은 괄호가 있으면(한글/영문 설명) extra로 분리
  const match = name.match(koreanParenRe)
  let extra = ''
  if (match) {
    extra = match[1].trim()
    name = name.replace(koreanParenRe, '').trim()
  }

  return { name, extra }
}

/**
 * 전화번호 문자열 파싱
 * - 콤마로 분리
 * - 앞 콤마 제거 (`,010-...` → `010-...`)
 * - primary / secondary 분리, 동일하면 secondary 제외
 */
function parsePhones(raw: string): { primary: string; secondary: string } {
  const parts = raw
    .split(',')
    .map(p => p.trim())
    .filter(Boolean)

  const primary = parts[0] ?? ''
  const secondary = parts[1] && parts[1] !== primary ? parts[1] : ''

  return { primary, secondary }
}

/**
 * 메모 문자열 파싱
 * - `:태그1/태그2` 패턴 → tags 배열로 추출
 * - 나머지 → public_notes
 * - 민감 키워드 포함 시 sensitivity = 'private'
 */
function parseMemo(
  raw: string,
  nameExtra: string,
): { notes: string; tags: string[]; sensitivity: Sensitivity } {
  const combined = [raw, nameExtra].filter(Boolean).join(' ').trim()

  // 태그 추출
  const tagMatches = combined.match(TAG_PATTERN) ?? []
  const tags = tagMatches
    .flatMap(m => m.slice(1).split('/'))
    .map(t => t.trim())
    .filter(Boolean)

  const notes = combined.replace(TAG_PATTERN, '').trim()

  // 민감 정보 감지
  const lowerNotes = notes.toLowerCase()
  const sensitivity: Sensitivity = SENSITIVE_KEYWORDS.some(kw =>
    lowerNotes.includes(kw),
  )
    ? 'private'
    : 'public'

  return { notes, tags, sensitivity }
}

/**
 * 탭 구분 텍스트 전체를 파싱하여 ParsedRow 배열 반환
 */
function parseText(text: string): ParsedRow[] {
  return text
    .split('\n')
    .map(line => line.replace(/\r$/, ''))
    .filter(line => line.trim().length > 0)
    .map(line => {
      const cols = line.split('\t')
      const rawOrg = (cols[0] ?? '').trim()
      const rawPos = (cols[1] ?? '').trim()
      const rawName = (cols[2] ?? '').trim()
      const rawPhone = (cols[3] ?? '').trim()
      const rawMemo = (cols[4] ?? '').trim()

      const { name, extra } = parseName(rawName)
      const { primary, secondary } = parsePhones(rawPhone)
      const { notes, tags, sensitivity } = parseMemo(rawMemo, extra)

      const row: ParsedRow = {
        full_name: name,
        current_organization: rawOrg,
        current_position: rawPos,
        phone_primary: primary,
        phone_secondary: secondary,
        public_notes: notes,
        tags,
        visibility: 'shared',
        sensitivity,
        _raw: line,
      }

      if (!name) {
        row.error = '이름이 없습니다'
      }

      return row
    })
}

// ── 결과 타입 ─────────────────────────────────────────────────────────────────

interface SubmitResult {
  succeeded: number
  failed: Array<{ name: string; error: string }>
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

export default function TextPasteImporter() {
  const router = useRouter()

  const [text, setText] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<SubmitResult | null>(null)

  // 파싱 실행
  const handleParse = useCallback((value: string) => {
    setText(value)
    if (!value.trim()) {
      setRows([])
      setSelected(new Set())
      return
    }
    const parsed = parseText(value)
    setRows(parsed)
    // 오류 없는 행만 기본 선택
    setSelected(new Set(parsed.map((_, i) => i).filter(i => !parsed[i].error)))
  }, [])

  // textarea 붙여넣기 이벤트
  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    // 붙여넣기 완료 후 값이 반영되면 파싱
    const pasted = e.clipboardData.getData('text')
    handleParse(pasted)
    // textarea 자체 업데이트도 허용
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    handleParse(e.target.value)
  }

  // 체크박스 토글
  function toggleRow(idx: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  function toggleAll() {
    const validIndices = rows.map((_, i) => i).filter(i => !rows[i].error)
    if (validIndices.every(i => selected.has(i))) {
      setSelected(new Set())
    } else {
      setSelected(new Set(validIndices))
    }
  }

  // 등록 실행
  async function handleSubmit() {
    const targets = rows.filter((_, i) => selected.has(i))
    if (targets.length === 0) return

    setSubmitting(true)
    const succeeded = { count: 0 }
    const failed: SubmitResult['failed'] = []

    for (const row of targets) {
      const payload = {
        full_name: row.full_name,
        current_organization: row.current_organization || null,
        current_position: row.current_position || null,
        phone_primary: row.phone_primary || null,
        phone_secondary: row.phone_secondary || null,
        public_notes: row.public_notes || null,
        tags: row.tags,
        visibility: row.visibility,
        sensitivity: row.sensitivity,
      }

      try {
        const res = await fetch('/api/sources', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) {
          succeeded.count++
        } else {
          const json = (await res.json().catch(() => ({}))) as { error?: string }
          failed.push({ name: row.full_name, error: json.error ?? `HTTP ${res.status}` })
        }
      } catch (err) {
        failed.push({ name: row.full_name, error: (err as Error).message })
      }
    }

    setResult({ succeeded: succeeded.count, failed })
    setSubmitting(false)
  }

  const selectedCount = selected.size
  const validRows = rows.filter(r => !r.error)

  // ── 완료 화면 ────────────────────────────────────────────────────────────────
  if (result) {
    return (
      <div className="glass-card p-12 text-center space-y-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
          style={{
            background: 'rgba(0,204,102,0.15)',
            border: '2px solid rgba(0,204,102,0.3)',
          }}
        >
          <span style={{ fontSize: '32px' }}>✅</span>
        </div>
        <h2 className="text-xl font-bold" style={{ color: '#CDD5E0' }}>
          등록 완료
        </h2>
        <p className="text-sm" style={{ color: '#8AAAC8' }}>
          <span style={{ color: '#3D9E6A', fontWeight: 'bold' }}>
            {result.succeeded}명
          </span>{' '}
          등록 완료
          {result.failed.length > 0 && (
            <span style={{ color: '#C04040' }}>
              {' '}/ {result.failed.length}명 실패
            </span>
          )}
        </p>

        {result.failed.length > 0 && (
          <div
            className="rounded-xl p-4 text-left mx-auto max-w-sm"
            style={{ background: 'rgba(192,64,64,0.08)', border: '1px solid rgba(192,64,64,0.25)' }}
          >
            <p className="text-xs font-semibold mb-2" style={{ color: '#C04040' }}>
              실패 항목
            </p>
            <ul className="space-y-1">
              {result.failed.map((f, i) => (
                <li key={i} className="text-xs" style={{ color: '#8AAAC8' }}>
                  <span style={{ color: '#CDD5E0' }}>{f.name}</span> — {f.error}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={() => {
              setResult(null)
              setText('')
              setRows([])
              setSelected(new Set())
            }}
            className="px-4 py-2 rounded-lg text-sm"
            style={{
              background: '#182035',
              color: '#8AAAC8',
              border: '1px solid #1A2838',
              cursor: 'pointer',
            }}
          >
            추가 등록
          </button>
          <button
            onClick={() => router.push('/sources')}
            className="px-6 py-2 rounded-lg text-sm font-semibold"
            style={{
              background: 'linear-gradient(135deg, #4A7CC0, #0066CC)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            취재원 목록으로 →
          </button>
        </div>
      </div>
    )
  }

  // ── 메인 UI ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* 안내 + 형식 예시 */}
      <div
        className="rounded-xl p-4 space-y-2"
        style={{ background: '#131C2C', border: '1px solid #1A2838' }}
      >
        <p className="text-sm font-semibold" style={{ color: '#CDD5E0' }}>
          입력 형식 (탭 구분, 5열)
        </p>
        <p className="text-xs" style={{ color: '#607898' }}>
          엑셀에서 행을 복사해 아래 창에 붙여넣으세요.
          열 순서: <span style={{ color: '#8AAAC8' }}>소속 → 직책 → 이름 → 전화번호 → 메모</span>
        </p>
        <div
          className="rounded-lg p-3 font-mono text-xs leading-relaxed overflow-x-auto"
          style={{ background: '#0D1520', color: '#607898', border: '1px solid #1A2838' }}
        >
          <div style={{ color: '#4A7CC0' }}>소속{'\t'}직책{'\t'}이름{'\t'}전화번호(콤마로 여러개){'\t'}메모</div>
          <div>법무법인 유한 태평양{'\t'}미국변호사{'\t'}김세진{'\t'}01042478869{'\t'}</div>
          <div>GKL{'\t'}홍보팀장{'\t'}김도곤(金渡坤){'\t'}02-3466-6231,010-6474-1444{'\t'}정몽헌 전 회장 자금담당</div>
        </div>
        <ul className="text-xs space-y-0.5" style={{ color: '#607898' }}>
          <li>• 이름의 한자 괄호 <span style={{ color: '#8AAAC8' }}>(金渡坤)</span>는 자동 제거됩니다</li>
          <li>• 전화번호 여러 개는 콤마로 구분 → 첫 번째가 주 번호, 두 번째가 보조 번호</li>
          <li>• 메모에 <span style={{ color: '#8AAAC8' }}>:카테고리/기타</span> 패턴은 태그로 자동 분류됩니다</li>
          <li>• 메모에 민감 키워드(자금, 주소, 부인 등) 포함 시 <span style={{ color: '#C04040' }}>🔒 민감</span>으로 표시됩니다</li>
        </ul>
      </div>

      {/* 입력 textarea */}
      <div className="glass-card p-4 space-y-2">
        <label className="text-sm font-medium" style={{ color: '#CDD5E0' }}>
          텍스트 붙여넣기
        </label>
        <textarea
          rows={8}
          value={text}
          onChange={handleChange}
          onPaste={handlePaste}
          placeholder={
            '소속\t직책\t이름\t전화번호\t메모\n' +
            '법무법인 유한 태평양\t미국변호사\t김세진\t01042478869\t\n' +
            'GKL\t홍보팀장\t김도곤(金渡坤)\t02-3466-6231,010-6474-1444\t정몽헌 전 회장 자금담당'
          }
          className="w-full rounded-xl text-sm font-mono resize-y"
          style={{
            background: '#182035',
            border: '1px solid #1A2838',
            color: '#CDD5E0',
            padding: '10px 12px',
            outline: 'none',
            lineHeight: '1.6',
          }}
          spellCheck={false}
        />
        {rows.length > 0 && (
          <p className="text-xs" style={{ color: '#607898' }}>
            총{' '}
            <span style={{ color: '#CDD5E0' }}>{rows.length}행</span> 감지됨 /{' '}
            <span style={{ color: '#3D9E6A' }}>{validRows.length}행</span> 정상 /{' '}
            <span style={{ color: '#C04040' }}>
              {rows.length - validRows.length}행
            </span>{' '}
            오류
          </p>
        )}
      </div>

      {/* 프리뷰 테이블 */}
      {rows.length > 0 && (
        <div className="glass-card overflow-hidden">
          {/* 테이블 헤더 */}
          <div
            className="flex items-center gap-3 px-4 py-2.5"
            style={{ background: '#131C2C', borderBottom: '1px solid #1A2838' }}
          >
            <input
              type="checkbox"
              checked={
                validRows.length > 0 &&
                validRows.every((_, i) =>
                  selected.has(rows.indexOf(validRows[i])),
                )
              }
              onChange={toggleAll}
              style={{ accentColor: '#4A7CC0', cursor: 'pointer' }}
            />
            <span className="text-xs font-semibold flex-1" style={{ color: '#8AAAC8' }}>
              이름
            </span>
            <span
              className="text-xs font-semibold hidden sm:block"
              style={{ color: '#8AAAC8', minWidth: '120px' }}
            >
              소속
            </span>
            <span
              className="text-xs font-semibold hidden sm:block"
              style={{ color: '#8AAAC8', minWidth: '80px' }}
            >
              직책
            </span>
            <span
              className="text-xs font-semibold hidden md:block"
              style={{ color: '#8AAAC8', minWidth: '120px' }}
            >
              전화
            </span>
            <span
              className="text-xs font-semibold hidden lg:block"
              style={{ color: '#8AAAC8', flex: 1 }}
            >
              메모 / 태그
            </span>
            <span
              className="text-xs font-semibold"
              style={{ color: '#8AAAC8', minWidth: '52px', textAlign: 'center' }}
            >
              민감도
            </span>
          </div>

          {/* 행 목록 */}
          <div className="divide-y" style={{ borderColor: '#1A2838' }}>
            {rows.map((row, idx) => {
              const isError = Boolean(row.error)
              const isSelected = selected.has(idx)

              return (
                <div
                  key={idx}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors"
                  style={{
                    background: isError
                      ? 'rgba(192,64,64,0.06)'
                      : isSelected
                        ? 'rgba(74,124,192,0.06)'
                        : 'transparent',
                    borderLeft: isError
                      ? '2px solid rgba(192,64,64,0.4)'
                      : isSelected
                        ? '2px solid rgba(74,124,192,0.3)'
                        : '2px solid transparent',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={isError}
                    onChange={() => toggleRow(idx)}
                    style={{
                      accentColor: '#4A7CC0',
                      cursor: isError ? 'not-allowed' : 'pointer',
                      opacity: isError ? 0.3 : 1,
                    }}
                  />

                  {/* 이름 */}
                  <span
                    className="text-sm flex-1 truncate"
                    style={{ color: isError ? '#C04040' : '#CDD5E0' }}
                    title={isError ? row.error : row.full_name}
                  >
                    {row.full_name || (
                      <span style={{ color: '#C04040', fontSize: '11px' }}>
                        {row.error}
                      </span>
                    )}
                  </span>

                  {/* 소속 */}
                  <span
                    className="text-xs truncate hidden sm:block"
                    style={{ color: '#8AAAC8', minWidth: '120px', maxWidth: '120px' }}
                    title={row.current_organization}
                  >
                    {row.current_organization || (
                      <span style={{ color: '#1A2838' }}>—</span>
                    )}
                  </span>

                  {/* 직책 */}
                  <span
                    className="text-xs truncate hidden sm:block"
                    style={{ color: '#8AAAC8', minWidth: '80px', maxWidth: '80px' }}
                    title={row.current_position}
                  >
                    {row.current_position || (
                      <span style={{ color: '#1A2838' }}>—</span>
                    )}
                  </span>

                  {/* 전화 */}
                  <div
                    className="hidden md:block"
                    style={{ minWidth: '120px', maxWidth: '120px' }}
                  >
                    {row.phone_primary ? (
                      <span className="text-xs" style={{ color: '#8AAAC8' }}>
                        {row.phone_primary}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: '#1A2838' }}>—</span>
                    )}
                    {row.phone_secondary && (
                      <span
                        className="text-xs block"
                        style={{ color: '#607898', fontSize: '10px' }}
                      >
                        {row.phone_secondary}
                      </span>
                    )}
                  </div>

                  {/* 메모 / 태그 */}
                  <div className="hidden lg:flex items-center gap-1.5 flex-1 min-w-0">
                    {row.tags.map((tag, ti) => (
                      <span
                        key={ti}
                        className="text-xs px-1.5 py-0.5 rounded-md flex-shrink-0"
                        style={{
                          background: 'rgba(74,124,192,0.15)',
                          color: '#4A7CC0',
                          border: '1px solid rgba(74,124,192,0.25)',
                        }}
                      >
                        {tag}
                      </span>
                    ))}
                    {row.public_notes && (
                      <span
                        className="text-xs truncate"
                        style={{ color: '#607898' }}
                        title={row.public_notes}
                      >
                        {row.public_notes}
                      </span>
                    )}
                  </div>

                  {/* 민감도 */}
                  <span
                    className="text-xs"
                    style={{
                      minWidth: '52px',
                      textAlign: 'center',
                      color: row.sensitivity === 'private' ? '#C04040' : '#3D9E6A',
                    }}
                    title={row.sensitivity === 'private' ? '민감 정보' : '공개'}
                  >
                    {row.sensitivity === 'private' ? '🔒 민감' : '📢 공개'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 하단 버튼 */}
      {rows.length > 0 && (
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={() => {
              setText('')
              setRows([])
              setSelected(new Set())
            }}
            className="px-4 py-2 rounded-lg text-sm"
            style={{
              background: '#182035',
              color: '#8AAAC8',
              border: '1px solid #1A2838',
              cursor: 'pointer',
            }}
          >
            초기화
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || selectedCount === 0}
            className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{
              background:
                submitting || selectedCount === 0
                  ? 'rgba(30,144,255,0.3)'
                  : 'linear-gradient(135deg, #4A7CC0, #0066CC)',
              color: 'white',
              border: 'none',
              cursor:
                submitting || selectedCount === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting
              ? '등록 중...'
              : `선택한 ${selectedCount}명 등록`}
          </button>
        </div>
      )}
    </div>
  )
}
