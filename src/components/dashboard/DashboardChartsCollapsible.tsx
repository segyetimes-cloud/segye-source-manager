'use client'

import { useState } from 'react'
import DashboardCharts, { type ChartData } from './DashboardCharts'

export default function DashboardChartsCollapsible({ data }: { data: ChartData }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          background: open ? 'rgba(30,144,255,0.06)' : 'rgba(255,255,255,0.025)',
          border: '1px solid',
          borderColor: open ? 'rgba(30,144,255,0.2)' : 'rgba(255,255,255,0.06)',
          borderRadius: open ? '10px 10px 0 0' : '10px',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: open ? '#7AADE0' : '#8AAAC8' }}>
          📊 활동 통계 상세
        </span>
        <span style={{
          fontSize: '11px', color: '#607898',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s',
          display: 'inline-block',
        }}>▼</span>
      </button>

      {open && (
        <div style={{
          border: '1px solid rgba(30,144,255,0.2)',
          borderTop: 'none',
          borderRadius: '0 0 10px 10px',
          padding: '4px 0 0',
          background: 'rgba(30,144,255,0.03)',
        }}>
          <DashboardCharts data={data} />
        </div>
      )}
    </div>
  )
}
