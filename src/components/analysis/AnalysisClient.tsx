'use client'

import { useState, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ── 타입 ──────────────────────────────────────────────────────────────────────
interface SourceListItem {
  id: string; full_name: string
  current_organization: string | null; current_position: string | null; owner_id: string
}

interface AnalysisData {
  source: any
  relationships: any[]
  sameOrg: any[]
  sameUniversity: any[]
  sameHighSchool: any[]
  sameExam: any[]
  sameTown: any[]
  registrants: any[]
  examType: string | null
}

interface Props {
  allSources: SourceListItem[]
  selectedId: string | null
  analysisData: AnalysisData | null
}

// ── 관계 유형 레이블 ──────────────────────────────────────────────────────────
const RELATION_LABELS: Record<string, string> = {
  direct_mention: '직접 언급', acquaintance: '지인', colleague: '동료',
  alumni: '동문', family: '가족', other: '기타',
}

// ── 서브그룹 정렬 헬퍼 ────────────────────────────────────────────────────────
function sortedSubGroups(map: Map<string, any[]>): [string, any[]][] {
  return [...map.entries()].sort(([aKey, aItems], [bKey, bItems]) => {
    // 숫자 키면 숫자 정렬 (17회, 34회, 87학번 등)
    const numA = parseInt(aKey)
    const numB = parseInt(bKey)
    if (!isNaN(numA) && !isNaN(numB)) return numA - numB
    // 미입력은 마지막
    if (aKey.includes('미입력')) return 1
    if (bKey.includes('미입력')) return -1
    // 나머지는 count 내림차순
    return bItems.length - aItems.length
  })
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────
export default function AnalysisClient({ allSources, selectedId, analysisData }: Props) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const filteredSources = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.trim().toLowerCase()
    return allSources
      .filter(s => s.full_name.toLowerCase().includes(q) || (s.current_organization ?? '').toLowerCase().includes(q))
      .slice(0, 10)
  }, [searchQuery, allSources])

  function selectSource(id: string) {
    setSearchQuery(''); setShowDropdown(false)
    router.push(`/analysis?id=${id}`)
  }

  const src = analysisData?.source

  return (
    <div style={{ minHeight: '100%', background: '#0D1520' }}>

      {/* 헤더 */}
      <div style={{ borderBottom: '1px solid #1A2838', padding: '20px 32px 16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#CDD5E0', margin: 0 }}>
          취재원 관계 분석
        </h1>
        <p style={{ fontSize: '13px', color: '#607898', marginTop: '4px' }}>
          취재원을 선택하면 학맥·지역·소속·기수별 인맥을 계층적으로 분석합니다
        </p>
      </div>

      {/* 검색창 */}
      <div style={{ padding: '20px 32px 0' }}>
        <div style={{ position: 'relative', maxWidth: '480px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#607898' }}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="6" cy="6" r="4" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true) }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                placeholder="이름 또는 소속으로 검색..."
                style={{
                  width: '100%', paddingLeft: '36px', paddingRight: '12px',
                  paddingTop: '10px', paddingBottom: '10px',
                  background: '#131C2C', border: '1px solid #1A2838',
                  borderRadius: '8px', fontSize: '14px', color: '#CDD5E0',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {showDropdown && filteredSources.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              marginTop: '4px', background: '#131C2C',
              border: '1px solid #1A2838', borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden',
            }}>
              {filteredSources.map(s => (
                <button key={s.id} type="button" onMouseDown={() => selectSource(s.id)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', borderBottom: '1px solid #1A2838' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(30,144,255,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#CDD5E0' }}>{s.full_name}</div>
                  {s.current_organization && (
                    <div style={{ fontSize: '12px', color: '#607898', marginTop: '2px' }}>
                      {s.current_organization}{s.current_position ? ` · ${s.current_position}` : ''}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 빈 상태 */}
      {!analysisData && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 32px', gap: '12px' }}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="20" cy="20" r="13" stroke="#2A3848" strokeWidth="2.5"/>
            <path d="M31 31L42 42" stroke="#2A3848" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M14 20h12M20 14v12" stroke="#2A3848" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <p style={{ fontSize: '15px', color: '#607898', textAlign: 'center', lineHeight: 1.7 }}>
            취재원을 검색해서 선택하면<br />계층형 관계 분석 결과가 표시됩니다
          </p>
        </div>
      )}

      {/* 분석 결과 */}
      {analysisData && src && (
        <div style={{ padding: '20px 32px 48px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* 기본 정보 카드 */}
          <div style={{ background: '#131C2C', border: '1px solid #1A2838', borderRadius: '12px', padding: '20px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#CDD5E0', margin: 0 }}>{src.full_name}</h2>
                {(src.current_organization || src.current_position) && (
                  <p style={{ fontSize: '14px', color: '#8AAAC8', marginTop: '4px' }}>
                    {[src.current_organization, src.current_position].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <Link href={`/sources/${src.id}`}
                style={{ padding: '6px 14px', borderRadius: '7px', fontSize: '13px', background: 'rgba(30,144,255,0.12)', color: '#4A7CC0', border: '1px solid rgba(30,144,255,0.2)', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                전체 프로필 보기
              </Link>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
              {src.phone_primary && <InfoChip label={src.phone_primary} />}
              {src.email_primary && <InfoChip label={src.email_primary} />}
              {src.university && <InfoChip label={src.university + (src.university_major ? ` ${src.university_major}` : '') + (src.university_year ? ` ${src.university_year}학번` : '')} accent />}
              {src.high_school && <InfoChip label={src.high_school + (src.high_school_year ? ` ${src.high_school_year}학번` : '')} accent />}
              {src.exam_batch && <InfoChip label={src.exam_batch} accent />}
              {src.hometown_province && <InfoChip label={src.hometown_province + (src.hometown_city ? ` ${src.hometown_city}` : '')} />}
            </div>
            {src.tags && src.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                {src.tags.map((tag: string) => (
                  <span key={tag} style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px', background: 'rgba(30,144,255,0.08)', color: '#6A9AC8', border: '1px solid rgba(30,144,255,0.15)' }}>{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* 인맥 분석 */}
          <SectionCard title="인맥 분석">

            {/* 소속 동료 — 단순 목록 */}
            <FlatGroup
              label="소속 동료"
              groupKey={src.current_organization}
              items={analysisData.sameOrg}
              renderItem={(s: any) => <PersonRow key={s.id} id={s.id} name={s.full_name} sub={s.current_position} />}
            />

            {/* 대학 동문 — 학과 > 학번 */}
            <DrillGroup
              label="대학 동문"
              topKey={src.university}
              items={analysisData.sameUniversity}
              getSubKey={(s: any) => s.university_major || '전공 미입력'}
              renderItem={(s: any) => (
                <PersonRow key={s.id} id={s.id} name={s.full_name}
                  sub={s.current_organization || s.current_position || ''}
                  badge={s.university_year ? `${s.university_year}학번` : undefined} />
              )}
            />

            {/* 고교 동문 — 학번별 */}
            <DrillGroup
              label="고교 동문"
              topKey={src.high_school}
              items={analysisData.sameHighSchool}
              getSubKey={(s: any) => s.high_school_year ? `${s.high_school_year}학번` : '학번 미입력'}
              renderItem={(s: any) => (
                <PersonRow key={s.id} id={s.id} name={s.full_name}
                  sub={s.current_organization || s.current_position || ''} />
              )}
            />

            {/* 시험·기수 — 기수별 */}
            <DrillGroup
              label="시험 · 기수"
              topKey={analysisData.examType ?? src.exam_batch}
              items={analysisData.sameExam}
              getSubKey={(s: any) => {
                if (!s.exam_batch) return '미입력'
                if (analysisData.examType) {
                  const prefix = analysisData.examType + ' '
                  return s.exam_batch.startsWith(prefix) ? s.exam_batch.slice(prefix.length) : s.exam_batch
                }
                return s.exam_batch
              }}
              renderItem={(s: any) => (
                <PersonRow key={s.id} id={s.id} name={s.full_name}
                  sub={s.current_organization || s.current_position || ''} />
              )}
            />

            {/* 출신 지역 — 시·군·구별 */}
            <DrillGroup
              label="출신 지역"
              topKey={src.hometown_province}
              items={analysisData.sameTown}
              getSubKey={(s: any) => s.hometown_city || '시/구 미입력'}
              renderItem={(s: any) => (
                <PersonRow key={s.id} id={s.id} name={s.full_name}
                  sub={s.current_organization || s.current_position || ''} />
              )}
            />

          </SectionCard>

          {/* 직접 입력 관계 */}
          {analysisData.relationships.length > 0 && (
            <SectionCard title="직접 입력 관계">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {analysisData.relationships.map((rel: any) => {
                  const isA = rel.source_a_id === src.id
                  const other = isA ? rel.source_b : rel.source_a
                  if (!other) return null
                  return (
                    <div key={rel.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#0D1520', borderRadius: '7px', border: '1px solid #1A2838' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '11px', background: 'rgba(184,148,40,0.12)', color: '#C8A840', border: '1px solid rgba(184,148,40,0.2)', flexShrink: 0 }}>
                        {RELATION_LABELS[rel.relation_type] ?? rel.relation_type}
                      </span>
                      <Link href={`/sources/${other.id}`} style={{ color: '#B8CCDE', textDecoration: 'none', fontWeight: 600, fontSize: '14px' }}>
                        {other.full_name}
                      </Link>
                      {other.current_organization && (
                        <span style={{ fontSize: '12px', color: '#607898' }}>
                          {other.current_organization}{other.current_position ? ` · ${other.current_position}` : ''}
                        </span>
                      )}
                      {rel.relation_label && (
                        <span style={{ fontSize: '11px', color: '#607898', marginLeft: 'auto', fontStyle: 'italic' }}>"{rel.relation_label}"</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </SectionCard>
          )}

          {/* 등록 현황 */}
          <SectionCard title="등록 현황">
            {analysisData.registrants.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#607898' }}>등록 정보 없음</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {analysisData.registrants.map((r: any, i: number) => {
                  const p = r.profiles
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#0D1520', borderRadius: '7px', border: '1px solid #1A2838' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#B8CCDE' }}>{p?.full_name ?? '알 수 없음'}</span>
                      {p?.department && <span style={{ fontSize: '12px', color: '#607898' }}>{p.department}</span>}
                      <span style={{ marginLeft: 'auto', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', background: r.visibility === 'shared' ? 'rgba(56,200,184,0.1)' : 'rgba(255,255,255,0.06)', color: r.visibility === 'shared' ? '#38C8B8' : '#607898', border: `1px solid ${r.visibility === 'shared' ? 'rgba(56,200,184,0.25)' : 'rgba(255,255,255,0.1)'}` }}>
                        {r.visibility === 'shared' ? '공개' : '개인'}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

        </div>
      )}
    </div>
  )
}

// ── 서브 컴포넌트들 ───────────────────────────────────────────────────────────

function InfoChip({ label, accent }: { label: string; accent?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', background: accent ? 'rgba(30,144,255,0.08)' : '#0D1520', color: accent ? '#6A9AC8' : '#8AAAC8', border: accent ? '1px solid rgba(30,144,255,0.18)' : '1px solid #1A2838' }}>
      {label}
    </span>
  )
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: '#131C2C', border: '1px solid #1A2838', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px', borderBottom: '1px solid #1A2838' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#B8CCDE' }}>{title}</h3>
      </div>
      <div style={{ padding: '14px 20px' }}>{children}</div>
    </div>
  )
}

function PersonRow({ id, name, sub, badge }: { id: string; name: string; sub?: string; badge?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px', background: '#0D1520', borderRadius: '6px', border: '1px solid #1A2838' }}>
      <Link href={`/sources/${id}`} style={{ fontSize: '13px', fontWeight: 600, color: '#B8CCDE', textDecoration: 'none', flexShrink: 0 }}>
        {name}
      </Link>
      {sub && <span style={{ fontSize: '11px', color: '#607898', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>}
      {badge && (
        <span style={{ marginLeft: 'auto', flexShrink: 0, padding: '1px 7px', borderRadius: '4px', fontSize: '10px', background: 'rgba(0,212,255,0.08)', color: '#3A90A8', border: '1px solid rgba(0,212,255,0.15)' }}>
          {badge}
        </span>
      )}
    </div>
  )
}

// 단순 목록 (소속 동료 등 — 드릴다운 없음)
function FlatGroup({ label, groupKey, items, renderItem }: {
  label: string; groupKey: string | null; items: any[]; renderItem: (s: any) => React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  return (
    <GroupRow
      label={label} groupKey={groupKey} count={items.length}
      expanded={expanded} onToggle={() => setExpanded(p => !p)}
    >
      {expanded && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', paddingLeft: '100px' }}>
          {items.map(renderItem)}
        </div>
      )}
      {expanded && items.length === 0 && (
        <p style={{ fontSize: '12px', color: '#3A4A5E', paddingLeft: '100px', marginTop: '4px' }}>해당 없음</p>
      )}
    </GroupRow>
  )
}

// 드릴다운 그룹 (대학/고교/지역/기수 — 서브그룹 존재)
function DrillGroup({ label, topKey, items, getSubKey, renderItem }: {
  label: string; topKey: string | null; items: any[]
  getSubKey: (s: any) => string; renderItem: (s: any) => React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set())

  const subGroups = useMemo(() => {
    const map = new Map<string, any[]>()
    for (const s of items) {
      const k = getSubKey(s)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(s)
    }
    return sortedSubGroups(map)
  }, [items, getSubKey])

  const toggleSub = useCallback((key: string) => {
    setExpandedSubs(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }, [])

  // 서브그룹이 1개뿐이면 단순 목록으로 표시
  const isSingleGroup = subGroups.length <= 1

  return (
    <GroupRow
      label={label} groupKey={topKey} count={items.length}
      expanded={expanded} onToggle={() => setExpanded(p => !p)}
    >
      {expanded && items.length === 0 && (
        <p style={{ fontSize: '12px', color: '#3A4A5E', paddingLeft: '100px', marginTop: '4px' }}>해당 없음</p>
      )}

      {expanded && items.length > 0 && isSingleGroup && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', paddingLeft: '100px' }}>
          {items.map(renderItem)}
        </div>
      )}

      {expanded && items.length > 0 && !isSingleGroup && (
        <div style={{ marginTop: '6px', paddingLeft: '100px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {subGroups.map(([subKey, subItems]) => (
            <div key={subKey}>
              {/* 서브그룹 헤더 */}
              <button
                type="button"
                onClick={() => toggleSub(subKey)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid #1A2838', borderRadius: '6px', cursor: 'pointer', padding: '5px 10px', marginBottom: '3px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#8AAAC8' }}>{subKey}</span>
                <span style={{ fontSize: '11px', color: '#4A7CC0', marginLeft: '4px' }}>{subItems.length}명</span>
                <span style={{ fontSize: '10px', color: '#607898', marginLeft: 'auto' }}>
                  {expandedSubs.has(subKey) ? '▲' : '▼'}
                </span>
              </button>
              {/* 서브그룹 인물 목록 */}
              {expandedSubs.has(subKey) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginLeft: '12px', marginBottom: '6px' }}>
                  {subItems.map(renderItem)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </GroupRow>
  )
}

// 그룹 헤더 행 (공통)
function GroupRow({ label, groupKey, count, expanded, onToggle, children }: {
  label: string; groupKey: string | null; count: number
  expanded: boolean; onToggle: () => void; children?: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: '8px' }}>
      <button
        type="button"
        onClick={groupKey ? onToggle : undefined}
        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', background: 'none', border: 'none', cursor: groupKey ? 'pointer' : 'default', padding: '4px 0', textAlign: 'left' }}>
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#8AAAC8', minWidth: '90px', flexShrink: 0 }}>{label}</span>
        {groupKey ? (
          <>
            <span style={{ padding: '2px 8px', borderRadius: '5px', fontSize: '12px', background: '#0D1520', color: '#B8CCDE', border: '1px solid #1A2838', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {groupKey}
            </span>
            <span style={{ fontSize: '11px', color: count > 0 ? '#4A7CC0' : '#3A4A5E' }}>
              {count > 0 ? `${count}명` : '없음'}
            </span>
            {count > 0 && (
              <span style={{ fontSize: '10px', color: '#607898', marginLeft: 'auto' }}>{expanded ? '▲' : '▼'}</span>
            )}
          </>
        ) : (
          <span style={{ fontSize: '11px', color: '#3A4A5E' }}>정보 없음</span>
        )}
      </button>
      {children}
    </div>
  )
}
