'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Entity  { name: string; role: string | null; mentions: string }
interface Relation { from: string; to: string; type: string; detail: string }
interface SourceMatch { name: string; sourceId: string; organization: string | null; position: string | null }

interface ExtractResult {
  entities: Entity[]
  relations: Relation[]
  sourceMatches: SourceMatch[]
}

interface Props {
  reportId: string
}

const RELATION_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  동기:      { bg: 'rgba(74,124,192,0.1)',  color: '#4A7CC0', border: 'rgba(74,124,192,0.3)'  },
  친분:      { bg: 'rgba(61,158,106,0.1)',  color: '#3D9E6A', border: 'rgba(61,158,106,0.3)'  },
  상하관계:  { bg: 'rgba(192,140,0,0.1)',   color: '#B89020', border: 'rgba(192,140,0,0.3)'   },
  가족:      { bg: 'rgba(192,64,64,0.1)',   color: '#C04040', border: 'rgba(192,64,64,0.3)'   },
  업무:      { bg: 'rgba(100,70,180,0.1)',  color: '#8060C0', border: 'rgba(100,70,180,0.3)'  },
}

function relStyle(type: string) {
  return RELATION_COLOR[type] ?? { bg: 'rgba(104,120,152,0.1)', color: '#607898', border: 'rgba(104,120,152,0.3)' }
}

