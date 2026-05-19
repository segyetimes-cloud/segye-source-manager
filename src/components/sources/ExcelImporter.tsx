'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as XLSX from 'xlsx'
import { normalizeSource, normalizeField } from '@/lib/normalize'

interface ColumnMapping {
  colIndex: number      // 원래 엑셀 열 번호
  header: string        // 표시용 레이블 (헤더명 or "1열")
  samples: string[]     // 실제 데이터 샘플 (3행)
  field: string
  confidence: number
  reason?: string
}

const FIELD_LABELS: Record<string, string> = {
  full_name: '이름',
  current_organization: '소속 기관',
  current_position: '직책',
  current_department: '부서',
  phone_primary: '전화번호(주)',
  phone_secondary: '전화번호(보조)',
  email_primary: '이메일(주)',
  email_secondary: '이메일(보조)',
  birthday: '생년월일',
  hometown_province: '출신 광역시도',
  hometown_city: '출신 시군구',
  high_school: '고교',
  university: '대학',
  university_major: '전공',
  graduate_school: '대학원',
  exam_batch: '고시/기수',
  tags: '태그',
  personal_notes: '메모',
  skip: '(건너뜀)',
}

const SYSTEM_FIELDS = Object.keys(FIELD_LABELS)

// 데이터 값 패턴으로 컬럼 타입 추론 (헤더 없을 때 사용)
function detectFieldFromSamples(values: string[]): { field: string; confidence: number; reason: string } {
  const nonEmpty = values.map(v => v?.trim()).filter(Boolean)
  if (nonEmpty.length === 0) return { field: 'skip', confidence: 0, reason: '데이터 없음' }

  // 전화번호: 숫자+하이픈 패턴
  const phoneRe = /^0\d[\d\-\s]{7,12}$/
  if (nonEmpty.filter(v => phoneRe.test(v.replace(/\s/g, ''))).length >= nonEmpty.length * 0.5)
    return { field: 'phone_primary', confidence: 0.92, reason: '전화번호 형식 감지' }

  // 이메일
  if (nonEmpty.filter(v => /@/.test(v) && /\.[a-z]{2,}/.test(v)).length >= nonEmpty.length * 0.5)
    return { field: 'email_primary', confidence: 0.93, reason: '이메일 형식 감지' }

  // 이름: 한국어 2-4글자
  const nameRe = /^[가-힣]{2,4}$/
  if (nonEmpty.filter(v => nameRe.test(v)).length >= nonEmpty.length * 0.65)
    return { field: 'full_name', confidence: 0.88, reason: '한국어 이름 패턴' }

  // 대학: "대학교", "대학", "공대" 등
  const univKeywords = ['대학교', '대학', '공대', '의대', '법대', '상대', 'university']
  if (nonEmpty.some(v => univKeywords.some(k => v.includes(k))))
    return { field: 'university', confidence: 0.75, reason: '대학 키워드 감지' }

  // 고등학교
  if (nonEmpty.some(v => v.includes('고등학교') || v.endsWith('고')))
    return { field: 'high_school', confidence: 0.75, reason: '고교 키워드 감지' }

  // 생년월일: 연도 또는 날짜 형식
  const birthRe = /^(19|20)\d{2}([-./]\d{1,2}([-./]\d{1,2})?)?$/
  if (nonEmpty.filter(v => birthRe.test(v)).length >= nonEmpty.length * 0.5)
    return { field: 'birthday', confidence: 0.85, reason: '날짜/연도 형식 감지' }

  // 고시/기수: "회" "기" "기수" 포함
  if (nonEmpty.some(v => /\d+(회|기)$/.test(v) || v.includes('행시') || v.includes('사시') || v.includes('고시')))
    return { field: 'exam_batch', confidence: 0.78, reason: '기수/고시 패턴 감지' }

  // 광역시도
  const provinces = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주']
  if (nonEmpty.filter(v => provinces.some(p => v.startsWith(p))).length >= nonEmpty.length * 0.5)
    return { field: 'hometown_province', confidence: 0.82, reason: '광역시도 감지' }

  // 직책: 장관/실장/팀장/대표 등으로 끝나는 경우
  if (nonEmpty.some(v => /(장관|차관|실장|국장|팀장|과장|대표|원장|부장|사장|회장|의원|교수)$/.test(v)))
    return { field: 'current_position', confidence: 0.7, reason: '직책 키워드 감지' }

  // 소속기관: 비교적 긴 문자열 (5자 이상)이고 한국어
  const avgLen = nonEmpty.reduce((s, v) => s + v.length, 0) / nonEmpty.length
  if (avgLen >= 5 && nonEmpty.filter(v => /[가-힣]/.test(v)).length >= nonEmpty.length * 0.7)
    return { field: 'current_organization', confidence: 0.5, reason: '기관명 추정 (긴 한국어)' }

  return { field: 'skip', confidence: 0, reason: '패턴 미감지' }
}

