'use client'

import { useRef, useCallback, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { forceCollide } = require('d3-force-3d') as { forceCollide: (r: (n: any) => number) => any }

interface Node {
  id: string
  label: string
  org: string | null
  position: string | null
  tags: string[]
  isOwner?: boolean
  degree: number          // 연결 강도 합산 → 원 크기 결정
  isDuplicate?: boolean   // 동일 이름 중복 레코드 여부
}

interface Link {
  source: string
  target: string
  type: string            // 대표 타입
  types?: string[]        // 모든 타입 (필터용)
  label: string
  strength: number        // 합산 강도 → 선 굵기
  connectionCount?: number // 겹치는 속성 수
}

interface Props {
  nodes: Node[]
  links: Link[]
}

const LINK_COLORS: Record<string, string> = {
  same_org:        '#A87228',   // 주황 — 동료
  same_university: '#3D9E6A',   // 녹색 — 대학동문
  same_highschool: '#4A7CC0',   // 파랑 — 고교동문
  same_exam:       '#7E6E48',   // 금색 — 시험동기
  same_hometown:   '#8858C0',   // 보라 — 동향
  same_tag:        '#3A90A8',   // 시안 — 공통태그
  same_position:   '#BC5028',   // 주홍 — 직책공유 (위원회 등)
  mention:         '#A87090',   // 핑크 — 직접 언급 (notes/tags)
  manual:          '#C04040',   // 빨강 — 수동등록
}

const LINK_LABELS: Record<string, string> = {
  same_org:        '동료',
  same_university: '대학동문',
  same_highschool: '고교동문',
  same_exam:       '시험동기',
  same_hometown:   '동향',
  same_tag:        '공통태그',
  same_position:   '직책공유',
  mention:         '직접언급',
  manual:          '수동등록',
}

/** 연결 수 기반 노드 반지름 (로그 스케일) */
function nodeRadius(degree: number): number {
  // degree 1 → r≈4,  5 → r≈6,  20 → r≈9,  100 → r≈13
  return Math.max(4, Math.min(3 + Math.log2(degree + 1) * 2.2, 13))
}

/** 합산 강도 기반 선 굵기 */
function linkWidth(strength: number, connectionCount: number): number {
  // connectionCount 1 → 얇게, 5+ → 굵게
  const base = Math.max(0.5, strength * 0.35)
  const bonus = Math.min((connectionCount - 1) * 0.6, 3)
  return Math.min(base + bonus, 6)
}

const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-2 animate-spin mx-auto mb-3"
            style={{ borderColor: '#1A2838', borderTopColor: '#4A7CC0' }} />
          <p className="text-sm" style={{ color: '#485870' }}>그래프 로딩 중...</p>
        </div>
      </div>
    )
  }
)

