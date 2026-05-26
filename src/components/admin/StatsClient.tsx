
'use client'

import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'

interface StatRow {
  id: string
  full_name: string
  department: string | null
  desk_name: string | null
  role: string
  sources_created: number
  points_earned: number
  edits_made: number
  help_responses: number
}

type SortKey = 'sources_created' | 'edits_made' | 'help_responses' | 'points_earned' | 'full_name'
type SortDir = 'asc' | 'desc'

type Preset = '오늘' | '이번 주' | '이번 달' | '이번 분기' | '올해' | '직접 입력'

const ROLE_LABEL: Record<string, string> = {
  superadmin: '최고관리자',
  admin: '데스크',
  deputy: '차장',
  reporter: '기자',
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function displayDate(str: string): string {
  // YYYY-MM-DD => YYYY.MM.DD
  return str.replace(/-/g, '.')
}

function getPresetRange(preset: Preset): { from: string; to: string } {
  const now = new Date()
  const today = toDateStr(now)

  if (preset === '오늘') {
    return { from: today, to: today }
  }
  if (preset === '이번 주') {
    const dow = now.getDay() // 0=Sun
    const mon = new Date(now)
    mon.setDate(now.getDate() - ((dow + 6) % 7))
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    return { from: toDateStr(mon), to: toDateStr(sun) }
  }
  if (preset === '이번 달') {
    const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    return { from, to: today }
  }
  if (preset === '이번 분기') {
    const q = Math.floor(now.getMonth() / 3)
    const qStart = new Date(now.getFullYear(), q * 3, 1)
    return { from: toDateStr(qStart), to: today }
  }
  if (preset === '올해') {
    return { from: `${now.getFullYear()}-01-01`, to: today }
  }
  // 직접 입력: 기본값은 이번 달
  const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  return { from, to: today }
}

export default function StatsClient() {
  const [preset, setPreset] = useState<Preset>('이번 달')
  const [from, setFrom] = useState(() => getPresetRange('이번 달').from)
  const [to, setTo] = useState(() => getPresetRange('이번 달').to)
  const [customFrom, setCustomFrom] = useState(from)
  const [customTo, setCustomTo] = useState(to)

  const [rows, setRows] = useState<StatRow[]>([])
  const [loading, setLoading] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>('sources_created')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const fetchStats = useCallback(async (f: string, t: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/stats?from=${f}&to=${t}`)
      if (res.ok) {
        const json = await res.json()
        setRows(json.stats ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats(from, to)
  }, [from, to, fetchStats])

  function handlePreset(p: Preset) {
    setPreset(p)
    if (p !== '직접 입력') {
      const range = getPresetRange(p)
      setFrom(range.from)
      setTo(range.to)
      setCustomFrom(range.from)
      setCustomTo(range.to)
    }
  }

  function handleCustomApply() {
    if (customFrom && customTo && customFrom <= customTo) {
      setFrom(customFrom)
      setTo(customTo)
    }
  }

  function handleExcelExport() {
    if (rows.length === 0) return

    const wb = XLSX.utils.book_new()

    // ── 시트1: 사용자별 실적 ──────────────────────────────────────────────────
    const periodLabel = `${displayDate(from)} ~ ${displayDate(to)}`

    // 제목 + 기간 메타 행
    const metaRows = [
      ['세계일보 취재원관리시스템 — 실적 집계'],
      [`조회 기간: ${periodLabel}`],
      [`출력 일시: ${new Date().toLocaleString('ko-KR')}`],
      [],   // 빈 행
    ]

    // 헤더
    const header = ['순위', '이름', '부서', '역할', '취재원 등록', '수정 횟수', '도움 응답', '적립 포인트(pt)']

    // 데이터 행 (현재 정렬 순서 그대로)
    const dataRows = sorted.map((row, i) => [
      i + 1,
      row.full_name || '',
      row.department || '',
      ROLE_LABEL[row.role] ?? row.role,
      row.sources_created,
      row.edits_made,
      row.help_responses,
      row.points_earned,
    ])

    // 합계 행
    const totalRow = ['', 'TOTAL', '', '', totalSources, totalEdits, totalHelp, totalPoints]

    const allRows = [...metaRows, header, ...dataRows, totalRow]
    const ws = XLSX.utils.aoa_to_sheet(allRows)

    // 열 너비 설정
    ws['!cols'] = [
      { wch: 6 },   // 순위
      { wch: 14 },  // 이름
      { wch: 14 },  // 부서
      { wch: 10 },  // 역할
      { wch: 12 },  // 취재원 등록
      { wch: 10 },  // 수정 횟수
      { wch: 10 },  // 도움 응답
      { wch: 16 },  // 적립 포인트
    ]

    // 셀 병합: 제목 행 A1~H1
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }]

    XLSX.utils.book_append_sheet(wb, ws, '실적집계')

    // ── 파일명: 실적집계_YYYYMMDD~YYYYMMDD.xlsx ─────────────────────────────
    const fileName = `실적집계_${from.replace(/-/g, '')}-${to.replace(/-/g, '')}.xlsx`
    XLSX.writeFile(wb, fileName)
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] as number | string
    const bv = b[sortKey] as number | string
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortDir === 'desc' ? bv - av : av - bv
    }
    const as = String(av ?? '')
    const bs = String(bv ?? '')
    return sortDir === 'desc' ? bs.localeCompare(as) : as.localeCompare(bs)
  })

  const totalSources = rows.reduce((s, r) => s + r.sources_created, 0)
  const totalPoints  = rows.reduce((s, r) => s + r.points_earned, 0)
  const totalEdits   = rows.reduce((s, r) => s + r.edits_made, 0)
  const totalHelp    = rows.reduce((s, r) => s + r.help_responses, 0)

  const PRESETS: Preset[] = ['오늘', '이번 주', '이번 달', '이번 분기', '올해', '직접 입력']

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <span style={{ color: '#2A4060' }}> ↕</span>
    return <span style={{ color: '#4A7CC0' }}>{sortDir === 'desc' ? ' ↓' : ' ↑'}</span>
  }

  const rankEmoji = (i: number) => {
    if (i === 0) return '🥇'
    if (i === 1) return '🥈'
    if (i === 2) return '🥉'
    return String(i + 1)
  }

  const summaryCards = [
    { label: '취재원 등록', value: totalSources, unit: '건', color: '#4A7CC0' },
    { label: '적립 포인트', value: totalPoints, unit: 'pt', color: '#7E6E48' },
    { label: '수정 횟수', value: totalEdits, unit: '회', color: '#3D9E6A' },
    { label: '도움 응답', value: totalHelp, unit: '건', color: '#FF6B6B' },
  ]

  return (
    <div className="space-y-5">
      {/* 기간 선택 */}
      <div className="glass-card p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {PRESETS.map(p => (
            <button
              key={p}
              onClick={() => handlePreset(p)}
              style={{
                padding: '5px 14px',
                borderRadius: '9999px',
                fontSize: '13px',
                fontWeight: preset === p ? 600 : 400,
                background: preset === p ? 'rgba(30,144,255,0.18)' : 'rgba(26,48,80,0.6)',
                color: preset === p ? '#4A7CC0' : '#8AAAC8',
                border: preset === p ? '1px solid rgba(30,144,255,0.4)' : '1px solid #1A2838',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}>
              {p}
            </button>
          ))}
        </div>

        {preset === '직접 입력' && (
          <div className="flex items-center gap-2 mt-2">
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              style={{
                background: '#131C2C',
                border: '1px solid #1A2838',
                color: '#CDD5E0',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <span style={{ color: '#607898' }}>~</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              style={{
                background: '#131C2C',
                border: '1px solid #1A2838',
                color: '#CDD5E0',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '13px',
                outline: 'none',
              }}
            />
            <button
              onClick={handleCustomApply}
              style={{
                padding: '6px 16px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #4A7CC0, #0066CC)',
                color: 'white',
                border: 'none',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
              }}>
              조회
            </button>
          </div>
        )}

        <p className="text-xs mt-2" style={{ color: '#607898' }}>
          조회 기간: <span style={{ color: '#8AAAC8' }}>{displayDate(from)} ~ {displayDate(to)}</span>
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {summaryCards.map(card => (
          <div key={card.label} className="glass-card p-4 text-center">
            {loading ? (
              <div style={{ color: '#2A4060', fontSize: '28px', fontWeight: 700 }}>—</div>
            ) : (
              <div style={{ color: card.color, fontSize: '28px', fontWeight: 700 }}>
                {card.value.toLocaleString()}
                <span style={{ fontSize: '14px', marginLeft: '2px' }}>{card.unit}</span>
              </div>
            )}
            <div className="text-xs mt-1" style={{ color: '#8AAAC8' }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* 사용자별 실적 테이블 */}
      <div className="glass-card overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #1A2838' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#CDD5E0' }}>
            사용자별 실적
          </h2>
          <button
            onClick={handleExcelExport}
            disabled={rows.length === 0 || loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              background: rows.length === 0 || loading
                ? 'rgba(26,48,80,0.4)'
                : 'linear-gradient(135deg, #1E6B3C, #0D4F2B)',
              color: rows.length === 0 || loading ? '#607898' : '#4ADE80',
              border: rows.length === 0 || loading
                ? '1px solid #1A2838'
                : '1px solid rgba(74,222,128,0.3)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: rows.length === 0 || loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              if (rows.length > 0 && !loading)
                (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #27823F, #155E31)'
            }}
            onMouseLeave={e => {
              if (rows.length > 0 && !loading)
                (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #1E6B3C, #0D4F2B)'
            }}>
            {/* 엑셀 아이콘 */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="1" width="12" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
              <path d="M4 4.5L6 7L4 9.5M7.5 9.5H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
            엑셀 다운로드
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <div style={{ color: '#607898', fontSize: '14px' }}>데이터를 불러오는 중...</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1A2838' }}>
                  {[
                    { label: '순위', key: null },
                    { label: '이름', key: 'full_name' as SortKey },
                    { label: '부서', key: null },
                    { label: '역할', key: null },
                    { label: '취재원 등록', key: 'sources_created' as SortKey },
                    { label: '수정 횟수', key: 'edits_made' as SortKey },
                    { label: '도움 응답', key: 'help_responses' as SortKey },
                    { label: '적립 포인트', key: 'points_earned' as SortKey },
                  ].map(col => (
                    <th
                      key={col.label}
                      onClick={col.key ? () => handleSort(col.key!) : undefined}
                      style={{
                        padding: '10px 14px',
                        textAlign: col.key && col.key !== 'full_name' ? 'right' : 'left',
                        color: '#8AAAC8',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        cursor: col.key ? 'pointer' : 'default',
                        userSelect: 'none',
                      }}>
                      {col.label}
                      {col.key && <SortIcon col={col.key} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, i) => (
                  <tr
                    key={row.id}
                    style={{
                      borderBottom: '1px solid rgba(26,48,80,0.5)',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(30,144,255,0.04)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 14px', color: '#8AAAC8', textAlign: 'center', width: '48px' }}>
                      {rankEmoji(i)}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#CDD5E0', fontWeight: 500 }}>
                      {row.full_name || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#8AAAC8' }}>
                      {row.department || '—'}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#8AAAC8' }}>
                      {ROLE_LABEL[row.role] ?? row.role}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: row.sources_created === 0 ? '#2A4060' : '#CDD5E0', fontWeight: row.sources_created > 0 ? 600 : 400 }}>
                      {row.sources_created}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: row.edits_made === 0 ? '#2A4060' : '#CDD5E0' }}>
                      {row.edits_made}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: row.help_responses === 0 ? '#2A4060' : '#CDD5E0' }}>
                      {row.help_responses}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: row.points_earned === 0 ? '#2A4060' : '#7E6E48', fontWeight: row.points_earned > 0 ? 600 : 400 }}>
                      {row.points_earned > 0 ? `+${row.points_earned.toLocaleString()}` : '0'}
                    </td>
                  </tr>
                ))}

                {/* 합계 행 */}
                {sorted.length > 0 && (
                  <tr style={{ borderTop: '2px solid #1A2838', background: 'rgba(26,48,80,0.3)' }}>
                    <td style={{ padding: '10px 14px', color: '#607898', textAlign: 'center' }}>—</td>
                    <td style={{ padding: '10px 14px', color: '#8AAAC8', fontWeight: 700 }}>TOTAL</td>
                    <td style={{ padding: '10px 14px' }} />
                    <td style={{ padding: '10px 14px' }} />
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#CDD5E0', fontWeight: 700 }}>{totalSources}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#CDD5E0', fontWeight: 700 }}>{totalEdits}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#CDD5E0', fontWeight: 700 }}>{totalHelp}</td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', color: '#7E6E48', fontWeight: 700 }}>+{totalPoints.toLocaleString()}</td>
                  </tr>
                )}

                {sorted.length === 0 && !loading && (
                  <tr>
                    <td colSpan={8} style={{ padding: '40px', textAlign: 'center', color: '#607898' }}>
                      해당 기간에 실적 데이터가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
