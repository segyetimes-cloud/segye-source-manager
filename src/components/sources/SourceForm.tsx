'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Source } from '@/types/database'
import QuickFill, { extractEducationFields, type FillData } from '@/components/sources/QuickFill'
import BusinessCardScanner from '@/components/sources/BusinessCardScanner'
import { calcCompletenessScore, calcRegistrationPoints, calcNoteScore, calcTotalScore } from '@/lib/points'

interface SourceFormProps {
  mode: 'create' | 'edit'
  initialData?: Partial<Source>
}

// lib/points.ts 에서 가져온 함수를 하위 호환 이름으로 재export
export { calcCompletenessScore as calcBaseScore, calcNoteScore, calcTotalScore }

// 폼 내부 별칭
const calcScore = calcCompletenessScore
const calcFieldPoints = calcRegistrationPoints

const PROVINCES = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
  '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
]

// ── 필드 한국어 레이블 ────────────────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  full_name: '이름', current_organization: '소속', current_position: '직책',
  current_department: '부서', phone_primary: '전화(주)', phone_secondary: '전화(부)',
  email_primary: '이메일(주)', email_secondary: '이메일(부)', birthday: '생년월일',
  hometown_province: '고향(광역)', hometown_city: '고향(시군구)',
  high_school: '고등학교', university: '대학', university_major: '전공',
  graduate_school: '대학원', exam_batch: '시험/기수', tags: '태그',
  visibility: '공개 범위', sensitivity: '민감도', on_record_status: '취재 동의', public_notes: '공개 정보', personal_notes: '민감 정보',
  sns_twitter: 'SNS(트위터)', sns_facebook: 'SNS(페이스북)',
}

const VISIBILITY_LABEL: Record<string, string> = { personal: '내 목록만', shared: '편집국 공유' }
const SENSITIVITY_LABEL: Record<string, string> = { public: '공개', private: '민감' }

// ── 유효성 검사 ────────────────────────────────────────────────────────────────
const PHONE_RE = /^0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function validatePhone(v: string): string | null {
  if (!v) return null
  const clean = v.replace(/[-.\s]/g, '')
  if (!PHONE_RE.test(v) || !/^\d+$/.test(clean)) return '전화번호 형식이 올바르지 않습니다 (예: 010-1234-5678)'
  return null
}

function validateEmail(v: string): string | null {
  if (!v) return null
  if (!EMAIL_RE.test(v)) return '이메일 형식이 올바르지 않습니다 (예: user@example.com)'
  return null
}

function formatVal(key: string, val: unknown): string {
  if (val === null || val === undefined || val === '') return '(없음)'
  if (key === 'visibility') return VISIBILITY_LABEL[val as string] ?? String(val)
  if (key === 'sensitivity') return SENSITIVITY_LABEL[val as string] ?? String(val)
  if (Array.isArray(val)) return val.length === 0 ? '(없음)' : val.join(', ')
  return String(val)
}

const FIELD_KO: Record<string, string> = {
  exam_batch: '고시/기수', university: '대학', university_major: '전공',
  graduate_school: '대학원', high_school: '고교',
  birthday: '생년월일', hometown_province: '출신(광역)', hometown_city: '출신(시군구)',
  current_organization: '소속', current_position: '직책',
}

function NotesExtractBanner({
  hint, onApply, onDismiss,
}: {
  hint: Record<string, string | undefined> | null
  onApply: () => void
  onDismiss: () => void
}) {
  if (!hint || Object.keys(hint).filter(k => hint[k]).length === 0) return null
  return (
    <div style={{
      marginTop: '8px', padding: '10px 12px', borderRadius: '8px',
      background: 'rgba(61,158,106,0.08)', border: '1px solid rgba(61,158,106,0.3)',
      display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: '13px' }}>✦</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#3D9E6A' }}>학력·기수 감지 — 학력 필드에 채울까요?&nbsp;</span>
        <span style={{ fontSize: '11px', color: '#607898' }}>
          {Object.entries(hint)
            .filter(([, v]) => v)
            .map(([k, v]) => `${FIELD_KO[k] ?? k}: ${v}`)
            .join(' · ')}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
        <button type="button" onClick={onApply}
          style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '6px',
            background: '#3D9E6A', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
          적용
        </button>
        <button type="button" onClick={onDismiss}
          style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '6px',
            background: 'none', color: '#607898', border: '1px solid #1A2838', cursor: 'pointer' }}>
          무시
        </button>
      </div>
    </div>
  )
}

