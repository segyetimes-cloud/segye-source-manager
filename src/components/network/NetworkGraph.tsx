'use client'

import { useRef, useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'

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
  same_org:        '#FF9900',   // 주황 — 동료
  same_university: '#00CC66',   // 녹색 — 대학동문
  same_highschool: '#1E90FF',   // 파랑 — 고교동문
  same_exam:       '#FFD700',   // 금색 — 시험동기
  same_hometown:   '#CC66FF',   // 보라 — 동향
  same_tag:        '#00D4FF',   // 시안 — 공통태그
  same_position:   '#FF6633',   // 주홍 — 직책공유 (위원회 등)
  mention:         '#FF99CC',   // 핑크 — 직접 언급 (notes/tags)
  manual:          '#FF4444',   // 빨강 — 수동등록
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
  // degree 1 → r≈5,  5 → r≈8,  20 → r≈13,  100 → r≈18
  return Math.max(5, Math.min(4 + Math.log2(degree + 1) * 3.2, 20))
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
            style={{ borderColor: '#1A3050', borderTopColor: '#1E90FF' }} />
          <p className="text-sm" style={{ color: '#4A6080' }}>그래프 로딩 중...</p>
        </div>
      </div>
    )
  }
)

export default function NetworkGraph({ nodes, links }: Props) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeTypes, setActiveTypes] = useState<Set<string>>(
    new Set(Object.keys(LINK_COLORS))
  )

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
          <circle cx="32" cy="32" r="8" stroke="#4A6080" strokeWidth="2"/>
          <circle cx="12" cy="12" r="6" stroke="#4A6080" strokeWidth="2"/>
          <circle cx="52" cy="12" r="6" stroke="#4A6080" strokeWidth="2"/>
          <circle cx="12" cy="52" r="6" stroke="#4A6080" strokeWidth="2"/>
          <circle cx="52" cy="52" r="6" stroke="#4A6080" strokeWidth="2"/>
          <path d="M18 18L26 26M38 26L46 18M18 46L26 38M38 38L46 46" stroke="#4A6080" strokeWidth="1.5"/>
        </svg>
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: '#8899BB' }}>연결된 취재원이 없습니다</p>
          <p className="text-xs mt-1" style={{ color: '#4A6080' }}>
            취재원 등록 시 소속·대학·시험기수 등을 입력하면
          </p>
          <p className="text-xs" style={{ color: '#4A6080' }}>자동으로 관계망이 그려집니다</p>
        </div>
      </div>
    )
  }

  const graphData = {
    nodes: nodes.map(n => ({
      ...n,
      name: n.label,
      // degree 기반 val → force-graph 내부 크기 힌트
      val: Math.max(2, (n.degree ?? 1) * 0.8),
    })),
    links: filteredLinks.map(l => ({
      ...l,
      curvature: (l.connectionCount ?? 1) > 1 ? 0.15 : 0.08,
    })),
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>

      {/* ── 범례 + 필터 ── */}
      <div
        className="absolute top-4 right-4 z-10 p-3 rounded-xl"
        style={{
          background: 'rgba(10,22,40,0.96)',
          border: '1px solid #1A3050',
          minWidth: '150px',
          backdropFilter: 'blur(8px)',
        }}
      >
        <p className="text-xs font-semibold mb-2" style={{ color: '#8899BB' }}>관계 유형 필터</p>
        <div className="space-y-1.5">
          {allTypes.map(type => (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              className="flex items-center gap-2 w-full text-left"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                opacity: activeTypes.has(type) ? 1 : 0.3,
                transition: 'opacity 0.15s',
              }}
            >
              <span
                className="flex-shrink-0 rounded-full"
                style={{
                  width: '12px', height: '5px',
                  background: LINK_COLORS[type] ?? '#8899BB',
                }}
              />
              <span className="text-xs" style={{ color: '#E8F0FE' }}>
                {LINK_LABELS[type] ?? type}
              </span>
            </button>
          ))}
        </div>

        {/* 범례: 원 크기 */}
        <div className="mt-3 pt-2 space-y-1" style={{ borderTop: '1px solid #1A3050' }}>
          <p className="text-xs font-semibold mb-1.5" style={{ color: '#8899BB' }}>원 크기</p>
          {[
            { label: '연결 많음', r: 10 },
            { label: '연결 적음', r: 5 },
          ].map(({ label, r }) => (
            <div key={label} className="flex items-center gap-2">
              <span
                className="rounded-full flex-shrink-0"
                style={{
                  width: r * 2, height: r * 2,
                  background: 'rgba(30,144,255,0.5)',
                  border: '1px solid rgba(30,144,255,0.7)',
                  display: 'inline-block',
                }}
              />
              <span className="text-xs" style={{ color: '#4A6080' }}>{label}</span>
            </div>
          ))}
          <p className="text-xs mt-2" style={{ color: '#4A6080' }}>
            굵은 선 = 겹치는 관계 多
          </p>
        </div>

        <p className="text-xs mt-2 pt-2" style={{ color: '#4A6080', borderTop: '1px solid #1A3050' }}>
          노드 클릭 → 상세 페이지
        </p>
      </div>

      <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
        <ForceGraph2D
          graphData={graphData}
          backgroundColor="#0A1628"

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
              ? '#FF9900'
              : isOwner
                ? '#00D4FF'
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
              ctx.fillStyle = isDuplicate ? '#FFB84D' : degree >= 5 ? '#FFFFFF' : '#C8D8F8'
              ctx.textAlign = 'center'
              ctx.textBaseline = 'top'
              ctx.fillText(n.label, n.x, n.y + r + 2)
              // 중복 경고 표시
              if (isDuplicate && globalScale > 0.7) {
                ctx.font = `${fontSize * 0.85}px Pretendard, sans-serif`
                ctx.fillStyle = '#FF9900'
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
            const color = LINK_COLORS[l.type] ?? '#4A6080'
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
            return LINK_COLORS[l.type] ?? '#4A6080'
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

          width={containerRef.current?.clientWidth ?? 800}
          height={containerRef.current?.clientHeight ?? 600}

          // 물리 시뮬레이션: 연결 많은 노드가 중심에 오도록
          cooldownTicks={200}
          d3AlphaDecay={0.015}
          d3VelocityDecay={0.25}
        />
      </div>
    </div>
  )
}
