'use client'

import { useState, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Source, SourcePosition, SourceEditHistory } from '@/types/database'
import SecureContentViewer from '@/components/common/SecureContentViewer'
import ProtectedText from '@/components/common/ProtectedText'
import SecureContainer from '@/components/common/SecureContainer'
import SourceCopyLogs from '@/components/sources/SourceCopyLogs'
import ContactLogs from '@/components/sources/ContactLogs'
import { extractEducationFields } from '@/components/sources/QuickFill'

interface SourceNote {
  id: string
  content: string
  is_sensitive: boolean
  created_at: string
  profiles: { id: string; full_name: string; department: string | null } | null
}

interface RelatedReport {
  id: string
  title: string
  created_at: string
  profiles: { full_name: string } | null
}

interface Props {
  source: Source & {
    profiles?: { full_name: string; email: string; department: string | null }
    source_positions?: SourcePosition[]
    source_edit_history?: SourceEditHistory[]
  }
  positions: SourcePosition[]
  editHistory: SourceEditHistory[]
  avgRating: number | null
  myRating: number | null
  hasPrivateAccess: boolean
  isOwner: boolean
  isAdmin: boolean
  isDeputyOrAbove?: boolean
  userRole?: string
  canSeePersonalNotes?: boolean
  userId: string
  userFullName: string
  userDepartment: string | null
  initialNotes: SourceNote[]
  lockedNotesCount: number
  relatedReports?: RelatedReport[]
  personalNotesPreview?: string | null
}

const AUTO_FIELD_KO: Record<string, string> = {
  exam_batch: '고시기수', university: '대학', university_major: '전공',
  graduate_school: '대학원', high_school: '고교',
  birthday: '생년월일', hometown_province: '출신(광역)', hometown_city: '출신(시군구)',
  current_organization: '소속', current_position: '직책',
}

const FIELD_LABELS: Record<string, string> = {
  full_name: '이름', current_organization: '소속', current_position: '직책',
  current_department: '부서', phone_primary: '전화(주)', phone_secondary: '전화(보조)',
  email_primary: '이메일(주)', email_secondary: '이메일(보조)', birthday: '생년월일',
  university: '대학', high_school: '고교', exam_batch: '고시기수',
  hometown_province: '출신지역', visibility: '공개범위', sensitivity: '민감도',
  on_record_status: '취재 동의', public_notes: '공개 정보', personal_notes: '민감 정보',
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 90 ? '#3D9E6A' : score >= 60 ? '#A87228' : '#C04040'
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 rounded-full" style={{ background: '#DDE5EF' }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-sm font-bold" style={{ color }}>{score}%</span>
    </div>
  )
}

function StarRating({ rating, onRate }: { rating: number | null; onRate: (r: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button key={star} type="button" onClick={() => onRate(star)}
          onMouseEnter={() => setHover(star)} onMouseLeave={() => setHover(0)}
          style={{ fontSize: '20px', background: 'none', border: 'none', cursor: 'pointer',
            color: star <= (hover || rating || 0) ? '#7E6E48' : '#DDE5EF' }}>
          ★
        </button>
      ))}
    </div>
  )
}

// ── 정보 카드 (작성자 헤더 포함) ─────────────────────────────────────────────
function NoteItem({ note, canDelete, onDelete, sourceId, userId, userFullName, userDepartment }: {
  note: SourceNote
  canDelete: boolean
  onDelete: (id: string) => void
  sourceId: string
  userId: string
  userFullName: string
  userDepartment: string | null
}) {
  const authorName = note.profiles?.full_name ?? '알 수 없음'
  const initial = authorName.slice(-2, -1) || authorName[0] || '?'
  const dateStr = new Date(note.created_at).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="rounded-xl overflow-hidden group"
      style={{
        border: `1px solid ${note.is_sensitive ? 'rgba(255,153,0,0.35)' : '#DDE5EF'}`,
        background: note.is_sensitive ? 'rgba(255,153,0,0.04)' : '#FFFFFF',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
      {/* 카드 헤더: 작성자 정보 */}
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{
          background: note.is_sensitive ? 'rgba(255,153,0,0.07)' : '#F5F8FC',
          borderBottom: `1px solid ${note.is_sensitive ? 'rgba(255,153,0,0.2)' : '#DDE5EF'}`,
        }}>
        <div className="flex items-center gap-2">
          {/* 아바타 */}
          <div style={{
            width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
            background: note.is_sensitive ? 'rgba(255,153,0,0.2)' : 'rgba(30,144,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 700,
            color: note.is_sensitive ? '#A87228' : '#4A7CC0',
            border: `1px solid ${note.is_sensitive ? 'rgba(255,153,0,0.4)' : 'rgba(30,144,255,0.35)'}`,
          }}>
            {initial}
          </div>
          <div>
            <span className="text-xs font-semibold" style={{ color: note.is_sensitive ? '#A87228' : '#374151' }}>
              {authorName}
            </span>
            {note.profiles?.department && (
              <span className="text-xs ml-1.5" style={{ color: '#7A8A9E' }}>
                {note.profiles.department}
              </span>
            )}
          </div>
          {note.is_sensitive && (
            <span className="text-xs px-1.5 py-0.5 rounded font-semibold"
              style={{ background: 'rgba(255,153,0,0.15)', color: '#A87228', border: '1px solid rgba(255,153,0,0.3)' }}>
              ⚠️ 민감
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: '#7A8A9E' }}>{dateStr}</span>
          {canDelete && (
            <button type="button" onClick={() => onDelete(note.id)}
              className="text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: '#C04040', background: 'none', border: 'none', cursor: 'pointer' }}>
              삭제
            </button>
          )}
        </div>
      </div>
      {/* 카드 본문 */}
      <SecureContainer
        className="px-4 py-3"
        disabled={!note.is_sensitive}
      >
        <SecureContentViewer
          apiPath={`/api/sources/${sourceId}/copy-log`}
          content={note.content}
          userId={userId}
          userFullName={userFullName}
          userDepartment={userDepartment}
        />
      </SecureContainer>
    </div>
  )
}

// ── 통합 정보 (중복 제거) ─────────────────────────────────────────────────────
// 모든 노트의 문장을 수집 → 정규화 → 중복 제거 → 통합 텍스트 생성
function buildUnifiedNotes(notes: SourceNote[]): string {
  if (notes.length === 0) return ''

  // 문장 분리: '. ', '.\n', '\n', '！', '。' 등
  const sentenceSet = new Set<string>()
  const ordered: string[] = []   // 순서 유지

  for (const note of notes) {
    // 줄바꿈·마침표·느낌표 기준으로 분리
    const raw = note.content
      .split(/(?<=[.。!！?？\n])\s*/)
      .flatMap(s => s.split('\n'))
      .map(s => s.trim())
      .filter(s => s.length > 0)

    for (const sentence of raw) {
      // 정규화: 끝 마침표 제거, 공백 통일, 소문자화 (한국어는 소문자 무의미하지만)
      const normalized = sentence.replace(/[.。!！?？]+$/, '').replace(/\s+/g, ' ').trim()
      if (!normalized) continue
      if (!sentenceSet.has(normalized)) {
        sentenceSet.add(normalized)
        ordered.push(sentence.trim())
      }
    }
  }

  return ordered.join(' · ')
}

const EMPTY_POS = { organization: '', department: '', position: '', rank: '', started_at: '', ended_at: '', is_current: false, change_note: '' }

