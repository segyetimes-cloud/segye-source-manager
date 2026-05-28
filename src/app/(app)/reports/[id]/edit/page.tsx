'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import type { ReportVisibility } from '@/types/database'
import { VISIBILITY_OPTIONS } from '@/lib/reportVisibility'
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

export default function EditReportPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

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
    if (!content.trim()) { setError('본문을 입력해 주세요.'); return }
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
          <label style={labelStyle}>본문 *</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="보고서 내용을 작성하세요"
            rows={18}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
            required
          />
        </div>

        {/* 민감정보 */}
        <div style={{
          background: 'rgba(255,153,0,0.04)',
          border: '1px solid rgba(255,153,0,0.25)',
          borderRadius: '10px',
          padding: '14px',
        }}>
          <label style={{ ...labelStyle, color: '#A87228', marginBottom: '4px' }}>
            ⚠️ 민감정보{' '}
            <span style={{ color: '#6B5020', fontWeight: 400 }}>(선택 — 작성자·데스크만 열람)</span>
          </label>
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

        {/* 버튼 */}
        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            style={{
              flex: 1,
              background: submitting ? '#1A2838' : 'linear-gradient(135deg, #4A7CC0, #0066CC)',
              color: 'white', border: 'none',
              borderRadius: '8px', padding: '11px',
              fontSize: '14px', fontWeight: 600,
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}>
            {submitting ? '저장 중...' : '수정 저장'}
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
