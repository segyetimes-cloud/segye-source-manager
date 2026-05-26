'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface SourceListItem {
  id: string
  full_name: string
  current_organization: string | null
  current_position: string | null
  owner_id: string
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
}

interface Props {
  allSources: SourceListItem[]
  selectedId: string | null
  analysisData: AnalysisData | null
}

const RELATION_LABELS: Record<string, string> = {
  direct_mention: '직접 언급',
  acquaintance: '지인',
  colleague: '동료',
  alumni: '동문',
  family: '가족',
  other: '기타',
}

export default function AnalysisClient({ allSources, selectedId, analysisData }: Props) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)

  const filteredSources = useMemo(() => {
    if (!searchQuery.trim()) return []
    const q = searchQuery.trim().toLowerCase()
    return allSources
      .filter(s =>
        s.full_name.toLowerCase().includes(q) ||
        (s.current_organization ?? '').toLowerCase().includes(q)
      )
      .slice(0, 10)
  }, [searchQuery, allSources])

  function selectSource(id: string) {
    setSearchQuery('')
    setShowDropdown(false)
    router.push(`/analysis?id=${id}`)
  }

  const src = analysisData?.source

  return (
    <div style={{
      minHeight: '100%',
      background: '#0D1520',
      padding: '0',
    }}>
      {/* 헤더 */}
      <div style={{
        borderBottom: '1px solid #1A2838',
        padding: '20px 32px 16px',
        background: '#0D1520',
      }}>
        <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#CDD5E0', margin: 0 }}>
          취재원 상세 열람
        </h1>
        <p style={{ fontSize: '13px', color: '#607898', marginTop: '4px' }}>
          취재원을 검색하면 인맥 분석, 직접 연결 관계, 등록 현황을 확인할 수 있습니다
        </p>
      </div>

      {/* 검색창 */}
      <div style={{ padding: '20px 32px 0' }}>
        <div style={{ position: 'relative', maxWidth: '480px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true) }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                placeholder="이름 또는 소속으로 검색..."
                style={{
                  width: '100%', paddingLeft: '14px', paddingRight: '12px',
                  paddingTop: '10px', paddingBottom: '10px',
                  background: '#131C2C', border: '1px solid #1A2838',
                  borderRadius: '8px', fontSize: '14px', color: '#CDD5E0',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* 드롭다운 */}
          {showDropdown && filteredSources.length > 0 && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
              marginTop: '4px', background: '#131C2C',
              border: '1px solid #1A2838', borderRadius: '8px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              overflow: 'hidden',
            }}>
              {filteredSources.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onMouseDown={() => selectSource(s.id)}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '10px 14px', background: 'none', border: 'none',
                    cursor: 'pointer', borderBottom: '1px solid #1A2838',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(30,144,255,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
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

      {/* 분석 결과 없을 때 */}
      {!analysisData && (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '80px 32px',
          gap: '12px',
        }}>
          <p style={{ fontSize: '15px', color: '#607898', textAlign: 'center' }}>
            취재원을 검색해서 선택하면<br />인맥 분석 결과가 여기에 표시됩니다
          </p>
        </div>
      )}

      {/* 분석 결과 */}
      {analysisData && src && (
        <div style={{ padding: '20px 32px 40px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* 기본 정보 카드 */}
          <div style={{
            background: '#131C2C', border: '1px solid #1A2838',
            borderRadius: '12px', padding: '20px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#CDD5E0', margin: 0 }}>
                  {src.full_name}
                </h2>
                {(src.current_organization || src.current_position) && (
                  <p style={{ fontSize: '14px', color: '#8AAAC8', marginTop: '4px' }}>
                    {[src.current_organization, src.current_position].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              <Link
                href={`/sources/${src.id}`}
                style={{
                  padding: '6px 14px', borderRadius: '7px', fontSize: '13px',
                  background: 'rgba(30,144,255,0.12)', color: '#4A7CC0',
                  border: '1px solid rgba(30,144,255,0.2)', textDecoration: 'none',
                  whiteSpace: 'nowrap',
                }}>
                전체 프로필 보기 &rarr;
              </Link>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
              {src.phone_primary && (
                <Chip label="전화" text={src.phone_primary} />
              )}
              {src.email_primary && (
                <Chip label="이메일" text={src.email_primary} />
              )}
              {src.university && (
                <Chip label="대학" text={src.university + (src.university_major ? ` ${src.university_major}` : '')} />
              )}
              {src.high_school && (
                <Chip label="고교" text={src.high_school} />
              )}
              {src.exam_batch && (
                <Chip label="기수" text={src.exam_batch} />
              )}
              {src.hometown_province && (
                <Chip label="출신" text={src.hometown_province + (src.hometown_city ? ` ${src.hometown_city}` : '')} />
              )}
            </div>

            {src.tags && src.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px' }}>
                {(src.tags as string[]).map((tag: string) => (
                  <span key={tag} style={{
                    padding: '3px 10px', borderRadius: '20px', fontSize: '11px',
                    background: 'rgba(30,144,255,0.08)', color: '#6A9AC8',
                    border: '1px solid rgba(30,144,255,0.15)',
                  }}>{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* 인맥 분석 */}
          <SectionCard title="인맥 분석" badge="network">
            <ConnectionGroup
              label="소속 동료"
              groupKey={src.current_organization ?? null}
              items={analysisData.sameOrg}
              emptyMsg="같은 소속 취재원 없음"
            />
            <ConnectionGroup
              label="대학 동문"
              groupKey={src.university ?? null}
              items={analysisData.sameUniversity}
              emptyMsg="같은 대학 취재원 없음"
            />
            <ConnectionGroup
              label="고교 동문"
              groupKey={src.high_school ?? null}
              items={analysisData.sameHighSchool}
              emptyMsg="같은 고교 취재원 없음"
            />
            <ConnectionGroup
              label="시험·기수 동기"
              groupKey={src.exam_batch ?? null}
              items={analysisData.sameExam}
              emptyMsg="같은 기수 취재원 없음"
            />
            <ConnectionGroup
              label="출신 지역"
              groupKey={src.hometown_province ?? null}
              items={analysisData.sameTown}
              emptyMsg="같은 지역 취재원 없음"
            />
          </SectionCard>

          {/* 직접 입력 관계 */}
          {analysisData.relationships.length > 0 && (
            <SectionCard title="직접 입력 관계" badge="link">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {analysisData.relationships.map((rel: any) => {
                  const isA = rel.source_a_id === src.id
                  const other = isA ? rel.source_b : rel.source_a
                  if (!other) return null
                  return (
                    <div key={rel.id} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 12px', background: '#0D1520',
                      borderRadius: '7px', border: '1px solid #1A2838',
                    }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: '4px', fontSize: '11px',
                        background: 'rgba(184,148,40,0.12)', color: '#C8A840',
                        border: '1px solid rgba(184,148,40,0.2)', flexShrink: 0,
                      }}>
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
                        <span style={{ fontSize: '11px', color: '#607898', marginLeft: 'auto', fontStyle: 'italic' }}>
                          &ldquo;{rel.relation_label}&rdquo;
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </SectionCard>
          )}

          {/* 등록 현황 */}
          <SectionCard title="등록 현황" badge="pin">
            {analysisData.registrants.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#607898' }}>등록 정보 없음</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {analysisData.registrants.map((r: any, i: number) => {
                  const p = r.profiles
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '8px 12px', background: '#0D1520',
                      borderRadius: '7px', border: '1px solid #1A2838',
                    }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: '#B8CCDE' }}>
                        {p?.full_name ?? '알 수 없음'}
                      </span>
                      {p?.department && (
                        <span style={{ fontSize: '12px', color: '#607898' }}>
                          {p.department}
                        </span>
                      )}
                      <span style={{
                        marginLeft: 'auto', padding: '2px 8px', borderRadius: '4px', fontSize: '11px',
                        background: r.visibility === 'shared' ? 'rgba(56,200,184,0.1)' : 'rgba(255,255,255,0.06)',
                        color: r.visibility === 'shared' ? '#38C8B8' : '#607898',
                        border: `1px solid ${r.visibility === 'shared' ? 'rgba(56,200,184,0.25)' : 'rgba(255,255,255,0.1)'}`,
                      }}>
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

// 서브 컴포넌트들

function Chip({ label, text }: { label: string; text: string }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '5px',
      padding: '4px 10px', borderRadius: '6px', fontSize: '12px',
      background: '#0D1520', color: '#8AAAC8',
      border: '1px solid #1A2838',
    }}>
      <span style={{ fontSize: '10px', color: '#607898' }}>{label}</span>
      <span>{text}</span>
    </span>
  )
}

function SectionCard({ title, badge, children }: { title: string; badge: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#131C2C', border: '1px solid #1A2838',
      borderRadius: '12px', overflow: 'hidden',
    }}>
      <div style={{
        padding: '12px 20px', borderBottom: '1px solid #1A2838',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <span style={{
          fontSize: '10px', fontWeight: 700, color: '#607898',
          padding: '1px 6px', borderRadius: '4px',
          background: '#0D1520', border: '1px solid #1A2838',
          textTransform: 'uppercase', letterSpacing: '0.05em',
        }}>{badge}</span>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#B8CCDE' }}>{title}</h3>
      </div>
      <div style={{ padding: '14px 20px' }}>
        {children}
      </div>
    </div>
  )
}

function ConnectionGroup({
  label, groupKey, items, emptyMsg,
}: {
  label: string
  groupKey: string | null
  items: any[]
  emptyMsg: string
}) {
  const [expanded, setExpanded] = useState(true)

  if (!groupKey) {
    return (
      <div style={{ marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#607898', minWidth: '80px' }}>{label}</span>
          <span style={{ fontSize: '11px', color: '#3A4A5E' }}>정보 없음</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: '12px' }}>
      <button
        type="button"
        onClick={() => setExpanded(p => !p)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
          background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 600, color: '#8AAAC8', minWidth: '90px' }}>{label}</span>
        <span style={{
          padding: '1px 8px', borderRadius: '4px', fontSize: '11px',
          background: '#0D1520', color: '#607898', border: '1px solid #1A2838',
        }}>{groupKey}</span>
        <span style={{ fontSize: '11px', color: '#4A7CC0', marginLeft: '4px' }}>
          {items.length > 0 ? `${items.length}명` : '없음'}
        </span>
        {items.length > 0 && (
          <span style={{ fontSize: '10px', color: '#607898', marginLeft: 'auto' }}>
            {expanded ? '▲' : '▼'}
          </span>
        )}
      </button>

      {expanded && items.length > 0 && (
        <div style={{
          marginLeft: '98px', marginTop: '4px',
          display: 'flex', flexDirection: 'column', gap: '4px',
        }}>
          {items.map((s: any) => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '5px 10px', background: '#0D1520',
              borderRadius: '6px', border: '1px solid #1A2838',
            }}>
              <Link
                href={`/sources/${s.id}`}
                style={{ fontSize: '13px', fontWeight: 600, color: '#B8CCDE', textDecoration: 'none' }}
              >
                {s.full_name}
              </Link>
              {s.current_position && (
                <span style={{ fontSize: '11px', color: '#607898' }}>{s.current_position}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {expanded && items.length === 0 && (
        <div style={{ marginLeft: '98px', marginTop: '4px' }}>
          <span style={{ fontSize: '11px', color: '#3A4A5E' }}>{emptyMsg}</span>
        </div>
      )}
    </div>
  )
}