export default function SourceForm({ mode, initialData }: SourceFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  // 빠른 입력 탭: 'contact'(연락처붙여넣기) | 'camera'(명함스캔) | 'excel'(엑셀붙여넣기) | null(닫힘)
  const [quickMode, setQuickMode] = useState<'contact' | 'camera' | 'excel' | null>(null)
  const [excelText, setExcelText] = useState('')
  const [excelPreview, setExcelPreview] = useState<FillData | null>(null)
  const [excelError, setExcelError] = useState('')

  // 정보 창 붙여넣기 감지 상태
  const [notesHint, setNotesHint] = useState<{
    fields: Partial<ReturnType<typeof extractEducationFields>>
    source: 'public_notes' | 'personal_notes'
  } | null>(null)

  const [form, setForm] = useState({
    full_name: initialData?.full_name ?? '',
    current_organization: initialData?.current_organization ?? '',
    current_position: initialData?.current_position ?? '',
    current_department: initialData?.current_department ?? '',
    phone_primary: initialData?.phone_primary ?? '',
    phone_secondary: initialData?.phone_secondary ?? '',
    email_primary: initialData?.email_primary ?? '',
    email_secondary: initialData?.email_secondary ?? '',
    birthday: initialData?.birthday ?? '',
    hometown_province: initialData?.hometown_province ?? '',
    hometown_city: initialData?.hometown_city ?? '',
    high_school: initialData?.high_school ?? '',
    university: initialData?.university ?? '',
    university_major: initialData?.university_major ?? '',
    graduate_school: initialData?.graduate_school ?? '',
    exam_batch: initialData?.exam_batch ?? '',
    tags: initialData?.tags ?? [] as string[],
    visibility: 'shared' as 'personal' | 'shared',
    sensitivity: initialData?.sensitivity ?? 'public' as 'public' | 'private',
    on_record_status: (initialData?.on_record_status ?? '') as '' | 'on_record' | 'background_only' | 'anonymous',
    public_notes: initialData?.public_notes ?? '',
    personal_notes: initialData?.personal_notes ?? '',
    sns_twitter: (initialData?.sns_links as Record<string, string> | undefined)?.twitter ?? '',
    sns_facebook: (initialData?.sns_links as Record<string, string> | undefined)?.facebook ?? '',
  })

  const score = calcScore(form)
  const pts = calcFieldPoints(form)
  const scoreColor = score >= 55 ? '#3D9E6A' : score >= 35 ? '#A87228' : '#C04040'
  const isPersonal = false

  // 편집 모드 진입 시 기존 notes에서 학력·기수 필드 감지
  useEffect(() => {
    if (mode !== 'edit') return
    const sources: Array<{ text: string; source: 'public_notes' | 'personal_notes' }> = [
      { text: form.public_notes,   source: 'public_notes' },
      { text: form.personal_notes, source: 'personal_notes' },
    ]
    for (const { text, source } of sources) {
      if (!text || text.length < 15) continue
      const extracted = extractEducationFields(text)
      const newFields: Partial<ReturnType<typeof extractEducationFields>> = {}
      if (extracted.exam_batch            && !form.exam_batch)            newFields.exam_batch            = extracted.exam_batch
      if (extracted.university            && !form.university)            newFields.university            = extracted.university
      if (extracted.university_major      && !form.university_major)      newFields.university_major      = extracted.university_major
      if (extracted.graduate_school       && !form.graduate_school)       newFields.graduate_school       = extracted.graduate_school
      if (extracted.high_school           && !form.high_school)           newFields.high_school           = extracted.high_school
      if (extracted.birthday              && !form.birthday)              newFields.birthday              = extracted.birthday
      if (extracted.hometown_province     && !form.hometown_province)     newFields.hometown_province     = extracted.hometown_province
      if (extracted.hometown_city         && !form.hometown_city)         newFields.hometown_city         = extracted.hometown_city
      if (extracted.current_organization  && !form.current_organization)  newFields.current_organization  = extracted.current_organization
      if (extracted.current_position      && !form.current_position)      newFields.current_position      = extracted.current_position
      if (Object.keys(newFields).length > 0) {
        setNotesHint({ fields: newFields, source })
        break
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function set(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // QuickFill 전용
  function handleQuickFill(data: FillData) {
    setForm(prev => ({
      ...prev,
      full_name:            data.full_name            ?? prev.full_name,
      current_organization: data.current_organization ?? prev.current_organization,
      current_position:     data.current_position     ?? prev.current_position,
      current_department:   data.current_department   ?? prev.current_department,
      phone_primary:        data.phone                ?? prev.phone_primary,
      phone_secondary:      data.phone_secondary      ?? prev.phone_secondary,
      email_primary:        data.email                ?? prev.email_primary,
      email_secondary:      data.email_secondary      ?? prev.email_secondary,
      exam_batch:           data.exam_batch           ?? prev.exam_batch,
      university:           data.university           ?? prev.university,
      university_major:     data.university_major     ?? prev.university_major,
      graduate_school:      data.graduate_school      ?? prev.graduate_school,
      high_school:          data.high_school          ?? prev.high_school,
      birthday:             data.birthday             ?? prev.birthday,
      hometown_province:    data.hometown_province    ?? prev.hometown_province,
      personal_notes:       data.personal_notes
                              ? (prev.personal_notes ? prev.personal_notes + '\n' + data.personal_notes : data.personal_notes)
                              : prev.personal_notes,
    }))
  }

  // ── 명함 OCR 결과를 폼에 채움 (BusinessCardScanner → SourceForm) ─────────────
  function handleCardExtracted(data: { [key: string]: string | null | undefined }) {
    setForm(prev => ({
      ...prev,
      full_name:            data.full_name            ?? prev.full_name,
      current_organization: data.current_organization ?? prev.current_organization,
      current_position:     data.current_position     ?? prev.current_position,
      current_department:   data.department           ?? prev.current_department,
      phone_primary:        data.phone_primary        ?? data.phone  ?? prev.phone_primary,
      phone_secondary:      data.phone_secondary      ?? data.office_phone ?? prev.phone_secondary,
      email_primary:        data.email_primary        ?? data.email ?? prev.email_primary,
    }))
    setQuickMode(null)  // 스캔 완료 → 패널 닫기
  }

  // ── 엑셀/스프레드시트 셀 붙여넣기 파서 ─────────────────────────────────────
  // Excel·Numbers·Google Sheets에서 복사하면 탭(\t) 구분 TSV로 클립보드에 들어옴
  const EXCEL_HEADER_MAP: Record<string, keyof FillData> = {
    '이름': 'full_name',         '성명': 'full_name',       'name': 'full_name',
    '소속': 'current_organization', '기관': 'current_organization', '회사': 'current_organization',
    '직책': 'current_position',  '직함': 'current_position', 'title': 'current_position',
    '부서': 'current_department', '팀': 'current_department', 'department': 'current_department',
    '전화': 'phone',             '전화번호': 'phone',        '휴대폰': 'phone',       '연락처': 'phone',
    '전화2': 'phone_secondary',  '전화(보조)': 'phone_secondary', '사무실': 'phone_secondary',
    '이메일': 'email',           'email': 'email',           '메일': 'email',
    '대학': 'university',        '학교': 'university',       '대학교': 'university',
    '전공': 'university_major',  '학과': 'university_major',
    '대학원': 'graduate_school',
    '고교': 'high_school',       '고등학교': 'high_school',
    '생년월일': 'birthday',       '생일': 'birthday',         '생년': 'birthday',
    '기수': 'exam_batch',        '고시': 'exam_batch',
    '출신지': 'hometown_province', '고향': 'hometown_province',
  }

  function parseExcelTSV(raw: string): { rows: FillData[]; error: string } {
    const lines = raw.split(/\r?\n/).filter(l => l.trim())
    if (lines.length < 2) {
      return { rows: [], error: '2행 이상 필요합니다. 첫 행 = 헤더, 두 번째 행부터 = 데이터' }
    }

    const headers = lines[0].split('\t').map(h => h.trim().toLowerCase())
    if (headers.length < 2) {
      return { rows: [], error: '엑셀에서 복사한 데이터가 아닙니다 (탭 구분자 없음)' }
    }

    // 헤더 → 필드 매핑
    const fieldMap: Array<keyof FillData | null> = headers.map(h => {
      const mapped = EXCEL_HEADER_MAP[h] ?? EXCEL_HEADER_MAP[h.replace(/\s/g, '')]
      return mapped ?? null
    })

    const rows: FillData[] = lines.slice(1).map(line => {
      const cells = line.split('\t')
      const row: FillData = {}
      fieldMap.forEach((field, i) => {
        if (field && cells[i]?.trim()) {
          (row as Record<string, string>)[field] = cells[i].trim()
        }
      })
      return row
    }).filter(row => Object.values(row).some(v => v))

    if (rows.length === 0) {
      return { rows: [], error: '인식된 데이터 행이 없습니다.' }
    }
    return { rows, error: '' }
  }

  function handleExcelAnalyze() {
    setExcelError('')
    setExcelPreview(null)
    if (!excelText.trim()) return
    const { rows, error } = parseExcelTSV(excelText)
    if (error) { setExcelError(error); return }
    setExcelPreview(rows[0])  // 미리보기는 첫 번째 행
    if (rows.length > 1) {
      setExcelError(`${rows.length}행 발견 — 첫 번째 행만 이 폼에 적용됩니다. 여러 명을 한꺼번에 등록하려면 엑셀 가져오기를 이용하세요.`)
    }
  }

  function applyExcelRow() {
    if (!excelPreview) return
    handleQuickFill(excelPreview)
    setQuickMode(null)
    setExcelText('')
    setExcelPreview(null)
    setExcelError('')
  }

  // 정보 창에 붙여넣을 때 교육/배경 필드 감지
  function handleNotesPaste(
    e: React.ClipboardEvent<HTMLTextAreaElement>,
    source: 'public_notes' | 'personal_notes'
  ) {
    const pasted = e.clipboardData.getData('text')
    if (!pasted || pasted.length < 15) return
    const extracted = extractEducationFields(pasted)
    const newFields: Partial<ReturnType<typeof extractEducationFields>> = {}
    if (extracted.exam_batch            && !form.exam_batch)            newFields.exam_batch            = extracted.exam_batch
    if (extracted.university            && !form.university)            newFields.university            = extracted.university
    if (extracted.university_major      && !form.university_major)      newFields.university_major      = extracted.university_major
    if (extracted.graduate_school       && !form.graduate_school)       newFields.graduate_school       = extracted.graduate_school
    if (extracted.high_school           && !form.high_school)           newFields.high_school           = extracted.high_school
    if (extracted.birthday              && !form.birthday)              newFields.birthday              = extracted.birthday
    if (extracted.hometown_province     && !form.hometown_province)     newFields.hometown_province     = extracted.hometown_province
    if (extracted.hometown_city         && !form.hometown_city)         newFields.hometown_city         = extracted.hometown_city
    if (extracted.current_organization  && !form.current_organization)  newFields.current_organization  = extracted.current_organization
    if (extracted.current_position      && !form.current_position)      newFields.current_position      = extracted.current_position
    if (Object.keys(newFields).length > 0) setNotesHint({ fields: newFields, source })
  }

  function applyNotesHint() {
    if (!notesHint) return
    setForm(prev => ({
      ...prev,
      exam_batch:           notesHint.fields.exam_batch           ?? prev.exam_batch,
      university:           notesHint.fields.university           ?? prev.university,
      university_major:     notesHint.fields.university_major     ?? prev.university_major,
      graduate_school:      notesHint.fields.graduate_school      ?? prev.graduate_school,
      high_school:          notesHint.fields.high_school          ?? prev.high_school,
      birthday:             notesHint.fields.birthday             ?? prev.birthday,
      hometown_province:    notesHint.fields.hometown_province    ?? prev.hometown_province,
      hometown_city:        notesHint.fields.hometown_city        ?? prev.hometown_city,
      current_organization: notesHint.fields.current_organization ?? prev.current_organization,
      current_position:     notesHint.fields.current_position     ?? prev.current_position,
    }))
    setNotesHint(null)
  }

  function addTag(tag: string) {
    const trimmed = tag.trim()
    if (trimmed && !form.tags.includes(trimmed)) {
      set('tags', [...form.tags, trimmed])
    }
    setTagInput('')
  }

  function buildPayload() {
    const BIRTHDAY_RE = /^\d{4}-\d{2}-\d{2}$/
    // exam_batch: 폼에서 string으로 관리 → 숫자 변환, 빈값/비숫자는 null
    const examBatchNum = form.exam_batch ? parseInt(String(form.exam_batch), 10) : NaN
    const payload: Record<string, unknown> = {
      ...form,
      visibility: 'shared',
      // enum 필드: 빈값 → undefined 로 보내야 Zod .default() 가 적용됨 (null 은 enum 검증 실패)
      on_record_status: form.on_record_status || undefined,
      public_notes:    form.public_notes    || null,
      personal_notes:  form.personal_notes  || null,
      // 빈 문자열·형식 불일치 선택 항목은 null — 서버 Zod 충돌 방지
      email_primary:   form.email_primary   || null,
      email_secondary: form.email_secondary || null,
      phone_primary:   form.phone_primary   || null,
      phone_secondary: form.phone_secondary || null,
      // 생년월일: YYYY-MM-DD 형식 불일치 시 null
      birthday: form.birthday && BIRTHDAY_RE.test(form.birthday) ? form.birthday : null,
      // exam_batch: 숫자 변환 실패 시 null
      exam_batch: !isNaN(examBatchNum) && examBatchNum > 0 ? examBatchNum : null,
      sns_links: {
        ...(form.sns_twitter && { twitter: form.sns_twitter }),
        ...(form.sns_facebook && { facebook: form.sns_facebook }),
      },
    }
    delete payload.sns_twitter
    delete payload.sns_facebook
    return payload
  }

  // 필드 변경 시 실시간 유효성 검사
  function setWithValidation(field: string, value: string) {
    set(field, value)
    let err: string | null = null
    if (field === 'phone_primary' || field === 'phone_secondary') err = validatePhone(value)
    if (field === 'email_primary' || field === 'email_secondary') err = validateEmail(value)
    setFieldErrors(prev => {
      const next = { ...prev }
      if (err) next[field] = err
      else delete next[field]
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.full_name.trim()) {
      setError('이름은 필수 입력 항목입니다.')
      return
    }
    // 형식 오류 선택 항목(이메일·전화)은 차단 대신 해당 값만 제거 후 진행
    // (필수 항목이 아니므로 잘못된 형식이라도 나머지를 저장하는 게 더 나은 UX)
    const strippedFields: string[] = []
    if (validatePhone(form.phone_primary))   strippedFields.push('phone_primary')
    if (validatePhone(form.phone_secondary)) strippedFields.push('phone_secondary')
    if (validateEmail(form.email_primary))   strippedFields.push('email_primary')
    if (validateEmail(form.email_secondary)) strippedFields.push('email_secondary')

    setError('')
    setFieldErrors({})

    const payload = buildPayload()
    // 형식 불량 필드는 페이로드에서 제거
    strippedFields.forEach(f => { payload[f] = null })

    if (mode === 'edit') {
      // 편집 모드: 확인 모달 먼저 표시
      setPendingPayload(payload)
      setShowConfirm(true)
      return
    }

    // 신규 등록: 바로 저장
    await doSave(payload)
  }

  async function doSave(payload: Record<string, unknown>) {
    setSubmitting(true)
    setError('')

    const url = mode === 'create' ? '/api/sources' : `/api/sources/${initialData?.id}`
    const method = mode === 'create' ? 'POST' : 'PATCH'

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      // JSON 파싱 실패 = 서버가 HTML 오류 페이지를 반환한 경우
      let data: Record<string, unknown> = {}
      try {
        data = await res.json()
      } catch {
        setError(`서버 오류 (${res.status}). 잠시 후 다시 시도해 주세요.`)
        setShowConfirm(false)
        return
      }

      if (!res.ok) {
        setError((data.error as string) ?? '저장에 실패했습니다.')
        setShowConfirm(false)
        return
      }

      router.push(mode === 'create' ? `/sources/${data.id}` : `/sources/${initialData?.id}`)
      router.refresh()
    } catch {
      setError('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.')
      setShowConfirm(false)
    } finally {
      setSubmitting(false)
    }
  }

  // 편집 확인 모달 - 변경 필드 diff 계산
  const changedFields: { key: string; label: string; before: string; after: string }[] = []
  if (mode === 'edit' && initialData && pendingPayload) {
    const checkKeys = [
      'full_name', 'current_organization', 'current_position', 'current_department',
      'phone_primary', 'phone_secondary', 'email_primary', 'email_secondary',
      'birthday', 'hometown_province', 'hometown_city',
      'high_school', 'university', 'university_major', 'graduate_school',
      'exam_batch', 'visibility', 'sensitivity', 'on_record_status', 'public_notes', 'personal_notes',
      'sns_twitter', 'sns_facebook', 'tags',
    ]
    for (const key of checkKeys) {
      const before = key === 'tags'
        ? ((initialData as Record<string, unknown>).tags ?? [])
        : key === 'sns_twitter'
          ? ((initialData.sns_links as Record<string, string> | undefined)?.twitter ?? '')
          : key === 'sns_facebook'
            ? ((initialData.sns_links as Record<string, string> | undefined)?.facebook ?? '')
            : (initialData as Record<string, unknown>)[key] ?? ''
      const after = (form as Record<string, unknown>)[key] ?? ''

      const beforeStr = formatVal(key, before)
      const afterStr = formatVal(key, after)
      if (beforeStr !== afterStr) {
        changedFields.push({ key, label: FIELD_LABELS[key] ?? key, before: beforeStr, after: afterStr })
      }
    }
  }

  const inputStyle = {
    background: '#182035',
    border: '1px solid #1A2838',
    color: '#DCE8F4',
    borderRadius: '8px',
    padding: '9px 12px',
    fontSize: '14px',
    width: '100%',
  }

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#8AAAC8' }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── 빠른 입력 (3탭) ─────────────────────────────────────────────────── */}
      {mode === 'create' && (
        <div style={{
          borderRadius: '12px',
          border: '1px solid rgba(30,144,255,0.25)',
          background: 'rgba(10,20,40,0.6)',
          padding: '16px',
        }}>
          <p style={{ fontSize: '12px', fontWeight: 700, color: '#8AAAC8', marginBottom: '12px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            ⚡ 빠른 입력 — 방법을 선택하세요
          </p>

          {/* 탭 선택 버튼 3개 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: quickMode ? '14px' : '0' }}>
            {[
              {
                key: 'contact' as const,
                icon: '📋',
                label: '연락처 붙여넣기',
                sub: '연락처 앱·네이버 복사',
                color: '#3D9E6A',
                bg: 'rgba(0,170,85,0.08)',
                border: 'rgba(0,170,85,0.3)',
              },
              {
                key: 'camera' as const,
                icon: '📸',
                label: '명함 사진 스캔',
                sub: '카메라 촬영·사진 선택',
                color: '#4A7CC0',
                bg: 'rgba(30,144,255,0.1)',
                border: 'rgba(30,144,255,0.4)',
              },
              {
                key: 'excel' as const,
                icon: '📊',
                label: '엑셀 붙여넣기',
                sub: '시트 셀 복사 후 Ctrl+V',
                color: '#A87228',
                bg: 'rgba(255,153,0,0.08)',
                border: 'rgba(255,153,0,0.3)',
              },
            ].map(tab => {
              const active = quickMode === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setQuickMode(prev => prev === tab.key ? null : tab.key)}
                  style={{
                    padding: '12px 10px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                    borderRadius: '10px', cursor: 'pointer',
                    background: active ? tab.bg : 'rgba(255,255,255,0.02)',
                    border: `2px solid ${active ? tab.border : 'rgba(255,255,255,0.06)'}`,
                    transition: 'all 0.15s',
                    boxShadow: active ? `0 0 12px ${tab.bg}` : 'none',
                  }}
                >
                  <span style={{ fontSize: '26px' }}>{tab.icon}</span>
                  <p style={{
                    fontSize: '12px', fontWeight: 700, margin: 0,
                    color: active ? tab.color : '#8898A8',
                  }}>
                    {tab.label}
                  </p>
                  <p style={{ fontSize: '10px', color: '#607898', margin: 0, textAlign: 'center', lineHeight: 1.4 }}>
                    {tab.sub}
                  </p>
                  <span style={{
                    fontSize: '10px', fontWeight: 600, marginTop: '2px',
                    color: active ? tab.color : '#384860',
                  }}>
                    {active ? '▲ 닫기' : '▼ 열기'}
                  </span>
                </button>
              )
            })}
          </div>

          {/* ── 연락처 붙여넣기 패널 ───────────────────────────────────────── */}
          {quickMode === 'contact' && (
            <QuickFill onFill={data => { handleQuickFill(data); setQuickMode(null) }} />
          )}

          {/* ── 명함 스캔 패널 (1장) ──────────────────────────────────────── */}
          {quickMode === 'camera' && (
            <div>
              <BusinessCardScanner onExtracted={handleCardExtracted} />
              <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <a
                  href="/sources/import-cards"
                  style={{ fontSize: '12px', color: '#4A7CC0', textDecoration: 'underline' }}
                >
                  📇 여러 장 한꺼번에 등록하려면 명함 일괄 등록 →
                </a>
              </div>
            </div>
          )}

          {/* ── 엑셀 셀 붙여넣기 패널 ─────────────────────────────────────── */}
          {quickMode === 'excel' && (
            <div style={{ borderRadius: '10px', border: '1px solid rgba(30,144,255,0.25)', overflow: 'hidden', background: 'rgba(30,144,255,0.03)' }}>
              <div style={{ padding: '10px 14px 0' }}>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#4A7CC0', marginBottom: '3px' }}>
                  📊 엑셀 셀 붙여넣기
                </p>
                <p style={{ fontSize: '11px', color: '#607898', lineHeight: 1.6 }}>
                  Excel·Numbers·Google Sheets에서 <b style={{ color: '#DCE8F4' }}>헤더 포함 셀을 선택</b>해 복사(Ctrl+C) 후 아래에 붙여넣으세요.<br />
                  인식 가능한 헤더: <span style={{ color: '#A8B8C8' }}>이름, 소속, 직책, 부서, 전화, 이메일, 대학, 전공, 기수, 생년월일 등</span>
                </p>
              </div>
              <div style={{ padding: '8px 14px' }}>
                <textarea
                  value={excelText}
                  onChange={e => { setExcelText(e.target.value); setExcelPreview(null); setExcelError('') }}
                  onPaste={e => {
                    // 붙여넣기 직후 자동 분석
                    setTimeout(() => {
                      const val = e.currentTarget.value || e.clipboardData.getData('text')
                      if (val.includes('\t')) {
                        setExcelText(val)
                        const { rows, error } = parseExcelTSV(val)
                        if (rows.length) setExcelPreview(rows[0])
                        if (error) setExcelError(error)
                      }
                    }, 50)
                  }}
                  placeholder={`헤더 행을 포함해서 붙여넣으세요 (Ctrl+V)\n\n예시:\n이름\t소속\t직책\t전화\t이메일\n홍길동\t기획재정부\t예산실장\t010-1234-5678\thgd@moef.go.kr`}
                  rows={5}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '10px 12px', resize: 'vertical',
                    background: '#1A2838', border: '1px solid #202C3A',
                    borderRadius: '8px', color: '#DCE8F4',
                    fontSize: '13px', lineHeight: 1.6, outline: 'none',
                    fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                  }}
                  autoFocus
                />
              </div>

              {/* 엑셀 미리보기 */}
              {excelPreview && (
                <div style={{ margin: '0 14px 8px', padding: '10px 12px', background: 'rgba(30,144,255,0.07)', border: '1px solid rgba(30,144,255,0.2)', borderRadius: '8px' }}>
                  <p style={{ fontSize: '11px', color: '#607898', marginBottom: '6px' }}>추출된 정보 확인</p>
                  {(Object.entries(excelPreview) as [string, string | undefined][])
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', gap: '8px', fontSize: '12px', padding: '2px 0' }}>
                        <span style={{ color: '#607898', flexShrink: 0, width: '72px' }}>
                          {{ full_name: '이름', current_organization: '소속', current_position: '직책',
                             current_department: '부서', phone: '전화(주)', phone_secondary: '전화(보조)',
                             email: '이메일', university: '대학', university_major: '전공',
                             graduate_school: '대학원', high_school: '고교',
                             birthday: '생년월일', exam_batch: '기수' }[k] ?? k}
                        </span>
                        <span style={{ color: '#A8B8C8', fontWeight: 500 }}>{v}</span>
                      </div>
                    ))}
                </div>
              )}

              {excelError && (
                <p style={{ fontSize: '12px', color: excelPreview ? '#A87228' : '#C04040', margin: '0 14px 8px', padding: '6px 10px', borderRadius: '6px', background: 'rgba(192,64,64,0.06)' }}>
                  ⚠ {excelError}
                  {excelError.includes('여러 명') && (
                    <a href="/sources/import" style={{ marginLeft: '8px', color: '#4A7CC0', textDecoration: 'underline' }}>
                      엑셀 가져오기 →
                    </a>
                  )}
                </p>
              )}

              <div style={{ padding: '0 14px 12px', display: 'flex', gap: '8px' }}>
                {!excelPreview ? (
                  <>
                    <button type="button" onClick={handleExcelAnalyze} disabled={!excelText.trim()}
                      style={{ flex: 1, padding: '10px', background: excelText.trim() ? '#4A7CC0' : '#1A2838', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: excelText.trim() ? 'pointer' : 'default' }}>
                      🔍 분석
                    </button>
                    <button type="button" onClick={() => { setQuickMode(null); setExcelText(''); setExcelPreview(null); setExcelError('') }}
                      style={{ padding: '10px 14px', background: 'none', border: '1px solid #1A2838', borderRadius: '8px', color: '#607898', fontSize: '12px', cursor: 'pointer' }}>
                      취소
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={applyExcelRow}
                      style={{ flex: 1, padding: '10px', background: '#4A7CC0', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                      ✅ 폼에 적용
                    </button>
                    <button type="button" onClick={() => { setExcelPreview(null); setExcelError('') }}
                      style={{ padding: '10px 14px', background: 'none', border: '1px solid #1A2838', borderRadius: '8px', color: '#607898', fontSize: '12px', cursor: 'pointer' }}>
                      수정
                    </button>
                    <button type="button" onClick={() => { setQuickMode(null); setExcelText(''); setExcelPreview(null); setExcelError('') }}
                      style={{ padding: '10px 14px', background: 'none', border: '1px solid #1A2838', borderRadius: '8px', color: '#607898', fontSize: '12px', cursor: 'pointer' }}>
                      취소
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 편집 모드: 정보 보충 (연락처·텍스트 붙여넣기만) */}
      {mode === 'edit' && (
        <div>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#8AAAC8', marginBottom: '8px' }}>
            📋 정보 보충 <span style={{ fontWeight: 400, color: '#607898' }}>— 뉴스·네이버·연락처 복사 후 붙여넣으면 빈 항목을 자동으로 채워드립니다</span>
          </p>
          <QuickFill onFill={handleQuickFill} />
        </div>
      )}

      {/* 완성도 게이지 */}
      <div className="glass-card px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium flex-shrink-0" style={{ color: '#8AAAC8' }}>완성도</span>
          <div className="flex-1 h-1.5 rounded-full" style={{ background: '#1A2838' }}>
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${score}%`, background: scoreColor }} />
          </div>
          <span className="text-sm font-bold flex-shrink-0" style={{ color: scoreColor }}>{score}%</span>
          <span className="text-xs flex-shrink-0" style={{ color: '#607898' }}>
            +{pts}pt
          </span>
        </div>
      </div>

      {/* 민감도 */}
      <div className="glass-card px-4 py-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-medium flex-shrink-0" style={{ color: '#8AAAC8' }}>민감도</span>
          <div className="flex rounded-lg p-0.5 flex-shrink-0" style={{ background: '#0D1520', border: '1px solid #1A2838' }}>
            {[
              { value: 'public', label: '✅ 일반' },
              { value: 'private', label: '🔴 민감' },
            ].map(opt => (
              <button key={opt.value} type="button" onClick={() => set('sensitivity', opt.value)}
                className="px-3 py-1 rounded-md text-xs font-medium transition-all"
                style={{
                  background: form.sensitivity === opt.value
                    ? (opt.value === 'private' ? '#CC3300' : '#3D9E6A')
                    : 'transparent',
                  color: form.sensitivity === opt.value ? 'white' : '#8AAAC8',
                }}>
                {opt.label}
              </button>
            ))}
          </div>
          {form.sensitivity === 'public' ? (
            <span className="text-xs" style={{ color: '#607898' }}>편집국 전체 열람</span>
          ) : (
            <span className="text-xs font-medium" style={{ color: '#BC5028' }}>🔴 데스크·슈퍼관리자만 열람</span>
          )}
        </div>
      </div>

      {/* 기본 정보 */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: '#DCE8F4' }}>👤 기본 정보</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label style={labelStyle}>이름 <span style={{ color: '#C04040' }}>*</span> <span style={{ color: '#7E6E48', fontSize: '11px' }}>+1pt</span></label>
            <input value={form.full_name} onChange={e => set('full_name', e.target.value)}
              placeholder="홍길동" required style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>현 소속 기관 <span style={{ color: '#7E6E48', fontSize: '11px' }}>+1pt</span></label>
            <input value={form.current_organization} onChange={e => set('current_organization', e.target.value)}
              placeholder="기획재정부" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>현 직책 <span style={{ color: '#7E6E48', fontSize: '11px' }}>+1pt</span></label>
            <input value={form.current_position} onChange={e => set('current_position', e.target.value)}
              placeholder="예산실장" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>현 부서</label>
            <input value={form.current_department} onChange={e => set('current_department', e.target.value)}
              placeholder="예산실" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>생년월일 <span style={{ color: '#8AAAC8', fontSize: '11px' }}>+0.5pt</span></label>
            <input type="text" value={form.birthday} onChange={e => set('birthday', e.target.value)}
              placeholder="1970 또는 1970-03 또는 1970-03-15"
              style={inputStyle} />
            <p style={{ fontSize: '11px', color: '#607898', marginTop: '4px' }}>연도만 입력해도 됩니다</p>
          </div>
          <div>
            <label style={labelStyle}>출신 광역시도 <span style={{ color: '#8AAAC8', fontSize: '11px' }}>+0.5pt</span></label>
            <select value={form.hometown_province} onChange={e => set('hometown_province', e.target.value)}
              style={inputStyle}>
              <option value="">선택</option>
              {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>출신 시군구</label>
            <input value={form.hometown_city} onChange={e => set('hometown_city', e.target.value)}
              placeholder="강남구" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>취재 동의 (온더레코드)</label>
            <select value={form.on_record_status} onChange={e => set('on_record_status', e.target.value)}
              style={inputStyle}>
              <option value="">미지정</option>
              <option value="on_record">✅ 온더레코드 (실명 인용 가능)</option>
              <option value="background_only">🟡 백그라운드 (익명 인용만)</option>
              <option value="anonymous">🔴 오프더레코드 (인용 불가)</option>
            </select>
          </div>
        </div>
      </div>

      {/* 연락처 */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: '#DCE8F4' }}>📞 연락처</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>주 전화번호 <span style={{ color: '#7E6E48', fontSize: '11px' }}>+1pt</span></label>
            <input value={form.phone_primary} onChange={e => setWithValidation('phone_primary', e.target.value)}
              placeholder="010-0000-0000"
              style={{ ...inputStyle, borderColor: fieldErrors.phone_primary ? '#C04040' : undefined }} />
            {fieldErrors.phone_primary && <p style={{ fontSize: '11px', color: '#C04040', marginTop: '3px' }}>{fieldErrors.phone_primary}</p>}
          </div>
          <div>
            <label style={labelStyle}>보조 전화번호</label>
            <input value={form.phone_secondary} onChange={e => setWithValidation('phone_secondary', e.target.value)}
              placeholder="02-000-0000"
              style={{ ...inputStyle, borderColor: fieldErrors.phone_secondary ? '#C04040' : undefined }} />
            {fieldErrors.phone_secondary && <p style={{ fontSize: '11px', color: '#C04040', marginTop: '3px' }}>{fieldErrors.phone_secondary}</p>}
          </div>
          <div>
            <label style={labelStyle}>이메일 <span style={{ color: '#8AAAC8', fontSize: '11px' }}>+0.5pt</span></label>
            <input type="text" value={form.email_primary} onChange={e => setWithValidation('email_primary', e.target.value)}
              placeholder="name@example.com"
              style={{ ...inputStyle, borderColor: fieldErrors.email_primary ? '#C04040' : undefined }} />
            {fieldErrors.email_primary && <p style={{ fontSize: '11px', color: '#C04040', marginTop: '3px' }}>{fieldErrors.email_primary}</p>}
          </div>
          <div>
            <label style={labelStyle}>보조 이메일</label>
            <input type="text" value={form.email_secondary} onChange={e => setWithValidation('email_secondary', e.target.value)}
              placeholder="name@gmail.com"
              style={{ ...inputStyle, borderColor: fieldErrors.email_secondary ? '#C04040' : undefined }} />
            {fieldErrors.email_secondary && <p style={{ fontSize: '11px', color: '#C04040', marginTop: '3px' }}>{fieldErrors.email_secondary}</p>}
          </div>
          <div>
            <label style={labelStyle}>트위터/X</label>
            <input value={form.sns_twitter} onChange={e => set('sns_twitter', e.target.value)}
              placeholder="@username" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>페이스북</label>
            <input value={form.sns_facebook} onChange={e => set('sns_facebook', e.target.value)}
              placeholder="facebook.com/..." style={inputStyle} />
          </div>
        </div>
      </div>

      {/* 학력 */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: '#DCE8F4' }}>🎓 학력</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label style={labelStyle}>출신 고교 <span style={{ color: '#7E6E48', fontSize: '11px' }}>+1pt</span></label>
            <input value={form.high_school} onChange={e => set('high_school', e.target.value)}
              placeholder="서울고등학교" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>출신 대학 <span style={{ color: '#7E6E48', fontSize: '11px' }}>+1pt</span></label>
            <input value={form.university} onChange={e => set('university', e.target.value)}
              placeholder="서울대학교" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>학과/전공 <span style={{ color: '#8AAAC8', fontSize: '11px' }}>+0.5pt</span></label>
            <input value={form.university_major} onChange={e => set('university_major', e.target.value)}
              placeholder="경제학과" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>대학원 <span style={{ color: '#8AAAC8', fontSize: '11px' }}>+0.5pt</span></label>
            <input value={form.graduate_school} onChange={e => set('graduate_school', e.target.value)}
              placeholder="서울대 행정대학원" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>고시 / 기수</label>
            <input value={form.exam_batch} onChange={e => set('exam_batch', e.target.value)}
              placeholder="행시 36회" style={inputStyle} />
          </div>
        </div>
      </div>

      {/* 태그 */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold mb-1" style={{ color: '#DCE8F4' }}>
          🏷️ 태그 / 키워드 <span style={{ color: '#8AAAC8', fontSize: '11px', fontWeight: 400 }}>+0.5pt</span>
        </h3>
        <p className="text-xs mb-3" style={{ color: '#607898' }}>공개 정보 — 모두에게 보임</p>
        <div className="flex gap-2 mb-3">
          <input value={tagInput} onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput) } }}
            placeholder="호암회, 삼성장학금, 검찰 출신..."
            style={{ ...inputStyle, flex: 1 }} />
          <button type="button" onClick={() => addTag(tagInput)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ background: '#4A7CC0', color: 'white', border: 'none', cursor: 'pointer' }}>
            추가
          </button>
        </div>
        {form.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {form.tags.map(tag => (
              <span key={tag} className="flex items-center gap-1.5 text-sm px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(30,144,255,0.15)', color: '#4A7CC0', border: '1px solid rgba(30,144,255,0.2)' }}>
                {tag}
                <button type="button" onClick={() => set('tags', form.tags.filter(t => t !== tag))}
                  style={{ color: '#607898', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 공개 정보 */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold mb-1" style={{ color: '#DCE8F4' }}>
          📝 공개 정보
          <span className="text-xs ml-2 font-normal" style={{ color: '#3D9E6A' }}>편집국 전원 열람</span>
        </h3>
        <p className="text-xs mb-3" style={{ color: '#607898' }}>
          현직, 전문 분야, 기자와의 관계 등 — 뉴스·네이버 경력 텍스트를 붙여넣으면 학력·기수를 자동 추출합니다
        </p>
        <textarea
          value={form.public_notes}
          onChange={e => set('public_notes', e.target.value)}
          onPaste={e => handleNotesPaste(e, 'public_notes')}
          rows={6}
          placeholder="예: 경제부 출입 담당자, 예산 전문가, 인터뷰 협조적..."
          style={{ ...inputStyle, resize: 'vertical' }}
        />
        <NotesExtractBanner
          hint={notesHint?.source === 'public_notes' ? notesHint.fields : null}
          onApply={applyNotesHint}
          onDismiss={() => setNotesHint(null)}
        />
      </div>

      {/* 민감 정보 */}
      <div className="glass-card p-5" style={{ border: '1px solid rgba(255,153,0,0.2)' }}>
        <h3 className="text-sm font-semibold mb-1" style={{ color: '#DCE8F4' }}>
          🔒 민감 정보
          <span className="text-xs ml-2 font-normal" style={{ color: '#A87228' }}>차장 이상만 열람 · 기자는 승인 필요</span>
        </h3>
        <p className="text-xs mb-3" style={{ color: '#607898' }}>
          친분 관계, 개인 성향, 가족 정보 등 — 뉴스·네이버 경력 텍스트를 붙여넣으면 학력·기수를 자동 추출합니다
        </p>
        <textarea
          value={form.personal_notes}
          onChange={e => set('personal_notes', e.target.value)}
          onPaste={e => handleNotesPaste(e, 'personal_notes')}
          rows={6}
          placeholder="예: 커피 좋아함, 오후 인터뷰 선호, 딸 2명 아들 1명, 홍○○과 대학 동기..."
          style={{ ...inputStyle, resize: 'vertical', borderColor: 'rgba(255,153,0,0.3)' }}
        />
        <NotesExtractBanner
          hint={notesHint?.source === 'personal_notes' ? notesHint.fields : null}
          onApply={applyNotesHint}
          onDismiss={() => setNotesHint(null)}
        />
      </div>

      {/* 오류 */}
      {error && (
        <div className="rounded-lg p-3 text-sm"
          style={{ background: 'rgba(255,68,68,0.1)', color: '#C04040', border: '1px solid rgba(255,68,68,0.2)' }}>
          {error}
        </div>
      )}

      {/* 제출 */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => router.back()}
          className="px-5 py-2.5 rounded-lg text-sm"
          style={{ background: '#182035', color: '#8AAAC8', border: '1px solid #1A2838', cursor: 'pointer' }}>
          취소
        </button>

        <div className="flex items-center gap-3">
          {mode === 'create' && (
            <span className="text-sm" style={{ color: '#607898' }}>
              저장 시 약 +{pts}pt 예정
            </span>
          )}
          <button type="submit" disabled={submitting}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold"
            style={{
              background: submitting ? 'rgba(30,144,255,0.4)' : 'linear-gradient(135deg, #4A7CC0, #0066CC)',
              color: 'white', border: 'none',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}>
            {submitting ? '저장 중...' : mode === 'create' ? '취재원 등록' : '수정 내용 확인 →'}
          </button>
        </div>
      </div>

      {/* ── 수정 확인 모달 ─────────────────────────────────────────────────────── */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowConfirm(false) }}>
          <div
            className="relative w-full max-w-lg mx-4 rounded-2xl overflow-hidden"
            style={{ background: '#131C2C', border: '1px solid #1A2838', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>

            {/* 모달 헤더 */}
            <div className="px-6 py-4 flex items-center justify-between flex-shrink-0"
              style={{ borderBottom: '1px solid #1A2838' }}>
              <div>
                <h3 className="text-base font-bold" style={{ color: '#DCE8F4' }}>✏️ 수정 내용 확인</h3>
                <p className="text-xs mt-0.5" style={{ color: '#8AAAC8' }}>
                  아래 항목이 변경됩니다. 저장하시겠습니까?
                </p>
              </div>
              <button onClick={() => setShowConfirm(false)}
                style={{ color: '#607898', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>
                ✕
              </button>
            </div>

            {/* 변경 내역 */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
              {changedFields.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: '#8AAAC8' }}>
                  변경된 내용이 없습니다.
                </p>
              ) : (
                changedFields.map(({ key, label, before, after }) => (
                  <div key={key} className="rounded-lg p-3"
                    style={{ background: 'rgba(30,144,255,0.05)', border: '1px solid rgba(30,144,255,0.12)' }}>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: '#4A7CC0' }}>{label}</p>
                    <div className="flex items-start gap-2 text-xs">
                      <div className="flex-1 rounded px-2 py-1.5 leading-relaxed"
                        style={{ background: 'rgba(255,68,68,0.08)', color: '#C07070', borderLeft: '2px solid #C04040' }}>
                        <span style={{ color: '#C04040', fontWeight: 600, marginRight: '4px' }}>변경 전</span>
                        {before}
                      </div>
                      <span style={{ color: '#607898', marginTop: '6px', flexShrink: 0 }}>→</span>
                      <div className="flex-1 rounded px-2 py-1.5 leading-relaxed"
                        style={{ background: 'rgba(0,204,102,0.08)', color: '#88FFBB', borderLeft: '2px solid #3D9E6A' }}>
                        <span style={{ color: '#3D9E6A', fontWeight: 600, marginRight: '4px' }}>변경 후</span>
                        {after}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 모달 하단 버튼 */}
            <div className="px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0"
              style={{ borderTop: '1px solid #1A2838' }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{
                  padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                  background: 'transparent', color: '#8AAAC8',
                  border: '1px solid #1A2838', cursor: 'pointer',
                }}>
                ← 계속 수정
              </button>
              <button
                disabled={submitting || changedFields.length === 0}
                onClick={() => pendingPayload && doSave(pendingPayload)}
                style={{
                  padding: '8px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                  background: (submitting || changedFields.length === 0)
                    ? 'rgba(30,144,255,0.3)'
                    : 'linear-gradient(135deg, #4A7CC0, #0066CC)',
                  color: 'white', border: 'none',
                  cursor: (submitting || changedFields.length === 0) ? 'not-allowed' : 'pointer',
                  minWidth: '100px',
                }}>
                {submitting ? '저장 중...' : changedFields.length === 0 ? '변경 없음' : `✓ 저장 확인 (${changedFields.length}건)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </form>
  )
}
