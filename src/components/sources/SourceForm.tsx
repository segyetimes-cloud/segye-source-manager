'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Source } from '@/types/database'
import QuickFill from '@/components/sources/QuickFill'

interface SourceFormProps {
  mode: 'create' | 'edit'
  initialData?: Partial<Source>
}

// ── 완성도 점수 계산 (새 기준) ────────────────────────────────────────────────
// 기본정보 20점 + 연락처 20점 + 학력 20점 = 최대 60점 (등록 시)
// 정보(source_notes) 40점은 등록 후 별도 반영
//
// [기본정보 20점]  이름 5 · 소속 8 · 직책 5 · 생년월일 2
// [연락처  20점]  전화(주) 13 · 이메일(주) 7
// [학력    20점]  대학 8 · 고교 6 · 전공 3 · 대학원 2 · 고시기수 1
export function calcBaseScore(data: Partial<Record<string, unknown>>): number {
  let s = 0
  // 기본정보
  if (data.full_name)             s += 5
  if (data.current_organization)  s += 8
  if (data.current_position)      s += 5
  if (data.birthday)              s += 2
  // 연락처
  if (data.phone_primary)         s += 13
  if (data.email_primary)         s += 7
  // 학력
  if (data.university)            s += 8
  if (data.high_school)           s += 6
  if (data.university_major)      s += 3
  if (data.graduate_school)       s += 2
  if (data.exam_batch)            s += 1
  return s   // 최대 60
}

// 정보 점수: 작성자 수 기준 (별도 계산 필요)
// authors: 정보를 입력한 고유 작성자 수
export function calcNoteScore(authorCount: number): number {
  if (authorCount >= 2) return 40
  if (authorCount === 1) return 20
  return 0
}

export function calcTotalScore(data: Partial<Record<string, unknown>>, authorCount = 0): number {
  return calcBaseScore(data) + calcNoteScore(authorCount)
}

// 폼 전용 별칭 (하위 호환)
function calcScore(data: Partial<Record<string, unknown>>): number {
  return calcBaseScore(data)
}

// 포인트 계산 (등록 보상용)
function calcFieldPoints(data: Partial<Record<string, unknown>>): number {
  const s = calcBaseScore(data)
  if (s >= 55) return 30
  if (s >= 35) return 15
  return 5
}

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
  visibility: '공개 범위', sensitivity: '민감도', personal_notes: '정보(내 메모)',
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