export default function ExcelImporter() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'upload' | 'mapping' | 'done'>('upload')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [hasHeader, setHasHeader] = useState(true)

  const [rawRows, setRawRows] = useState<string[][]>([])   // 실제 데이터 행 (헤더 제외)
  const [colCount, setColCount] = useState(0)
  const [mappings, setMappings] = useState<ColumnMapping[]>([])
  const [importCount, setImportCount] = useState(0)
  const [normalizeCount, setNormalizeCount] = useState(0)
  const [visibility, setVisibility] = useState<'personal' | 'shared'>('personal')
  const [mappingSource, setMappingSource] = useState<'ai' | 'heuristic' | 'heuristic_fallback' | 'data_pattern' | ''>('')

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setError('')

    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'buffer' })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, { header: 1 }) as (string | number | null)[][]

      const minRows = hasHeader ? 2 : 1
      if (data.length < minRows) {
        setError('데이터가 없습니다. 최소 1행 이상의 데이터가 필요합니다.')
        setLoading(false)
        return
      }

      // 헤더 행 처리
      const headerRow = data[0].map(h => h != null ? String(h) : '')
      const numCols = headerRow.length
      const dataRows = (hasHeader ? data.slice(1) : data).map(row =>
        Array.from({ length: numCols }, (_, i) => row[i] != null ? String(row[i]) : '')
      )

      setRawRows(dataRows)
      setColCount(numCols)

      // 컬럼별 샘플 3개 추출
      const colSamples = Array.from({ length: numCols }, (_, colIdx) =>
        dataRows.slice(0, 5).map(row => row[colIdx] ?? '').filter(v => v.trim()).slice(0, 3)
      )

      if (hasHeader) {
        // 헤더 있음 → API (키워드 기반) 분류
        const headers = headerRow
        try {
          const res = await fetch('/api/ai/classify-columns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ headers, sampleRows: dataRows.slice(0, 3) }),
          })
          if (res.ok) {
            const json = await res.json()
            const rawMappings = Array.isArray(json.mappings) ? json.mappings : []
            const finalMappings: ColumnMapping[] = headers.map((h, i) => {
              const api = rawMappings.find((m: ColumnMapping) => m?.header === h) ?? rawMappings[i]
              return {
                colIndex: i,
                header: h || `${i + 1}열`,
                samples: colSamples[i] ?? [],
                field: api?.field ?? 'skip',
                confidence: api?.confidence ?? 0,
                reason: api?.reason ?? '',
              }
            })
            setMappings(finalMappings)
            setMappingSource(json.source ?? 'heuristic')
          } else {
            throw new Error('API error')
          }
        } catch {
          // 폴백: 데이터 패턴으로
          const finalMappings: ColumnMapping[] = headers.map((h, i) => {
            const detected = detectFieldFromSamples(colSamples[i] ?? [])
            return { colIndex: i, header: h || `${i + 1}열`, samples: colSamples[i] ?? [], ...detected }
          })
          setMappings(finalMappings)
          setMappingSource('data_pattern')
        }
      } else {
        // 헤더 없음 → 데이터 패턴으로만 추론
        const finalMappings: ColumnMapping[] = Array.from({ length: numCols }, (_, i) => {
          const detected = detectFieldFromSamples(colSamples[i] ?? [])
          return { colIndex: i, header: `${i + 1}열`, samples: colSamples[i] ?? [], ...detected }
        })
        setMappings(finalMappings)
        setMappingSource('data_pattern')
      }

      setStep('mapping')
    } catch (err) {
      setError('파일 읽기 실패: ' + (err as Error).message)
    }
    setLoading(false)
  }

  function updateMapping(idx: number, field: string) {
    setMappings(prev => prev.map((m, i) => i === idx ? { ...m, field } : m))
  }

  async function handleImport() {
    if (!mappings.some(m => m.field === 'full_name')) {
      setError('이름 컬럼을 반드시 지정해주세요.')
      return
    }
    setLoading(true)
    setError('')

    // 컬럼 인덱스 → 필드명 매핑
    const colFieldMap = new Map(mappings.filter(m => m.field !== 'skip').map(m => [m.colIndex, m.field]))

    const rawSources = rawRows
      .filter(row => row.some(cell => cell.trim()))
      .map(row => {
        const obj: Record<string, string | string[]> = { visibility }
        colFieldMap.forEach((field, colIdx) => {
          const val = row[colIdx]?.trim()
          if (!val) return
          if (field === 'tags') {
            obj.tags = val.split(/[,、，]/).map(t => t.trim()).filter(Boolean)
          } else {
            obj[field] = val
          }
        })
        return obj
      })
      .filter(s => s.full_name)

    // 유사어 정규화 적용 (대학명·기관명·출신지 등 통일)
    let totalNormalized = 0
    const sources = rawSources.map(source => {
      const { result, changes } = normalizeSource(source)
      totalNormalized += Object.keys(changes).length
      return result
    })

    let successCount = 0
    for (const source of sources) {
      const res = await fetch('/api/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(source),
      })
      if (res.ok) successCount++
    }

    setImportCount(successCount)
    setNormalizeCount(totalNormalized)
    setStep('done')
    setLoading(false)
  }

  const totalRows = rawRows.filter(r => r.some(c => c?.trim())).length
  const mappedCount = mappings.filter(m => m.field !== 'skip').length

  return (
    <div className="space-y-6">

      {/* 단계 표시 */}
      <div className="flex items-center gap-2">
        {[
          { key: 'upload', label: '1. 파일 업로드' },
          { key: 'mapping', label: '2. 컬럼 매핑' },
          { key: 'done', label: '3. 완료' },
        ].map((s, i, arr) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: step === s.key ? '#4A7CC0'
                    : ['upload', 'mapping', 'done'].indexOf(step) > i ? '#3D9E6A' : '#182035',
                  color: 'white',
                }}>
                {['upload', 'mapping', 'done'].indexOf(step) > i ? '✓' : i + 1}
              </div>
              <span className="text-sm" style={{ color: step === s.key ? '#CDD5E0' : '#485870' }}>
                {s.label}
              </span>
            </div>
            {i < arr.length - 1 && <span style={{ color: '#1A2838' }}>→</span>}
          </div>
        ))}
      </div>

      {/* Step 1: 업로드 */}
      {step === 'upload' && (
        <div className="glass-card p-8 space-y-5">

          {/* 헤더 여부 토글 */}
          <div className="p-4 rounded-xl" style={{ background: '#131C2C', border: '1px solid #1A2838' }}>
            <p className="text-sm font-semibold mb-3" style={{ color: '#CDD5E0' }}>📋 엑셀 형식 선택</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setHasHeader(true)}
                className="p-3 rounded-xl text-left transition-all"
                style={{
                  background: hasHeader ? 'rgba(30,144,255,0.15)' : '#182035',
                  border: `1px solid ${hasHeader ? 'rgba(30,144,255,0.4)' : '#1A2838'}`,
                  cursor: 'pointer',
                }}>
                <p className="text-sm font-medium" style={{ color: hasHeader ? '#4A7CC0' : '#687898' }}>
                  ✅ 첫 줄이 컬럼명 (권장)
                </p>
                <div className="mt-2 text-xs rounded overflow-hidden" style={{ border: '1px solid #1A2838' }}>
                  <div className="px-2 py-1 font-bold" style={{ background: '#1A2838', color: '#687898' }}>이름 | 소속 | 전화</div>
                  <div className="px-2 py-1" style={{ color: '#485870' }}>홍길동 | 기재부 | 010-…</div>
                  <div className="px-2 py-1" style={{ color: '#485870' }}>김철수 | 행안부 | 010-…</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setHasHeader(false)}
                className="p-3 rounded-xl text-left transition-all"
                style={{
                  background: !hasHeader ? 'rgba(255,153,0,0.12)' : '#182035',
                  border: `1px solid ${!hasHeader ? 'rgba(255,153,0,0.4)' : '#1A2838'}`,
                  cursor: 'pointer',
                }}>
                <p className="text-sm font-medium" style={{ color: !hasHeader ? '#A87228' : '#687898' }}>
                  ⚠️ 첫 줄부터 데이터
                </p>
                <div className="mt-2 text-xs rounded overflow-hidden" style={{ border: '1px solid #1A2838' }}>
                  <div className="px-2 py-1" style={{ color: '#485870' }}>홍길동 | 기재부 | 010-…</div>
                  <div className="px-2 py-1" style={{ color: '#485870' }}>김철수 | 행안부 | 010-…</div>
                  <div className="px-2 py-1" style={{ color: '#485870' }}>박영희 | 교육부 | 010-…</div>
                </div>
              </button>
            </div>
            {!hasHeader && (
              <p className="text-xs mt-2" style={{ color: '#A87228' }}>
                ⚠️ 헤더가 없으면 전화번호·이메일·이름 패턴으로 자동 감지합니다. 매핑 화면에서 확인하세요.
              </p>
            )}
          </div>

          {/* 파일 선택 */}
          <div
            className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors"
            style={{ borderColor: '#1A2838' }}
            onClick={() => fileRef.current?.click()}
            onMouseEnter={e => (e.currentTarget.style.borderColor = '#4A7CC0')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = '#1A2838')}>
            <svg width="40" height="40" viewBox="0 0 48 48" fill="none" className="mx-auto mb-3">
              <rect x="8" y="4" width="32" height="40" rx="3" stroke="#485870" strokeWidth="2"/>
              <path d="M16 16h16M16 22h16M16 28h10" stroke="#485870" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M28 36l4-4 4 4M32 32v8" stroke="#4A7CC0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <p className="text-sm font-medium mb-1" style={{ color: '#CDD5E0' }}>클릭하여 엑셀 파일 선택</p>
            <p className="text-xs" style={{ color: '#485870' }}>.xlsx · .xls · .csv 지원</p>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: 'none' }} />
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-3">
              <div className="w-5 h-5 rounded-full border-2 animate-spin"
                style={{ borderColor: '#1A2838', borderTopColor: '#4A7CC0' }} />
              <p className="text-sm" style={{ color: '#687898' }}>컬럼 분석 중...</p>
            </div>
          )}
          {error && <p className="text-sm text-center" style={{ color: '#C04040' }}>{error}</p>}
        </div>
      )}

      {/* Step 2: 컬럼 매핑 */}
      {step === 'mapping' && (
        <div className="space-y-4">

          {/* 요약 */}
          <div className="glass-card p-4 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm font-semibold" style={{ color: '#CDD5E0' }}>
                총 <span style={{ color: '#4A7CC0' }}>{totalRows}명</span> · {colCount}개 컬럼
              </span>
              {mappingSource === 'ai' && (
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(0,204,102,0.15)', color: '#3D9E6A', border: '1px solid rgba(0,204,102,0.3)' }}>✨ AI 자동분류</span>
              )}
              {(mappingSource === 'heuristic' || mappingSource === 'heuristic_fallback') && (
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,153,0,0.15)', color: '#A87228', border: '1px solid rgba(255,153,0,0.3)' }}>🔍 키워드 자동분류</span>
              )}
              {mappingSource === 'data_pattern' && (
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(0,212,255,0.12)', color: '#3A90A8', border: '1px solid rgba(0,212,255,0.3)' }}>📊 데이터 패턴 감지</span>
              )}
            </div>
            <span className="text-xs" style={{ color: '#485870' }}>
              {mappedCount}개 컬럼 매핑됨
              {!mappings.some(m => m.field === 'full_name') && (
                <span style={{ color: '#C04040' }}> · 이름 컬럼 필수!</span>
              )}
            </span>
          </div>

          {/* 컬럼 매핑 카드들 */}
          <div className="glass-card p-5">
            <p className="text-xs mb-4" style={{ color: '#687898' }}>
              각 컬럼이 어떤 정보인지 확인·수정하세요.
              샘플 데이터를 보고 잘못 분류된 컬럼은 드롭다운으로 직접 선택하세요.
            </p>
            <div className="space-y-2">
              {mappings.map((m, idx) => {
                const isLowConf = m.confidence < 0.7
                const isSkip = m.field === 'skip'
                return (
                  <div key={idx}
                    className="rounded-xl p-3"
                    style={{
                      background: isSkip ? '#0F1E35' : isLowConf ? 'rgba(255,153,0,0.05)' : '#182035',
                      border: `1px solid ${isSkip ? '#1A2838' : isLowConf ? 'rgba(255,153,0,0.25)' : 'rgba(30,144,255,0.15)'}`,
                      opacity: isSkip ? 0.6 : 1,
                    }}>
                    <div className="flex items-start gap-3">

                      {/* 컬럼 번호 */}
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold mt-0.5"
                        style={{ background: '#1A2838', color: '#485870' }}>
                        {m.colIndex + 1}
                      </div>

                      {/* 샘플 데이터 */}
                      <div className="flex-1 min-w-0">
                        {!hasHeader && (
                          <p className="text-xs mb-1" style={{ color: '#485870' }}>{m.header}</p>
                        )}
                        {hasHeader && (
                          <p className="text-xs font-semibold mb-1" style={{ color: '#687898' }}>
                            헤더: <span style={{ color: '#CDD5E0' }}>{m.header}</span>
                          </p>
                        )}
                        <div className="flex gap-2 flex-wrap">
                          {m.samples.length > 0 ? m.samples.map((s, si) => {
                            const { normalized, changed } = normalizeField(m.field, s)
                            return (
                              <span key={si} className="text-xs px-2 py-0.5 rounded-md flex items-center gap-1"
                                style={{ background: '#0D1520', color: changed ? '#3D9E6A' : '#687898', border: `1px solid ${changed ? 'rgba(0,204,102,0.3)' : '#1A2838'}`, maxWidth: '200px', overflow: 'hidden', whiteSpace: 'nowrap', display: 'inline-flex' }}>
                                {changed ? (
                                  <>
                                    <span style={{ color: '#485870', textDecoration: 'line-through', fontSize: '11px' }}>{s}</span>
                                    <span style={{ color: '#485870' }}>→</span>
                                    <span style={{ color: '#3D9E6A' }}>{normalized}</span>
                                  </>
                                ) : s}
                              </span>
                            )
                          }) : (
                            <span className="text-xs" style={{ color: '#485870' }}>샘플 없음</span>
                          )}
                        </div>
                      </div>

                      {/* 매핑 선택 */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span style={{ color: '#485870', fontSize: '12px' }}>→</span>
                        <select
                          value={m.field}
                          onChange={e => updateMapping(idx, e.target.value)}
                          style={{
                            background: '#0D1520',
                            border: `1px solid ${isSkip ? '#1A2838' : isLowConf ? '#A87228' : 'rgba(30,144,255,0.4)'}`,
                            color: isSkip ? '#485870' : '#CDD5E0',
                            borderRadius: '8px', padding: '5px 8px', fontSize: '13px',
                            minWidth: '130px',
                          }}>
                          {SYSTEM_FIELDS.map(f => (
                            <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                          ))}
                        </select>
                        {!isSkip && (
                          <span className="text-xs w-9 text-right"
                            style={{ color: m.confidence >= 0.8 ? '#3D9E6A' : m.confidence >= 0.5 ? '#A87228' : '#C04040' }}>
                            {Math.round(m.confidence * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 목록 구분 */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#CDD5E0' }}>가져올 목록 구분</h3>
            <div className="flex rounded-lg p-1 w-fit" style={{ background: '#0D1520', border: '1px solid #1A2838' }}>
              {[
                { value: 'personal', label: '🔒 내 목록' },
                { value: 'shared', label: '🌐 공유 목록' },
              ].map(opt => (
                <button key={opt.value} type="button"
                  onClick={() => setVisibility(opt.value as typeof visibility)}
                  className="px-5 py-2 rounded-md text-sm font-medium transition-all"
                  style={{
                    background: visibility === opt.value ? '#4A7CC0' : 'transparent',
                    color: visibility === opt.value ? 'white' : '#687898',
                    cursor: 'pointer',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 실행 */}
          <div className="glass-card p-5">
            {error && <p className="text-sm mb-3" style={{ color: '#C04040' }}>{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setStep('upload'); setMappings([]); setRawRows([]) }}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ background: '#182035', color: '#687898', border: '1px solid #1A2838', cursor: 'pointer' }}>
                ← 다시 선택
              </button>
              <button onClick={handleImport} disabled={loading}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold"
                style={{
                  background: loading ? 'rgba(30,144,255,0.4)' : 'linear-gradient(135deg, #4A7CC0, #0066CC)',
                  color: 'white', border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                }}>
                {loading ? `가져오는 중...` : `✅ ${totalRows}명 가져오기`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: 완료 */}
      {step === 'done' && (
        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(0,204,102,0.15)', border: '2px solid rgba(0,204,102,0.3)' }}>
            <span style={{ fontSize: '32px' }}>✅</span>
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#CDD5E0' }}>가져오기 완료!</h2>
          <p className="text-sm" style={{ color: '#687898' }}>
            <span style={{ color: '#3D9E6A', fontWeight: 'bold' }}>{importCount}명</span>의 취재원이 등록되었습니다
          </p>
          {normalizeCount > 0 && (
            <div className="mt-3 mb-4 mx-auto max-w-xs rounded-lg px-4 py-2.5 text-xs"
              style={{ background: 'rgba(30,144,255,0.08)', border: '1px solid rgba(30,144,255,0.2)', color: '#687898' }}>
              <span style={{ color: '#4A7CC0', fontWeight: 600 }}>✦ {normalizeCount}건</span> 유사어 자동 정규화
              <span className="block mt-0.5" style={{ color: '#485870' }}>
                연세대→연세대학교, 설대→서울대학교 등
              </span>
            </div>
          )}
          {normalizeCount === 0 && <div className="mb-4" />}
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setStep('upload'); setMappings([]); setRawRows([]) }}
              className="px-4 py-2 rounded-lg text-sm"
              style={{ background: '#182035', color: '#687898', border: '1px solid #1A2838', cursor: 'pointer' }}>
              추가 파일 가져오기
            </button>
            <button onClick={() => router.push('/sources')}
              className="px-6 py-2 rounded-lg text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg, #4A7CC0, #0066CC)', color: 'white', border: 'none', cursor: 'pointer' }}>
              취재원 목록으로 →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
