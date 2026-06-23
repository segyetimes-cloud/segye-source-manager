'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { ReportVisibility } from '@/types/database'
import { GENERAL_VISIBILITY_OPTIONS } from '@/lib/reportVisibility'
import AllowedUsersSelector, { type AllowedUser } from '@/components/reports/AllowedUsersSelector'

const inputStyle: React.CSSProperties = {
  background: '#182035',
  border: '1px solid #1A2838',
  color: '#CDD5E0',
  borderRadius: '8px',
  padding: '9px 12px',
  fontSize: '14px',
  width: '100%',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 500,
  marginBottom: '6px',
  color: '#8AAAC8',
}

interface SourceResult {
  id: string
  full_name: string
  current_organization: string | null
}

export default function NewReportPage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('일반')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [visibility, setVisibility] = useState<ReportVisibility>('my_desk')
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([])

  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [hasDraft, setHasDraft] = useState(false)
  const [draftInfo, setDraftInfo] = useState<{ savedAt: string } | null>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 첨부파일
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files ?? [])
    setSelectedFiles(prev => {
      const combined = [...prev]
      for (const f of newFiles) {
        if (!combined.find(x => x.name === f.name && x.size === f.size)) combined.push(f)
      }
      return combined.slice(0, 5)
    })
    e.target.value = ''
  }

  function removeFile(index: number) {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index))
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  // 취재원 연결
  const [sourceQuery, setSourceQuery] = useState('')
  const [sourceResults, setSourceResults] = useState<SourceResult[]>([])
  const [selectedSources, setSelectedSources] = useState<SourceResult[]>([])
  const [sourceSearching, setSourceSearching] = useState(false)

  async function searchSources(q: string) {
    if (!q.trim()) { setSourceResults([]); return }
    setSourceSearching(true)
    const res = await fetch(`/api/sources?q=${encodeURIComponent(q)}&tab=shared&limit=10`)
    if (res.ok) {
      const data = await res.json()
      setSourceResults((data.sources ?? []) as SourceResult[])
    }
    setSourceSearching(false)
  }

  const sourceInputRef = useRef<HTMLInputElement>(null)

  function addSource(s: SourceResult) {
    if (selectedSources.find(x => x.id === s.id)) return
    setSelectedSources(prev => [...prev, s])
    setSourceQuery('')
    setSourceResults([])
    setTimeout(() => sourceInputRef.current?.focus(), 0)
  }

  function handleSourceKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === ',' && sourceResults.length > 0) {
      e.preventDefault()
      addSource(sourceResults[0])
    }
  }

  function removeSource(id: string) {
    setSelectedSources(prev => prev.filter(x => x.id !== id))
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === ',' || e.key === 'Enter') {
      e.preventDefault()
      const val = tagInput.trim().replace(/,/g, '')
      if (val && !tags.includes(val)) setTags(prev => [...prev, val])
      setTagInput('')
    }
  }

  function removeTag(t: string) {
    setTags(prev => prev.filter(x => x !== t))
  }

  const saveDraft = useCallback(async () => {
    if (!title && !body) return
    setIsSaving(true)
    try {
      await fetch('/api/reports/draft', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content: body, category, tags, visibility }),
      })
      setLastSaved(new Date())
    } catch {}
    setIsSaving(false)
  }, [title, body, category, tags, visibility])

  async function restoreDraft() {
    try {
      const res = await fetch('/api/reports/draft')
      if (!res.ok) return
      const data = await res.json()
      const draft = data.draft
      if (!draft) return
      if (draft.title    !== undefined) setTitle(draft.title)
      if (draft.content  !== undefined) setBody(draft.content)
      if (draft.category !== undefined) setCategory(draft.category)
      if (draft.tags     !== undefined) setTags(draft.tags)
      if (draft.visibility !== undefined) setVisibility(draft.visibility)
    } catch {}
    setHasDraft(false)
    setDraftInfo(null)
  }

  async function dismissDraft() {
    try { await fetch('/api/reports/draft', { method: 'DELETE' }) } catch {}
    setHasDraft(false)
    setDraftInfo(null)
  }

  useEffect(() => {
    async function checkDraft() {
      try {
        const res = await fetch('/api/reports/draft')
        if (!res.ok) return
        const data = await res.json()
        const draft = data.draft
        if (draft?.updated_at) {
          setHasDraft(true)
          setDraftInfo({ savedAt: draft.updated_at })
        }
      } catch {}
    }
    checkDraft()
  }, [])

  useEffect(() => {
    if (!title && !body) return
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => { saveDraft() }, 2000)
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  }, [title, body, category, tags, visibility, saveDraft])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('제목을 입력해 주세요.'); return }
    if (!body.trim())  { setError('본문을 입력해 주세요.'); return }
    setSubmitting(true)
    setError('')

    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), 15_000)

    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abort.signal,
        body: JSON.stringify({
          title, category, tags, visibility,
          content: body,
          source_ids:       selectedSources.map(s => s.id),
          allowed_user_ids: allowedUsers.map(u => u.id),
        }),
      })

      clearTimeout(timer)
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? '저장에 실패했습니다.'); return }

      if (selectedFiles.length > 0) {
        setUploadingFiles(true)
        for (const file of selectedFiles) {
          const fd = new FormData()
          fd.append('file', file)
          await fetch(`/api/reports/${data.id}/attachments`, { method: 'POST', body: fd })
        }
        setUploadingFiles(false)
      }

      fetch('/api/reports/draft', { method: 'DELETE' }).catch(() => {})
      router.push('/reports')
    } catch (err) {
      clearTimeout(timer)
      const isTimeout = err instanceof Error && err.name === 'AbortError'
      setError(isTimeout
        ? '저장 요청이 시간 초과되었습니다. 다시 시도해 주세요.'
        : '저장 중 오류가 발생했습니다. 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5" style={{ paddingBottom: '2rem' }}>

      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link href="/reports" style={{ color: '#607898', textDecoration: 'none', fontSize: '22px', lineHeight: 1 }}>←</Link>
        <div style={{ flex: 1 }}>
          <h1 className="text-lg font-bold" style={{ color: '#CDD5E0' }}>새 보고서 작성</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
            <p className="text-xs" style={{ color: '#5A7099' }}>정보보고 작성</p>
            {isSaving && <span style={{ fontSize: '11px', color: '#607898' }}>저장 중...</span>}
            {!isSaving && lastSaved && (
              <span style={{ fontSize: '11px', color: '#3D7A50' }}>
                ✓ 자동 저장됨 · {lastSaved.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 임시저장 복원 배너 */}
      {hasDraft && draftInfo && (
        <div style={{
          background: 'rgba(74,124,192,0.1)', border: '1px solid rgba(74,124,192,0.3)',
          borderRadius: '8px', padding: '12px 14px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        }}>
          <div>
            <p style={{ fontSize: '13px', color: '#7AADE0', fontWeight: 600, margin: 0 }}>💾 저장된 임시보고가 있습니다</p>
            <p style={{ fontSize: '11px', color: '#607898', margin: '2px 0 0' }}>
              {new Date(draftInfo.savedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 저장
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
            <button type="button" onClick={restoreDraft} style={{
              background: 'rgba(74,124,192,0.2)', border: '1px solid rgba(74,124,192,0.4)',
              color: '#7AADE0', borderRadius: '6px', padding: '5px 12px',
              fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            }}>불러오기</button>
            <button type="button" onClick={dismissDraft} style={{
              background: 'none', border: '1px solid #1A2838',
              color: '#607898', borderRadius: '6px', padding: '5px 12px',
              fontSize: '12px', cursor: 'pointer',
            }}>무시</button>
          </div>
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)',
          borderRadius: '8px', padding: '10px 14px',
          color: '#C04040', fontSize: '13px',
        }}>{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* 분류 + 제목 */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label style={labelStyle}>분류</label>
            <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
              {['일반','단독','공동취재','인터뷰','배경설명','분석','기타'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>제목 *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="보고서 제목을 입력하세요"
              style={inputStyle}
              required
            />
          </div>
        </div>

        {/* 공개 대상 */}
        <div>
          <label style={labelStyle}>공개 대상 *</label>
          <div className="flex flex-col gap-2">
            {GENERAL_VISIBILITY_OPTIONS.map(opt => (
              <label key={opt.value} style={{
                display: 'flex', alignItems: 'flex-start', gap: '10px',
                padding: '10px 12px', borderRadius: '8px', cursor: 'pointer',
                background: visibility === opt.value ? 'rgba(30,144,255,0.08)' : '#182035',
                border: `1px solid ${visibility === opt.value ? 'rgba(30,144,255,0.3)' : '#1A2838'}`,
              }}>
                <input
                  type="radio"
                  name="visibility"
                  value={opt.value}
                  checked={visibility === opt.value}
                  onChange={() => setVisibility(opt.value)}
                  style={{ marginTop: '2px', accentColor: '#4A7CC0' }}
                />
                <div>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#CDD5E0' }}>{opt.label}</span>
                  <p style={{ fontSize: '12px', color: '#5A7099', marginTop: '2px' }}>{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 지정 열람자 */}
        <div>
          <label style={labelStyle}>
            지정 열람자{' '}
            <span style={{ color: '#607898', fontWeight: 400 }}>(선택 — 등급 무관하게 지명된 기자도 열람 가능)</span>
          </label>
          <AllowedUsersSelector selected={allowedUsers} onChange={setAllowedUsers} />
        </div>

        {/* 본문 */}
        <div>
          <label style={labelStyle}>본문 *</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="보고서 내용을 자세히 작성하세요"
            rows={18}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
          />
        </div>

        {/* 태그 */}
        <div>
          <label style={labelStyle}>태그 <span style={{ color: '#607898', fontWeight: 400 }}>(쉼표 또는 Enter로 추가)</span></label>
          <input
            type="text"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder="예: 경제, 금융, 국회"
            style={inputStyle}
          />
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {tags.map(tag => (
                <span key={tag} style={{
                  background: 'rgba(30,144,255,0.1)',
                  color: '#4A7CC0',
                  border: '1px solid rgba(30,144,255,0.25)',
                  borderRadius: '5px', padding: '3px 9px',
                  fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px',
                }}>
                  #{tag}
                  <button type="button" onClick={() => removeTag(tag)}
                    style={{ background: 'none', border: 'none', color: '#4A7CC0', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 }}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 취재원 연결 */}
        <div>
          <label style={labelStyle}>취재원 연결 <span style={{ color: '#607898', fontWeight: 400 }}>(선택)</span></label>
          <div style={{ position: 'relative' }}>
            <input
              ref={sourceInputRef}
              type="text"
              value={sourceQuery}
              onChange={e => { setSourceQuery(e.target.value); searchSources(e.target.value) }}
              onKeyDown={handleSourceKeyDown}
              placeholder="취재원 이름 또는 소속 검색 (쉼표로 첫 번째 결과 추가)"
              style={inputStyle}
            />
            {sourceResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                background: '#131C2C', border: '1px solid #1A2838',
                borderRadius: '8px', marginTop: '4px',
                maxHeight: '200px', overflowY: 'auto',
              }}>
                {sourceResults.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => addSource(s)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '9px 12px', background: 'none', border: 'none',
                      cursor: 'pointer', color: '#CDD5E0', fontSize: '13px',
                      borderBottom: '1px solid #1A2838',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#182035')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                    <span style={{ fontWeight: 600 }}>{s.full_name}</span>
                    {s.current_organization && (
                      <span style={{ color: '#5A7099', marginLeft: '8px', fontSize: '12px' }}>{s.current_organization}</span>
                    )}
                  </button>
                ))}
              </div>
            )}
            {sourceSearching && (
              <p style={{ fontSize: '12px', color: '#607898', marginTop: '4px' }}>검색 중...</p>
            )}
          </div>
          {selectedSources.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {selectedSources.map(s => (
                <span key={s.id} style={{
                  background: 'rgba(0,212,255,0.08)',
                  color: '#3A90A8',
                  border: '1px solid rgba(0,212,255,0.2)',
                  borderRadius: '5px', padding: '3px 9px',
                  fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px',
                }}>
                  👤 {s.full_name}
                  <button type="button" onClick={() => removeSource(s.id)}
                    style={{ background: 'none', border: 'none', color: '#3A90A8', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: 0 }}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 첨부파일 */}
        <div>
          <label style={labelStyle}>
            첨부파일{' '}
            <span style={{ color: '#607898', fontWeight: 400 }}>(선택 — 최대 5개, 파일당 20MB)</span>
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              ...inputStyle, padding: '10px 14px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '8px',
              color: '#607898', userSelect: 'none',
            }}
          >
            <span style={{ fontSize: '16px' }}>📎</span>
            <span style={{ fontSize: '13px' }}>
              {selectedFiles.length < 5
                ? '파일을 선택하세요 (이미지, PDF, Word, Excel, HWP)'
                : '최대 5개 파일을 선택했습니다'}
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.hwp"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          {selectedFiles.length > 0 && (
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {selectedFiles.map((file, idx) => (
                <div key={`${file.name}-${file.size}`} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: '#131C2C', border: '1px solid #1A2838',
                  borderRadius: '6px', padding: '6px 10px',
                }}>
                  <span style={{ fontSize: '14px', flexShrink: 0 }}>📎</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', color: '#CDD5E0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name}
                    </p>
                    <p style={{ fontSize: '11px', color: '#607898', margin: '1px 0 0' }}>{formatSize(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    style={{ background: 'none', border: 'none', color: '#607898', cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 2px', flexShrink: 0 }}
                    aria-label={`${file.name} 제거`}
                  >×</button>
                </div>
              ))}
            </div>
          )}
          {uploadingFiles && (
            <p style={{ fontSize: '12px', color: '#4A7CC0', marginTop: '6px' }}>첨부파일 업로드 중...</p>
          )}
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={saveDraft}
            style={{
              background: '#182035', border: '1px solid #1A2838',
              color: '#8AAAC8', borderRadius: '8px', padding: '11px 16px',
              fontSize: '13px', fontWeight: 500, cursor: 'pointer', flexShrink: 0,
            }}>
            💾 임시저장
          </button>
          <button
            type="submit"
            disabled={submitting || uploadingFiles}
            style={{
              flex: 1,
              background: (submitting || uploadingFiles)
                ? '#1A2838'
                : 'linear-gradient(135deg, #4A7CC0, #0066CC)',
              color: 'white', border: 'none',
              borderRadius: '8px', padding: '11px',
              fontSize: '14px', fontWeight: 600,
              cursor: (submitting || uploadingFiles) ? 'not-allowed' : 'pointer',
            }}>
            {uploadingFiles ? '파일 업로드 중...' : submitting ? '저장 중...' : '보고서 저장'}
          </button>
          <Link href="/reports" style={{
            padding: '11px 20px', background: '#182035',
            border: '1px solid #1A2838', color: '#8AAAC8',
            borderRadius: '8px', fontSize: '14px',
            textDecoration: 'none', whiteSpace: 'nowrap',
          }}>
            취소
          </Link>
        </div>
      </form>
    </div>
  )
}