export default function NetworkGraph({ nodes, links }: Props) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<any>(null)
  const [activeTypes, setActiveTypes] = useState<Set<string>>(
    new Set(Object.keys(LINK_COLORS))
  )
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [isMobile, setIsMobile] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false) // 모바일: 기본 접힘

  // 컨테이너 크기 + 모바일 감지
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      setLegendOpen(!mobile) // PC: 기본 열림, 모바일: 기본 접힘
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const measure = () => {
      const { clientWidth: w, clientHeight: h } = el
      if (w > 0 && h > 0) setDimensions({ width: w, height: h })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 노드 수에 따라 반발력·거리 동적 조정
  const nodeCount = nodes.length
  const chargeStrength = Math.min(-180 - nodeCount * 15, -1200)
  const linkDistance   = Math.max(100, Math.min(80 + nodeCount * 4, 280))

  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    const timer = setTimeout(() => {
      try {
        fg.d3Force('charge')?.strength(chargeStrength)

        // 링크 거리: 연결된 두 노드의 실제 반지름 합산 + 여백
        // → 큰 원끼리는 자동으로 더 멀리 배치됨
        fg.d3Force('link')?.distance((link: any) => {
          const srcR = nodeRadius((link.source as any)?.degree ?? 1)
          const tgtR = nodeRadius((link.target as any)?.degree ?? 1)
          return Math.max(srcR + tgtR + 55, linkDistance)
        }).iterations(5)

        // 충돌 반경: 노드 반지름에 비례한 패딩 (대형 노드일수록 더 넓은 간격)
        // r=4  → 4*2.4+6 = 15.6
        // r=9  → 9*2.4+6 = 27.6
        // r=13 → 13*2.4+6 = 37.2
        fg.d3Force('collide', forceCollide((n: any) => {
          const r = nodeRadius(n.degree ?? 1)
          return r * 2.4 + 6
        }).iterations(6))

        fg.d3ReheatSimulation()
      } catch (e) { console.warn('force config error', e) }
    }, 150)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, links.length])

  // 시뮬레이션 완료 후 전체 뷰 자동 맞춤
  const handleEngineStop = useCallback(() => {
    try {
      fgRef.current?.zoomToFit(400, 40)
    } catch (e) { /* noop */ }
  }, [])

  // 링크에 존재하는 모든 타입 수집 (types 배열 포함)
  const allTypes = [...new Set(
    links.flatMap(l => l.types ?? [l.type])
  )]

  // 활성 타입 중 하나라도 포함된 링크만 표시
  const filteredLinks = links.filter(l =>
    (l.types ?? [l.type]).some(t => activeTypes.has(t))
  )

  const handleNodeClick = useCallback((node: unknown) => {
    const n = node as Node
    if (n.id) router.push(`/sources/${n.id}`)
  }, [router])

  function toggleType(type: string) {
    setActiveTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  if (nodes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="8" stroke="#485870" strokeWidth="2"/>
          <circle cx="12" cy="12" r="6" stroke="#485870" strokeWidth="2"/>
          <circle cx="52" cy="12" r="6" stroke="#485870" strokeWidth="2"/>
          <circle cx="12" cy="52" r="6" stroke="#485870" strokeWidth="2"/>
          <circle cx="52" cy="52" r="6" stroke="#485870" strokeWidth="2"/>
          <path d="M18 18L26 26M38 26L46 18M18 46L26 38M38 38L46 46" stroke="#485870" strokeWidth="1.5"/>
        </svg>
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: '#687898' }}>연결된 취재원이 없습니다</p>
          <p className="text-xs mt-1" style={{ color: '#485870' }}>
            취재원 등록 시 소속·대학·시험기수 등을 입력하면
          </p>
          <p className="text-xs" style={{ color: '#485870' }}>자동으로 관계망이 그려집니다</p>
        </div>
      </div>
    )
  }

  const graphData = {
    nodes: nodes.map(n => ({
      ...n,
      name: n.label,
      // forceCollide가 실제 반지름을 쓰므로 val은 1로 고정
      val: 1,
    })),
    links: filteredLinks.map(l => ({
      ...l,
      curvature: (l.connectionCount ?? 1) > 1 ? 0.2 : 0.05,
    })),
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0D1520' }}>

      {/* ── PC 범례 (우상단 고정) ── */}
      {!isMobile && legendOpen && (
        <div style={{
          position: 'absolute', top: '16px', right: '16px', zIndex: 10,
          padding: '12px', borderRadius: '12px',
          background: 'rgba(10,22,40,0.96)', border: '1px solid #1A2838',
          minWidth: '150px', backdropFilter: 'blur(8px)',
        }}>
          <p className="text-xs font-semibold mb-2" style={{ color: '#687898' }}>관계 유형 필터</p>
          <div className="space-y-1.5">
            {allTypes.map(type => (
              <button key={type} type="button" onClick={() => toggleType(type)}
                className="flex items-center gap-2 w-full text-left"
                style={{ background: 'none', border: 'none', cursor: 'pointer',
                  opacity: activeTypes.has(type) ? 1 : 0.3, transition: 'opacity 0.15s' }}>
                <span className="flex-shrink-0 rounded-full"
                  style={{ width: '12px', height: '5px', background: LINK_COLORS[type] ?? '#687898' }} />
                <span className="text-xs" style={{ color: '#CDD5E0' }}>{LINK_LABELS[type] ?? type}</span>
              </button>
            ))}
          </div>
          <div className="mt-3 pt-2 space-y-1" style={{ borderTop: '1px solid #1A2838' }}>
            <p className="text-xs font-semibold mb-1.5" style={{ color: '#687898' }}>원 크기</p>
            {[{ label: '연결 많음', r: 10 }, { label: '연결 적음', r: 5 }].map(({ label, r }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="rounded-full flex-shrink-0" style={{
                  width: r * 2, height: r * 2, display: 'inline-block',
                  background: 'rgba(30,144,255,0.5)', border: '1px solid rgba(30,144,255,0.7)',
                }} />
                <span className="text-xs" style={{ color: '#485870' }}>{label}</span>
              </div>
            ))}
            <p className="text-xs mt-1" style={{ color: '#485870' }}>굵은 선 = 겹치는 관계 多</p>
          </div>
          <p className="text-xs mt-2 pt-2" style={{ color: '#485870', borderTop: '1px solid #1A2838' }}>
            노드 클릭 → 상세 페이지
          </p>
        </div>
      )}

      {/* ── 모바일 범례 (하단 가로 칩 바) ── */}
      {isMobile && (
        <div style={{
          position: 'absolute', bottom: '8px', left: '8px', right: '8px', zIndex: 10,
          display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'center',
          padding: '8px 10px', borderRadius: '10px',
          background: 'rgba(10,22,40,0.88)', border: '1px solid #1A2838',
          backdropFilter: 'blur(8px)',
        }}>
          {allTypes.map(type => (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '4px 10px', borderRadius: '20px',
                background: activeTypes.has(type)
                  ? `${LINK_COLORS[type] ?? '#485870'}22`
                  : 'rgba(26,48,80,0.5)',
                border: `1px solid ${activeTypes.has(type) ? (LINK_COLORS[type] ?? '#485870') : '#1A2838'}`,
                cursor: 'pointer', transition: 'all 0.15s',
                opacity: activeTypes.has(type) ? 1 : 0.5,
              }}
            >
              <span style={{
                width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
                background: LINK_COLORS[type] ?? '#687898',
              }} />
              <span style={{ fontSize: '11px', color: '#CDD5E0', whiteSpace: 'nowrap' }}>
                {LINK_LABELS[type] ?? type}
              </span>
            </button>
          ))}
        </div>
      )}


      <div ref={containerRef} style={{ width: '100%', height: '100%', background: '#0D1520' }}>
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          backgroundColor="#0D1520"

          // ── 노드 렌더링: degree 기반 크기 ──
          nodeCanvasObject={(node: unknown, ctx: CanvasRenderingContext2D, globalScale: number) => {
            const n = node as Node & { x?: number; y?: number }
            if (n.x === undefined || n.y === undefined) return

            const degree = n.degree ?? 1
            const r = nodeRadius(degree)
            const fontSize = Math.max(9 / globalScale, 2.5)
            const isOwner = n.isOwner
            const isDuplicate = n.isDuplicate

            // 연결 강도가 높을수록 더 밝은 색
            const intensity = Math.min(degree / 15, 1)
            const blue = Math.round(100 + intensity * 100)
            const cyan = Math.round(144 + intensity * 111)
            const color = isDuplicate
              ? '#A87228'
              : isOwner
                ? '#3A90A8'
                : `rgb(30, ${cyan}, 255)`

            // 글로우 효과
            if (degree >= 3 || isDuplicate) {
              ctx.beginPath()
              ctx.arc(n.x, n.y, r + 3, 0, 2 * Math.PI)
              const glowAlpha = isDuplicate ? 0.3 : Math.min(0.12 + intensity * 0.2, 0.35)
              ctx.fillStyle = isDuplicate
                ? `rgba(255,153,0,${glowAlpha})`
                : isOwner
                  ? `rgba(0,212,255,${glowAlpha})`
                  : `rgba(30,${blue},255,${glowAlpha})`
              ctx.fill()
            }

            // 노드 원
            ctx.beginPath()
            ctx.arc(n.x, n.y, r, 0, 2 * Math.PI)
            ctx.fillStyle = color
            ctx.fill()
            // 중복 노드는 점선 테두리
            if (isDuplicate) {
              ctx.setLineDash([2, 2])
              ctx.strokeStyle = 'rgba(255,153,0,0.9)'
              ctx.lineWidth = 2
            } else {
              ctx.setLineDash([])
              ctx.strokeStyle = isOwner
                ? 'rgba(0,212,255,0.7)'
                : `rgba(30,${blue},255,0.5)`
              ctx.lineWidth = r > 10 ? 2 : 1.5
            }
            ctx.stroke()
            ctx.setLineDash([])

            // 레이블 (일정 줌 이상에서만)
            if (globalScale > 0.45) {
              ctx.font = `${fontSize}px Pretendard, sans-serif`
              ctx.fillStyle = isDuplicate ? '#B08830' : degree >= 5 ? '#FFFFFF' : '#A8B8C8'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'top'
              ctx.fillText(n.label, n.x, n.y + r + 2)
              // 중복 경고 표시
              if (isDuplicate && globalScale > 0.7) {
                ctx.font = `${fontSize * 0.85}px Pretendard, sans-serif`
                ctx.fillStyle = '#A87228'
                ctx.fillText('⚠ 중복', n.x, n.y + r + fontSize + 3)
              }
            }
          }}

          nodeLabel={(node: unknown) => {
            const n = node as Node
            const parts = [n.label]
            if (n.org) parts.push(n.org)
            if (n.position) parts.push(n.position)
            parts.push(`연결강도: ${n.degree}`)
            return parts.join('\n')
          }}

          // ── 링크 색상: 대표 타입 색상 사용 ──
          linkColor={(link: unknown) => {
            const l = link as Link
            const color = LINK_COLORS[l.type] ?? '#485870'
            // 겹치는 관계 많을수록 더 불투명
            const count = l.connectionCount ?? 1
            const alpha = Math.min(40 + count * 20, 200).toString(16).padStart(2, '0')
            return color + alpha
          }}

          // ── 선 굵기: 강도 + 겹침 수에 비례 ──
          linkWidth={(link: unknown) => {
            const l = link as Link
            return linkWidth(l.strength ?? 1, l.connectionCount ?? 1)
          }}

          // ── 파티클: 연결 강도에 따라 ──
          linkDirectionalParticles={(link: unknown) => {
            const l = link as Link
            return Math.min(Math.ceil((l.connectionCount ?? 1) * 0.7), 3)
          }}
          linkDirectionalParticleColor={(link: unknown) => {
            const l = link as Link
            return LINK_COLORS[l.type] ?? '#485870'
          }}
          linkDirectionalParticleSpeed={(link: unknown) => {
            const l = link as Link
            return 0.002 + (l.connectionCount ?? 1) * 0.001
          }}
          linkDirectionalParticleWidth={(link: unknown) => {
            const l = link as Link
            return Math.min(1.5 + (l.connectionCount ?? 1) * 0.4, 3.5)
          }}

          linkLabel={(link: unknown) => (link as Link).label ?? ''}

          onNodeClick={handleNodeClick}
          onEngineStop={handleEngineStop}

          width={dimensions.width}
          height={dimensions.height}

          minZoom={0.02}
          maxZoom={12}

          // 물리 시뮬레이션 — 수렴 시간 확보해서 초기 배치 안정화
          cooldownTicks={500}
          warmupTicks={150}
          d3AlphaDecay={0.008}
          d3VelocityDecay={0.35}
          nodeRelSize={1}
        />
      </div>
    </div>
  )
}
