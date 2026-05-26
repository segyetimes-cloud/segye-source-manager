'use client'

export interface ChartData {
  monthlyTrend: { label: string; count: number }[]       // 최근 6개월 취재원 등록 수
  completeness: { label: string; count: number; color: string }[]  // 완성도 분포 5구간
  reportCategories: { name: string; count: number; color: string }[] // 보고서 카테고리
  topOrgs: { name: string; count: number }[]             // 상위 출입처 5개
  myReportCount: number
  avgCompleteness: number
  sharedCount: number
  sensitiveCount: number
}

// ────────────────────────────────────────────────────────────
// 월별 등록 추이 (SVG Line Chart)
// ────────────────────────────────────────────────────────────
function LineChart({ data }: { data: { label: string; count: number }[] }) {
  const W = 320
  const H = 90
  const PAD = { t: 12, b: 28, l: 28, r: 12 }
  const cW = W - PAD.l - PAD.r
  const cH = H - PAD.t - PAD.b
  const maxVal = Math.max(...data.map(d => d.count), 1)
  const n = data.length

  const pts = data.map((d, i) => ({
    x: PAD.l + (n <= 1 ? cW / 2 : (i / (n - 1)) * cW),
    y: PAD.t + cH - (d.count / maxVal) * cH,
    ...d,
  }))

  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)},${(PAD.t + cH).toFixed(1)} L${pts[0].x.toFixed(1)},${(PAD.t + cH).toFixed(1)} Z`

  // Y축 격자선 (0, max/2, max)
  const gridYs = [PAD.t, PAD.t + cH / 2, PAD.t + cH]
  const gridVals = [maxVal, Math.round(maxVal / 2), 0]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', overflow: 'visible' }}>
      <defs>
        <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4A7CC0" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#4A7CC0" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* 격자선 */}
      {gridYs.map((y, i) => (
        <g key={i}>
          <line x1={PAD.l} y1={y} x2={W - PAD.r} y2={y}
            stroke="#1A2838" strokeWidth="1" strokeDasharray={i === 2 ? '' : '3 3'} />
          <text x={PAD.l - 4} y={y + 3} textAnchor="end" fontSize="8" fill="#384860">
            {gridVals[i]}
          </text>
        </g>
      ))}

      {/* 면적 */}
      <path d={areaPath} fill="url(#lineAreaGrad)" />
      {/* 선 */}
      <path d={linePath} fill="none" stroke="#4A7CC0" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
      {/* 점 */}
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={p.count > 0 ? 3.5 : 1.5} fill="#0D1520" stroke="#4A7CC0" strokeWidth={p.count > 0 ? 1.5 : 0.5} />
          {p.count > 0 && p.label !== '' && (
            <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="9" fill="#7AADE0" fontWeight="600">
              {p.count}
            </text>
          )}
        </g>
      ))}
      {/* X축 레이블 */}
      {pts.map((p, i) => p.label ? (
        <text key={i} x={p.x} y={H - 4} textAnchor="middle" fontSize="9" fill="#607898">
          {p.label}
        </text>
      ) : null)}
    </svg>
  )
}

// ────────────────────────────────────────────────────────────
// 완성도 분포 (Bar Chart)
// ────────────────────────────────────────────────────────────
function CompletenessChart({ data }: { data: { label: string; count: number; color: string }[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '70px', padding: '0 4px' }}>
      {data.map((d, i) => {
        const pct = (d.count / maxCount) * 100
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: '#7AADE0', fontWeight: 600, minHeight: '14px' }}>
              {d.count > 0 ? d.count : ''}
            </span>
            <div style={{
              width: '100%', height: `${Math.max(pct, 3)}%`,
              background: d.color, borderRadius: '4px 4px 0 0',
              transition: 'height 0.4s ease',
              minHeight: '4px',
            }} />
            <span style={{ fontSize: '9px', color: '#607898', whiteSpace: 'nowrap' }}>{d.label}</span>
          </div>
        )
      })}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 보고서 카테고리 (Donut Chart)
// ────────────────────────────────────────────────────────────
function DonutChart({ data, total }: { data: { name: string; count: number; color: string }[]; total: number }) {
  const R = 36
  const r = 22
  const cx = 50
  const cy = 50

  if (total === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0', color: '#607898', fontSize: '13px' }}>
        작성된 보고서가 없습니다
      </div>
    )
  }

  let angle = -Math.PI / 2
  const arcs = data.filter(d => d.count > 0).map(d => {
    const sweep = (d.count / total) * 2 * Math.PI
    const start = angle
    angle += sweep
    return { ...d, start, end: angle }
  })

  function sectorPath(start: number, end: number): string {
    const x1 = cx + R * Math.cos(start)
    const y1 = cy + R * Math.sin(start)
    const x2 = cx + R * Math.cos(end)
    const y2 = cy + R * Math.sin(end)
    const xi1 = cx + r * Math.cos(start)
    const yi1 = cy + r * Math.sin(start)
    const xi2 = cx + r * Math.cos(end)
    const yi2 = cy + r * Math.sin(end)
    const large = end - start > Math.PI ? 1 : 0
    return `M${x1.toFixed(2)},${y1.toFixed(2)} A${R},${R} 0 ${large} 1 ${x2.toFixed(2)},${y2.toFixed(2)} L${xi2.toFixed(2)},${yi2.toFixed(2)} A${r},${r} 0 ${large} 0 ${xi1.toFixed(2)},${yi1.toFixed(2)} Z`
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <svg viewBox="0 0 100 100" style={{ width: '90px', flexShrink: 0 }}>
        {arcs.map((arc, i) => (
          <path key={i} d={sectorPath(arc.start, arc.end)} fill={arc.color} />
        ))}
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="13" fill="#CDD5E0" fontWeight="700">{total}</text>
        <text x={cx} y={cy + 8} textAnchor="middle" fontSize="7.5" fill="#607898">건</text>
      </svg>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {arcs.map((arc, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: arc.color, flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: '#8899AA', flex: 1 }}>{arc.name}</span>
            <span style={{ fontSize: '11px', color: '#CDD5E0', fontWeight: 600 }}>{arc.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 상위 출입처 (Horizontal Bar)
// ────────────────────────────────────────────────────────────
function OrgBarChart({ data }: { data: { name: string; count: number }[] }) {
  const maxCount = Math.max(...data.map(d => d.count), 1)
  if (data.length === 0) return (
    <p style={{ color: '#607898', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>
      취재원 소속 데이터가 없습니다
    </p>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#8AAAC8', width: '14px', textAlign: 'right', flexShrink: 0 }}>
            {i + 1}
          </span>
          <span style={{
            fontSize: '12px', color: '#CDD5E0',
            width: '90px', flexShrink: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{d.name}</span>
          <div style={{ flex: 1, background: '#1A2838', borderRadius: '3px', height: '8px', overflow: 'hidden' }}>
            <div style={{
              width: `${(d.count / maxCount) * 100}%`,
              height: '100%',
              background: `hsl(${210 - i * 15}, 60%, ${55 - i * 3}%)`,
              borderRadius: '3px',
              transition: 'width 0.4s ease',
            }} />
          </div>
          <span style={{ fontSize: '11px', color: '#7AADE0', fontWeight: 600, width: '24px', textAlign: 'right', flexShrink: 0 }}>
            {d.count}
          </span>
        </div>
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 공개/민감 현황 (Stacked Info)
// ────────────────────────────────────────────────────────────
function SharedSensitiveBar({ shared, sensitive }: { shared: number; sensitive: number }) {
  const total = shared || 1
  const sensitiveRatio = Math.round((sensitive / total) * 100)
  const normalRatio = 100 - sensitiveRatio
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* 스택 바 */}
      <div style={{ display: 'flex', height: '12px', borderRadius: '6px', overflow: 'hidden', gap: '2px' }}>
        <div style={{ flex: normalRatio, background: '#3A90A8', borderRadius: '6px 0 0 6px', minWidth: '4px' }} />
        <div style={{ flex: sensitiveRatio, background: '#C04040', borderRadius: '0 6px 6px 0', minWidth: sensitiveRatio > 0 ? '4px' : '0' }} />
      </div>
      {/* 범례 */}
      <div style={{ display: 'flex', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#3A90A8' }} />
          <span style={{ fontSize: '12px', color: '#8899AA' }}>일반</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#3A90A8' }}>{shared - sensitive}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#C04040' }} />
          <span style={{ fontSize: '12px', color: '#8899AA' }}>민감</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#C04040' }}>{sensitive}</span>
        </div>
      </div>
      <p style={{ fontSize: '11px', color: '#607898', margin: 0 }}>
        전체 공유 취재원 {total}명 중 민감 분류 {sensitiveRatio}%
      </p>
    </div>
  )
}

// ────────────────────────────────────────────────────────────
// 메인 컴포넌트
// ────────────────────────────────────────────────────────────
export default function DashboardCharts({ data }: { data: ChartData }) {
  const cardStyle: React.CSSProperties = {
    background: 'rgba(19,28,44,0.8)',
    border: '1px solid #1A2838',
    borderRadius: '12px',
    padding: '12px 14px',
  }
  const titleStyle: React.CSSProperties = {
    fontSize: '13px', fontWeight: 600, color: '#8899AA',
    marginBottom: '8px', letterSpacing: '0.02em',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#CDD5E0', margin: 0 }}>
        📊 통계 분석
      </h2>

      {/* 상단 2열 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>

        {/* 월별 등록 추이 */}
        <div style={cardStyle}>
          <p style={titleStyle}>📈 최근 30일 등록 추이</p>
          <LineChart data={data.monthlyTrend} />
        </div>

        {/* 완성도 분포 */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <p style={{ ...titleStyle, marginBottom: 0 }}>🎯 취재원 완성도 분포</p>
            <span style={{ fontSize: '12px', color: '#7AADE0', fontWeight: 700 }}>
              평균 {data.avgCompleteness}점
            </span>
          </div>
          <CompletenessChart data={data.completeness} />
        </div>

      </div>

      {/* 하단 3열 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>

        {/* 보고서 카테고리 */}
        <div style={cardStyle}>
          <p style={titleStyle}>📋 정보보고 카테고리</p>
          <DonutChart data={data.reportCategories} total={data.myReportCount} />
        </div>

        {/* 상위 출입처 */}
        <div style={cardStyle}>
          <p style={titleStyle}>🏢 내 취재원 상위 출입처</p>
          <OrgBarChart data={data.topOrgs} />
        </div>

        {/* 공유 취재원 현황 */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <p style={{ ...titleStyle, marginBottom: 0 }}>🌐 공유 취재원 현황</p>
          </div>
          <SharedSensitiveBar shared={data.sharedCount} sensitive={data.sensitiveCount} />
        </div>

      </div>
    </div>
  )
}