export default function ReportRelationExtractor({ reportId }: Props) {
  const [loading, setLoading]     = useState(true)  // 마운트 시 캐시 로딩
  const [result, setResult]       = useState<ExtractResult | null>(null)
  const [error, setError]         = useState('')
  const [collapsed, setCollapsed] = useState(false)

  // 마운트 시 DB 캐시된 결과 로드
  useEffect(() => {
    fetch(`/api/reports/${reportId}/extract-relations`)
      .then(r => r.json())
      .then(data => {
        if (data.entities?.length > 0 || data.relations?.length > 0) {
          setResult(data as ExtractResult)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [reportId])

  async function extract(method: 'POST' | 'GET' = 'POST') {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/reports/${reportId}/extract-relations`, { method })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? '추출 실패'); return }
      setResult(data as ExtractResult)
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 인물별 연결 관계 인덱스
  function relationsOf(name: string): Relation[] {
    if (!result) return []
    return result.relations.filter(r => r.from === name || r.to === name)
  }

  // 취재원 DB 매칭 조회
  function sourceMatch(name: string): SourceMatch | undefined {
    return result?.sourceMatches.find(
      m => m.name === name || m.name.includes(name) || name.includes(m.name)
    )
  }

  /* ── 캐시 없음 상태: 수동 추출 버튼 ── */
  if (!result && !loading) {
    return (
      <div>
        <button
          type="button"
          onClick={() => extract('POST')}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            background: 'rgba(100,70,200,0.08)',
            border: '1px solid rgba(100,70,200,0.25)',
            color: '#9B7DE8',
            borderRadius: '8px', padding: '8px 16px',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(100,70,200,0.16)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(100,70,200,0.08)')}
        >
          🤖 AI 인물 관계망 추출
        </button>
        {error && <p style={{ fontSize: '12px', color: '#C04040', marginTop: '6px' }}>{error}</p>}
      </div>
    )
  }

  /* ── 로딩 ── */
  if (loading) {
    return (
      <div style={{
        background: 'rgba(100,70,200,0.06)', border: '1px solid rgba(100,70,200,0.2)',
        borderRadius: '10px', padding: '16px 20px',
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <span style={{ fontSize: '18px', animation: 'spin 1s linear infinite' }}>⚙️</span>
        <span style={{ fontSize: '13px', color: '#9B7DE8' }}>
          AI가 인물·관계를 분석 중입니다…
        </span>
      </div>
    )
  }

  /* ── 결과 ── */
  if (!result) return null
  const { entities, relations } = result
  const hasData = entities.length > 0

  return (
    <div style={{
      background: 'rgba(100,70,200,0.04)',
      border: '1px solid rgba(100,70,200,0.2)',
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      {/* 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        borderBottom: collapsed ? 'none' : '1px solid rgba(100,70,200,0.15)',
        background: 'rgba(100,70,200,0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>🤖</span>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#9B7DE8' }}>
            AI 인물 관계망
          </span>
          <span style={{
            fontSize: '11px', fontWeight: 600,
            background: 'rgba(100,70,200,0.15)', color: '#9B7DE8',
            border: '1px solid rgba(100,70,200,0.3)',
            borderRadius: '4px', padding: '1px 7px',
          }}>
            {entities.length}명 · {relations.length}개 관계
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => extract('POST')}
            title="AI 재분석"
            style={{
              background: 'none', border: '1px solid rgba(100,70,200,0.25)',
              color: '#7A60C0', borderRadius: '5px', padding: '3px 9px',
              fontSize: '11px', cursor: 'pointer',
            }}
          >
            🔄 재분석
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(c => !c)}
            style={{
              background: 'none', border: 'none',
              color: '#7A60C0', cursor: 'pointer', fontSize: '15px', lineHeight: 1,
            }}
          >
            {collapsed ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {collapsed ? null : !hasData ? (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: '#607898' }}>
            본문에서 인물·관계를 추출하지 못했습니다.
          </p>
        </div>
      ) : (
        <div style={{ padding: '16px' }}>

          {/* ── 등장 인물 ── */}
          <p style={{ fontSize: '11px', fontWeight: 600, color: '#7A60C0', marginBottom: '8px', letterSpacing: '0.05em' }}>
            등장 인물
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '18px' }}>
            {entities.map((e, i) => {
              const sm = sourceMatch(e.name)
              return (
                <div key={i} style={{
                  background: '#182035', border: '1px solid #1A2838',
                  borderRadius: '8px', padding: '8px 12px',
                  maxWidth: '200px',
                  transition: 'border-color 0.15s',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#CDD5E0' }}>
                      {e.name}
                    </span>
                    {e.role && (
                      <span style={{ fontSize: '11px', color: '#607898' }}>{e.role}</span>
                    )}
                  </div>
                  <p style={{ fontSize: '11px', color: '#5A7099', margin: '0 0 6px', lineHeight: 1.4 }}>
                    {e.mentions}
                  </p>
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {/* 분석 페이지 링크 */}
                    <Link
                      href={`/analysis?q=${encodeURIComponent(e.name)}`}
                      style={{
                        fontSize: '10px', fontWeight: 600,
                        background: 'rgba(74,124,192,0.12)',
                        color: '#4A7CC0', border: '1px solid rgba(74,124,192,0.25)',
                        borderRadius: '4px', padding: '2px 7px',
                        textDecoration: 'none',
                      }}
                    >
                      🔍 관계 분석
                    </Link>
                    {/* 취재원 DB 매칭 */}
                    {sm && (
                      <Link
                        href={`/sources/${sm.sourceId}`}
                        style={{
                          fontSize: '10px', fontWeight: 600,
                          background: 'rgba(61,158,106,0.12)',
                          color: '#3D9E6A', border: '1px solid rgba(61,158,106,0.25)',
                          borderRadius: '4px', padding: '2px 7px',
                          textDecoration: 'none',
                        }}
                      >
                        👤 취재원 카드
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* ── 관계망 ── */}
          {relations.length > 0 && (
            <>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#7A60C0', marginBottom: '8px', letterSpacing: '0.05em' }}>
                관계망
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {relations.map((r, i) => {
                  const rs = relStyle(r.type)
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '0',
                      background: '#131C2C', border: '1px solid #1A2838',
                      borderRadius: '8px', overflow: 'hidden',
                      fontSize: '12px',
                    }}>
                      {/* From */}
                      <Link
                        href={`/analysis?q=${encodeURIComponent(r.from)}`}
                        style={{
                          padding: '8px 12px', fontWeight: 700, color: '#CDD5E0',
                          textDecoration: 'none', whiteSpace: 'nowrap',
                          background: 'rgba(255,255,255,0.02)',
                          borderRight: '1px solid #1A2838',
                          flexShrink: 0,
                          transition: 'color 0.12s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#7AADE0')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#CDD5E0')}
                      >
                        {r.from}
                      </Link>

                      {/* Connector */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0',
                        flex: 1, minWidth: 0, padding: '6px 10px',
                      }}>
                        <div style={{ height: '1px', width: '10px', background: '#2A3A50', flexShrink: 0 }} />
                        <div style={{
                          display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center', minWidth: 0,
                        }}>
                          <span style={{
                            fontSize: '10px', fontWeight: 700,
                            background: rs.bg, color: rs.color, border: `1px solid ${rs.border}`,
                            borderRadius: '4px', padding: '1px 7px',
                            whiteSpace: 'nowrap',
                          }}>
                            {r.type}
                          </span>
                          <span style={{
                            fontSize: '10px', color: '#5A7099', marginTop: '2px',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            maxWidth: '100%',
                          }}>
                            {r.detail}
                          </span>
                        </div>
                        <div style={{ height: '1px', width: '10px', background: '#2A3A50', flexShrink: 0 }} />
                      </div>

                      {/* To */}
                      <Link
                        href={`/analysis?q=${encodeURIComponent(r.to)}`}
                        style={{
                          padding: '8px 12px', fontWeight: 700, color: '#CDD5E0',
                          textDecoration: 'none', whiteSpace: 'nowrap',
                          background: 'rgba(255,255,255,0.02)',
                          borderLeft: '1px solid #1A2838',
                          flexShrink: 0,
                          transition: 'color 0.12s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#7AADE0')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#CDD5E0')}
                      >
                        {r.to}
                      </Link>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* ── 취재원 DB 매칭 결과 ── */}
          {result.sourceMatches.length > 0 && (
            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid rgba(100,70,200,0.15)' }}>
              <p style={{ fontSize: '11px', fontWeight: 600, color: '#7A60C0', marginBottom: '8px', letterSpacing: '0.05em' }}>
                취재원 DB 매칭 ({result.sourceMatches.length}명)
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {result.sourceMatches.map((sm, i) => (
                  <Link key={i} href={`/sources/${sm.sourceId}`} style={{ textDecoration: 'none' }}>
                    <div style={{
                      background: 'rgba(61,158,106,0.08)', border: '1px solid rgba(61,158,106,0.25)',
                      borderRadius: '6px', padding: '5px 10px',
                      fontSize: '12px', color: '#3D9E6A', fontWeight: 600,
                    }}>
                      👤 {sm.name}
                      {sm.organization && (
                        <span style={{ fontWeight: 400, color: '#3A7055', marginLeft: '5px', fontSize: '11px' }}>
                          {sm.organization}
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <p style={{ fontSize: '10px', color: '#3A4A5E', marginTop: '14px', textAlign: 'right' }}>
            AI 분석 결과는 참고용입니다. 오류가 있을 수 있습니다.
          </p>
        </div>
      )}
    </div>
  )
}
