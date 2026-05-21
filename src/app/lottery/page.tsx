'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// ── 상수 ──────────────────────────────────────────────────────────────────
const W = 600
const H = 750
const BALL_R = 13
const GRAVITY = 0.10
const FRICTION = 0.88
const BOUNCE = 0.42
const PEG_R = 7
const BUMPER_R = 18

const BALL_LABELS = ['A','B','C','D','E','F','G','H','I','J']
const BALL_COLORS = [
  '#FF6B6B','#FFD93D','#6BCB77','#4D96FF','#FF922B',
  '#CC5DE8','#20C997','#F06595','#74C0FC','#A9E34B',
]

// ── 타입 ──────────────────────────────────────────────────────────────────
interface Ball {
  id: number
  label: string
  color: string
  x: number
  y: number
  vx: number
  vy: number
  active: boolean
  done: boolean
  rank: number
  bin: number
  trail: {x:number,y:number}[]
}

interface Peg { x: number; y: number; type: 'normal'|'bumper' }
interface Trap { x: number; y: number; w: number; open: boolean; timer: number }
interface Bin  { x: number; label: string }

// ── 레이아웃 생성 ─────────────────────────────────────────────────────────
function buildLayout() {
  const pegs: Peg[] = []
  // 지그재그 못 배열 (Plinko 스타일)
  for (let row = 0; row < 9; row++) {
    const cols = row % 2 === 0 ? 7 : 6
    const offsetX = row % 2 === 0 ? 50 : 95
    for (let col = 0; col < cols; col++) {
      const x = offsetX + col * 85
      const y = 180 + row * 52
      pegs.push({ x, y, type: 'normal' })
    }
  }
  // 범퍼 (특별 장애물) 5개
  const bumperPositions = [
    { x: 135, y: 310 }, { x: 465, y: 310 },
    { x: 220, y: 440 }, { x: 380, y: 440 },
    { x: 300, y: 550 },
  ]
  for (const p of bumperPositions) pegs.push({ ...p, type: 'bumper' })

  // 아래 10개 바구니
  const bins: Bin[] = BALL_LABELS.map((label, i) => ({
    x: 30 + i * 55,
    label,
  }))

  // 함정 문 (3개) - 중간에 가로로 막았다 열렸다
  const traps: Trap[] = [
    { x: 90,  y: 370, w: 110, open: false, timer: 0 },
    { x: 250, y: 490, w: 100, open: false, timer: 0 },
    { x: 400, y: 420, w: 110, open: false, timer: 0 },
  ]

  return { pegs, bins, traps }
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────
export default function LotteryGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef  = useRef<{
    balls: Ball[]
    pegs: Peg[]
    traps: Trap[]
    bins: Bin[]
    rankings: {label:string,color:string,bin:string}[]
    running: boolean
    frame: number
    rafId: number
    nextDrop: number
    dropIndex: number
  } | null>(null)
  const [rankings, setRankings] = useState<{label:string,color:string,bin:string}[]>([])
  const [phase, setPhase]       = useState<'idle'|'running'|'done'>('idle')

  const initState = useCallback(() => {
    const { pegs, bins, traps } = buildLayout()
    stateRef.current = {
      balls: [],
      pegs, bins, traps,
      rankings: [],
      running: false,
      frame: 0,
      rafId: 0,
      nextDrop: 30,
      dropIndex: 0,
    }
  }, [])

  useEffect(() => { initState() }, [initState])

  // ── 그리기 ──────────────────────────────────────────────────────────────
  const draw = useCallback((ctx: CanvasRenderingContext2D) => {
    const s = stateRef.current!

    // 배경
    ctx.fillStyle = '#0D1520'
    ctx.fillRect(0, 0, W, H)

    // 벽 테두리
    ctx.strokeStyle = '#2a4a6b'
    ctx.lineWidth = 3
    ctx.strokeRect(2, 2, W-4, H-4)

    // 함정 문
    for (const t of s.traps) {
      if (!t.open) {
        ctx.fillStyle = '#FF4444'
        ctx.shadowColor = '#FF4444'
        ctx.shadowBlur = 8
        ctx.fillRect(t.x, t.y, t.w, 8)
        ctx.shadowBlur = 0
        // 경고 마크
        ctx.fillStyle = '#FFD93D'
        ctx.font = 'bold 10px monospace'
        ctx.fillText('TRAP', t.x + t.w/2 - 14, t.y - 3)
      } else {
        // 열린 상태 - 점선
        ctx.strokeStyle = '#FF444444'
        ctx.setLineDash([4,4])
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(t.x, t.y + 4)
        ctx.lineTo(t.x + t.w, t.y + 4)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // 못
    for (const p of s.pegs) {
      if (p.type === 'bumper') {
        ctx.beginPath()
        ctx.arc(p.x, p.y, BUMPER_R, 0, Math.PI*2)
        const grd = ctx.createRadialGradient(p.x-4,p.y-4,2, p.x,p.y,BUMPER_R)
        grd.addColorStop(0, '#FF922B')
        grd.addColorStop(1, '#c05000')
        ctx.fillStyle = grd
        ctx.fill()
        ctx.strokeStyle = '#FFD93D'
        ctx.lineWidth = 2
        ctx.stroke()
        ctx.fillStyle = '#FFD93D'
        ctx.font = 'bold 9px monospace'
        ctx.textAlign = 'center'
        ctx.fillText('★', p.x, p.y+3)
      } else {
        ctx.beginPath()
        ctx.arc(p.x, p.y, PEG_R, 0, Math.PI*2)
        ctx.fillStyle = '#3a6ea5'
        ctx.fill()
        ctx.strokeStyle = '#6aafd4'
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }

    // 바구니 (하단)
    const binW = 55
    const binY = H - 80
    for (let i = 0; i < s.bins.length; i++) {
      const bx = 2 + i * binW
      // 바구니 테두리
      ctx.strokeStyle = '#2a6abf'
      ctx.lineWidth = 2
      ctx.strokeRect(bx+2, binY, binW-4, 78)
      ctx.fillStyle = 'rgba(13,30,60,0.7)'
      ctx.fillRect(bx+3, binY+1, binW-6, 76)
      // 번호
      ctx.fillStyle = '#6aafd4'
      ctx.font = 'bold 11px monospace'
      ctx.textAlign = 'center'
      ctx.fillText((i+1).toString(), bx + binW/2, binY + 14)
    }

    // 공 트레일
    for (const b of s.balls) {
      if (!b.active && !b.done) continue
      for (let i = 0; i < b.trail.length; i++) {
        const alpha = (i / b.trail.length) * 0.3
        ctx.beginPath()
        ctx.arc(b.trail[i].x, b.trail[i].y, BALL_R * 0.5, 0, Math.PI*2)
        ctx.fillStyle = b.color + Math.floor(alpha*255).toString(16).padStart(2,'0')
        ctx.fill()
      }
    }

    // 공
    for (const b of s.balls) {
      if (!b.active && !b.done) continue
      const grd = ctx.createRadialGradient(b.x-4, b.y-4, 2, b.x, b.y, BALL_R)
      grd.addColorStop(0, '#ffffff')
      grd.addColorStop(0.3, b.color)
      grd.addColorStop(1, b.color + '88')
      ctx.beginPath()
      ctx.arc(b.x, b.y, BALL_R, 0, Math.PI*2)
      ctx.fillStyle = grd
      ctx.shadowColor = b.color
      ctx.shadowBlur = 12
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 11px monospace'
      ctx.textAlign = 'center'
      ctx.fillText(b.label, b.x, b.y + 4)
    }

    // 상단 투하 가이드
    ctx.textAlign = 'center'
    ctx.fillStyle = '#4a7ab5'
    ctx.font = '11px monospace'
    ctx.fillText('▼ DROP ZONE ▼', W/2, 30)

    // 상단 "대기 중" 공 표시
    const waiting = BALL_LABELS.length - s.dropIndex
    if (waiting > 0 && s.running) {
      ctx.fillStyle = '#ffffff33'
      ctx.font = '10px monospace'
      ctx.fillText(`대기: ${waiting}개`, W - 60, 20)
    }
  }, [])

  // ── 물리 업데이트 ──────────────────────────────────────────────────────
  const update = useCallback(() => {
    const s = stateRef.current!
    s.frame++

    // 함정 토글 (랜덤하게 열고 닫기)
    for (const t of s.traps) {
      t.timer++
      if (!t.open && t.timer > 80 + Math.random() * 60) {
        t.open = true; t.timer = 0
      } else if (t.open && t.timer > 40 + Math.random() * 40) {
        t.open = false; t.timer = 0
      }
    }

    // 공 순차 투하
    if (s.running && s.frame >= s.nextDrop && s.dropIndex < BALL_LABELS.length) {
      const i = s.dropIndex
      const xPositions = [70,130,180,230,280,330,380,430,480,530]
      s.balls.push({
        id: i,
        label: BALL_LABELS[i],
        color: BALL_COLORS[i],
        x: xPositions[i] + (Math.random() - 0.5) * 20,
        y: 50,
        vx: (Math.random() - 0.5) * 0.8,
        vy: 0.3,
        active: true,
        done: false,
        rank: 0,
        bin: -1,
        trail: [],
      })
      s.dropIndex++
      s.nextDrop = s.frame + 35 + Math.floor(Math.random() * 30)
    }

    const binW = 55
    const binY = H - 80

    for (const b of s.balls) {
      if (!b.active) continue

      // 중력
      b.vy += GRAVITY
      b.x += b.vx
      b.y += b.vy

      // 트레일
      b.trail.push({x: b.x, y: b.y})
      if (b.trail.length > 8) b.trail.shift()

      // 벽 충돌
      if (b.x - BALL_R < 2) { b.x = 2 + BALL_R; b.vx = Math.abs(b.vx) * BOUNCE }
      if (b.x + BALL_R > W - 2) { b.x = W - 2 - BALL_R; b.vx = -Math.abs(b.vx) * BOUNCE }

      // 함정 충돌
      for (const t of s.traps) {
        if (!t.open &&
            b.y + BALL_R > t.y && b.y - BALL_R < t.y + 8 &&
            b.x > t.x && b.x < t.x + t.w) {
          b.y = t.y - BALL_R
          b.vy = -b.vy * BOUNCE
          b.vx += (Math.random() - 0.5) * 0.8
        }
      }

      // 못 충돌
      for (const p of s.pegs) {
        const r = p.type === 'bumper' ? BUMPER_R : PEG_R
        const dx = b.x - p.x
        const dy = b.y - p.y
        const dist = Math.sqrt(dx*dx + dy*dy)
        if (dist < r + BALL_R) {
          const nx = dx / dist
          const ny = dy / dist
          const dot = b.vx * nx + b.vy * ny
          const bounceFactor = p.type === 'bumper' ? 1.1 : BOUNCE
          b.vx = (b.vx - 2 * dot * nx) * bounceFactor
          b.vy = (b.vy - 2 * dot * ny) * bounceFactor
          b.x = p.x + nx * (r + BALL_R + 1)
          b.y = p.y + ny * (r + BALL_R + 1)
          // 범퍼는 추가 에너지
          if (p.type === 'bumper') {
            const speed = Math.sqrt(b.vx*b.vx + b.vy*b.vy)
            if (speed < 3) { b.vx *= 1.2; b.vy *= 1.2 }
          }
        }
      }

      // 속도 감쇠
      b.vx *= FRICTION

      // 바구니 도착
      if (b.y + BALL_R >= binY) {
        const binIdx = Math.min(9, Math.max(0, Math.floor(b.x / binW)))
        b.y = binY + BALL_R
        b.active = false
        b.done = true
        b.bin = binIdx
        b.vx = 0; b.vy = 0
        const rank = s.rankings.length + 1
        b.rank = rank
        s.rankings.push({ label: b.label, color: b.color, bin: (binIdx+1).toString() })
        setRankings([...s.rankings])
        if (s.rankings.length === BALL_LABELS.length) {
          s.running = false
          setPhase('done')
        }
      }
    }
  }, [])

  // ── 게임 루프 ──────────────────────────────────────────────────────────
  const gameLoop = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    update()
    draw(ctx)
    stateRef.current!.rafId = requestAnimationFrame(gameLoop)
  }, [update, draw])

  const startGame = useCallback(() => {
    if (stateRef.current?.rafId) cancelAnimationFrame(stateRef.current.rafId)
    initState()
    setRankings([])
    setPhase('running')
    setTimeout(() => {
      if (stateRef.current) {
        stateRef.current.running = true
        stateRef.current.rafId = requestAnimationFrame(gameLoop)
      }
    }, 50)
  }, [initState, gameLoop])

  useEffect(() => () => {
    if (stateRef.current?.rafId) cancelAnimationFrame(stateRef.current.rafId)
  }, [])

  // ── 최초 렌더 (idle 화면) ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || phase !== 'idle') return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#0D1520'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = '#2a4a6b'
    ctx.lineWidth = 3
    ctx.strokeRect(2, 2, W-4, H-4)
    ctx.fillStyle = '#4a9eff'
    ctx.font = 'bold 28px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('🎱 LOTTO BALL DROP', W/2, H/2 - 30)
    ctx.fillStyle = '#6aafd4'
    ctx.font = '14px monospace'
    ctx.fillText('A ~ J 10개 공이 장애물을 피해 낙하합니다', W/2, H/2 + 10)
    ctx.fillText('가장 먼저 도착하는 순서대로 등수 결정!', W/2, H/2 + 35)
  }, [phase])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4"
         style={{ background: '#060d18' }}>
      <h1 style={{ color: '#4a9eff', fontFamily: 'monospace', fontSize: 22, fontWeight: 'bold', letterSpacing: 2 }}>
        🎱 LOTTO BALL DROP
      </h1>

      <div className="flex gap-4 items-start">
        {/* 캔버스 */}
        <div style={{ border: '2px solid #2a4a6b', borderRadius: 8, overflow: 'hidden' }}>
          <canvas ref={canvasRef} width={W} height={H} />
        </div>

        {/* 순위판 */}
        <div style={{
          width: 160, minHeight: 400, background: '#0a1628',
          border: '2px solid #2a4a6b', borderRadius: 8, padding: 12,
          fontFamily: 'monospace',
        }}>
          <div style={{ color: '#4a9eff', fontWeight: 'bold', fontSize: 14, marginBottom: 12, textAlign: 'center' }}>
            📊 실시간 순위
          </div>
          {rankings.length === 0 && (
            <div style={{ color: '#334', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
              게임을 시작하세요
            </div>
          )}
          {rankings.map((r, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 8, padding: '6px 8px',
              background: i === 0 ? '#2a1a00' : i === 1 ? '#1a1a2a' : i === 2 ? '#1a2a1a' : '#111827',
              borderRadius: 6,
              border: `1px solid ${i === 0 ? '#FFD93D44' : i === 1 ? '#aaaaff44' : i === 2 ? '#88cc8844' : '#ffffff11'}`,
            }}>
              <span style={{ fontSize: 13, color: i === 0 ? '#FFD93D' : i === 1 ? '#aaaaff' : i === 2 ? '#88cc88' : '#666', minWidth: 22 }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`}
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 22, height: 22, borderRadius: '50%',
                background: r.color, color: '#fff', fontSize: 11, fontWeight: 'bold',
              }}>
                {r.label}
              </span>
              <span style={{ color: '#6aafd4', fontSize: 11 }}>→{r.bin}번</span>
            </div>
          ))}
          {phase === 'done' && (
            <div style={{ marginTop: 12, padding: '8px', background: '#0f2a0f', borderRadius: 6, border: '1px solid #2a6a2a', textAlign: 'center' }}>
              <div style={{ color: '#6BCB77', fontSize: 11 }}>🏆 게임 종료!</div>
              <div style={{ color: '#FFD93D', fontSize: 12, marginTop: 4 }}>
                우승: {rankings[0]?.label}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 버튼 */}
      <button
        onClick={startGame}
        style={{
          padding: '12px 40px',
          background: phase === 'running' ? '#1a3a1a' : 'linear-gradient(135deg, #1a4a8a, #2a6abf)',
          color: phase === 'running' ? '#4a6a4a' : '#ffffff',
          border: `2px solid ${phase === 'running' ? '#2a4a2a' : '#4a9eff'}`,
          borderRadius: 8, cursor: phase === 'running' ? 'not-allowed' : 'pointer',
          fontFamily: 'monospace', fontSize: 16, fontWeight: 'bold', letterSpacing: 2,
          transition: 'all 0.2s',
        }}
        disabled={phase === 'running'}
      >
        {phase === 'running' ? '⏳ 진행 중...' : phase === 'done' ? '🔄 다시 시작' : '▶ 게임 시작'}
      </button>

      {/* 규칙 설명 */}
      <div style={{ color: '#334d66', fontFamily: 'monospace', fontSize: 11, textAlign: 'center', maxWidth: 600 }}>
        ★ BUMPER(주황) 충돌 시 공이 튕겨나감 &nbsp;|&nbsp; RED TRAP — 닫히면 공이 막힘 &nbsp;|&nbsp; 먼저 도착 순으로 등수 결정
      </div>
    </div>
  )
}
