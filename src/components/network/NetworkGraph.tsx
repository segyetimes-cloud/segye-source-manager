'use client'

import { useRef, useCallback, useState, useEffect, useMemo } from 'react'
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
  degree: number
  isDuplicate?: boolean
}

interface Link {
  source: string
  target: string
  type: string
  types?: string[]
  label: string
  strength: number
  connectionCount?: number
}

interface Props {
  nodes: Node[]
  links: Link[]
}

// ── Org-based color palette (FNV hash for consistency) ────────────────────────
const ORG_PALETTE = [
  '#5C9CE8', // 코발트 블루
  '#E8934C', // 웜 오렌지
  '#52BF8C', // 세이지 그린
  '#E8607A', // 코랄 레드
  '#A474E8', // 소프트 바이올렛
  '#E8C040', // 허니 골드
  '#48BCE0', // 스카이 블루
  '#D06AAC', // 피오니 핑크
  '#80C450', // 스프링 그린
  '#E8A04A', // 앰버
  '#7880E8', // 퍼리윙클
  '#C0488C', // 매젠타 로즈
]

function hexToRgb(hex: string): [number, number, number] {
  if (!hex.startsWith('#')) return [74, 144, 217]
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

// ── Constants ─────────────────────────────────────────────────────────────────
const LINK_COLORS: Record<string, string> = {
  same_org:         '#A87228',
  same_university:  '#3D9E6A',
  same_highschool:  '#4A7CC0',
  same_exam:        '#B09048',
  same_hometown:    '#8858C0',
  same_tag:         '#3A90A8',
  same_position:    '#BC5028',
  academic_mentor:  '#38B8A0',  // 지도/사사 — 틸 그린
  close_friend:     '#E8C040',  // 친분 — 허니 골드
  family:           '#E8607A',  // 가족/혼인 — 코랄 로즈
  mention:          '#A87090',
  manual:           '#C04040',
}

const LINK_LABELS: Record<string, string> = {
  same_org:         '동료',
  same_university:  '대학동문',
  same_highschool:  '고교동문',
  same_exam:        '시험동기',
  same_hometown:    '동향',
  same_tag:         '공통태그',
  same_position:    '직책공유',
  academic_mentor:  '지도/사사',
  close_friend:     '친분관계',
  family:           '가족/혼인',
  mention:          '직접언급',
  manual:           '수동등록',
}

function nodeRadius(degree: number): number {
  return Math.max(3.5, Math.min(3.5 + Math.log2(degree + 1) * 2.2, 13))
}

function baseLinkWidth(strength: number, connectionCount: number): number {
  const base = Math.max(0.4, strength * 0.3)
  const bonus = Math.min((connectionCount - 1) * 0.5, 2.5)
  return Math.min(base + bonus, 4.5)
}

const ForceGraph2D = dynamic(
  () => import('react-force-graph-2d'),
  {
    ssr: false,
    loading: () => (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            border: '2px solid #1A2838', borderTopColor: '#4A7CC0',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 10px',
          }} />
          <p style={{ fontSize: '13px', color: '#485870' }}>그래프 로딩 중...</p>
        </div>
      </div>
    ),
  }
)