export default function SourceDetailClient({
  source, positions: initialPositions, editHistory,
  avgRating, myRating, hasPrivateAccess,
  isOwner, isAdmin, isDeputyOrAbove = false, userRole = 'reporter',
  canSeePersonalNotes = false,
  userId, userFullName, userDepartment,
  initialNotes, lockedNotesCount,
  relatedReports = [],
  personalNotesPreview = null,
}: Props) {
  const router = useRouter()
  const [showHistory, setShowHistory] = useState(false)
  const [rating, setRating] = useState(myRating)
  const [approvalReason, setApprovalReason] = useState('')
  const [showApprovalForm, setShowApprovalForm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [positions, setPositions] = useState(initialPositions)
  const [showPosForm, setShowPosForm] = useState(false)
  const [posForm, setPosForm] = useState(EMPTY_POS)
  const [posSubmitting, setPosSubmitting] = useState(false)
  const [editingPosId, setEditingPosId] = useState<string | null>(null)
  const [editPosForm, setEditPosForm] = useState(EMPTY_POS)
  const [editPosSubmitting, setEditPosSubmitting] = useState(false)
  const [deletingPosId, setDeletingPosId] = useState<string | null>(null)
  const [notes, setNotes] = useState<SourceNote[]>(initialNotes)
  const [extractApplied, setExtractApplied] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [noteSensitive, setNoteSensitive] = useState(false)
  const [noteSubmitting, setNoteSubmitting] = useState(false)
  const [noteError, setNoteError] = useState('')
  const [currentVisibility, setCurrentVisibility] = useState<'personal' | 'shared'>(source.visibility as 'personal' | 'shared')
  const [currentSensitivity, setCurrentSensitivity] = useState<'public' | 'private'>(source.sensitivity as 'public' | 'private')
  const [visibilityChanging, setVisibilityChanging] = useState(false)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [fieldSaving, setFieldSaving] = useState(false)
  const [fieldSaveError, setFieldSaveError] = useState('')

  const noteFormRef = useRef<HTMLFormElement>(null)

  const canEdit = isOwner || isAdmin
  // 직책 이력: 공유 취재원이면 모든 로그인 사용자가 관리 가능 (직책/소속은 공개 정보)
  const canEditPositions = canEdit || source.visibility === 'shared'
  const showPrivate = hasPrivateAccess || isOwner

  // 정보(source_notes)와 notes 필드에서 구조화 가능한 항목 자동 감지
  const autoExtractFields = useMemo(() => {
    if (!canEdit || extractApplied) return null
    const texts: string[] = []
    if (source.personal_notes) texts.push(source.personal_notes)
    if (source.public_notes) texts.push(source.public_notes)
    for (const note of initialNotes) texts.push(note.content)
    const combined = texts.join('\n')
    if (combined.length < 15) return null
    const ex = extractEducationFields(combined)
    const fillable: Record<string, string> = {}
    if (ex.exam_batch            && !source.exam_batch)            fillable.exam_batch            = ex.exam_batch
    if (ex.university            && !source.university)            fillable.university            = ex.university
    if (ex.university_major      && !source.university_major)      fillable.university_major      = ex.university_major
    if (ex.graduate_school       && !source.graduate_school)       fillable.graduate_school       = ex.graduate_school
    if (ex.high_school           && !source.high_school)           fillable.high_school           = ex.high_school
    if (ex.birthday              && !source.birthday)              fillable.birthday              = ex.birthday
    if (ex.hometown_province     && !source.hometown_province)     fillable.hometown_province     = ex.hometown_province
    if (ex.hometown_city         && !source.hometown_city)         fillable.hometown_city         = ex.hometown_city
    if (ex.current_organization  && !source.current_organization)  fillable.current_organization  = ex.current_organization
    if (ex.current_position      && !source.current_position)      fillable.current_position      = ex.current_position
    return Object.keys(fillable).length > 0 ? fillable : null
  }, [source, initialNotes, canEdit, extractApplied]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAutoExtract() {
    if (!autoExtractFields) return
    setExtracting(true)
    const res = await fetch(`/api/sources/${source.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(autoExtractFields),
    })
    if (res.ok) {
      setExtractApplied(true)
      router.refresh()
    }
    setExtracting(false)
  }

  async function handleFieldSave(field: string) {
    if (!editingValue.trim()) { setEditingField(null); return }
    setFieldSaving(true)
    setFieldSaveError('')
    try {
      const res = await fetch(`/api/sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: editingValue.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setFieldSaveError(data.error ?? '저장 실패'); return }
      setEditingField(null)
      setEditingValue('')
      router.refresh()
    } catch {
      setFieldSaveError('오류가 발생했습니다.')
    } finally {
      setFieldSaving(false)
    }
  }

  async function handleMoveToPublic() {
    if (!editingValue.trim()) return
    setFieldSaving(true)
    setFieldSaveError('')
    try {
      // 기존 공개 정보에 이어붙이기
      const merged = source.public_notes
        ? source.public_notes + '\n' + editingValue.trim()
        : editingValue.trim()
      const res = await fetch(`/api/sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_notes: merged, personal_notes: null }),
      })
      const data = await res.json()
      if (!res.ok) { setFieldSaveError(data.error ?? '저장 실패'); return }
      setEditingField(null)
      setEditingValue('')
      router.refresh()
    } catch {
      setFieldSaveError('오류가 발생했습니다.')
    } finally {
      setFieldSaving(false)
    }
  }

  async function handleAddPosition(e: React.FormEvent) {
    e.preventDefault()
    if (!posForm.organization || !posForm.position || !posForm.started_at) return
    setPosSubmitting(true)
    const res = await fetch(`/api/sources/${source.id}/positions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(posForm),
    })
    if (res.ok) {
      const newPos = await res.json()
      if (posForm.is_current) {
        setPositions(prev => [newPos, ...prev.map(p => ({ ...p, is_current: false }))])
      } else {
        setPositions(prev => [...prev, newPos])
      }
      setPosForm(EMPTY_POS)
      setShowPosForm(false)
      router.refresh()
    }
    setPosSubmitting(false)
  }

  async function handleEditPosition(posId: string) {
    setEditPosSubmitting(true)
    const res = await fetch(`/api/sources/${source.id}/positions?posId=${posId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editPosForm),
    })
    if (res.ok) {
      const updated = await res.json()
      setPositions(prev => prev.map(p => p.id === posId ? updated : p))
      setEditingPosId(null)
      router.refresh()
    }
    setEditPosSubmitting(false)
  }

  async function handleDeletePosition(posId: string) {
    setDeletingPosId(posId)
    const res = await fetch(`/api/sources/${source.id}/positions?posId=${posId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setPositions(prev => prev.filter(p => p.id !== posId))
      router.refresh()
    }
    setDeletingPosId(null)
  }

  async function handleRate(r: number) {
    setRating(r)
    await fetch(`/api/sources/${source.id}/rate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating: r }),
    })
    router.refresh()
  }

  async function handleApprovalRequest() {
    if (!approvalReason.trim()) return
    const res = await fetch('/api/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source_id: source.id, reason: approvalReason }),
    })
    if (res.ok) {
      setShowApprovalForm(false)
      alert('열람 신청이 완료되었습니다. 데스크 승인 후 조회 가능합니다.')
    }
  }

  // 부장+: 직접 삭제
  async function handleDelete() {
    if (!confirm(`"${source.full_name}" 취재원을 삭제하시겠습니까?\n삭제 후 복구가 불가능합니다.`)) return
    setDeleting(true)
    await fetch(`/api/sources/${source.id}`, { method: 'DELETE' })
    router.push('/sources')
  }

  // 기자·차장: 삭제 요청 — 부장 전원에게 알림 발송
  async function handleDeletionRequest() {
    if (!confirm(`"${source.full_name}" 취재원 삭제를 부장에게 요청하시겠습니까?`)) return
    setDeleting(true)
    const res = await fetch(`/api/sources/${source.id}/deletion-request`, { method: 'POST' })
    if (res.ok) {
      alert('삭제 요청이 접수됐습니다. 부장 확인 후 처리됩니다.')
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? '요청 중 오류가 발생했습니다.')
    }
    setDeleting(false)
  }

  async function handleVisibilityChange(newVisibility: 'personal' | 'shared') {
    if (newVisibility === currentVisibility) return
    const confirmMsg = newVisibility === 'shared'
      ? `"${source.full_name}"을 편집국 공유 목록으로 이동하시겠습니까?\n다른 기자들도 이 취재원을 볼 수 있게 됩니다.`
      : `"${source.full_name}"을 내 목록(비공개)으로 이동하시겠습니까?\n다른 기자들이 더 이상 볼 수 없게 됩니다.`
    if (!confirm(confirmMsg)) return
    setVisibilityChanging(true)
    const payload: Record<string, string> = { visibility: newVisibility }
    if (newVisibility === 'personal') payload.sensitivity = 'public'
    const res = await fetch(`/api/sources/${source.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      setCurrentVisibility(newVisibility)
      if (newVisibility === 'personal') setCurrentSensitivity('public')
      router.refresh()
    }
    setVisibilityChanging(false)
  }

  async function handleSensitivityChange(newSensitivity: 'public' | 'private') {
    if (newSensitivity === currentSensitivity) return
    setVisibilityChanging(true)
    const res = await fetch(`/api/sources/${source.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sensitivity: newSensitivity }),
    })
    if (res.ok) {
      setCurrentSensitivity(newSensitivity)
      router.refresh()
    }
    setVisibilityChanging(false)
  }

  async function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!noteContent.trim()) return
    setNoteSubmitting(true)
    setNoteError('')
    try {
      const res = await fetch(`/api/sources/${source.id}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: noteContent.trim(), is_sensitive: noteSensitive }),
      })
      let data: Record<string, unknown> = {}
      try {
        data = await res.json()
      } catch {
        setNoteError(`서버 오류 (${res.status}). 잠시 후 다시 시도해 주세요.`)
        return
      }
      if (!res.ok) {
        setNoteError((data.error as string) ?? '저장에 실패했습니다.')
        return
      }
      setNotes(prev => [...prev, data as unknown as SourceNote])
      setNoteContent('')
      setNoteSensitive(false)
    } catch {
      setNoteError('네트워크 오류가 발생했습니다. 인터넷 연결을 확인해 주세요.')
    } finally {
      setNoteSubmitting(false)
    }
  }

  async function handleDeleteNote(noteId: string) {
    if (!confirm('이 정보를 삭제하시겠습니까?')) return
    const res = await fetch(`/api/sources/${source.id}/notes?note_id=${noteId}`, { method: 'DELETE' })
    if (res.ok) {
      setNotes(prev => prev.filter(n => n.id !== noteId))
    }
  }

  // Canvas로 렌더링할 민감 필드 목록 (텍스트 긁기·DOM 추출 방지)
  const CANVAS_FIELDS = new Set(['📞', '📧', '🎂', '📍'])

  const infoCard = (label: string, value: string | null | undefined, icon?: string) => {
    if (!value) return null
    const isPhone = icon === '📞'
    const isEmail = icon === '📧'
    const href = isPhone ? `tel:${value.replace(/\s/g, '')}` : isEmail ? `mailto:${value}` : null
    const useCanvas = !!icon && CANVAS_FIELDS.has(icon)

    return (
      <div className="flex flex-col gap-1 secure-field">
        <span className="text-xs" style={{ color: '#7A8A9E' }}>{icon} {label}</span>
        {useCanvas ? (
          <ProtectedText
            text={value}
            href={href ?? undefined}
            fontSize={14}
            fontWeight={500}
            color={isPhone || isEmail ? '#4A7CC0' : '#1C2B3A'}
          />
        ) : (
          <span className="text-sm font-medium" style={{ color: '#1C2B3A' }}>{value}</span>
        )}
      </div>
    )
  }

  return (
    <div className="content-page max-w-4xl mx-auto space-y-6">

      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold"
            style={{ background: 'linear-gradient(135deg, rgba(30,144,255,0.2), rgba(0,212,255,0.1))',
              border: '1px solid rgba(30,144,255,0.3)', color: '#4A7CC0' }}>
            {source.full_name[0]}
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#1C2B3A' }}>
              {source.full_name}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: '#526070' }}>
              {source.current_organization}
              {source.current_position && ` · ${source.current_position}`}
              {source.current_department && ` · ${source.current_department}`}
            </p>
            {/* 배지 한 줄: 공개범위 · 민감도 · 완성도 · 취재동의 */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">

              {/* 공개범위 — 클릭 시 토글 (소유자/관리자) */}
              {canEdit ? (
                <button type="button" disabled={visibilityChanging}
                  onClick={() => handleVisibilityChange(currentVisibility === 'personal' ? 'shared' : 'personal')}
                  title="클릭하여 공개 설정 변경"
                  style={{
                    fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '12px',
                    border: 'none', cursor: visibilityChanging ? 'wait' : 'pointer',
                    background: currentVisibility === 'shared' ? 'rgba(61,158,106,0.12)' : 'rgba(30,144,255,0.1)',
                    color: currentVisibility === 'shared' ? '#3D9E6A' : '#4A7CC0',
                  }}>
                  {currentVisibility === 'shared' ? '🌐 편집국 공유' : '🔒 내 목록'}
                </button>
              ) : (
                <span style={{
                  fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '12px',
                  background: currentVisibility === 'shared' ? 'rgba(61,158,106,0.1)' : 'rgba(30,144,255,0.08)',
                  color: currentVisibility === 'shared' ? '#3D9E6A' : '#526070',
                }}>
                  {currentVisibility === 'shared' ? '🌐 공유' : '🔒 개인'}
                </span>
              )}

              {/* 민감도 — 클릭 시 토글 (공유 목록 + 소유자/관리자) */}
              {currentVisibility === 'shared' && canEdit && (
                <button type="button" disabled={visibilityChanging}
                  onClick={() => handleSensitivityChange(currentSensitivity === 'public' ? 'private' : 'public')}
                  title="클릭하여 민감도 변경"
                  style={{
                    fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '12px',
                    border: 'none', cursor: visibilityChanging ? 'wait' : 'pointer',
                    background: currentSensitivity === 'private' ? 'rgba(255,153,0,0.12)' : 'rgba(61,158,106,0.12)',
                    color: currentSensitivity === 'private' ? '#A87228' : '#3D9E6A',
                  }}>
                  {currentSensitivity === 'private' ? '⚠️ 민감' : '✅ 공개'}
                </button>
              )}

              {/* 열람 전용 (비소유자) */}
              {currentVisibility === 'shared' && !canEdit && (
                <span style={{
                  fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '12px',
                  background: currentSensitivity === 'private' ? 'rgba(255,153,0,0.1)' : 'rgba(61,158,106,0.1)',
                  color: currentSensitivity === 'private' ? '#A87228' : '#3D9E6A',
                }}>
                  {currentSensitivity === 'private' ? '⚠️ 민감' : '✅ 공개'}
                </span>
              )}

              <ScoreBadge score={source.completeness_score} />

              {source.on_record_status && (() => {
                const s = source.on_record_status
                const cfg = s === 'on_record'
                  ? { icon: '✅', label: '온더레코드', bg: 'rgba(61,158,106,0.12)', color: '#3D9E6A', border: 'rgba(61,158,106,0.3)' }
                  : s === 'background_only'
                  ? { icon: '🟡', label: '백그라운드', bg: 'rgba(184,148,40,0.12)', color: '#A87228', border: 'rgba(184,148,40,0.3)' }
                  : { icon: '🔴', label: '오프더레코드', bg: 'rgba(192,64,64,0.12)', color: '#C04040', border: 'rgba(192,64,64,0.3)' }
                return (
                  <span style={{
                    fontSize: '11px', fontWeight: 600, padding: '3px 9px', borderRadius: '12px',
                    background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                  }}>
                    {cfg.icon} {cfg.label}
                  </span>
                )
              })()}
            </div>
          </div>
        </div>

        {/* 닫기 — 목록으로 돌아가기 (상단 우측 고정) */}
        <button
          type="button"
          onClick={() => router.push('/sources')}
          title="목록으로 돌아가기"
          style={{
            width: '30px', height: '30px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.04)', border: '1px solid #DDE5EF',
            color: '#94A3B8', cursor: 'pointer', fontSize: '16px',
            lineHeight: 1, flexShrink: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(192,64,64,0.08)'
            e.currentTarget.style.borderColor = 'rgba(192,64,64,0.3)'
            e.currentTarget.style.color = '#C04040'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(0,0,0,0.04)'
            e.currentTarget.style.borderColor = '#DDE5EF'
            e.currentTarget.style.color = '#94A3B8'
          }}
        >
          ✕
        </button>
      </div>

      {/* 정보에서 구조화 가능한 항목 자동 감지 배너 */}
      {canEdit && autoExtractFields && (
        <div style={{
          padding: '12px 16px', borderRadius: '10px',
          background: 'rgba(61,158,106,0.07)', border: '1px solid rgba(61,158,106,0.3)',
          display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: '14px', color: '#3D9E6A' }}>✦</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: '#3D9E6A', margin: 0 }}>
              정보란에서 학력·소속 등 구조화 가능한 항목이 발견됐습니다
            </p>
            <p style={{ fontSize: '11px', color: '#7A8A9E', marginTop: '2px' }}>
              {Object.entries(autoExtractFields)
                .map(([k, v]) => `${AUTO_FIELD_KO[k] ?? k}: ${v}`)
                .join(' · ')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button type="button" onClick={handleAutoExtract} disabled={extracting}
              style={{ fontSize: '12px', fontWeight: 600, padding: '6px 14px', borderRadius: '6px',
                background: extracting ? '#2A5A3A' : '#3D9E6A', color: '#fff', border: 'none', cursor: 'pointer' }}>
              {extracting ? '적용 중...' : '해당 필드에 적용'}
            </button>
            <button type="button" onClick={() => setExtractApplied(true)}
              style={{ fontSize: '12px', padding: '6px 10px', borderRadius: '6px',
                background: 'none', color: '#7A8A9E', border: '1px solid #DDE5EF', cursor: 'pointer' }}>
              무시
            </button>
          </div>
        </div>
      )}

      {/* 민감정보 안내 (공유+민감 취재원, 열람 승인 폐지로 안내만 표시) */}
      {source.visibility === 'shared' && source.sensitivity === 'private' && !showPrivate && (
        <div className="glass-card p-4" style={{ border: '1px solid rgba(255,153,0,0.3)', background: 'rgba(255,153,0,0.05)' }}>
          <p className="text-sm font-medium" style={{ color: '#A87228' }}>⚠️ 이 취재원은 민감 정보로 분류되어 있습니다</p>
          <p className="text-xs mt-1" style={{ color: '#526070' }}>민감도 표시가 있는 취재원입니다. 내용은 아래에서 확인하세요.</p>
        </div>
      )}

      {/* 기본 정보 */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ color: '#1C2B3A' }}>👤 기본 정보 · 연락처</h2>
          <button
            type="button"
            onClick={() => {
              setNoteSensitive(true)
              noteFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
              setTimeout(() => noteFormRef.current?.querySelector('textarea')?.focus(), 400)
            }}
            style={{
              fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '6px',
              background: 'rgba(255,153,0,0.1)', color: '#A87228',
              border: '1px solid rgba(255,153,0,0.25)', cursor: 'pointer',
            }}>
            📝 내 정보 메모
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5">
          {infoCard('전화번호', source.phone_primary, '📞')}
          {infoCard('이메일', source.email_primary, '📧')}
          {infoCard('보조전화', source.phone_secondary, '📞')}
          {infoCard('보조이메일', source.email_secondary, '📧')}
          {infoCard('생년월일', source.birthday, '🎂')}
          {infoCard('출신지역', [source.hometown_province, source.hometown_city].filter(Boolean).join(' '), '📍')}
        </div>
        {canEdit && (
          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid #DDE5EF' }}>
            {editingField && editingField !== 'personal_notes' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <p style={{ fontSize: '12px', color: '#4A7CC0', fontWeight: 600 }}>
                  {FIELD_LABELS[editingField] ?? editingField} 입력
                </p>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input
                    autoFocus
                    type="text"
                    value={editingValue}
                    onChange={e => setEditingValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleFieldSave(editingField); if (e.key === 'Escape') { setEditingField(null); setEditingValue('') } }}
                    placeholder={`${FIELD_LABELS[editingField] ?? editingField} 입력...`}
                    style={{
                      flex: 1, padding: '7px 10px', background: '#EEF2F7',
                      border: '1px solid rgba(74,124,192,0.4)', borderRadius: '7px',
                      color: '#1C2B3A', fontSize: '13px',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleFieldSave(editingField)}
                    disabled={fieldSaving || !editingValue.trim()}
                    style={{
                      padding: '7px 14px', background: fieldSaving || !editingValue.trim() ? '#DDE5EF' : '#4A7CC0',
                      color: fieldSaving || !editingValue.trim() ? '#7A8A9E' : 'white',
                      border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                    }}>
                    {fieldSaving ? '저장 중' : '저장'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingField(null); setEditingValue('') }}
                    style={{ padding: '7px 10px', background: 'none', border: '1px solid #DDE5EF', color: '#7A8A9E', borderRadius: '7px', fontSize: '12px', cursor: 'pointer' }}>
                    취소
                  </button>
                </div>
                {fieldSaveError && (
                  <p style={{ fontSize: '12px', color: '#C04040' }}>{fieldSaveError}</p>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                <p style={{ fontSize: '11px', color: '#7A8A9E', width: '100%', marginBottom: '2px' }}>빈 항목 채우기</p>
                {[
                  { field: 'phone_primary', label: '📞 전화번호', empty: !source.phone_primary },
                  { field: 'phone_secondary', label: '📞 보조전화', empty: !source.phone_secondary },
                  { field: 'email_primary', label: '📧 이메일', empty: !source.email_primary },
                  { field: 'email_secondary', label: '📧 보조이메일', empty: !source.email_secondary },
                  { field: 'birthday', label: '🎂 생년월일', empty: !source.birthday },
                  { field: 'hometown_province', label: '📍 출신지역', empty: !source.hometown_province },
                  { field: 'high_school', label: '🏫 고교', empty: !source.high_school },
                  { field: 'university', label: '🎓 대학', empty: !source.university },
                  { field: 'exam_batch', label: '📋 고시기수', empty: !source.exam_batch },
                ].filter(f => f.empty).map(f => (
                  <button
                    key={f.field}
                    type="button"
                    onClick={() => { setEditingField(f.field); setEditingValue('') }}
                    style={{
                      padding: '4px 10px', background: '#EEF2F7',
                      border: '1px solid #DDE5EF', color: '#6B7D92',
                      borderRadius: '6px', fontSize: '11px', cursor: 'pointer',
                    }}>
                    + {f.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {source.tags && source.tags.length > 0 && (
          <div className="mt-4 pt-4" style={{ borderTop: '1px solid #DDE5EF' }}>
            <p className="text-xs mb-2" style={{ color: '#7A8A9E' }}>🏷️ 태그</p>
            <div className="flex flex-wrap gap-2">
              {source.tags.map((tag) => (
                <span key={tag} className="text-xs px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(30,144,255,0.1)', color: '#4A7CC0', border: '1px solid rgba(30,144,255,0.2)' }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 학력 */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold mb-4" style={{ color: '#1C2B3A' }}>🎓 학력 / 이력</h2>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5 secure-field">
          {infoCard('고교', source.high_school, '🏫')}
          {infoCard('대학', source.university, '🎓')}
          {infoCard('전공', source.university_major, '📚')}
          {infoCard('대학원', source.graduate_school, '🔬')}
          {/* 고시기수: Canvas 렌더링 (개인식별 민감정보) */}
          {source.exam_batch ? (
            <div className="flex flex-col gap-1 secure-field">
              <span className="text-xs" style={{ color: '#7A8A9E' }}>📋 고시/기수</span>
              <ProtectedText text={source.exam_batch} fontSize={14} fontWeight={500} color="#1C2B3A" />
            </div>
          ) : null}
        </div>
      </div>

      {/* 직책 이력 */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: '#1C2B3A' }}>💼 직책 이력</h2>
            <p className="text-xs mt-0.5" style={{ color: '#7A8A9E' }}>소속/직책 변경 시 자동으로 이력에 쌓입니다</p>
          </div>
          {canEditPositions && (
            <button onClick={() => setShowPosForm(v => !v)}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background: 'rgba(30,144,255,0.1)', color: '#4A7CC0',
                border: '1px solid rgba(30,144,255,0.2)', cursor: 'pointer' }}>
              {showPosForm ? '✕ 닫기' : '+ 직책 추가'}
            </button>
          )}
        </div>

        {positions.length > 0 ? (
          <div className="relative">
            {/* 타임라인 선 */}
            <div className="absolute left-[18px] top-4 bottom-4 w-px" style={{ background: '#DDE5EF' }} />
            <div className="space-y-3">
              {[...positions]
                .sort((a, b) => {
                  if (a.is_current) return -1
                  if (b.is_current) return 1
                  return new Date(b.started_at || '').getTime() - new Date(a.started_at || '').getTime()
                })
                .map(pos => (
                  <div key={pos.id} className="flex items-start gap-4">
                    <div className="mt-1.5 flex-shrink-0 z-10">
                      <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center"
                        style={{
                          background: pos.is_current ? '#4A7CC0' : '#F0F3F7',
                          borderColor: pos.is_current ? '#4A7CC0' : '#7A8A9E',
                        }}>
                        {pos.is_current && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                    <div className="flex-1 p-3 rounded-lg"
                      style={{
                        background: pos.is_current ? 'rgba(30,144,255,0.05)' : '#F0F3F7',
                        border: `1px solid ${pos.is_current ? 'rgba(30,144,255,0.2)' : '#DDE5EF'}`,
                      }}>
                      {editingPosId === pos.id ? (
                        /* ── 인라인 수정 폼 ── */
                        <div className="space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            {([
                              { key: 'organization', label: '조직명 *', placeholder: '외교부' },
                              { key: 'position',     label: '직책 *',   placeholder: '제1차관' },
                              { key: 'department',   label: '부서',     placeholder: '' },
                              { key: 'rank',         label: '직급',     placeholder: '' },
                            ] as const).map(f => (
                              <div key={f.key}>
                                <label className="block text-xs mb-0.5" style={{ color: '#526070' }}>{f.label}</label>
                                <input
                                  value={(editPosForm as unknown as Record<string, string>)[f.key]}
                                  onChange={e => setEditPosForm(p => ({ ...p, [f.key]: e.target.value }))}
                                  placeholder={f.placeholder}
                                  style={{ width: '100%', background: '#fff', border: '1px solid #DDE5EF',
                                    color: '#1C2B3A', borderRadius: '5px', padding: '5px 8px', fontSize: '12px' }}
                                />
                              </div>
                            ))}
                            <div>
                              <label className="block text-xs mb-0.5" style={{ color: '#526070' }}>시작일</label>
                              <input type="date" value={editPosForm.started_at}
                                onChange={e => setEditPosForm(p => ({ ...p, started_at: e.target.value }))}
                                style={{ width: '100%', background: '#fff', border: '1px solid #DDE5EF',
                                  color: '#1C2B3A', borderRadius: '5px', padding: '5px 8px', fontSize: '12px' }} />
                            </div>
                            <div>
                              <label className="block text-xs mb-0.5" style={{ color: '#526070' }}>종료일</label>
                              <input type="date" value={editPosForm.ended_at}
                                onChange={e => setEditPosForm(p => ({ ...p, ended_at: e.target.value }))}
                                style={{ width: '100%', background: '#fff', border: '1px solid #DDE5EF',
                                  color: '#1C2B3A', borderRadius: '5px', padding: '5px 8px', fontSize: '12px' }} />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <input type="checkbox" id={`is_current_${pos.id}`} checked={editPosForm.is_current}
                              onChange={e => setEditPosForm(p => ({ ...p, is_current: e.target.checked }))}
                              style={{ accentColor: '#4A7CC0' }} />
                            <label htmlFor={`is_current_${pos.id}`} className="text-xs" style={{ color: '#526070', cursor: 'pointer' }}>현직</label>
                          </div>
                          <div className="flex gap-2 mt-1">
                            <button type="button" onClick={() => handleEditPosition(pos.id)} disabled={editPosSubmitting}
                              className="px-3 py-1 rounded text-xs font-semibold"
                              style={{ background: editPosSubmitting ? '#DDE5EF' : 'rgba(30,144,255,0.15)',
                                color: '#4A7CC0', border: '1px solid rgba(30,144,255,0.3)', cursor: editPosSubmitting ? 'not-allowed' : 'pointer' }}>
                              {editPosSubmitting ? '저장 중...' : '저장'}
                            </button>
                            <button type="button" onClick={() => setEditingPosId(null)}
                              className="px-3 py-1 rounded text-xs"
                              style={{ background: '#EEF2F7', color: '#7A8A9E', border: '1px solid #DDE5EF', cursor: 'pointer' }}>
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* ── 읽기 모드 ── */
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold" style={{ color: '#1C2B3A' }}>{pos.organization}</span>
                              {pos.is_current && (
                                <span className="text-xs px-1.5 py-0.5 rounded"
                                  style={{ background: 'rgba(0,204,102,0.15)', color: '#3D9E6A' }}>현직</span>
                              )}
                            </div>
                            <p className="text-sm" style={{ color: '#526070' }}>
                              {pos.department && `${pos.department} · `}{pos.position}
                              {pos.rank && ` (${pos.rank})`}
                            </p>
                            <p className="text-xs mt-1" style={{ color: '#7A8A9E' }}>
                              {pos.started_at} ~ {pos.ended_at ?? '현재'}
                              {pos.change_source === 'crawl' && ` · 🤖 자동감지`}
                            </p>
                          </div>
                          {canEditPositions && (
                            <div className="flex gap-1 flex-shrink-0">
                              <button type="button"
                                onClick={() => {
                                  setEditingPosId(pos.id)
                                  setEditPosForm({
                                    organization: pos.organization,
                                    department:   pos.department ?? '',
                                    position:     pos.position,
                                    rank:         pos.rank ?? '',
                                    started_at:   pos.started_at ?? '',
                                    ended_at:     pos.ended_at ?? '',
                                    is_current:   pos.is_current,
                                    change_note:  '',
                                  })
                                }}
                                title="수정"
                                style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '5px',
                                  background: 'rgba(30,144,255,0.1)', color: '#4A7CC0',
                                  border: '1px solid rgba(30,144,255,0.3)', cursor: 'pointer', fontWeight: 600 }}>
                                수정
                              </button>
                              <button type="button"
                                onClick={() => {
                                  if (window.confirm(`"${pos.organization} ${pos.position}" 이력을 삭제하시겠습니까?`)) {
                                    handleDeletePosition(pos.id)
                                  }
                                }}
                                disabled={deletingPosId === pos.id}
                                title="삭제"
                                style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '5px',
                                  background: 'rgba(192,64,64,0.08)', color: '#C04040',
                                  border: '1px solid rgba(192,64,64,0.25)', fontWeight: 600,
                                  cursor: deletingPosId === pos.id ? 'not-allowed' : 'pointer',
                                  opacity: deletingPosId === pos.id ? 0.5 : 1 }}>
                                {deletingPosId === pos.id ? '삭제 중…' : '삭제'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <p className="text-sm" style={{ color: '#7A8A9E' }}>직책 이력이 없습니다. 직책을 추가하거나 취재원 수정에서 소속/직책을 변경하면 자동으로 기록됩니다.</p>
        )}

        {/* 직책 추가 폼 */}
        {showPosForm && canEditPositions && (
          <form onSubmit={handleAddPosition} className="mt-4 pt-4 space-y-3" style={{ borderTop: '1px solid #DDE5EF' }}>
            <p className="text-xs font-semibold" style={{ color: '#4A7CC0' }}>새 직책 추가</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'organization', label: '조직명 *', placeholder: '국토교통부', required: true },
                { key: 'position', label: '직책 *', placeholder: '장관', required: true },
                { key: 'department', label: '부서', placeholder: '기획조정실' },
                { key: 'rank', label: '직급', placeholder: '1급' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs mb-1" style={{ color: '#526070' }}>{f.label}</label>
                  <input type="text" value={(posForm as unknown as Record<string, string>)[f.key]}
                    onChange={e => setPosForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder={f.placeholder} required={f.required}
                    style={{ width: '100%', background: '#EEF2F7', border: '1px solid #DDE5EF',
                      color: '#1C2B3A', borderRadius: '6px', padding: '7px 10px', fontSize: '13px' }} />
                </div>
              ))}
              <div>
                <label className="block text-xs mb-1" style={{ color: '#526070' }}>시작일 *</label>
                <input type="date" value={posForm.started_at} required
                  onChange={e => setPosForm(p => ({ ...p, started_at: e.target.value }))}
                  style={{ width: '100%', background: '#EEF2F7', border: '1px solid #DDE5EF',
                    color: '#1C2B3A', borderRadius: '6px', padding: '7px 10px', fontSize: '13px' }} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#526070' }}>종료일</label>
<input type="date" value={posForm.ended_at}
                  onChange={e => setPosForm(p => ({ ...p, ended_at: e.target.value }))}
                  style={{ width: '100%', background: '#EEF2F7', border: '1px solid #DDE5EF',
                    color: '#1C2B3A', borderRadius: '6px', padding: '7px 10px', fontSize: '13px' }} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_current" checked={posForm.is_current}
                onChange={e => setPosForm(p => ({ ...p, is_current: e.target.checked }))}
                style={{ accentColor: '#4A7CC0' }} />
              <label htmlFor="is_current" className="text-xs" style={{ color: '#526070', cursor: 'pointer' }}>
                현직 (기존 현직을 이전 직책으로 자동 이동)
              </label>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={posSubmitting}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: posSubmitting ? '#DDE5EF' : 'rgba(30,144,255,0.15)',
                  color: '#4A7CC0', border: '1px solid rgba(30,144,255,0.3)',
                  cursor: posSubmitting ? 'not-allowed' : 'pointer' }}>
                {posSubmitting ? '저장 중...' : '저장'}
              </button>
              <button type="button" onClick={() => { setShowPosForm(false); setPosForm(EMPTY_POS) }}
                className="px-4 py-1.5 rounded-lg text-xs"
                style={{ background: '#EEF2F7', color: '#7A8A9E', border: '1px solid #DDE5EF', cursor: 'pointer' }}>
                취소
              </button>
            </div>
          </form>
        )}
      </div>

      {/* ── 정보 섹션 (민감 정보 포함 — 공유 취재원) ──────────────────────────── */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: '#1C2B3A' }}>
              🔒 민감 정보
              <span className="text-xs ml-2 font-normal" style={{ color: '#A87228' }}>차장 이상 열람 · 기자는 승인 필요</span>
            </h2>
          </div>
        </div>

        {/* personal_notes(민감 정보) — 차장이상/승인된 기자: 표시 */}
        {canSeePersonalNotes && source.personal_notes && (
          <SecureContainer
            className="mb-4 p-3 rounded-lg"
            style={{
              background: 'rgba(255,153,0,0.04)',
              border: '1px solid rgba(255,153,0,0.2)',
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold" style={{ color: '#A87228', userSelect: 'text' }}>
                {isOwner ? '📌 내 민감 정보 (등록자)' : '📌 민감 정보'}
              </p>
              {canEdit && editingField !== 'personal_notes' && (
                <button
                  type="button"
                  onClick={() => { setEditingField('personal_notes'); setEditingValue(source.personal_notes ?? '') }}
                  style={{ fontSize: '11px', color: '#A87228', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
                  ✏️ 수정
                </button>
              )}
            </div>
            {editingField === 'personal_notes' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <textarea
                  autoFocus
                  rows={6}
                  value={editingValue}
                  onChange={e => setEditingValue(e.target.value)}
                  placeholder="민감 정보 입력 (인사, 성향, 관계 등)..."
                  style={{
                    width: '100%', padding: '8px 10px', background: '#EEF2F7',
                    border: '1px solid rgba(255,153,0,0.4)', borderRadius: '8px',
                    color: '#1C2B3A', fontSize: '13px', resize: 'vertical',
                  }}
                />
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => handleFieldSave('personal_notes')} disabled={fieldSaving || !editingValue.trim()}
                    style={{ padding: '6px 14px', background: fieldSaving ? '#EEF2F7' : 'rgba(255,153,0,0.2)', color: '#A87228', border: '1px solid rgba(255,153,0,0.4)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    {fieldSaving ? '저장 중...' : '저장'}
                  </button>
                  <button type="button" onClick={handleMoveToPublic} disabled={fieldSaving || !editingValue.trim()}
                    title="이 내용을 공개 정보로 이동하고 민감 정보를 비웁니다"
                    style={{ padding: '6px 14px', background: fieldSaving ? '#EEF2F7' : 'rgba(61,158,106,0.12)', color: '#3D9E6A', border: '1px solid rgba(61,158,106,0.35)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: fieldSaving ? 'not-allowed' : 'pointer' }}>
                    📤 공개 정보로 이동
                  </button>
                  <button type="button" onClick={() => { setEditingField(null); setEditingValue('') }}
                    style={{ padding: '6px 10px', background: 'none', border: '1px solid #DDE5EF', color: '#7A8A9E', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    취소
                  </button>
                </div>
                {fieldSaveError && <p style={{ fontSize: '12px', color: '#C04040' }}>{fieldSaveError}</p>}
              </div>
            ) : (
              <SecureContentViewer
                apiPath={`/api/sources/${source.id}/copy-log`}
                content={source.personal_notes}
                userId={userId}
                userFullName={userFullName}
                userDepartment={userDepartment ?? null}
              />
            )}
          </SecureContainer>
        )}

        {/* 차장 이상이지만 민감 정보 없을 때 */}
        {canSeePersonalNotes && !source.personal_notes && (
          canEdit ? (
            editingField === 'personal_notes' ? (
              <div className="mb-4" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <textarea
                  autoFocus
                  rows={6}
                  value={editingValue}
                  onChange={e => setEditingValue(e.target.value)}
                  placeholder="민감 정보 입력 (인사, 성향, 관계 등)..."
                  style={{
                    width: '100%', padding: '8px 10px', background: '#EEF2F7',
                    border: '1px solid rgba(255,153,0,0.4)', borderRadius: '8px',
                    color: '#1C2B3A', fontSize: '13px', resize: 'vertical',
                  }}
                />
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button type="button" onClick={() => handleFieldSave('personal_notes')} disabled={fieldSaving || !editingValue.trim()}
                    style={{ padding: '6px 14px', background: fieldSaving ? '#EEF2F7' : 'rgba(255,153,0,0.2)', color: '#A87228', border: '1px solid rgba(255,153,0,0.4)', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    {fieldSaving ? '저장 중...' : '저장'}
                  </button>
                  <button type="button" onClick={() => { setEditingField(null); setEditingValue('') }}
                    style={{ padding: '6px 10px', background: 'none', border: '1px solid #DDE5EF', color: '#7A8A9E', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}>
                    취소
                  </button>
                </div>
                {fieldSaveError && <p style={{ fontSize: '12px', color: '#C04040' }}>{fieldSaveError}</p>}
              </div>
            ) : (
              <div className="mb-4">
                <button type="button"
                  onClick={() => { setEditingField('personal_notes'); setEditingValue('') }}
                  style={{ fontSize: '13px', color: '#A87228', background: 'rgba(255,153,0,0.08)', border: '1px solid rgba(255,153,0,0.2)', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer' }}>
                  + 민감 정보 입력
                </button>
              </div>
            )
          ) : (
            <p className="text-sm mb-4" style={{ color: '#7A8A9E' }}>아직 민감 정보가 없습니다.</p>
          )
        )}

        {/* 기자가 민감 정보 열람 권한 없을 때 — 데스크 승인 신청 유도 */}
        {!isOwner && !canSeePersonalNotes && (
          <div className="mb-4 p-4 rounded-lg flex items-start gap-3"
            style={{ background: 'rgba(255,153,0,0.04)', border: '1px solid rgba(255,153,0,0.2)' }}>
            <span style={{ fontSize: '18px' }}>🔒</span>
            <div className="flex-1">
              <p className="text-xs font-semibold" style={{ color: '#A87228' }}>민감 정보는 데스크(부장+) 승인 후 열람 가능합니다</p>
              {personalNotesPreview && (
                <div style={{ position: 'relative', marginBottom: '10px', overflow: 'hidden', borderRadius: '8px' }}>
                  <p style={{
                    fontSize: '13px', lineHeight: 1.7, color: '#1C2B3A',
                    filter: 'blur(4px)', userSelect: 'none', pointerEvents: 'none',
                    padding: '10px 12px', background: 'rgba(255,153,0,0.04)',
                    border: '1px solid rgba(255,153,0,0.15)', borderRadius: '8px',
                  }}>
                    {personalNotesPreview}
                  </p>
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(to bottom, transparent 40%, rgba(238,242,247,0.85))',
                    borderRadius: '8px',
                  }} />
                  <div style={{
                    position: 'absolute', bottom: '6px', left: '50%', transform: 'translateX(-50%)',
                    fontSize: '11px', color: '#A87228', fontWeight: 600, whiteSpace: 'nowrap',
                  }}>
                    🔒 내용 일부 — 전체 열람은 아래에서 신청하세요
                  </div>
                </div>
              )}
              {!showApprovalForm ? (
                <button
                  onClick={() => setShowApprovalForm(true)}
                  className="mt-2 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: 'rgba(255,153,0,0.12)', color: '#A87228', border: '1px solid rgba(255,153,0,0.3)', cursor: 'pointer' }}>
                  민감 정보 열람 신청
                </button>
              ) : (
                <div className="mt-2 space-y-2">
                  <textarea value={approvalReason} onChange={e => setApprovalReason(e.target.value)}
                    placeholder="열람 사유를 입력하세요 (예: 기획기사 취재 목적)"
                    rows={2}
                    style={{ width: '100%', background: '#EEF2F7', border: '1px solid #DDE5EF', color: '#1C2B3A', borderRadius: '8px', padding: '8px', fontSize: '13px', resize: 'none' }} />
                  <div className="flex gap-2">
                    <button onClick={handleApprovalRequest}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: '#A87228', color: 'white', border: 'none', cursor: 'pointer' }}>신청</button>
                    <button onClick={() => setShowApprovalForm(false)}
                      className="px-3 py-1.5 rounded-lg text-xs"
                      style={{ background: '#EEF2F7', color: '#526070', border: '1px solid #DDE5EF', cursor: 'pointer' }}>취소</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* ── 공개 정보 섹션 (복수 작성자 + 등록자 메모) ────────────────────────── */}
      <div className="glass-card p-5">
        <h2 className="text-sm font-semibold mb-4" style={{ color: '#1C2B3A' }}>
          📝 공개 정보
          <span className="text-xs ml-2 font-normal" style={{ color: '#3D9E6A' }}>편집국 전원 열람</span>
          <span className="text-xs ml-1 font-normal" style={{ color: '#7A8A9E' }}>· 여러 기자가 추가 가능</span>
        </h2>

        {/* ── 등록자 메모 (public_notes) — 있을 때만 표시 ─────────────────── */}
        {source.public_notes && (
          <div className="mb-4 rounded-xl overflow-hidden"
            style={{ border: '1px solid #DDE5EF', background: '#FFFFFF', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div className="px-4 py-2.5 flex items-center gap-2"
              style={{ background: '#F5F8FC', borderBottom: '1px solid #DDE5EF' }}>
              <div style={{
                width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                background: 'rgba(30,144,255,0.2)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: '#4A7CC0',
                border: '1px solid rgba(30,144,255,0.35)',
              }}>
                {(source.profiles?.full_name ?? '?').slice(0, 1)}
              </div>
              <div>
                <span className="text-xs font-semibold" style={{ color: '#374151' }}>
                  {source.profiles?.full_name ?? '등록자'}
                </span>
                <span className="text-xs ml-2" style={{ color: '#9CA3AF' }}>등록자 메모</span>
              </div>
              {canEdit && (
                <a href={`/sources/${source.id}/edit`}
                  className="ml-auto text-xs"
                  style={{ color: '#4A7CC0', textDecoration: 'none' }}>
                  수정
                </a>
              )}
            </div>
            <div className="px-4 py-3">
              <SecureContentViewer
                apiPath={`/api/sources/${source.id}/copy-log`}
                content={source.public_notes}
                userId={userId}
                userFullName={userFullName}
                userDepartment={userDepartment ?? null}
              />
            </div>
          </div>
        )}

        {/* 잠긴 민감 노트 알림 (차장 미만에게 표시) */}
        {lockedNotesCount > 0 && !showPrivate && (
          <div className="mb-3 p-3 rounded-lg flex items-center gap-3"
            style={{ background: 'rgba(255,153,0,0.05)', border: '1px solid rgba(255,153,0,0.2)' }}>
            <span style={{ color: '#A87228' }}>🔒</span>
            <div>
              <p className="text-xs font-semibold" style={{ color: '#A87228' }}>
                민감 정보 {lockedNotesCount}건이 잠겨 있습니다
              </p>
              <p className="text-xs" style={{ color: '#526070' }}>
                데스크(부장+) 승인 후 열람 가능합니다
              </p>
            </div>
            {!showApprovalForm && (
              <button onClick={() => setShowApprovalForm(true)}
                className="ml-auto text-xs px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(255,153,0,0.15)', color: '#A87228',
                  border: '1px solid rgba(255,153,0,0.3)', cursor: 'pointer' }}>
                열람 신청
              </button>
            )}
          </div>
        )}

        {/* ── 통합 정보 (중복 제거) — 최상단 표시 ─────────────────────────── */}
        {notes.filter(n => !n.is_sensitive || isAdmin || isDeputyOrAbove || n.profiles?.id === userId).length > 1 && (() => {
          const visibleNotes = notes.filter(n => !n.is_sensitive || isAdmin || isDeputyOrAbove || n.profiles?.id === userId)
          const unified = buildUnifiedNotes(visibleNotes)
          if (!unified) return null
          const authorMap = new Map<string, { name: string; dept: string | null; count: number }>()
          for (const n of visibleNotes) {
            const aid = n.profiles?.id ?? 'unknown'
            if (!authorMap.has(aid)) {
              authorMap.set(aid, { name: n.profiles?.full_name ?? '알 수 없음', dept: n.profiles?.department ?? null, count: 0 })
            }
            authorMap.get(aid)!.count++
          }
          return (
            <div className="mb-4 rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(0,212,255,0.2)', background: 'rgba(0,212,255,0.03)' }}>
              <div className="px-4 py-3 flex items-center gap-2 flex-wrap"
                style={{ background: 'rgba(0,212,255,0.07)', borderBottom: '1px solid rgba(0,212,255,0.15)' }}>
                <span style={{ fontSize: '14px' }}>🔗</span>
                <span className="text-xs font-bold" style={{ color: '#3A90A8' }}>통합 정보</span>
                <span className="text-xs" style={{ color: '#7A8A9E' }}>
                  — {visibleNotes.length}건 중복 제거 통합
                </span>
                <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                  {[...authorMap.values()].map((a, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(0,212,255,0.12)', color: '#3A90A8', border: '1px solid rgba(0,212,255,0.2)' }}>
                      {a.name}{a.count > 1 ? ` ×${a.count}` : ''}
                    </span>
                  ))}
                </div>
              </div>
              <div className="px-4 py-3">
                <SecureContentViewer
                  apiPath={`/api/sources/${source.id}/copy-log`}
                  content={unified}
                  userId={userId}
                  userFullName={userFullName}
                  userDepartment={userDepartment ?? null}
                />
              </div>
            </div>
          )
        })()}

        {/* ── 개별 정보 카드 (작성자별) ─────────────────────────────────── */}
        {notes.filter(n => !n.is_sensitive || isAdmin || isDeputyOrAbove || n.profiles?.id === userId).length > 0 ? (
          <div className="space-y-3">
            {notes.filter(n => !n.is_sensitive || isAdmin || isDeputyOrAbove || n.profiles?.id === userId).map(note => (
              <NoteItem
                key={note.id}
                note={note}
                canDelete={note.profiles?.id === userId || isAdmin}
                onDelete={handleDeleteNote}
                sourceId={source.id}
                userId={userId}
                userFullName={userFullName}
                userDepartment={userDepartment ?? null}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: '#7A8A9E' }}>
            {source.public_notes ? '등록자 메모 외 추가 정보가 없습니다. 아래에서 첫 정보를 추가해보세요.' : '아직 추가된 정보가 없습니다. 아래에서 첫 정보를 추가해보세요.'}
          </p>
        )}

        {/* ── 정보 추가 폼 ───────────────────────────────────────────────── */}
        <form ref={noteFormRef} onSubmit={handleAddNote} className="mt-4 pt-4 space-y-3" style={{ borderTop: '1px solid #DDE5EF' }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold" style={{ color: '#4A7CC0' }}>
              + 정보 추가 <span style={{ color: '#7E6E48' }}>+10pt</span>
            </p>
            {/* 공개/민감 토글 */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #DDE5EF' }}>
              <button
                type="button"
                onClick={() => setNoteSensitive(false)}
                className="px-3 py-1 text-xs font-medium transition-all"
                style={{
                  background: !noteSensitive ? 'rgba(61,158,106,0.15)' : 'transparent',
                  color: !noteSensitive ? '#3D9E6A' : '#7A8A9E',
                  border: 'none', cursor: 'pointer',
                }}>
                📢 공개
              </button>
              <div style={{ width: '1px', background: '#DDE5EF' }} />
              <button
                type="button"
                onClick={() => setNoteSensitive(true)}
                className="px-3 py-1 text-xs font-medium transition-all"
                style={{
                  background: noteSensitive ? 'rgba(255,153,0,0.15)' : 'transparent',
                  color: noteSensitive ? '#A87228' : '#7A8A9E',
                  border: 'none', cursor: 'pointer',
                }}>
                🔒 민감
              </button>
            </div>
          </div>
          <p className="text-xs" style={{ color: '#7A8A9E', marginTop: '-4px' }}>
            {noteSensitive
              ? '🔒 민감 정보 — 차장 이상과 본인만 열람 가능합니다'
              : '📢 공개 정보 — 편집국 전원이 열람할 수 있습니다'}
          </p>
          <textarea
            value={noteContent}
            onChange={e => setNoteContent(e.target.value)}
            placeholder={noteSensitive
              ? '차장 이상만 볼 수 있는 내용 (친분 관계, 개인 성향, 가족 정보 등)...'
              : '편집국 전체와 공유할 내용 (전문 분야, 인터뷰 팁, 최근 동향 등)...'}
            rows={3}
            style={{
              width: '100%', resize: 'vertical', outline: 'none', fontSize: '14px',
              padding: '10px 12px', borderRadius: '8px', color: '#1C2B3A',
              background: '#EEF2F7',
              border: `1px solid ${noteSensitive ? 'rgba(255,153,0,0.3)' : '#DDE5EF'}`,
            }}
          />
          {noteError && (
            <div className="text-xs px-3 py-2 rounded-lg mb-1"
              style={{ background: 'rgba(192,64,64,0.1)', color: '#C04040', border: '1px solid rgba(192,64,64,0.25)' }}>
              {noteError}
            </div>
          )}
          <div className="flex justify-end">
            <button type="submit" disabled={noteSubmitting || !noteContent.trim()}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold"
              style={{
                background: (noteSubmitting || !noteContent.trim()) ? '#DDE5EF'
                  : noteSensitive ? 'rgba(255,153,0,0.2)' : 'linear-gradient(135deg, #4A7CC0, #0066CC)',
                color: (noteSubmitting || !noteContent.trim()) ? '#7A8A9E'
                  : noteSensitive ? '#A87228' : 'white',
                border: noteSensitive ? '1px solid rgba(255,153,0,0.4)' : 'none',
                cursor: (noteSubmitting || !noteContent.trim()) ? 'not-allowed' : 'pointer',
              }}>
              {noteSubmitting ? '저장 중...' : `${noteSensitive ? '🔒 민감 정보' : '📢 공개 정보'} 등록 (+10pt)`}
            </button>
          </div>
        </form>
      </div>

      {/* 유용성 평가 */}
      {!isOwner && (
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold mb-3" style={{ color: '#1C2B3A' }}>⭐ 유용성 평가</h2>
          <div className="flex items-center gap-4">
            <StarRating rating={rating} onRate={handleRate} />
            {avgRating != null && (
              <span className="text-sm" style={{ color: '#526070' }}>평균 {avgRating.toFixed(1)}점</span>
            )}
            {rating && (
              <span className="text-sm" style={{ color: '#3D9E6A' }}>내 평가: {rating}점 (+1pt)</span>
            )}
          </div>
        </div>
      )}

      {/* 수정 이력 모달 */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setShowHistory(false)}>
          <div className="glass-card p-6 w-full max-w-lg max-h-96 overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold" style={{ color: '#1C2B3A' }}>📋 수정 이력</h3>
              <button onClick={() => setShowHistory(false)}
                style={{ color: '#7A8A9E', background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' }}>×</button>
            </div>
            {editHistory.length > 0 ? (
              <div className="space-y-3">
                {editHistory.slice(0, 50).map(h => (
                  <div key={h.id} className="p-3 rounded-lg" style={{ background: '#EEF2F7' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold" style={{ color: '#4A7CC0' }}>{h.editor_name}</span>
                      <span className="text-xs" style={{ color: '#7A8A9E' }}>
                        {new Date(h.edited_at).toLocaleString('ko-KR')}
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: '#526070' }}>
                      <span style={{ color: '#1C2B3A' }}>{FIELD_LABELS[h.field_name] ?? h.field_name}</span>
                      {' '}
                      <span style={{ color: '#C04040', textDecoration: 'line-through' }}>{h.old_value ?? '(없음)'}</span>
                      {' → '}
                      <span style={{ color: '#3D9E6A' }}>{h.new_value ?? '(없음)'}</span>
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-center py-4" style={{ color: '#7A8A9E' }}>수정 이력이 없습니다.</p>
            )}
          </div>
        </div>
      )}

      {/* 복사 이력 추적 (데스크 전용) */}
      {isAdmin && <SourceCopyLogs sourceId={source.id} />}

      {/* 관련 정보보고 */}
      {relatedReports.length > 0 && (
        <div className="glass-card p-5">
          <h2 className="text-sm font-semibold mb-3" style={{ color: '#1C2B3A' }}>
            📋 관련 정보보고 ({relatedReports.length}건)
          </h2>
          <div className="space-y-2">
            {relatedReports.map(report => (
              <a key={report.id} href={`/reports/${report.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                <div className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{ background: '#EEF2F7', border: '1px solid #DDE5EF', cursor: 'pointer' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = '#4A7CC0')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = '#DDE5EF')}>
                  <span className="text-sm font-medium truncate" style={{ color: '#1C2B3A', flex: 1 }}>
                    {report.title}
                  </span>
                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    {report.profiles?.full_name && (
                      <span className="text-xs" style={{ color: '#6B7D92' }}>{report.profiles.full_name}</span>
                    )}
                    <span className="text-xs" style={{ color: '#7A8A9E' }}>
                      {new Date(report.created_at).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })}
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 연락 이력 타임라인 */}
      <ContactLogs sourceId={source.id} currentUserId={userId} userRole={userRole} />

      {/* 등록자 정보 */}
      <div className="flex items-center gap-2 text-xs" style={{ color: '#7A8A9E' }}>
        <span>등록: {source.profiles?.full_name ?? '—'}</span>
        <span>·</span>
        <span>최종수정: {new Date(source.updated_at).toLocaleString('ko-KR')}</span>
      </div>

      {/* ── 하단 액션 바 — 읽기 흐름이 끝난 뒤 행동 결정 ─────────────────── */}
      <div className="flex items-center gap-2 pt-5" style={{ borderTop: '1px solid #DDE5EF' }}>
        {canEdit && (
          <Link
            href={`/sources/${source.id}/edit`}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
              background: '#EEF2F7', color: '#526070', border: '1px solid #DDE5EF',
              textDecoration: 'none', transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = '#E2E8F0'
              ;(e.currentTarget as HTMLElement).style.color = '#1C2B3A'
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = '#EEF2F7'
              ;(e.currentTarget as HTMLElement).style.color = '#526070'
            }}
          >
            ✏️ 수정
          </Link>
        )}
        <button
          onClick={() => setShowHistory(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
            background: '#EEF2F7', color: '#526070', border: '1px solid #DDE5EF',
            cursor: 'pointer', transition: 'all 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = '#E2E8F0'
            e.currentTarget.style.color = '#1C2B3A'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = '#EEF2F7'
            e.currentTarget.style.color = '#526070'
          }}
        >
          📋 이력
        </button>

        {/* 삭제는 오른쪽 끝 — 가장 파괴적인 행동이므로 마지막에 */}
        <div style={{ flex: 1 }} />
        {isAdmin ? (
          <button
            onClick={handleDelete}
            disabled={deleting}
            title="취재원 삭제 (부장 권한)"
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500,
              background: 'rgba(255,68,68,0.08)', color: '#C04040',
              border: '1px solid rgba(255,68,68,0.18)', cursor: 'pointer',
            }}
          >
            🗑️ 삭제
          </button>
        ) : (
          <button
            onClick={handleDeletionRequest}
            disabled={deleting}
            title="삭제 요청 (부장 승인 필요)"
            style={{
              padding: '8px 16px', borderRadius: '8px', fontSize: '13px',
              background: 'rgba(255,153,0,0.08)', color: '#A87228',
              border: '1px solid rgba(255,153,0,0.2)', cursor: 'pointer',
            }}
          >
            🗑️ 삭제 요청
          </button>
        )}
      </div>
    </div>
  )
}
