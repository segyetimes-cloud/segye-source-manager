'use client'

import { useRef, useCallback, useState, useEffect, useLayoutEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { forceCollide, forceX, forceY } = require('d3-force-3d') as {
  forceCollide: (r: (n: any) => number) => any
  forceX: (x: number) => any
  forceY: (y: number) => any
}

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

type ViewMode = 'mine' | 'org' | 'all'

// 조직 클러스터 노드 반지름 — 소속 인원 수 기반
function orgNodeRadius(count: number): number {
  return Math.max(18, Math.min(18 + Math.log2(count + 1) * 5, 52))
}

// 노드당 표시할 최대 링크 수 — 이 값이 일관된 레이아웃의 핵심
const MAX_LINKS_PER_NODE = 5

// ── 노드당 링크 수 상한 ────────────────────────────────────────────────────────
// 연결이 많은 계정일수록 스프링이 많아져 그래프가 뭉치는 근본 원인 해결.
// 각 노드에서 강도 상위 maxPerNode개의 링크만 그래프에 표시.
// (나머지 연결은 취재원 상세 페이지에서 확인 가능)
function capLinksPerNode<T extends { source: string | any; target: string | any; strength: number }>(
  links: T[],
  maxPerNode: number
): { capped: T[]; hiddenCount: number } {
  const sorted = [...links].sort((a, b) => b.strength - a.strength)
  const counts = new Map<string, number>()
  const capped: T[] = []
  let hiddenCount = 0
  for (const l of sorted) {
    const src = typeof l.source === 'string' ? l.source : l.source?.id ?? ''
    const tgt = typeof l.target === 'string' ? l.target : l.target?.id ?? ''
    const sc = counts.get(src) ?? 0
    const tc = counts.get(tgt) ?? 0
    if (sc >= maxPerNode || tc >= maxPerNode) {
      hiddenCount++
      continue
    }
    counts.set(src, sc + 1)
    counts.set(tgt, tc + 1)
    capped.push(l)
  }
  return { capped, hiddenCount }
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
          <p style={{ fontSize: '13px', color: '#607898' }}>그래프 로딩 중...</p>
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
  // ── 그래프 준비 상태 — force 설정 완료 전에는 캔버스를 숨겨 ugly flash 방지 ──
  const [graphReady, setGraphReady] = useState(false)
  // ── 커스텀 force가 실제로 적용됐는지 추적 ─────────────────────────────────────
  // handleEngineStop이 applyForces 실행 전에 발화하면 캔버스를 열지 않도록 가드
  const forcesAppliedRef = useRef(false)

  // ── Hover state — refs for canvas (no re-render), state for UI overlays ───
  const hoveredIdRef = useRef<string | null>(null)
  const hoverCenterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clearHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const orgColorMapRef = useRef<Map<string, string>>(new Map())
  const highlightIdsRef = useRef<Set<string>>(new Set())
  const [hoveredInfo, setHoveredInfo] = useState<Node | null>(null)

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

  // ── View mode ─────────────────────────────────────────────────────────────
  const [viewMode, setViewMode] = useState<ViewMode>('mine')
  const [focusFilterIds, setFocusFilterIds] = useState<Set<string> | null>(null)

  // ── Panel UI state ────────────────────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  // ── Mobile detection ──────────────────────────────────────────────────────
  // resize 이벤트에서는 isMobile만 갱신 — panelOpen은 초기 마운트 시 1회만 설정
  // (resize마다 setPanelOpen을 호출하면 가상 키보드·화면 회전 시 패널이 멋대로 열림)
  useEffect(() => {
    const mobile = window.innerWidth < 768
    setIsMobile(mobile)
    setPanelOpen(!mobile)   // 초기값: 모바일=닫힘, 데스크톱=열림

    const onResize = () => {
      setIsMobile(window.innerWidth < 768)
      // panelOpen 은 건드리지 않음 — 사용자가 직접 열고 닫은 상태를 유지
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // ── 마운트 시 내 네트워크 자동 포커스 ─────────────────────────────────────────
  // 페이지를 열면 로그인한 사용자의 취재원 + 1촌 인맥만 먼저 표시.
  // 이후 [인물 검색]으로 다른 취재원 중심 보기로 전환 가능.
  const mountFocusApplied = useRef(false)
  useEffect(() => {
    if (mountFocusApplied.current) return
    mountFocusApplied.current = true
    const ownerIds = nodes.filter(n => n.isOwner).map(n => n.id)
    if (ownerIds.length === 0) return   // 관리자 등 isOwner 없는 경우 → 기본 뷰 유지
    const focusSet = new Set<string>(ownerIds)
    for (const id of ownerIds) {
      const nbrs = adjacencyMap.get(id)
      if (nbrs) for (const nid of nbrs) focusSet.add(nid)
    }
    focusMatchIdsRef.current = focusSet
    setFocusFilterIds(focusSet)
    setFocusModeLabel('내 네트워크')
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // ── 내 네트워크 데이터 (isOwner 노드 + 1촌) ──────────────────────────────────
  const myNetworkData = useMemo(() => {
    const ownerIds = new Set(nodes.filter(n => n.isOwner).map(n => n.id))
    if (ownerIds.size === 0) return { nodes: [] as Node[], links: [] as Link[] }
    const ids = new Set(ownerIds)
    for (const id of ownerIds) {
      const nbrs = adjacencyMap.get(id)
      if (nbrs) for (const nid of nbrs) ids.add(nid)
    }
    return {
      nodes: nodes.filter(n => ids.has(n.id)),
      links: links.filter(l => {
        const s = typeof l.source === 'string' ? l.source : (l.source as any).id
        const t = typeof l.target === 'string' ? l.target : (l.target as any).id
        return ids.has(s) && ids.has(t)
      }),
    }
  }, [nodes, links, adjacencyMap])

  // ── 조직 클러스터 데이터 ──────────────────────────────────────────────────────
  // 개인 노드 → 기관 노드로 집계. 1만명도 기관 수는 수백 개 이내 → 항상 깔끔
  const orgClusterData = useMemo(() => {
    const orgMap = new Map<string, Node[]>()
    for (const n of nodes) {
      const org = n.org || '소속 없음'
      if (!orgMap.has(org)) orgMap.set(org, [])
      orgMap.get(org)!.push(n)
    }

    const orgNodes: Node[] = [...orgMap.entries()].map(([org, members]) => ({
      id: `_org_::${org}`,
      label: org,
      org,
      position: `${members.length}명`,
      tags: [],
      isOwner: members.some(m => m.isOwner),
      degree: members.length,   // degree = 인원수 (노드 크기 결정)
      isDuplicate: false,
    }))

    // 기관 간 연결: 두 기관 소속 인물이 연결되어 있으면 기관 간 선 생성
    const nodeToOrgId = new Map<string, string>()
    for (const n of nodes) nodeToOrgId.set(n.id, `_org_::${n.org || '소속 없음'}`)

    const orgLinkMap = new Map<string, { weight: number; types: Set<string> }>()
    for (const l of links) {
      const s = typeof l.source === 'string' ? l.source : (l.source as any).id
      const t = typeof l.target === 'string' ? l.target : (l.target as any).id
      const so = nodeToOrgId.get(s)
      const to = nodeToOrgId.get(t)
      if (!so || !to || so === to) continue
      const key = [so, to].sort().join('|||')
      if (!orgLinkMap.has(key)) orgLinkMap.set(key, { weight: 0, types: new Set() })
      const e = orgLinkMap.get(key)!
      e.weight++
      for (const tp of (l.types ?? [l.type])) e.types.add(tp)
    }

    const orgLinks: Link[] = [...orgLinkMap.entries()].map(([key, { weight, types }]) => {
      const [s, t] = key.split('|||')
      const typeArr = [...types]
      return {
        source: s, target: t,
        type: typeArr[0] ?? 'same_org',
        types: typeArr,
        label: `${weight}개 연결`,
        strength: Math.log2(weight + 1) * 2,
        connectionCount: weight,
      }
    })

    return { nodes: orgNodes, links: orgLinks }
  }, [nodes, links])

  // ── 전체 보기 데이터 (상위 150명) ────────────────────────────────────────────
  const allNetworkData = useMemo(() => {
    const MAX = 150
    const top = nodes.length > MAX
      ? [...nodes].sort((a, b) => b.degree - a.degree).slice(0, MAX)
      : nodes
    const topIds = new Set(top.map(n => n.id))
    return {
      nodes: top,
      links: links.filter(l => {
        const s = typeof l.source === 'string' ? l.source : (l.source as any).id
        const t = typeof l.target === 'string' ? l.target : (l.target as any).id
        return topIds.has(s) && topIds.has(t)
      }),
    }
  }, [nodes, links])

  // 현재 뷰 모드에 따른 활성 데이터
  const activeData = viewMode === 'mine' ? myNetworkData
    : viewMode === 'org' ? orgClusterData
    : allNetworkData

  const activeNodes = activeData.nodes
  const activeLinks = activeData.links

  // ── 포커스 필터: 활성일 때 해당 인물 네트워크로 그래프 한정 ────────────────────────
  // focusFilterIds가 설정되면 activeNodes 중 해당 IDs만 표시.
  // 현재 뷰에 해당 노드가 없으면(viewMode 전환 등) 필터 무효화해 전체 표시 유지.
  const focusNodeIds = useMemo(() => {
    if (!focusFilterIds) return null
    const matched = activeNodes.filter(n => focusFilterIds.has(n.id))
    return matched.length > 0 ? focusFilterIds : null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNodes, focusFilterIds])

  const visNodes = focusNodeIds
    ? activeNodes.filter(n => focusNodeIds.has(n.id))
    : activeNodes

  const visLinks = focusNodeIds
    ? activeLinks.filter(l => {
        const s = typeof l.source === 'string' ? l.source : (l.source as any).id
        const t = typeof l.target === 'string' ? l.target : (l.target as any).id
        return focusNodeIds.has(s) && focusNodeIds.has(t)
      })
    : activeLinks

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
    () => viewMode === 'org'
      ? visLinks
      : visLinks.filter(l => (l.types ?? [l.type]).some(t => activeTypes.has(t))),
    [visLinks, activeTypes, viewMode]
  )

  // ── graphData: memoized so react-force-graph doesn't re-init on every render ─
  const nodeCount = visNodes.length

  // ── charge 공식 + 밀도 보정 ──────────────────────────────────────────────────
  // 계정마다 연결 수가 달라도 항상 퍼진 레이아웃을 유지하기 위해
  // 노드당 평균 링크 수(밀도)에 비례해서 반발력을 자동으로 강화
  //
  // densityFactor: 밀도가 높을수록 링크 스프링이 강하게 당기므로
  //   반발력(chargeStrength)을 같은 비율로 증폭 → 어느 계정이든 균형점 유지
  //
  // CENTER_STR = 0.04 (낮을수록 노드가 캔버스 중심에 덜 끌림 → 더 퍼짐)
  // TARGET_R = max(500, 100*√N): 초기 원형 배치를 넉넉하게 잡아 초기 퍼짐 보장
  const CENTER_STR = 0.04
  const TARGET_R = Math.max(500, 100 * Math.sqrt(nodeCount))

  // ── 노드당 링크 상한 ─────────────────────────────────────────────────────────
  // MAX_LINKS_PER_NODE: 컴포넌트 바깥 상수 (아래 패널 렌더에서도 참조)
  // org 클러스터 뷰는 기관 수가 적고 링크도 많지 않으므로 더 많은 연결 허용
  const perNodeCap = viewMode === 'org' ? 20 : MAX_LINKS_PER_NODE

  const [displayLinks, hiddenLinkCount] = useMemo(() => {
    const { capped, hiddenCount } = capLinksPerNode(filteredLinks, perNodeCap)
    return [capped, hiddenCount]
  }, [filteredLinks, perNodeCap])

  // 실제 표시되는 링크 수 기준으로 밀도 계산
  const avgLinksPerNode = visLinks.length / Math.max(nodeCount - 1, 1)

  // densityFactor는 이미 capLinksPerNode로 상한이 걸려 있어서 소폭만 보정
  const densityFactor = Math.max(1.0, avgLinksPerNode * 0.4)

  const chargeStrength = -Math.round(
    (TARGET_R ** 2 * 2 * CENTER_STR * densityFactor) / Math.max(nodeCount - 1, 1)
  )
  const initRadius = TARGET_R

  // 링크 강도: 상한 덕분에 노드당 최대 5개이므로 고정값으로 충분
  const adaptiveLinkStrength = 0.012

  // nodeCount 최신값을 canvas 콜백(useCallback[])에서 참조하기 위한 ref
  const nodeCountRef = useRef(nodeCount)
  nodeCountRef.current = nodeCount

  const graphData = useMemo(() => {
    return {
      nodes: visNodes.map((n, i) => ({
        ...n,
        name: n.label,
        val: 1,
        x: Math.cos((2 * Math.PI * i) / Math.max(visNodes.length, 1)) * initRadius,
        y: Math.sin((2 * Math.PI * i) / Math.max(visNodes.length, 1)) * initRadius,
      })),
      links: displayLinks.map(l => ({
        ...l,
        curvature: (l.connectionCount ?? 1) > 1 ? 0.18 : 0.04,
      })),
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visNodes, displayLinks])

  // ── Canvas 즉시 숨김 — 페인트 이전에 실행하여 ugly flash 차단 ─────────────
  // useEffect는 브라우저 페인트 후 실행 → 새 데이터가 이전 graphReady=true 상태로
  // 잠깐 노출됨. useLayoutEffect는 페인트 전 동기 실행 → flash 원천 차단
  const firstNodeId = visNodes[0]?.id ?? ''
  useLayoutEffect(() => {
    setGraphReady(false)
    revealPendingRef.current = false
    forcesAppliedRef.current = false   // 노드/링크가 바뀌면 반드시 다시 적용해야 함
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visNodes.length, visLinks.length, firstNodeId, viewMode])

  // ── Force configuration ───────────────────────────────────────────────────
  useEffect(() => {
    let tries = 0
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null

    function applyForces() {
      const fg = fgRef.current
      if (!fg) {
        // react-force-graph-2d는 dynamic import — 첫 로드 시 수초 걸릴 수 있음
        // 100회×100ms = 최대 10초 대기 (소진 시 overallFallback이 처리)
        if (++tries < 100) setTimeout(applyForces, 100)
        return
      }
      try {
        // 1. Force 구성
        //    react-force-graph 기본 force: 'center'(ForceCenter), 'charge', 'link'
        //    centerX/centerY 없음 → 'x'/'y' 이름으로 forceX/forceY 직접 추가
        // org 클러스터 뷰: 큰 노드들이므로 collide 반경 조정
        const isOrgView = viewMode === 'org'

        fg.d3Force('x', forceX(0).strength(CENTER_STR))
        fg.d3Force('y', forceY(0).strength(CENTER_STR))
        fg.d3Force('charge')?.strength(chargeStrength)
        fg.d3Force('link')
          // adaptiveLinkStrength: 연결 밀도에 반비례 → 연결 많은 계정도 퍼진 레이아웃 유지
          // distance +280: 연결된 노드 간 기본 간격을 충분히 확보
          ?.strength(isOrgView ? 0.02 : adaptiveLinkStrength)
          .distance((link: any) => {
            const srcR = isOrgView ? orgNodeRadius((link.source as Node)?.degree ?? 1) : nodeRadius((link.source as Node)?.degree ?? 1)
            const tgtR = isOrgView ? orgNodeRadius((link.target as Node)?.degree ?? 1) : nodeRadius((link.target as Node)?.degree ?? 1)
            return srcR + tgtR + (isOrgView ? 60 : 280)
          })
          .iterations(1)
        fg.d3Force('collide', forceCollide((n: any) => {
          return isOrgView
            ? orgNodeRadius(n.degree ?? 1) + 15
            : nodeRadius(n.degree ?? 1) + 22
        }).iterations(3))

        // 2. 노드 위치를 원형 배치로 리셋 — 기본 force가 이미 노드를 뭉쳤을 수 있으므로
        //    깨끗한 시작점(원형, 반경 initRadius)으로 되돌리고 속도도 초기화
        const data = fg.graphData()
        const n = data.nodes.length
        if (n > 0) {
          data.nodes.forEach((node: any, i: number) => {
            node.x = Math.cos((2 * Math.PI * i) / n) * initRadius
            node.y = Math.sin((2 * Math.PI * i) / n) * initRadius
            node.vx = 0
            node.vy = 0
          })
        }

        // 3. 커스텀 force 적용 완료 표시 — handleEngineStop 조기 발화 가드
        forcesAppliedRef.current = true

        // 4. 시뮬레이션 재시작
        fg.d3ReheatSimulation()

        // 5. 틱 카운트 리셋 후 reveal 활성화 — handleEngineTick 틱 30 도달 시 캔버스 표시
        tickCountRef.current = 0
        revealPendingRef.current = true

        // 5. 안전망 타이머: 틱 이벤트가 충분히 발생하지 않을 경우 대비
        fallbackTimer = setTimeout(() => setGraphReady(true), 3000)
      } catch (e) {
        console.warn('force config error', e)
        setGraphReady(true)   // 에러 시 그냥 표시
      }
    }

    // 즉시 실행 시도 — fgRef가 없으면 내부 재시도 루프(100ms×100회)가 처리
    // 딜레이를 50ms→0ms로 단축: 기본 d3 force가 수렴하기 전에 커스텀 force를 먼저 적용
    const timer = setTimeout(applyForces, 0)
    // 전체 안전망: 10초 안에 어떤 경로로도 표시되지 않으면 강제 표시 (첫 로드 blank 방지)
    const overallFallback = setTimeout(() => setGraphReady(true), 10000)
    return () => {
      clearTimeout(timer)
      clearTimeout(overallFallback)
      revealPendingRef.current = false
      if (fallbackTimer) clearTimeout(fallbackTimer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visNodes.length, visLinks.length, firstNodeId, viewMode])

  // ── Auto-fit + reveal: simulation 틱마다, 종료 시 ─────────────────────────
  const tickCountRef = useRef(0)
  const revealPendingRef = useRef(false)
  const handleEngineTick = useCallback(() => {
    tickCountRef.current++
    // reveal 대기 중이고 30틱에 도달하면 → zoom 맞추고 캔버스 표시
    if (revealPendingRef.current && tickCountRef.current >= 30) {
      revealPendingRef.current = false
      try { fgRef.current?.zoomToFit(300, 80) } catch {}
      setGraphReady(true)
    }
  }, [])
  const handleEngineStop = useCallback(() => {
    revealPendingRef.current = false
    tickCountRef.current = 0
    // ⚠ 커스텀 force가 아직 적용되지 않은 상태에서 발화하면 무시
    // (기본 d3 force로 뭉친 상태를 노출하는 것을 차단)
    if (!forcesAppliedRef.current) return
    setGraphReady(true)
    try { fgRef.current?.zoomToFit(400, 60) } catch {}
  }, [])

  // ── Focus helpers ─────────────────────────────────────────────────────────
  const applyFocus = useCallback((node: Node) => {
    // 검색한 인물이 현재 뷰(mine/org)에 없을 수 있으므로 전체 데이터로 전환 후 포커스
    setViewMode('all')
    const focusSet = new Set<string>([node.id])
    const n1 = adjacencyMap.get(node.id)
    if (n1) for (const id of n1) {
      focusSet.add(id)
      const n2 = adjacencyMap.get(id)
      if (n2) for (const id2 of n2) focusSet.add(id2)
    }
    focusMatchIdsRef.current = focusSet
    setFocusFilterIds(focusSet)
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
    setFocusFilterIds(focusSet)
    setFocusModeLabel(`내 취재원 (${ownerIds.length}명)`)
    setFocusSearch('')
    setFocusResults([])
    setTimeout(() => {
      try { fgRef.current?.zoomToFit(500, 80, (n: any) => focusSet.has(n.id)) } catch {}
    }, 80)
  }, [nodes, adjacencyMap])

  const clearFocus = useCallback(() => {
    focusMatchIdsRef.current = null
    setFocusFilterIds(null)
    setFocusModeLabel(null)
    setFocusSearch('')
    setFocusResults([])
  }, [])

  const applyOrgFocus = useCallback((org: string) => {
    const orgNodes = nodes.filter(n => n.org === org)
    const focusSet = new Set<string>(orgNodes.map(n => n.id))
    focusMatchIdsRef.current = focusSet
    setFocusFilterIds(focusSet)
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
    setFocusFilterIds(focusSet)
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
    const isOrgNode = n.id.startsWith('_org_::')
    const r = isOrgNode ? orgNodeRadius(degree) : nodeRadius(degree)
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
    // 노드 수 많을 때 매 프레임 gradient 객체 대량 생성은 렌더링 병목 → 호버/하이라이트만 표시
    const glowEnabled = isHovered || isHighlighted || (degree >= 4 && nodeCountRef.current < 120)
    if (!isFaded && glowEnabled) {
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

      // org 노드: 원 안에 인원수 표시
      if (isOrgNode && globalScale > 0.15) {
        const countFontSize = Math.max(rDraw * 0.5, 7) / globalScale
        ctx.font = `700 ${countFontSize}px -apple-system, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.globalAlpha = isFaded ? 0.06 : 0.9
        ctx.fillStyle = '#FFFFFF'
        ctx.fillText(degree > 999 ? '999+' : String(degree), n.x, n.y)
      }

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

    const color = LINK_COLORS[l.type] ?? '#607898'
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
    if (n.id.startsWith('_org_::')) {
      // 조직 클러스터 → 드릴다운: 해당 기관 소속 인물들만 전체 보기로 전환
      const orgName = n.org || n.label
      const orgMembers = nodes.filter(nd => nd.org === orgName)
      const focusSet = new Set<string>(orgMembers.map(nd => nd.id))
      focusMatchIdsRef.current = focusSet
      setFocusFilterIds(focusSet)
      setFocusModeLabel(`${orgName} (${orgMembers.length}명)`)
      setViewMode('all')
      setTimeout(() => {
        try { fgRef.current?.zoomToFit(500, 60, (nd: any) => focusSet.has(nd.id)) } catch {}
      }, 300)
    } else {
      if (n.id) router.push(`/sources/${n.id}`)
    }
  }, [router, nodes])

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

  // ── 뷰 모드 탭 바 (재사용) ────────────────────────────────────────────────
  const viewTabBar = (
    <div style={{
      position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
      zIndex: 25, display: 'flex', gap: '3px',
      background: 'rgba(6,12,24,0.92)', padding: '4px',
      borderRadius: '10px', border: '1px solid rgba(255,255,255,0.10)',
      backdropFilter: 'blur(12px)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    }}>
      {([
        { id: 'mine' as ViewMode, icon: '🙋', label: '내 네트워크',
          disabled: myNetworkData.nodes.length === 0 },
        { id: 'org' as ViewMode, icon: '🏢', label: '조직 클러스터',
          disabled: false },
        { id: 'all' as ViewMode, icon: '🌐', label: '전체',
          disabled: false },
      ]).map(tab => (
        <button
          key={tab.id}
          type="button"
          disabled={tab.disabled}
          onClick={() => setViewMode(tab.id)}
          title={tab.disabled ? '내 취재원을 등록하면 활성화됩니다' : undefined}
          style={{
            padding: '5px 11px', borderRadius: '7px',
            fontSize: isMobile ? '10px' : '11px',
            cursor: tab.disabled ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '4px',
            background: viewMode === tab.id ? 'rgba(74,124,192,0.35)' : 'transparent',
            color: tab.disabled ? '#3A4A5E' : viewMode === tab.id ? '#88B8E8' : '#5A7090',
            border: viewMode === tab.id ? '1px solid rgba(74,124,192,0.5)' : '1px solid transparent',
            transition: 'all 0.15s', whiteSpace: 'nowrap',
            opacity: tab.disabled ? 0.4 : 1,
          }}
        >
          <span style={{ fontSize: '12px' }}>{tab.icon}</span>
          {!isMobile && <span>{tab.label}</span>}
          {isMobile && <span style={{ fontSize: '9px' }}>{tab.label}</span>}
        </button>
      ))}
    </div>
  )

  // ── Empty state ───────────────────────────────────────────────────────────
  if (nodes.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '16px' }}>
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <circle cx="32" cy="32" r="8" stroke="#607898" strokeWidth="2"/>
          <circle cx="12" cy="12" r="6" stroke="#607898" strokeWidth="2"/>
          <circle cx="52" cy="12" r="6" stroke="#607898" strokeWidth="2"/>
          <circle cx="12" cy="52" r="6" stroke="#607898" strokeWidth="2"/>
          <circle cx="52" cy="52" r="6" stroke="#607898" strokeWidth="2"/>
          <path d="M18 18L26 26M38 26L46 18M18 46L26 38M38 38L46 46" stroke="#607898" strokeWidth="1.5"/>
        </svg>
        <div style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '14px', fontWeight: 500, color: '#8AAAC8' }}>연결된 취재원이 없습니다</p>
          <p style={{ fontSize: '12px', marginTop: '4px', color: '#607898' }}>
            취재원 등록 시 소속·대학·시험기수 등을 입력하면
          </p>
          <p style={{ fontSize: '12px', color: '#607898' }}>자동으로 관계망이 그려집니다</p>
        </div>
      </div>
    )
  }

  // 내 네트워크 뷰이고 owner 노드 없을 때 (전체 데이터는 있지만 본인 소유 없음)
  if (viewMode === 'mine' && myNetworkData.nodes.length === 0 && nodes.length > 0) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0D1520' }}>
        {viewTabBar}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
          <p style={{ fontSize: '14px', color: '#8AAAC8' }}>아직 등록한 취재원이 없습니다</p>
          <p style={{ fontSize: '12px', color: '#607898' }}>조직 클러스터 또는 전체 보기를 선택하세요</p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: '#0D1520', overflow: 'hidden' }}>

      {/* ── 뷰 모드 탭 (상단 중앙) ──────────────────────────────────────── */}
      {viewTabBar}

      {/* ── Canvas — force 설정 완료 전 숨김으로 ugly flash 방지 ──────────── */}
      <div ref={containerRef} style={{ width: '100%', height: '100%', opacity: graphReady ? 1 : 0, transition: 'opacity 0.25s ease' }}>
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
          onEngineTick={handleEngineTick}
          onEngineStop={handleEngineStop}

          width={dimensions.width}
          height={dimensions.height}
          minZoom={0.02}
          maxZoom={12}
          cooldownTicks={400}
          warmupTicks={0}
          d3AlphaDecay={0.010}
          d3VelocityDecay={0.35}
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
            maxHeight: 'calc(100vh - 80px)',
            overflowY: 'auto',
            overflowX: 'hidden',
          }}>

            {/* ── 중심 보기 ── */}
            <div style={{ padding: '10px 14px' }}>
              <p style={sectionLabel}>중심 보기</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>

                {/* 검색창 — 항상 표시 (포커스 활성 여부 무관) */}
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <input
                      type="text"
                      value={focusSearch}
                      onChange={e => setFocusSearch(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && focusResults.length > 0) applyFocus(focusResults[0])
                      }}
                      placeholder="취재원 이름 검색..."
                      style={{
                        flex: 1, paddingLeft: '10px', paddingRight: '8px',
                        paddingTop: '7px', paddingBottom: '7px',
                        background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)',
                        borderRadius: '6px', fontSize: '12px', color: '#C8D8E8',
                        outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => { if (focusResults.length > 0) applyFocus(focusResults[0]) }}
                      style={{
                        padding: '0 11px', borderRadius: '6px', fontSize: '12px', fontWeight: 600,
                        cursor: focusSearch.trim() ? 'pointer' : 'default',
                        background: focusSearch.trim() && focusResults.length > 0
                          ? 'rgba(74,124,192,0.35)'
                          : focusSearch.trim()
                            ? 'rgba(74,124,192,0.15)'
                            : 'rgba(255,255,255,0.05)',
                        color: focusSearch.trim() ? '#A8C8E8' : '#607898',
                        border: focusSearch.trim() ? '1px solid rgba(74,124,192,0.5)' : '1px solid rgba(255,255,255,0.08)',
                        whiteSpace: 'nowrap', flexShrink: 0,
                        transition: 'all 0.15s',
                      }}>
                      검색
                    </button>
                  </div>

                  {/* 자동완성 드롭다운 */}
                  {focusResults.length > 0 && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                      background: 'rgba(8,16,30,0.98)', border: '1px solid rgba(255,255,255,0.14)',
                      borderRadius: '6px', marginTop: '3px', overflow: 'hidden',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                    }}>
                      {focusResults.map(n => (
                        <button
                          key={n.id} type="button" onClick={() => applyFocus(n)}
                          style={{
                            display: 'block', width: '100%', textAlign: 'left',
                            padding: '8px 10px', background: 'none', border: 'none',
                            cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.06)',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,124,192,0.12)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        >
                          <div style={{ fontSize: '13px', color: '#CDD5E0', fontWeight: 600 }}>{n.label}</div>
                          {n.org && <div style={{ fontSize: '10px', color: '#8AAAC8', marginTop: '1px' }}>{n.org}</div>}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 검색어 있는데 결과 없을 때 */}
                  {focusSearch.trim().length >= 1 && focusResults.length === 0 && (
                    <p style={{ fontSize: '10px', color: '#806050', marginTop: '4px' }}>
                      일치하는 취재원이 없습니다
                    </p>
                  )}
                </div>

                {/* 나를 중심으로 버튼 */}
                <button
                  type="button" onClick={applyMyFocus}
                  style={{
                    padding: '5px 0', borderRadius: '6px', fontSize: '11px', cursor: 'pointer',
                    background: 'rgba(56,200,184,0.1)', color: '#38C8B8',
                    border: '1px solid rgba(56,200,184,0.3)',
                  }}>
                  🙋 나를 중심으로
                </button>

                {/* 현재 포커스 활성 배지 */}
                {focusModeLabel && (
                  <div style={{
                    padding: '5px 8px', borderRadius: '6px',
                    background: 'rgba(61,158,106,0.1)', border: '1px solid rgba(61,158,106,0.25)',
                  }}>
                    <div style={{
                      fontSize: '11px', color: '#5EC88A', fontWeight: 600,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      📍 {focusModeLabel}
                    </div>
                    {focusNodeIds && (
                      <p style={{ fontSize: '10px', color: '#3D9E6A', margin: '2px 0 4px' }}>
                        {visNodes.length}명 · {visLinks.length}쌍 표시 중
                      </p>
                    )}
                    <button
                      type="button" onClick={clearFocus}
                      style={{ fontSize: '10px', color: '#607898', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                      포커스 해제 (전체 보기)
                    </button>
                  </div>
                )}

              </div>
            </div>

            <Divider />

            {/* ── Search ── */}
            <div style={{ padding: '12px 14px 10px' }}>
              <p style={sectionLabel}>검색</p>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: '#607898', pointerEvents: 'none' }}>🔍</span>
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

            {/* ── Link type filters — org 뷰에서는 기관간 집계 링크에 의미없으므로 숨김 ── */}
            {viewMode !== 'org' && (
              <>
                <Divider />
                <div style={{ padding: '10px 14px 12px' }}>
                  <button
                    type="button"
                    onClick={() => setFiltersOpen(p => !p)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    }}>
                    <p style={sectionLabel}>관계 유형 필터</p>
                    <span style={{ fontSize: '10px', color: '#607898' }}>{filtersOpen ? '▲' : '▼'}</span>
                  </button>

                  {filtersOpen && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                        <button type="button" onClick={() => setActiveTypes(new Set(allTypes))}
                          style={smallBtn('#4A7CC0')}>전체 선택</button>
                        <button type="button" onClick={() => setActiveTypes(new Set())}
                          style={smallBtn('#607898')}>전체 해제</button>
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
                            <span style={{ width: '18px', height: '3px', borderRadius: '2px', background: LINK_COLORS[type] ?? '#8AAAC8', flexShrink: 0 }} />
                            <span style={{ fontSize: '11px', color: '#C8D8E8', textAlign: 'left' }}>
                              {LINK_LABELS[type] ?? type}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── 숨겨진 연결 안내 ── */}
            {hiddenLinkCount > 0 && (
              <>
                <Divider />
                <div style={{ padding: '8px 14px', fontSize: '10px', color: '#5A7090', lineHeight: 1.5 }}>
                  ℹ 노드당 상위 {MAX_LINKS_PER_NODE}개 연결만 표시
                  <br />
                  <span style={{ color: '#607898' }}>{hiddenLinkCount}개 추가 연결은 상세 페이지에서 확인</span>
                </div>
              </>
            )}

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
              color: '#607898', backdropFilter: 'blur(8px)',
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