export default function NetworkGraph({ nodes, links }: Props) {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef = useRef<any>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 })
  const [isMobile, setIsMobile] = useState(false)

  // ── Hover state — refs for canvas (no re-render), state for UI overlays ───
  const hoveredIdRef = useRef<string | null>(null)
  const hoverCenterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const orgColorMapRef = useRef<Map<string, string>>(new Map())
  const highlightIdsRef = useRef<Set<string>>(new Set())
  const [hoveredInfo, setHoveredInfo] = useState<Node | null>(null)
  // Initial circular positions — declared here (before any conditional return) to satisfy Rules of Hooks
  const initialPositions = useRef<Map<string, { x: number; y: number }>>(new Map())

  // ── Search ────────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('')
  const [searchDepth, setSearchDepth] = useState<1 | 2>(1)
  const [searchMatchCount, setSearchMatchCount] = useState<number | null>(null)
  const searchMatchIdsRef = useRef<Set<string> | null>(null)

  // ── Focus mode ────────────────────────────────────────────────────────────
  const [focusModeLabel, setFocusModeLabel] = useState<string | null>(null)
  const [focusSearch, setFocusSearch] = useState('')
  const [focusResults, setFocusResults] = useState<Node[]>([])
  const focusMatchIdsRef = useRef<Set<string> | null>(null)

  // ── Filter & display ──────────────────────────────────────────────────────
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(Object.keys(LINK_COLORS)))
  const [colorMode, setColorMode] = useState<'org' | 'degree'>('org')
  const colorModeRef = useRef<'org' | 'degree'>('org')

  // ── Panel UI state ────────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // ── Mobile detection ──────────────────────────────────────────────────────
  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      setPanelOpen(!mobile)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // ── Container sizing ──────────────────────────────────────────────────────
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

  // ── Sync refs ─────────────────────────────────────────────────────────────
  useEffect(() => { colorModeRef.current = colorMode }, [colorMode])

  // ── Adjacency map (built once per links change) ────────────────────────────
  const adjacencyMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const l of links) {
      const src = typeof l.source === 'string' ? l.source : (l.source as Node).id
      const tgt = typeof l.target === 'string' ? l.target : (l.target as Node).id
      if (!map.has(src)) map.set(src, new Set())
      if (!map.has(tgt)) map.set(tgt, new Set())
      map.get(src)!.add(tgt)
      map.get(tgt)!.add(src)
    }
    return map
  }, [links])

  // ── Focus search: compute results as user types ───────────────────────────
  useEffect(() => {
    if (!focusSearch.trim()) { setFocusResults([]); return }
    const q = focusSearch.toLowerCase()
    setFocusResults(
      nodes.filter(n =>
        n.label.toLowerCase().includes(q) || n.org?.toLowerCase().includes(q)
      ).slice(0, 6)
    )
  }, [focusSearch, nodes])

  // ── Search: update match IDs ref + state for count display ────────────────
  useEffect(() => {
    if (!searchQuery.trim()) {
      searchMatchIdsRef.current = null
      setSearchMatchCount(null)
      return
    }
    const q = searchQuery.toLowerCase()
    const directMatches = nodes.filter(n =>
      n.label.toLowerCase().includes(q) ||
      n.org?.toLowerCase().includes(q) ||
      n.position?.toLowerCase().includes(q) ||
      n.tags?.some(t => t.toLowerCase().includes(q))
    )
    const matchSet = new Set(directMatches.map(n => n.id))

    if (searchDepth === 2) {
      // extend to 1-hop neighbors of matched nodes
      for (const id of [...matchSet]) {
        const neighbors = adjacencyMap.get(id)
        if (neighbors) for (const nid of neighbors) matchSet.add(nid)
      }
    }

    searchMatchIdsRef.current = matchSet
    setSearchMatchCount(searchDepth === 2 ? directMatches.length : matchSet.size)
  }, [searchQuery, searchDepth, nodes, adjacencyMap])

  // ── Filtered links ────────────────────────────────────────────────────────
  const filteredLinks = useMemo(
    () => links.filter(l => (l.types ?? [l.type]).some(t => activeTypes.has(t))),
    [links, activeTypes]
  )

  // ── Force simulation setup ────────────────────────────────────────────────
  const nodeCount = nodes.length
  // Stronger repulsion so nodes always spread out (never cluster)
  const chargeStrength = Math.min(-400 - nodeCount * 25, -1800)
  const linkDistance   = Math.max(140, Math.min(110 + nodeCount * 6, 360))

  useEffect(() => {
    const fg = fgRef.current
    if (!fg) return
    const timer = setTimeout(() => {
      try {
        fg.d3Force('charge')?.strength(chargeStrength)
        fg.d3Force('link')?.distance((link: any) => {
          const srcR = nodeRadius((link.source as Node)?.degree ?? 1)
          const tgtR = nodeRadius((link.target as Node)?.degree ?? 1)
          return Math.max(srcR + tgtR + 70, linkDistance)
        }).iterations(6)
        fg.d3Force('collide', forceCollide((n: any) => {
          const r = nodeRadius(n.degree ?? 1)
          return r * 3.2 + 14
        }).iterations(8))
        fg.d3ReheatSimulation()
      } catch (e) { console.warn('force config error', e) }
    }, 150)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, links.length])

  // ── Auto-fit after simulation stabilizes ─────────────────────────────────
  const handleEngineStop = useCallback(() => {
    try { fgRef.current?.zoomToFit(400, 60) } catch {}
  }, [])

  // ── Focus helpers ─────────────────────────────────────────────────────────
  const applyFocus = useCallback((node: Node) => {
    const focusSet = new Set<string>([node.id])
    const n1 = adjacencyMap.get(node.id)
    if (n1) for (const id of n1) {
      focusSet.add(id)
      const n2 = adjacencyMap.get(id)
      if (n2) for (const id2 of n2) focusSet.add(id2)
    }
    focusMatchIdsRef.current = focusSet
    setFocusModeLabel(node.label)
    setFocusSearch('')
    setFocusResults([])
    setTimeout(() => {
      try {
        const gn = fgRef.current?.graphData()?.nodes?.find((n: any) => n.id === node.id)
        if (gn?.x !== undefined) {
          fgRef.current?.centerAt(gn.x, gn.y, 600)
          fgRef.current?.zoom(3, 600)
        }
      } catch {}
    }, 80)
  }, [adjacencyMap])

  const applyMyFocus = useCallback(() => {
    const ownerIds = nodes.filter(n => n.isOwner).map(n => n.id)
    if (ownerIds.length === 0) return
    const focusSet = new Set<string>(ownerIds)
    for (const id of ownerIds) {
      const neighbors = adjacencyMap.get(id)
      if (neighbors) for (const nid of neighbors) focusSet.add(nid)
    }
    focusMatchIdsRef.current = focusSet
    setFocusModeLabel(`내 취재원 (${ownerIds.length}명)`)
    setFocusSearch('')
    setFocusResults([])
    setTimeout(() => {
      try { fgRef.current?.zoomToFit(500, 80, (n: any) => focusSet.has(n.id)) } catch {}
    }, 80)
  }, [nodes, adjacencyMap])

  const clearFocus = useCallback(() => {
    focusMatchIdsRef.current = null
    setFocusModeLabel(null)
    setFocusSearch('')
    setFocusResults([])
  }, [])

  const applyOrgFocus = useCallback((org: string) => {
    const orgNodes = nodes.filter(n => n.org === org)
    const focusSet = new Set<string>(orgNodes.map(n => n.id))
    focusMatchIdsRef.current = focusSet
    setFocusModeLabel(`${org} (${orgNodes.length}명)`)
    setFocusSearch('')
    setFocusResults([])
    setTimeout(() => {
      try { fgRef.current?.zoomToFit(500, 60, (n: any) => focusSet.has(n.id)) } catch {}
    }, 80)
  }, [nodes])

  // ── Exam batch → nodeId map (from same_exam links) ────────────────────────
  const examGroupMap = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const l of links) {
      if (!(l.types ?? [l.type]).includes('same_exam')) continue
      const match = l.label?.match(/동기\s*\((.+?)\)/)
      if (!match) continue
      const exam = match[1].trim()
      if (!map.has(exam)) map.set(exam, new Set())
      const srcId = typeof l.source === 'string' ? l.source : (l.source as any).id
      const tgtId = typeof l.target === 'string' ? l.target : (l.target as any).id
      map.get(exam)!.add(srcId)
      map.get(exam)!.add(tgtId)
    }
    return map
  }, [links])

  const uniqueExams = useMemo(() => [...examGroupMap.keys()].sort(), [examGroupMap])

  const applyExamFocus = useCallback((exam: string) => {
    const ids = examGroupMap.get(exam)
    if (!ids || ids.size === 0) return
    const focusSet = new Set(ids)
    focusMatchIdsRef.current = focusSet
    setFocusModeLabel(`${exam} (${focusSet.size}명)`)
    setFocusSearch('')
    setFocusResults([])
    setTimeout(() => {
      try { fgRef.current?.zoomToFit(500, 60, (n: any) => focusSet.has(n.id)) } catch {}
    }, 80)
  }, [examGroupMap])

  // ── Hover handler — updates refs (for canvas) + state (for overlay) ───────
  const handleNodeHover = useCallback((node: unknown) => {
    const n = node as (Node & { x?: number; y?: number }) | null

    // 펜딩 중인 클리어 타이머 취소 (새 노드에 진입했으므로)
    if (clearHoverTimerRef.current) {
      clearTimeout(clearHoverTimerRef.current)
      clearHoverTimerRef.current = null
    }

    hoveredIdRef.current = n?.id ?? null

    const ids = new Set<string>()
    if (n) {
      ids.add(n.id)
      try {
        const graphLinks: any[] = fgRef.current?.graphData()?.links ?? []
        for (const l of graphLinks) {
          const srcId = l.source?.id ?? l.source
          const tgtId = l.target?.id ?? l.target
          if (srcId === n.id) ids.add(tgtId)
          if (tgtId === n.id) ids.add(srcId)
        }
      } catch {}
    }
    highlightIdsRef.current = ids

    if (n) {
      setHoveredInfo(n as unknown as Node)
      // Debounced center-on-hover (280ms delay, no zoom change)
      if (hoverCenterTimerRef.current) clearTimeout(hoverCenterTimerRef.current)
      hoverCenterTimerRef.current = setTimeout(() => {
        try {
          const gn = fgRef.current?.graphData()?.nodes?.find((nn: any) => nn.id === n.id)
          if (gn?.x !== undefined) fgRef.current?.centerAt(gn.x, gn.y, 500)
        } catch {}
      }, 280)
    } else {
      // 커서가 노드 바깥으로 이동했을 때 600ms 유예 — 근처에 머물면 카드 유지
      clearHoverTimerRef.current = setTimeout(() => {
        setHoveredInfo(null)
        clearHoverTimerRef.current = null
      }, 600)
    }
  }, [])

  // ── Node canvas renderer ──────────────────────────────────────────────────
  // Uses refs — called every animation frame, always picks up latest state
  const nodeCanvasObject = useCallback((node: unknown, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const n = node as Node & { x?: number; y?: number }
    if (n.x === undefined || n.y === undefined) return

    const degree = n.degree ?? 1
    const r = nodeRadius(degree)
    const isHovered = hoveredIdRef.current === n.id
    const hasHoverActive = hoveredIdRef.current !== null
    const isHighlighted = highlightIdsRef.current.has(n.id)
    const isFadedByHover = hasHoverActive && !isHighlighted

    const activeIds = focusMatchIdsRef.current ?? searchMatchIdsRef.current
    const isSearchMatch = activeIds?.has(n.id) ?? false
    const isFadedBySearch = activeIds !== null && !isSearchMatch

    const isFaded = isFadedByHover || isFadedBySearch
    const rDraw = isHovered ? r * 1.3 : r

    // Determine base color
    let baseColor: string
    if (n.isDuplicate) {
      baseColor = '#E8A030'
    } else if (n.isOwner) {
      baseColor = '#38C8B8'
    } else if (colorModeRef.current === 'org') {
      baseColor = orgColorMapRef.current.get(n.org ?? '') ?? ORG_PALETTE[0]
    } else {
      const intensity = Math.min(degree / 15, 1)
      const g = Math.round(144 + intensity * 111)
      baseColor = `rgb(30,${g},255)`
    }

    ctx.save()
    ctx.globalAlpha = isFaded ? 0.06 : 1

    // Radial glow (hover / highlighted / high-degree)
    if (!isFaded && (isHovered || isHighlighted || degree >= 4)) {
      const glowR = isHovered ? rDraw * 3.2 : rDraw * 2.2
      const glowAlpha = isHovered ? 0.5 : isHighlighted ? 0.2 : 0.1
      const [cr, cg, cb] = baseColor.startsWith('rgb')
        ? baseColor.match(/\d+/g)!.map(Number) as [number, number, number]
        : hexToRgb(baseColor)
      const grad = ctx.createRadialGradient(n.x, n.y, rDraw * 0.2, n.x, n.y, glowR)
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},${glowAlpha})`)
      grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`)
      ctx.beginPath()
      ctx.arc(n.x, n.y, glowR, 0, 2 * Math.PI)
      ctx.fillStyle = grad
      ctx.fill()
    }

    // Main circle
    ctx.beginPath()
    ctx.arc(n.x, n.y, rDraw, 0, 2 * Math.PI)
    ctx.fillStyle = baseColor
    ctx.fill()

    // Border
    if (n.isDuplicate) {
      ctx.setLineDash([2, 2])
      ctx.strokeStyle = 'rgba(255,165,50,0.8)'
      ctx.lineWidth = 1.5
    } else {
      ctx.setLineDash([])
      ctx.strokeStyle = isHovered
        ? 'rgba(255,255,255,0.95)'
        : isHighlighted
          ? `${baseColor.startsWith('#') ? baseColor : '#4A90D9'}CC`
          : `${baseColor.startsWith('#') ? baseColor : '#4A90D9'}50`
      ctx.lineWidth = isHovered ? 2.5 : 1.5
    }
    ctx.stroke()
    ctx.setLineDash([])

    // Label
    if (globalScale > 0.38) {
      const fontSize = Math.max((isHovered ? 12 : 9) / globalScale, 2.5)
      ctx.font = `${isHovered ? '600 ' : ''}${fontSize}px -apple-system, "Pretendard", "Noto Sans KR", sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'

      // Text shadow for readability
      ctx.globalAlpha = isFaded ? 0 : 0.75
      ctx.fillStyle = '#050A12'
      ctx.fillText(n.label, n.x + 0.5, n.y + rDraw + 2.5)

      ctx.globalAlpha = isFaded ? 0.06 : 1
      ctx.fillStyle = isHovered
        ? '#FFFFFF'
        : isHighlighted
          ? '#D0E8FF'
          : degree >= 5 ? '#9ABCD8' : '#607890'
      ctx.fillText(n.label, n.x, n.y + rDraw + 2)

      if (n.isDuplicate && globalScale > 0.65) {
        ctx.font = `${fontSize * 0.8}px -apple-system, sans-serif`
        ctx.fillStyle = '#E8A030'
        ctx.fillText('⚠ 중복', n.x, n.y + rDraw + fontSize + 3)
      }
    }

    ctx.restore()
  }, [])

  // ── Link color ────────────────────────────────────────────────────────────
  const getLinkColor = useCallback((link: unknown) => {
    const l = link as { source: any; target: any; type: string; connectionCount?: number }
    const srcId = l.source?.id ?? l.source
    const tgtId = l.target?.id ?? l.target

    const hasHover = hoveredIdRef.current !== null
    const both = highlightIdsRef.current.has(srcId) && highlightIdsRef.current.has(tgtId)
    const isFadedByHover = hasHover && !both

    const activeIds = focusMatchIdsRef.current ?? searchMatchIdsRef.current
    const either = activeIds?.has(srcId) || activeIds?.has(tgtId)
    const isFadedBySearch = activeIds !== null && !either

    const color = LINK_COLORS[l.type] ?? '#485870'
    if (isFadedByHover || isFadedBySearch) return color + '0C'

    const count = l.connectionCount ?? 1
    const alpha = Math.min(55 + count * 28, 215).toString(16).padStart(2, '0')
    return color + alpha
  }, [])

  // ── Link width ────────────────────────────────────────────────────────────
  const getLinkWidth = useCallback((link: unknown) => {
    const l = link as { source: any; target: any; strength?: number; connectionCount?: number }
    const srcId = l.source?.id ?? l.source
    const tgtId = l.target?.id ?? l.target
    const hasHover = hoveredIdRef.current !== null
    const both = highlightIdsRef.current.has(srcId) && highlightIdsRef.current.has(tgtId)
    const base = baseLinkWidth(l.strength ?? 1, l.connectionCount ?? 1)
    return hasHover && both ? Math.min(base * 2.2, 6) : base
  }, [])

  // ── Click to navigate ─────────────────────────────────────────────────────
  const handleNodeClick = useCallback((node: unknown) => {
    const n = node as Node
    if (n.id) router.push(`/sources/${n.id}`)
  }, [router])

  // ── All types present in current links ───────────────────────────────────
  const allTypes = useMemo(
    () => [...new Set(links.flatMap(l => l.types ?? [l.type]))],
    [links]
  )

  // ── Unique orgs for legend ────────────────────────────────────────────────
  const uniqueOrgs = useMemo(
    () => [...new Set(nodes.map(n => n.org).filter(Boolean))] as string[],
    [nodes]
  )

  // Build stable org→color map: each org gets the next palette slot in order
  useEffect(() => {
    const map = new Map<string, string>()
    uniqueOrgs.forEach((org, i) => {
      map.set(org, ORG_PALETTE[i % ORG_PALETTE.length])
    })
    orgColorMapRef.current = map
  }, [uniqueOrgs])

  // ── Empty state ───────────────────────────────────────────────────────────
  if (nodes.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="8" stroke="#485870" strokeWidth="2"/>
          <circle cx="12" cy="12" r="6" stroke="#485870" strokeWidth="2"/>
          <circle cx="52" cy="12" r="6" stroke="#485870" strokeWidth="2"/>
          <circle cx="12" cy="52" r="6" stroke="#485870" strokeWidth="2"/>
          <circle cx="52" cy="52" r="6" stroke="#485870" strokeWidth="2"/>
          <path d="M18 18L26 26M38 26L46 18M18 46L26 38M38 38L46 46" stroke="#485870" strokeWidth="1.5"/>
        </svg>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '14px', fontWeight: 500, color: '#687898' }}>연결된 취재원이 없습니다</p>
          <p style={{ fontSize: '12px', marginTop: '4px', color: '#485870' }}>
            취재원 등록 시 소속·대학·시험기수 등을 입력하면
          </p>
          <p style={{ fontSize: '12px', color: '#485870' }}>자동으로 관계망이 그려집니다</p>
        </div>
      </div>
    )
  }

  // Synchronous: runs during render so positions are ready before d3 starts
  nodes.forEach((n, i) => {
    if (!initialPositions.current.has(n.id)) {
      const angle = (2 * Math.PI * i) / nodes.length
      const radius = Math.max(220, nodes.length * 16)
      initialPositions.current.set(n.id, {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
      })
    }
  })

  const graphData = {
    nodes: nodes.map(n => ({
      ...n, name: n.label, val: 1,
      ...initialPositions.current.get(n.id),
    })),
    links: filteredLinks.map(l => ({
      ...l,
      curvature: (l.connectionCount ?? 1) > 1 ? 0.18 : 0.04,
    })),
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0D1520', overflow: 'hidden' }}>

      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
        <ForceGraph2D
          ref={fgRef}
          graphData={graphData}
          backgroundColor="#0D1520"

          nodeCanvasObject={nodeCanvasObject}
          nodeCanvasObjectMode={() => 'replace'}

          nodeLabel={(node: unknown) => {
            const n = node as Node
            const parts = [n.label]
            if (n.org) parts.push(n.org)
            if (n.position) parts.push(n.position)
            parts.push(`연결강도 ${n.degree}`)
            return parts.join('\n')
          }}

          linkColor={getLinkColor}
          linkWidth={getLinkWidth}
          linkLabel={(link: unknown) => (link as Link).label ?? ''}

          onNodeClick={handleNodeClick}
          onNodeHover={handleNodeHover}
          onEngineStop={handleEngineStop}

          width={dimensions.width}
          height={dimensions.height}
          minZoom={0.02}
          maxZoom={12}
          cooldownTicks={600}
          warmupTicks={300}
          d3AlphaDecay={0.010}
          d3VelocityDecay={0.30}
          nodeRelSize={1}
        />
      </div>

      {/* ── Obsidian-style settings panel (bottom-left) ──────────────────── */}
      <div style={{
        position: 'absolute', bottom: '16px', left: '16px',
        zIndex: 20, display: 'flex', flexDirection: 'column-reverse', gap: '8px',
        alignItems: 'flex-start',
      }}>
        {/* Toggle button */}
        <button
          type="button"
          onClick={() => setPanelOpen(p => !p)}
          title={panelOpen ? '패널 닫기' : '설정 패널 열기'}
          style={{
            width: '36px', height: '36px', borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: panelOpen ? 'rgba(74,124,192,0.25)' : 'rgba(8,14,28,0.88)',
            border: `1px solid ${panelOpen ? 'rgba(74,124,192,0.55)' : '#1A2838'}`,
            cursor: 'pointer', fontSize: '15px',
            backdropFilter: 'blur(10px)',
          }}>
          ⚙
        </button>

        {/* Panel body */}
        {panelOpen && (
          <div style={{
            width: isMobile ? 'min(260px, calc(100vw - 80px))' : '228px',
            background: 'rgba(10,18,32,0.96)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: '12px',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.55)',
            overflow: 'hidden',
          }}>

            {/* ── Search ── */}
            <div style={{ padding: '12px 14px 10px' }}>
              <p style={sectionLabel}>검색</p>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#485870', pointerEvents: 'none' }}>🔍</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="이름, 소속, 직책..."
                  style={{
                    width: '100%', paddingLeft: '26px', paddingRight: '8px',
                    paddingTop: '6px', paddingBottom: '6px',
                    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: '6px', fontSize: '12px', color: '#C8D8E8',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
              {searchMatchCount !== null && (
                <p style={{ fontSize: '11px', color: '#4A7CC0', marginTop: '5px' }}>
                  {searchMatchCount > 0
                    ? searchDepth === 2
                      ? `직접 일치 ${searchMatchCount}명 + 연결 취재원 포함 강조`
                      : `${searchMatchCount}명 일치`
                    : '일치하는 취재원 없음'}
                </p>
              )}
              {searchQuery.trim() && (
                <div style={{ display: 'flex', gap: '5px', marginTop: '6px' }}>
                  {([1, 2] as const).map(d => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSearchDepth(d)}
                      style={{
                        flex: 1, padding: '4px 0', borderRadius: '5px',
                        fontSize: '10px', cursor: 'pointer',
                        background: searchDepth === d ? 'rgba(74,124,192,0.25)' : 'rgba(255,255,255,0.06)',
                        color: searchDepth === d ? '#88B8E8' : '#6A8098',
                        border: searchDepth === d ? '1px solid rgba(74,124,192,0.5)' : '1px solid rgba(255,255,255,0.10)',
                      }}>
                      {d === 1 ? '1촌만' : '2촌 포함'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Divider />

            {/* ── 중심 보기 ── */}
            <div style={{ padding: '10px 14px' }}>
              <p style={sectionLabel}>중심 보기</p>

              {focusModeLabel ? (
                <div>
                  <div style={{
                    fontSize: '11px', color: '#5EC88A', fontWeight: 600,
                    padding: '5px 8px', background: 'rgba(61,158,106,0.1)',
                    border: '1px solid rgba(61,158,106,0.25)', borderRadius: '6px',
                    marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    📍 {focusModeLabel}
                  </div>
                  <button
                    type="button" onClick={clearFocus}
                    style={{ fontSize: '10px', color: '#7A8A9E', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                    포커스 해제
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  <button
                    type="button" onClick={applyMyFocus}
                    style={{
                      padding: '5px 0', borderRadius: '6px', fontSize: '11px', cursor: 'pointer',
                      background: 'rgba(56,200,184,0.1)', color: '#38C8B8',
                      border: '1px solid rgba(56,200,184,0.3)',
                    }}>
                    나를 중심으로
                  </button>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#485870', pointerEvents: 'none' }}>📍</span>
                    <input
                      type="text"
                      value={focusSearch}
                      onChange={e => setFocusSearch(e.target.value)}
                      placeholder="인물 포커스..."
                      style={{
                        width: '100%', paddingLeft: '26px', paddingRight: '8px',
                        paddingTop: '6px', paddingBottom: '6px',
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                        borderRadius: '6px', fontSize: '12px', color: '#C8D8E8',
                        outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                    {focusResults.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                        background: 'rgba(8,16,30,0.98)', border: '1px solid rgba(255,255,255,0.12)',
                        borderRadius: '6px', marginTop: '3px', overflow: 'hidden',
                      }}>
                        {focusResults.map(n => (
                          <button
                            key={n.id} type="button" onClick={() => applyFocus(n)}
                            style={{
                              display: 'block', width: '100%', textAlign: 'left',
                              padding: '6px 10px', background: 'none', border: 'none',
                              cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.06)',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,124,192,0.08)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                          >
                            <div style={{ fontSize: '12px', color: '#C8D8E8', fontWeight: 500 }}>{n.label}</div>
                            {n.org && <div style={{ fontSize: '10px', color: '#5A7090' }}>{n.org}</div>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Divider />

            {/* ── Color mode ── */}
            <div style={{ padding: '10px 14px' }}>
              <p style={sectionLabel}>색상 기준</p>
              <div style={{ display: 'flex', gap: '6px' }}>
                {([
                  { value: 'org', label: '소속기관' },
                  { value: 'degree', label: '연결강도' },
                ] as const).map(m => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setColorMode(m.value)}
                    style={{
                      flex: 1, padding: '5px 0', borderRadius: '6px',
                      fontSize: '11px', cursor: 'pointer', transition: 'all 0.15s',
                      background: colorMode === m.value ? 'rgba(74,124,192,0.25)' : 'rgba(255,255,255,0.06)',
                      color: colorMode === m.value ? '#88B8E8' : '#6A8098',
                      border: colorMode === m.value ? '1px solid rgba(74,124,192,0.5)' : '1px solid rgba(255,255,255,0.10)',
                    }}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Org color legend ── */}
            {colorMode === 'org' && uniqueOrgs.length > 0 && (
              <>
                <Divider />
                <div style={{ padding: '10px 14px 12px' }}>
                  <p style={sectionLabel}>소속 색상</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', maxHeight: '120px', overflowY: 'auto' }}>
                    {uniqueOrgs.slice(0, 12).map(org => (
                      <button
                        key={org}
                        type="button"
                        onClick={() => applyOrgFocus(org)}
                        title={`${org} 소속 노드만 보기`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '2px 4px', borderRadius: '4px', width: '100%',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,124,192,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        <span style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: orgColorMapRef.current.get(org) ?? ORG_PALETTE[0], flexShrink: 0,
                          boxShadow: `0 0 5px ${orgColorMapRef.current.get(org) ?? ORG_PALETTE[0]}80`,
                        }} />
                        <span style={{ fontSize: '11px', color: '#8AAAC8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {org.length > 14 ? org.slice(0, 14) + '…' : org}
                        </span>
                      </button>
                    ))}
                    {uniqueOrgs.length > 12 && (
                      <p style={{ fontSize: '10px', color: '#7A8A9E', marginTop: '2px' }}>외 {uniqueOrgs.length - 12}개</p>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ── 시험 기수 ── */}
            {uniqueExams.length > 0 && (
              <>
                <Divider />
                <div style={{ padding: '10px 14px 12px' }}>
                  <p style={sectionLabel}>시험·기수 보기</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '110px', overflowY: 'auto' }}>
                    {uniqueExams.map(exam => (
                      <button
                        key={exam}
                        type="button"
                        onClick={() => applyExamFocus(exam)}
                        title={`${exam} 기수만 보기`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '2px 4px', borderRadius: '4px', width: '100%',
                          transition: 'background 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(184,148,40,0.10)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                      >
                        <span style={{
                          width: '8px', height: '8px', borderRadius: '2px', flexShrink: 0,
                          background: LINK_COLORS['same_exam'] ?? '#B09048',
                        }} />
                        <span style={{ fontSize: '11px', color: '#8AAAC8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {exam}
                        </span>
                        <span style={{ fontSize: '10px', color: '#5A7090', marginLeft: 'auto', flexShrink: 0 }}>
                          {examGroupMap.get(exam)?.size ?? 0}명
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Divider />

            {/* ── Link type filters ── */}
            <div style={{ padding: '10px 14px 12px' }}>
              <button
                type="button"
                onClick={() => setFiltersOpen(p => !p)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}>
                <p style={sectionLabel}>관계 유형 필터</p>
                <span style={{ fontSize: '10px', color: '#485870' }}>{filtersOpen ? '▲' : '▼'}</span>
              </button>

              {filtersOpen && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <button type="button" onClick={() => setActiveTypes(new Set(allTypes))}
                      style={smallBtn('#4A7CC0')}>전체 선택</button>
                    <button type="button" onClick={() => setActiveTypes(new Set())}
                      style={smallBtn('#485870')}>전체 해제</button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {allTypes.map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setActiveTypes(prev => {
                          const next = new Set(prev)
                          next.has(type) ? next.delete(type) : next.add(type)
                          return next
                        })}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px',
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: '1px 0', opacity: activeTypes.has(type) ? 1 : 0.28,
                          transition: 'opacity 0.15s',
                        }}>
                        <span style={{ width: '18px', height: '3px', borderRadius: '2px', background: LINK_COLORS[type] ?? '#687898', flexShrink: 0 }} />
                        <span style={{ fontSize: '11px', color: '#C8D8E8', textAlign: 'left' }}>
                          {LINK_LABELS[type] ?? type}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Legend ── */}
            <Divider />
            <div style={{ padding: '8px 14px 10px', display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#38C8B8', boxShadow: '0 0 4px #38C8B870', display: 'inline-block' }} />
                <span style={{ fontSize: '10px', color: '#5A7090' }}>내 취재원</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#E8A030', border: '1px dashed rgba(255,165,50,0.7)', display: 'inline-block' }} />
                <span style={{ fontSize: '10px', color: '#5A7090' }}>중복</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Hovered node info card (top-right) ───────────────────────────── */}
      {hoveredInfo && (
        <div style={{
          position: 'absolute', top: '16px', right: '16px', zIndex: 20,
          padding: '12px 14px', borderRadius: '10px', maxWidth: '210px',
          background: 'rgba(10,18,32,0.96)', border: '1px solid rgba(255,255,255,0.10)',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.55)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{
              width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
              background: hoveredInfo.isDuplicate ? '#E8A030' :
                hoveredInfo.isOwner ? '#38C8B8' :
                colorMode === 'org' ? orgColorMapRef.current.get(hoveredInfo.org ?? '') ?? ORG_PALETTE[0] : '#4A90D9',
              boxShadow: `0 0 6px ${
                hoveredInfo.isDuplicate ? '#E8A03088' :
                hoveredInfo.isOwner ? '#38C8B888' :
                colorMode === 'org' ? (orgColorMapRef.current.get(hoveredInfo.org ?? '') ?? ORG_PALETTE[0]) + '88' : '#4A90D988'
              }`,
            }} />
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#D8E8F5', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {hoveredInfo.label}
            </p>
          </div>
          {hoveredInfo.org && (
            <p style={{ fontSize: '11px', color: '#8AAAC8', margin: '2px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              🏢 {hoveredInfo.org}
            </p>
          )}
          {hoveredInfo.position && (
            <p style={{ fontSize: '11px', color: '#5A7090', margin: '2px 0' }}>
              {hoveredInfo.position}
            </p>
          )}
          <div style={{ marginTop: '8px', paddingTop: '7px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '10px', color: '#5A7090' }}>연결강도</span>
            <span style={{ fontSize: '12px', color: '#7E6E48', fontWeight: 700 }}>{hoveredInfo.degree}</span>
          </div>
          <p style={{ fontSize: '10px', color: '#3A5070', marginTop: '5px', textAlign: 'center' }}>
            클릭하면 상세 페이지로 이동
          </p>
        </div>
      )}

      {/* ── Zoom controls (bottom-right) ─────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: '16px', right: '16px', zIndex: 20,
        display: 'flex', flexDirection: 'column', gap: '4px',
      }}>
        {[
          { label: '+', action: () => { try { const z = fgRef.current?.zoom(); fgRef.current?.zoom(Math.min((z ?? 1) * 1.4, 12), 300) } catch {} } },
          { label: '−', action: () => { try { const z = fgRef.current?.zoom(); fgRef.current?.zoom(Math.max((z ?? 1) / 1.4, 0.02), 300) } catch {} } },
          { label: '⊡', action: () => { try { fgRef.current?.zoomToFit(400, 60) } catch {} } },
        ].map(btn => (
          <button
            key={btn.label}
            type="button"
            onClick={btn.action}
            style={{
              width: '30px', height: '30px', borderRadius: '6px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(6,12,24,0.88)', border: '1px solid #1A2838',
              cursor: 'pointer', fontSize: btn.label === '⊡' ? '13px' : '17px',
              color: '#485870', backdropFilter: 'blur(8px)',
              lineHeight: 1,
            }}>
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── Shared micro-components ────────────────────────────────────────────────────
function Divider() {
  return <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)' }} />
}

const sectionLabel: React.CSSProperties = {
  fontSize: '9px',
  fontWeight: 700,
  color: '#94A3B8',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  margin: 0,
  marginBottom: '8px',
}

function smallBtn(color: string): React.CSSProperties {
  return {
    fontSize: '10px', color, background: 'none', border: 'none',
    cursor: 'pointer', padding: 0, textDecoration: 'underline',
    textDecorationColor: color + '60',
  }
}
