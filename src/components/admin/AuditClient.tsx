'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

interface AuditLog {
  id: number
  user_id: string | null
  user_email: string | null
  user_role: string | null
  action: string
  resource_type: string
  resource_id: string | null
  ip_address: string | null
  is_vpn_access: boolean
  export_row_count: number | null
  watermark_token: string | null
  metadata: Record<string, unknown>
  created_at: string
}

interface Props {
  logs: AuditLog[]
  totalCount: number
  currentPage: number
  totalPages: number
  currentAction: string
  currentEmail: string
  currentResourceType: string
  currentResourceId: string
  currentDateFrom: string
  currentDateTo: string
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  view:           { label: '조회',          color: '#687898' },
  create:         { label: '등록',          color: '#3D9E6A' },
  update:         { label: '수정',          color: '#4A7CC0' },
  delete:         { label: '삭제',          color: '#C04040' },
  export:         { label: '내보내기',       color: '#A87228' },
  import:         { label: '가져오기',       color: '#7E6E48' },
  view_private:   { label: '민감정보 열람',   color: '#A87228' },
  approve:        { label: '승인',          color: '#3D9E6A' },
  reject:         { label: '거절',          color: '#C04040' },
  security_alert: { label: '보안 경고',      color: '#C04040' },
}

const ACTION_OPTIONS = ['', 'view', 'view_private', 'create', 'update', 'delete', 'export', 'import', 'approve', 'reject']

const inputStyle = {
  background: '#182035',
  border: '1px solid #1A2838',
  color: '#CDD5E0',
  borderRadius: '8px',
  padding: '8px 12px',
  fontSize: '13px',
} as const

