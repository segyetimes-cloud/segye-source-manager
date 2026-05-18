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
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  view: { label: '조회', color: '#8899BB' },
  create: { label: '등록', color: '#00CC66' },
  update: { label: '수정', color: '#1E90FF' },
  delete: { label: '삭제', color: '#FF4444' },
  export: { label: '내보내기', color: '#FF9900' },
  import: { label: '가져오기', color: '#FFD700' },
  view_private: { label: '민감정보 열람', color: '#FF9900' },
  approve: { label: '승인', color: '#00CC66' },
  reject: { label: '거절', color: '#FF4444' },
}

const ACTION_OPTIONS = ['', 'view', 'create', 'update', 'delete', 'export', 'import', 'view_private', 'approve', 'reject']

export default function AuditClient({
  logs, totalCount, currentPage, totalPages, currentAction, currentEmail,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [action, setAction] = useState(currentAction)
  const [email, setEmail] = useState(currentEmail)

  function applyFilter() {
    const params = new URLSearchParams()
    if (action) params.set('action', action)
    if (email) params.set('user_email', email)
    params.set('page', '1')
    startTransition(() => router.push(`${pathname}?${params}`))
  }

  function buildPageUrl(p: number) {
    const params = new URLSearchParams()
    if (currentAction) params.set('action', currentAction)
    if (currentEmail) params.set('user_email', currentEmail)
    params.set('page', String(p))
    return `${pathname}?${params}`
  }

  return (
    <div className="space-y-5">
      {/* 필터 */}
      <div className="glass-card p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs mb-1.5" style={{ color: '#8899BB' }}>액션</label>
          <select
            value={action}
            onChange={e => setAction(e.target.value)}
            style={{
              background: '#132850',
              border: '1px solid #1A3050',
              color: '#E8F0FE',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '13px',
              cursor: 'pointer',
            }}>
            {ACTION_OPTIONS.map(a => (
              <option key={a} value={a}>
                {a ? (ACTION_LABELS[a]?.label ?? a) : '전체'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs mb-1.5" style={{ color: '#8899BB' }}>이메일 검색</label>
          <input
            type="text"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyFilter()}
            placeholder="user@segye.com"
            style={{
              background: '#132850',
              border: '1px solid #1A3050',
              color: '#E8F0FE',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '13px',
              width: '220px',
            }}
          />
        </div>

        <button
          onClick={applyFilter}
          disabled={isPending}
          style={{
            background: 'linear-gradient(135deg, #1E90FF, #0066CC)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '9px 16px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: isPending ? 'not-allowed' : 'pointer',
          }}>
          {isPending ? '검색 중...' : '검색'}
        </button>

        <span className="text-xs ml-auto" style={{ color: '#4A6080' }}>
          총 {totalCount.toLocaleString()}건
        </span>
      </div>

      {/* 로그 테이블 */}
      <div className="glass-card overflow-hidden">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1A3050' }}>
                {['시각', '사용자', '액션', '리소스', 'IP', 'VPN', '메타'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#4A6080', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: '#4A6080' }}>
                    로그가 없습니다
                  </td>
                </tr>
              ) : logs.map(log => {
                const actionInfo = ACTION_LABELS[log.action] ?? { label: log.action, color: '#8899BB' }
                return (
                  <tr key={log.id} style={{ borderBottom: '1px solid rgba(26,48,80,0.5)' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(30,144,255,0.03)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '10px 14px', color: '#4A6080', whiteSpace: 'nowrap' }}>
                      {new Date(log.created_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ color: '#E8F0FE' }}>{log.user_email?.split('@')[0] ?? '—'}</div>
                      <div style={{ color: '#4A6080', fontSize: '11px' }}>{log.user_role}</div>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ background: `${actionInfo.color}1A`, color: actionInfo.color, fontWeight: 600 }}>
                        {actionInfo.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ color: '#8899BB' }}>{log.resource_type}</div>
                      {log.resource_id && (
                        <div style={{ color: '#4A6080', fontSize: '11px', fontFamily: 'monospace' }}>
                          {log.resource_id.slice(0, 8)}…
                        </div>
                      )}
                      {log.export_row_count != null && (
                        <div style={{ color: '#FF9900', fontSize: '11px' }}>
                          {log.export_row_count}행
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#4A6080', fontSize: '11px', fontFamily: 'monospace' }}>
                      {log.ip_address ?? '—'}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      {log.is_vpn_access ? (
                        <span style={{ color: '#00CC66', fontSize: '11px' }}>✅ VPN</span>
                      ) : (
                        <span style={{ color: '#4A6080', fontSize: '11px' }}>외부</span>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', maxWidth: '200px' }}>
                      {Object.keys(log.metadata ?? {}).length > 0 && (
                        <details>
                          <summary style={{ color: '#4A6080', fontSize: '11px', cursor: 'pointer' }}>보기</summary>
                          <pre style={{ color: '#8899BB', fontSize: '10px', marginTop: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
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

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          {currentPage > 1 && (
            <Link href={buildPageUrl(currentPage - 1)}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{ background: '#0F2040', color: '#8899BB', border: '1px solid #1A3050', textDecoration: 'none' }}>
              ← 이전
            </Link>
          )}
          <span className="text-sm" style={{ color: '#4A6080' }}>
            {currentPage} / {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link href={buildPageUrl(currentPage + 1)}
              className="px-3 py-1.5 rounded-lg text-sm"
              style={{ background: '#0F2040', color: '#8899BB', border: '1px solid #1A3050', textDecoration: 'none' }}>
              다음 →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