export default function SourceForm({ mode, initialData }: SourceFormProps) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingPayload, setPendingPayload] = useState<Record<string, unknown> | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

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
    visibility: initialData?.visibility ?? 'personal' as 'personal' | 'shared',
    sensitivity: initialData?.sensitivity ?? 'public' as 'public' | 'private',
    personal_notes: initialData?.personal_notes ?? '',
    sns_twitter: (initialData?.sns_links as Record<string, string> | undefined)?.twitter ?? '',
    sns_facebook: (initialData?.sns_links as Record<string, string> | undefined)?.facebook ?? '',
  })

  const score = calcScore(form)
  const pts = calcFieldPoints(form)
  const scoreColor = score >= 55 ? '#3D9E6A' : score >= 35 ? '#A87228' : '#C04040'
  const isPersonal = form.visibility === 'personal'

  function set(field: string, value: unknown) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // 명함 OCR / 연락처 가져오기 결과를 폼에 채움
  function handleCardExtracted(data: { [key: string]: string | null | undefined }) {
    setForm(prev => ({
      ...prev,
      full_name:            data.full_name            ?? prev.full_name,
      current_organization: data.current_organization ?? prev.current_organization,
      current_position:     data.current_position     ?? prev.current_position,
      current_department:   data.department           ?? prev.current_department,
      phone_primary:        data.phone                ?? prev.phone_primary,
      phone_secondary:      data.office_phone         ?? prev.phone_secondary,
      email_primary:        data.email                ?? prev.email_primary,
    }))
  }

  // QuickFill 전용 (이름·소속·직책·전화·이메일)
  function handleQuickFill(data: { full_name?: string; current_organization?: string; current_position?: string; phone?: string; email?: string }) {
    setForm(prev => ({
      ...prev,
      full_name:            data.full_name            ?? prev.full_name,
      current_organization: data.current_organization ?? prev.current_organization,
      current_position:     data.current_position     ?? prev.current_position,
      phone_primary:        data.phone                ?? prev.phone_primary,
      email_primary:        data.email                ?? prev.email_primary,
    }))
  }

  function addTag(tag: string) {
    const trimmed = tag.trim()
    if (trimmed && !form.tags.includes(trimmed)) {
      set('tags', [...form.tags, trimmed])
    }
    setTagInput('')
  }

  function buildPayload() {
    const payload: Record<string, unknown> = {
      ...form,
      // 개인 목록은 sensitivity 항상 public
      sensitivity: isPersonal ? 'public' : form.sensitivity,
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
    // 형식 오류가 있으면 제출 차단
    const errs: Record<string, string> = {}
    const phoneErr1 = validatePhone(form.phone_primary)
    const phoneErr2 = validatePhone(form.phone_secondary)
    const emailErr1 = validateEmail(form.email_primary)
    const emailErr2 = validateEmail(form.email_secondary)
    if (phoneErr1) errs['phone_primary'] = phoneErr1
    if (phoneErr2) errs['phone_secondary'] = phoneErr2
    if (emailErr1) errs['email_primary'] = emailErr1
    if (emailErr2) errs['email_secondary'] = emailErr2
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs)
      setError('입력 형식을 확인해 주세요.')
      return
    }
    setError('')

    const payload = buildPayload()

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

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? '저장에 실패했습니다.')
      setSubmitting(false)
      setShowConfirm(false)
      return
    }

    router.push(mode === 'create' ? `/sources/${data.id}` : `/sources/${initialData?.id}`)
    router.refresh()
  }

  // 편집 확인 모달 - 변경 필드 diff 계산
  const changedFields: { key: string; label: string; before: string; after: string }[] = []
  if (mode === 'edit' && initialData && pendingPayload) {
    const checkKeys = [
      'full_name', 'current_organization', 'current_position', 'current_department',
      'phone_primary', 'phone_secondary', 'email_primary', 'email_secondary',
      'birthday', 'hometown_province', 'hometown_city',
      'high_school', 'university', 'university_major', 'graduate_school',
      'exam_batch', 'visibility', 'sensitivity', 'personal_notes',
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
    color: '#CDD5E0',
    borderRadius: '8px',
    padding: '9px 12px',
    fontSize: '14px',
    width: '100%',
  }

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px', color: '#687898' }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* 빠른 입력 */}
      {mode === 'create' && (
        <div>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#687898', marginBottom: '8px' }}>
            ⚡ 빠른 입력 <span style={{ fontWeight: 400, color: '#485870' }}>(선택)</span>
          </p>
          <QuickFill onFill={handleQuickFill} />
        </div>
      )}

      {/* 완성도 게이지 */}
      <div className="glass-card px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium flex-shrink-0" style={{ color: '#687898' }}>완성도</span>
          <div className="flex-1 h-1.5 rounded-full" style={{ background: '#1A2838' }}>
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${score}%`, background: scoreColor }} />
          </div>
          <span className="text-sm font-bold flex-shrink-0" style={{ color: scoreColor }}>{score}점</span>
          <span className="text-xs flex-shrink-0" style={{ color: '#485870' }}>
            +{pts}pt
          </span>
        </div>
      </div>

      {/* 공개 범위 */}
      <div className="glass-card px-4 py-3">
        <div className={`flex items-center gap-3 ${!isPersonal ? 'flex-wrap' : ''}`}>
          <span className="text-xs font-medium flex-shrink-0" style={{ color: '#687898' }}>🔒 공개 설정</span>

          {/* 목록 구분 토글 */}
          <div className="flex rounded-lg p-0.5 flex-shrink-0" style={{ background: '#0D1520', border: '1px solid #1A2838' }}>
            {[
              { value: 'personal', label: '🔒 내 목록' },
              { value: 'shared', label: '🌐 편집국 공유' },
            ].map(opt => (
              <button key={opt.value} type="button" onClick={() => set('visibility', opt.value)}
                className="px-3 py-1 rounded-md text-xs font-medium transition-all"
                style={{
                  background: form.visibility === opt.value ? '#4A7CC0' : 'transparent',
                  color: form.visibility === opt.value ? 'white' : '#687898',
                }}>
                {opt.label}
              </button>
            ))}
          </div>

          {/* 민감도 토글 — 공유일 때만 */}
          {!isPersonal && (
            <div className="flex rounded-lg p-0.5 flex-shrink-0" style={{ background: '#0D1520', border: '1px solid #1A2838' }}>
              {[
                { value: 'public', label: '✅ 공개' },
                { value: 'private', label: '🔴 민감' },
              ].map(opt => (
                <button key={opt.value} type="button" onClick={() => set('sensitivity', opt.value)}
                  className="px-3 py-1 rounded-md text-xs font-medium transition-all"
                  style={{
                    background: form.sensitivity === opt.value
                      ? (opt.value === 'private' ? '#CC3300' : '#3D9E6A')
                      : 'transparent',
                    color: form.sensitivity === opt.value ? 'white' : '#687898',
                  }}>
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* 인라인 안내 */}
          {isPersonal ? (
            <span className="text-xs" style={{ color: '#485870' }}>나만 열람</span>
          ) : form.sensitivity === 'public' ? (
            <span className="text-xs" style={{ color: '#485870' }}>편집국 전체 열람</span>
          ) : (
            <span className="text-xs font-medium" style={{ color: '#BC5028' }}>🔴 데스크·슈퍼관리자만 열람</span>
          )}
        </div>
      </div>

      {/* 기본 정보 */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: '#CDD5E0' }}>👤 기본 정보</h3>
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
            <label style={labelStyle}>생년월일 <span style={{ color: '#687898', fontSize: '11px' }}>+0.5pt</span></label>
            <input type="text" value={form.birthday} onChange={e => set('birthday', e.target.value)}
              placeholder="1970 또는 1970-03 또는 1970-03-15"
              style={inputStyle} />
            <p style={{ fontSize: '11px', color: '#485870', marginTop: '4px' }}>연도만 입력해도 됩니다</p>
          </div>
          <div>
            <label style={labelStyle}>출신 광역시도 <span style={{ color: '#687898', fontSize: '11px' }}>+0.5pt</span></label>
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
        </div>
      </div>

      {/* 연락처 */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: '#CDD5E0' }}>📞 연락처</h3>
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
            <label style={labelStyle}>이메일 <span style={{ color: '#687898', fontSize: '11px' }}>+0.5pt</span></label>
            <input type="email" value={form.email_primary} onChange={e => setWithValidation('email_primary', e.target.value)}
              placeholder="name@example.com"
              style={{ ...inputStyle, borderColor: fieldErrors.email_primary ? '#C04040' : undefined }} />
            {fieldErrors.email_primary && <p style={{ fontSize: '11px', color: '#C04040', marginTop: '3px' }}>{fieldErrors.email_primary}</p>}
          </div>
          <div>
            <label style={labelStyle}>보조 이메일</label>
            <input type="email" value={form.email_secondary} onChange={e => setWithValidation('email_secondary', e.target.value)}
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
        <h3 className="text-sm font-semibold mb-4" style={{ color: '#CDD5E0' }}>🎓 학력</h3>
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
            <label style={labelStyle}>학과/전공 <span style={{ color: '#687898', fontSize: '11px' }}>+0.5pt</span></label>
            <input value={form.university_major} onChange={e => set('university_major', e.target.value)}
              placeholder="경제학과" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>대학원 <span style={{ color: '#687898', fontSize: '11px' }}>+0.5pt</span></label>
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
        <h3 className="text-sm font-semibold mb-1" style={{ color: '#CDD5E0' }}>
          🏷️ 태그 / 키워드 <span style={{ color: '#687898', fontSize: '11px', fontWeight: 400 }}>+0.5pt</span>
        </h3>
        <p className="text-xs mb-3" style={{ color: '#485870' }}>공개 정보 — 모두에게 보임</p>
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
                  style={{ color: '#485870', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 정보 (개인 메모) */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold mb-1" style={{ color: '#CDD5E0' }}>
          📝 정보
          {!isPersonal && <span className="text-xs ml-2 font-normal" style={{ color: '#485870' }}>나에게만 보이는 메모</span>}
        </h3>
        <p className="text-xs mb-3" style={{ color: '#485870' }}>
          친분 관계, 성격, 인터뷰 팁 등 — 상세한 정보를 추가하면 취재원 상세 페이지에서 +10pt
        </p>
        <textarea
          value={form.personal_notes}
          onChange={e => set('personal_notes', e.target.value)}
          rows={4}
          placeholder="예: 커피 좋아함, 오후 인터뷰 선호, 딸 2명 아들 1명, 홍○○과 대학 동기..."
          style={{ ...inputStyle, resize: 'vertical' }}
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
          style={{ background: '#182035', color: '#687898', border: '1px solid #1A2838', cursor: 'pointer' }}>
          취소
        </button>

        <div className="flex items-center gap-3">
          {mode === 'create' && (
            <span className="text-sm" style={{ color: '#485870' }}>
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
                <h3 className="text-base font-bold" style={{ color: '#CDD5E0' }}>✏️ 수정 내용 확인</h3>
                <p className="text-xs mt-0.5" style={{ color: '#687898' }}>
                  아래 항목이 변경됩니다. 저장하시겠습니까?
                </p>
              </div>
              <button onClick={() => setShowConfirm(false)}
                style={{ color: '#485870', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}>
                ✕
              </button>
            </div>

            {/* 변경 내역 */}
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-3">
              {changedFields.length === 0 ? (
                <p className="text-sm text-center py-6" style={{ color: '#687898' }}>
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
                      <span style={{ color: '#485870', marginTop: '6px', flexShrink: 0 }}>→</span>
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
                  background: 'transparent', color: '#687898',
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