export default function AuditClient({
  logs, totalCount, currentPage, totalPages,
  currentAction, currentEmail, currentResourceType,
  currentResourceId, currentDateFrom, currentDateTo,
}: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const [action,       setAction]       = useState(currentAction)
  const [email,        setEmail]        = useState(currentEmail)
  const [resourceType, setResourceType] = useState(currentResourceType)
  const [resourceId,   setResourceId]   = useState(currentResourceId)
  const [dateFrom,     setDateFrom]     = useState(currentDateFrom)
  const [dateTo,       setDateTo]       = useState(currentDateTo)
  const [exporting,    setExporting]    = useState(false)

  function buildParams(page = '1') {
    const p = new URLSearchParams()
    if (action)       p.set('action',        action)
    if (email)        p.set('user_email',    email)
    if (resourceType) p.set('resource_type', resourceType)
    if (resourceId)   p.set('resource_id',   resourceId)
    if (dateFrom)     p.set('date_from',     dateFrom)
    if (dateTo)       p.set('date_to',       dateTo)
    p.set('page', page)
    return p
  }

  function applyFilter() {
    startTransition(() => router.push(`${pathname}?${buildParams('1')}`))
  }

  function buildPageUrl(p: number) {
    const sp = new URLSearchParams()
    if (currentAction)       sp.set('action',        currentAction)
    if (currentEmail)        sp.set('user_email',    currentEmail)
    if (currentResourceType) sp.set('resource_type', currentResourceType)
    if (currentResourceId)   sp.set('resource_id',   currentResourceId)
    if (currentDateFrom)     sp.set('date_from',     currentDateFrom)
    if (currentDateTo)       sp.set('date_to',       currentDateTo)
    sp.set('page', String(p))
    return `${pathname}?${sp}`
  }

  async function handleExport() {
    setExporting(true)
    try {
      const sp = new URLSearchParams()
      if (currentAction)       sp.set('action',        currentAction)
      if (currentEmail)        sp.set('user_email',    currentEmail)
      if (currentResourceType) sp.set('resource_type', currentResourceType)
      if (currentResourceId)   sp.set('resource_id',   currentResourceId)
      if (currentDateFrom)     sp.set('date_from',     currentDateFrom)
      if (currentDateTo)       sp.set('date_to',       currentDateTo)

      const res = await fetch(`/api/admin/audit/export?${sp}`)
      if (!res.ok) {
        const err = await res.json()
        alert(err.error ?? '내보내기 실패')
        return
      }
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      const cd   = res.headers.get('content-disposition') ?? ''
      const match = cd.match(/filename\*=UTF-8''(.+)/)
      a.href     = url
      a.download = match ? decodeURIComponent(match[1]) : '감사로그.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* ── 필터 ────────────────────────────────────────────────────────────── */}
      <div className="glass-card p-4 space-y-3">
        {/* 첫 번째 줄: 액션 · 이메일 · 리소스 유형 */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#687898' }}>액션</label>
            <select value={action} onChange={e => setAction(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              {ACTION_OPTIONS.map(a => (
                <option key={a} value={a}>
                  {a ? (ACTION_LABELS[a]?.label ?? a) : '전체'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#687898' }}>이메일</label>
            <input
              type="text" value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilter()}
              placeholder="user@segye.com"
              style={{ ...inputStyle, width: 200 }}
            />
          </div>

          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#687898' }}>리소스 유형</label>
            <select value={resourceType} onChange={e => setResourceType(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}>
              {['', 'source', 'report', 'user', 'approval', 'contact_log', 'export', 'help', 'audit_logs'].map(rt => (
                <option key={rt} value={rt}>{rt || '전체'}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#687898' }}>리소스 ID</label>
            <input
              type="text" value={resourceId}
              onChange={e => setResourceId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilter()}
              placeholder="UUID 일부 검색"
              style={{ ...inputStyle, width: 180, fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>
        </div>

        {/* 두 번째 줄: 날짜 범위 · 검색 · 초기화 · Export */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#687898' }}>시작일</label>
            <input
              type="date" value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            />
          </div>
          <div>
            <label className="block text-xs mb-1.5" style={{ color: '#687898' }}>종료일</label>
            <input
              type="date" value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              style={{ ...inputStyle, cursor: 'pointer' }}
            />
          </div>

          <button
            onClick={applyFilter} disabled={isPending}
            style={{
              background: 'linear-gradient(135deg, #4A7CC0, #0066CC)',
              color: 'white', border: 'none', borderRadius: '8px',
              padding: '9px 16px', fontSize: '13px', fontWeight: 600,
              cursor: isPending ? 'not-allowed' : 'pointer',
            }}>
            {isPending ? '검색 중...' : '검색'}
          </button>

          {/* 필터 초기화 */}
          {(currentAction || currentEmail || currentResourceType || currentResourceId || currentDateFrom || currentDateTo) && (
            <button
              onClick={() => {
                setAction(''); setEmail(''); setResourceType('')
                setResourceId(''); setDateFrom(''); setDateTo('')
                startTransition(() => router.push(pathname))
              }}
              style={{ background: '#182035', color: '#687898', border: '1px solid #1A2838', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', cursor: 'pointer' }}>
              초기화
            </button>
          )}

          {/* Export 버튼 */}
          <button
            onClick={handleExport} disabled={exporting}
            style={{
              background: exporting ? '#182035' : 'rgba(168,114,40,0.15)',
              color: '#A87228', border: '1px solid rgba(168,114,40,0.35)',
              borderRadius: '8px', padding: '9px 14px', fontSize: '13px', fontWeight: 600,
              cursor: exporting ? 'not-allowed' : 'pointer',
              marginLeft: 'auto',
            }}>
            {exporting ? '처리 중...' : '📥 Excel 내보내기'}
          </button>

          <span className="text-xs" style={{ color: '#485870', whiteSpace: 'nowrap' }}>
            총 {totalCount.toLocaleString()}건
          </span>
        </div>
      </div>

      {/* ── 로그 테이블 ─────────────────────────────────────────────────────── */}
      <div className="glass-card overflow-hidden">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1A2838' }}>
                {['시각', '사용자', '액션', '리소스', 'IP', 'VPN', '메타'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#485870', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#485870' }}>
                    로그가 없습니다
                  </td>
                </tr>
              ) : logs.map(log => {
                const actionInfo = ACTION_LABELS[log.action] ?? { label: log.action, color: '#687898' }
                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(26,48,80,0.5)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(30,144,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                    <td style={{ padding: '10px 14px', color: '#485870', whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>

                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ color: '#CDD5E0' }}>{log.user_email?.split('@')[0] ?? '—'}</div>
                      <div style={{ color: '#485870', fontSize: '11px' }}>{log.user_role}</div>
                    </td>

                    <td style={{ padding: '10px 14px' }}>
                      <span className="text-xs px-2 py-0.5 rounded"
                        style={{ background: `${actionInfo.color}1A`, color: actionInfo.color, fontWeight: 600 }}>
                        {actionInfo.label}
                      </span>
                    </td>

                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ color: '#687898' }}>{log.resource_type}</div>
                      {log.resource_id && (
                        <div style={{ color: '#485870', fontSize: '11px', fontFamily: 'monospace' }}>
                          {log.resource_id.slice(0, 8)}…
                        </div>
                      )}
                      {log.export_row_count != null && (
                        <div style={{ color: '#A87228', fontSize: '11px' }}>{log.export_row_count}행</div>
                      )}
                    </td>

                    <td style={{ padding: '10px 14px', color: '#485870', fontSize: '11px', fontFamily: 'monospace' }}>
                      {log.ip_address ?? '—'}
                    </td>

                    <td style={{ padding: '10px 14px' }}>
                      {log.is_vpn_access
                        ? <span style={{ color: '#3D9E6A', fontSize: '11px' }}>✅ VPN</span>
                        : <span style={{ color: '#485870', fontSize: '11px' }}>외부</span>}
                    </td>

                    <td style={{ padding: '10px 14px', maxWidth: '200px' }}>
                      {Object.keys(log.metadata ?? {}).length > 0 && (
                        <details>
                          <summary style={{ color: '#485870', fontSize: '11px', cursor: 'pointer' }}>보기</summary>
                          <pre style={{ color: '#687898', fontSize: '10px', marginTop: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 페이지네이션 ──────────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Link href={buildPageUrl(currentPage - 1)}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{ background: '#131C2C', color: '#687898', border: '1px solid #1A2838', textDecoration: 'none' }}>
              ← 이전
            </Link>
          )}
          <span className="text-sm" style={{ color: '#485870' }}>
            {currentPage} / {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link href={buildPageUrl(currentPage + 1)}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{ background: '#131C2C', color: '#687898', border: '1px solid #1A2838', textDecoration: 'none' }}>
              다음 →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
