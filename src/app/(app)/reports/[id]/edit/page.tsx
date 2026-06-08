'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import type { ReportVisibility } from '@/types/database'
import { VISIBILITY_OPTIONS } from '@/lib/reportVisibility'
import AllowedUsersSelector, { type AllowedUser } from '@/components/reports/AllowedUsersSelector'
import type { AttachmentRow } from '@/components/reports/ReportAttachments'

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

export default function EditReportPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [existingAttachments, setExistingAttachments] = useState<AttachmentRow[]>([])
  const [newFiles, setNewFiles] = useState<File[]>([])
  const [deletingAtt, setDeletingAtt] = useState<string | null>(null)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sensitiveContent, setSensitiveContent] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [visibility, setVisibility] = useState<ReportVisibility>('author_only')
  const [allowedUsers, setAllowedUsers] = useState<AllowedUser[]>([])

  const [sourceQuery, setSourceQuery] = useState('')
  const [sourceResults, setSourceResults] = useState<SourceResult[]>([])
  const [selectedSources, setSelectedSources] = useState<SourceResult[]>([])
  const [sourceSearching, setSourceSearching] = useState(false)

  useEffect(() => {
    fetch(`/api/reports/${id}`)
      .then(r => r.json())
      .then(data => {
        // GET /api/reports/[id] 는 { report: {...} } 구조로 반환
        const r = data.report
        if (!r) { setError('보고서를 불러올 수 없습니다.'); setLoading(false); return }

        setTitle(r.title ?? '')
        setContent(r.content ?? '')
        setSensitiveContent(r.sensitive_content ?? '')
        setTags(r.tags ?? [])
        setVisibility(r.visibility ?? 'author_only')

        interface ReportSourceItem { sources: { id: string; full_name: string; current_organization: string | null } | null }
        const linkedSources = ((r.report_sources ?? []) as ReportSourceItem[])
          .map((rs: ReportSourceItem) => rs.sources)
          .filter((s): s is SourceResult => s !== null)
        setSelectedSources(linkedSources)

        // 기존 지정 열람자 로드
        fetch(`/api/reports/${id}/allowed-users`)
          .then(res => res.ok ? res.json() : { allowed: [] })
          .then(d => {
            interface AllowedUserItem { user_id: string; profiles?: { full_name: string; department: string | null; rank: string | null } | null }
            const users = ((d.allowed ?? []) as AllowedUserItem[]).map(a => ({
              id: a.user_id,
              full_name: a.profiles?.full_name ?? '—',
              department: a.profiles?.department ?? null,
              rank: a.profiles?.rank ?? null,
            }))
            setAllowedUsers(users)
          })
          .catch(() => {/* 열람자 로드 실패는 무시 */})

        // 기존 첨부파일 로드
        fetch(`/api/reports/${id}/attachments`)
          .then(r => r.ok ? r.json() : { attachments: [] })
          .then(d => setExistingAttachments((d.attachments ?? []) as AttachmentRow[]))
          .catch(() => {})

        setLoading(false)
      })
      .catch(() => { setError('보고서를 불러올 수 없습니다.'); setLoading(false) })
  }, [id])

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

  async function deleteExistingAttachment(att: AttachmentRow) {
    if (!confirm(`"${att.filename}" 파일을 삭제하시겠습니까?`)) return
    setDeletingAtt(att.id)
    try {
      const res = await fetch(
        `/api/reports/${id}/attachments?attachmentId=${encodeURIComponent(att.id)}`,
        { method: 'DELETE' }
      )
      if (res.ok) setExistingAttachments(prev => prev.filter(a => a.id !== att.id))
    } catch {}
    setDeletingAtt(null)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    setNewFiles(prev => {
      const combined = [...prev]
      for (const f of files) {
        if (!combined.find(x => x.name === f.name && x.size === f.size)) {
          combined.push(f)
        }
      }
      return combined.slice(0, 5)
    })
    e.target.value = ''
  }

  function removeFile(index: number) {
    setNewFiles(prev => prev.filter((_, i) => i !== index))
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) { setError('제목을 입력해 주세요.'); return }
    if (!content.trim() && !sensitiveContent.trim()) { setError('본문 또는 민감정보 중 하나는 입력해 주세요.'); return }
    setSubmitting(true)
    setError('')

    const abort = new AbortController()
    const timer = setTimeout(() => abort.abort(), 15_000)  // 15초 타임아웃

    try {
      const res = await fetch(`/api/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        signal: abort.signal,
        body: JSON.stringify({
          title, content, tags,
          sensitive_content: sensitiveContent,
          visibility,
          source_ids: selectedSources.map(s => s.id),
          allowed_user_ids: allowedUsers.map(u => u.id),
        }),
      })

      clearTimeout(timer)

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? '수정에 실패했습니다.')
        return
      }

      if (newFiles.length > 0) {
        setUploadingFiles(true)
        for (const file of newFiles) {
          const fd = new FormData()
          fd.append('file', file)
          await fetch(`/api/reports/${id}/attachments`, { method: 'POST', body: fd }).catch(() => {})
        }
        setUploadingFiles(false)
      }

      router.push(`/reports/${id}`)
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

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#607898' }}>불러오는 중...</div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5" style={{ paddingBottom: '2rem' }}>

      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <Link href={`/reports/${id}`} style={{ color: '#607898', textDecoration: 'none', fontSize: '22px', lineHeight: 1 }}>←</Link>
        <div>
          <h1 className="text-lg font-bold" style={{ color: '#CDD5E0' }}>보고서 수정</h1>
          <p style={{ fontSize: '12px', color: '#607898', marginTop: '2px' }}>
            내용을 변경하면 수정 이력이 자동으로 기록됩니다
          </p>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)',
          borderRadius: '8px', padding: '10px 14px',
          color: '#C04040', fontSize: '13px',
        }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* 제목 */}
        <div>
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

        {/* 본문 */}
        <div>
          <label style={labelStyle}>
            본문
            {!sensitiveContent.trim() && <span style={{ color: '#C04040', marginLeft: 2 }}>*</span>}
            {sensitiveContent.trim() && <span style={{ fontSize: '11px', color: '#607898', fontWeight: 400, marginLeft: 6 }}>(민감정보에 내용이 있으면 비워도 됩니다)</span>}
          </label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="보고서 내용을 작성하세요"
            rows={18}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
          />
          <div style={{ marginTop: '6px', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => {
                if (!content.trim()) return
                setSensitiveContent(prev => prev ? `${prev}\n\n${content}` : content)
                setContent('')
              }}
              style={{
                fontSize: '11px',
                padding: '3px 10px',
                borderRadius: '5px',
                background: 'rgba(74,124,192,0.08)',
                border: '1px solid rgba(74,124,192,0.2)',
                color: '#6A9AC8',
                cursor: 'pointer',
              }}
            >
              ⬇️ 민감정보로 이동
            </button>
          </div>
        </div>

        {/* 민감정보 */}
        <div style={{
          background: 'rgba(255,153,0,0.04)',
          border: '1px solid rgba(255,153,0,0.25)',
          borderRadius: '10px',
          padding: '14px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <label style={{ ...labelStyle, color: '#A87228', marginBottom: 0 }}>
              ⚠️ 민감정보{' '}
              <span style={{ color: '#6B5020', fontWeight: 400 }}>(선택 — 작성자·데스크만 열람)</span>
            </label>
            <button
              type="button"
              onClick={() => {
                if (!sensitiveContent.trim()) return
                setContent(prev => prev ? `${prev}\n\n${sensitiveContent}` : sensitiveContent)
                setSensitiveContent('')
              }}
              style={{
                fontSize: '11px',
                padding: '3px 10px',
                borderRadius: '5px',
                background: 'rgba(74,124,192,0.08)',
                border: '1px solid rgba(74,124,192,0.2)',
                color: '#6A9AC8',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              ⬆️ 본문으로 이동
            </button>
          </div>
          <p style={{ fontSize: '11px', color: '#6B5020', marginBottom: '8px' }}>
            공개 본문에 포함하기 어려운 민감한 취재 내용을 별도로 기록합니다. 데스크(부장 이상)와 작성자만 볼 수 있습니다.
          </p>
          <textarea
            value={sensitiveContent}
            onChange={e => setSensitiveContent(e.target.value)}
            placeholder="공개되어선 안 되는 취재원 정보, 미확인 사실, 내부 동향 등을 입력하세요"
            rows={8}
            style={{
              ...inputStyle,
              resize: 'vertical',
              lineHeight: 1.6,
              background: 'rgba(30,16,4,0.6)',
              border: '1px solid rgba(255,153,0,0.3)',
              color: '#CDD5E0',
            }}
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

        {/* 열람 범위 */}
        <div>
          <label style={labelStyle}>열람 범위 *</label>
          <div className="flex flex-col gap-2">
            {VISIBILITY_OPTIONS.map(opt => (
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
        {(visibility === 'author_only' || visibility === 'desk_above') && (
          <div>
            <label style={labelStyle}>
              지정 열람자{' '}
              <span style={{ color: '#607898', fontWeight: 400 }}>(선택 — 등급 무관하게 지명된 기자도 열람 가능)</span>
            </label>
            <AllowedUsersSelector selected={allowedUsers} onChange={setAllowedUsers} />
          </div>
        )}

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
            <span style={{ color: '#607898', fontWeight: 400 }}>(파일당 20MB · 최대 5개 추가)</span>
          </label>

          {/* 기존 첨부파일 목록 */}
          {existingAttachments.length > 0 && (
            <div style={{ marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {existingAttachments.map(att => (
                <div key={att.id} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: '#131C2C', border: '1px solid #1A2838',
                  borderRadius: '6px', padding: '6px 10px',
                }}>
                  <span style={{ fontSize: '14px', flexShrink: 0 }}>
                    {att.mime_type.startsWith('image/') ? '🖼' : '📎'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', color: '#CDD5E0', margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {att.filename}
                    </p>
                    <p style={{ fontSize: '11px', color: '#607898', margin: '1px 0 0' }}>
                      {formatSize(att.file_size)} · 기존 첨부
                    </p>
                  </div>
                  <button type="button" onClick={() => deleteExistingAttachment(att)}
                    disabled={deletingAtt === att.id}
                    style={{
                      background: 'none', border: '1px solid rgba(192,64,64,0.3)',
                      color: deletingAtt === att.id ? '#607898' : '#904040',
                      borderRadius: '6px', padding: '3px 8px',
                      fontSize: '12px', cursor: deletingAtt === att.id ? 'not-allowed' : 'pointer',
                      flexShrink: 0,
                    }}>
                    {deletingAtt === att.id ? '...' : '삭제'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 새 파일 picker */}
          <div onClick={() => fileInputRef.current?.click()} style={{
            ...inputStyle, padding: '10px 14px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '8px',
            color: '#607898', userSelect: 'none',
          }}>
            <span style={{ fontSize: '16px' }}>📎</span>
            <span style={{ fontSize: '13px' }}>
              {newFiles.length < 5 ? '파일 추가 (이미지, PDF, Word, Excel, HWP)' : '최대 5개 파일 추가됨'}
            </span>
          </div>
          <input ref={fileInputRef} type="file" multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.hwp"
            onChange={handleFileChange} style={{ display: 'none' }} />

          {/* 새 파일 목록 */}
          {newFiles.length > 0 && (
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {newFiles.map((file, idx) => (
                <div key={`${file.name}-${file.size}`} style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: '#131C2C', border: '1px solid rgba(30,144,255,0.15)',
                  borderRadius: '6px', padding: '6px 10px',
                }}>
                  <span style={{ fontSize: '14px', flexShrink: 0 }}>➕</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: '13px', color: '#CDD5E0', margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {file.name}
                    </p>
                    <p style={{ fontSize: '11px', color: '#4A9EFF', margin: '1px 0 0' }}>
                      {formatSize(file.size)} · 저장 시 업로드
                    </p>
                  </div>
                  <button type="button" onClick={() => removeFile(idx)} style={{
                    background: 'none', border: 'none', color: '#607898',
                    cursor: 'pointer', fontSize: '16px', lineHeight: 1, padding: '0 2px', flexShrink: 0,
                  }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting || uploadingFiles}
            style={{
              flex: 1,
              background: (submitting || uploadingFiles) ? '#1A2838' : 'linear-gradient(135deg, #4A7CC0, #0066CC)',
              color: 'white', border: 'none',
              borderRadius: '8px', padding: '11px',
              fontSize: '14px', fontWeight: 600,
              cursor: (submitting || uploadingFiles) ? 'not-allowed' : 'pointer',
            }}>
            {uploadingFiles ? '파일 업로드 중...' : submitting ? '저장 중...' : '수정 저장'}
          </button>
          <Link href={`/reports/${id}`} style={{
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
