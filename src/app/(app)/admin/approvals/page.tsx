import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ApprovalsClient from '@/components/admin/ApprovalsClient'
import ReportApprovalsClient from '@/components/admin/ReportApprovalsClient'

// 승인 권한이 있는 역할
const APPROVER_ROLES = ['superadmin', 'publisher', 'editor', 'section_editor', 'admin'] as const
// 전 부서 승인 가능 역할 (나머지 admin 은 소속 부서만)
const CROSS_DEPT_ROLES = ['superadmin', 'publisher', 'editor', 'section_editor'] as const

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function AdminApprovalsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const supabaseAny = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileRaw } = await supabaseAny
    .from('profiles')
    .select('role, department')
    .eq('id', user.id)
    .single()

  const profile = profileRaw as { role: string; department: string | null } | null
  const myRole = profile?.role ?? ''
  const myDept = profile?.department ?? null

  if (!(APPROVER_ROLES as readonly string[]).includes(myRole)) {
    redirect('/dashboard')
  }

  const isCrossDept = (CROSS_DEPT_ROLES as readonly string[]).includes(myRole)

  // 현재 탭 (searchParams는 Promise)
  const sp = await searchParams
  const tab = sp.tab === 'reports' ? 'reports' : 'sources'

  // 부장(admin): 자기 부서 요청자 ID 먼저 수집
  let deptUserIds: string[] | null = null
  if (!isCrossDept && myDept) {
    const { data: deptUsers } = await supabaseAny
      .from('profiles')
      .select('id')
      .eq('department', myDept)
    deptUserIds = (deptUsers ?? []).map((u: any) => u.id as string)
  }

  // ── 취재원 열람 승인 데이터 ──────────────────────────────────────────────────
  let pendingQuery = supabaseAny
    .from('source_access_approvals')
    .select(`
      id, source_id, requester_id, reason, status, requested_at, decided_at, expires_at, reject_reason,
      sources!source_id(full_name, current_organization),
      profiles!requester_id(full_name, department, email)
    `)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })

  if (deptUserIds !== null) {
    if (deptUserIds.length === 0) {
      pendingQuery = pendingQuery.eq('requester_id', '00000000-0000-0000-0000-000000000000')
    } else {
      pendingQuery = pendingQuery.in('requester_id', deptUserIds)
    }
  }

  let recentQuery = supabaseAny
    .from('source_access_approvals')
    .select(`
      id, source_id, requester_id, reason, status, requested_at, decided_at, expires_at, reject_reason,
      sources!source_id(full_name, current_organization),
      profiles!requester_id(full_name, department, email)
    `)
    .in('status', ['approved', 'rejected'])
    .order('decided_at', { ascending: false })
    .limit(50)

  if (deptUserIds !== null) {
    if (deptUserIds.length === 0) {
      recentQuery = recentQuery.eq('requester_id', '00000000-0000-0000-0000-000000000000')
    } else {
      recentQuery = recentQuery.in('requester_id', deptUserIds)
    }
  }

  // ── 정보보고 검토 데이터 ──────────────────────────────────────────────────────
  let reportQuery = supabaseAny
    .from('information_reports')
    .select(`
      id, title, author_id, status, created_at, updated_at,
      profiles!author_id(full_name, department)
    `)
    .eq('status', 'submitted')
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })

  // 부장: 소속 부서 작성자 보고서만
  if (deptUserIds !== null) {
    if (deptUserIds.length === 0) {
      reportQuery = reportQuery.eq('author_id', '00000000-0000-0000-0000-000000000000')
    } else {
      reportQuery = reportQuery.in('author_id', deptUserIds)
    }
  }

  const [{ data: pendingRaw }, { data: recentRaw }, { data: submittedReportsRaw }] = await Promise.all([
    pendingQuery,
    recentQuery,
    reportQuery,
  ])

  const pending = (pendingRaw ?? []) as any[]
  const recent = (recentRaw ?? []) as any[]
  const submittedReports = (submittedReportsRaw ?? []) as any[]

  const roleLabel: Record<string, string> = {
    superadmin: '시스템 관리자',
    publisher: '편집인',
    editor: '국장',
    section_editor: '부국장',
    admin: `부장${myDept ? ` (${myDept})` : ''}`,
  }

  const tabBase: React.CSSProperties = {
    padding: '8px 18px',
    fontSize: '13px',
    fontWeight: 600,
    borderRadius: '7px 7px 0 0',
    border: '1px solid #1A2838',
    borderBottom: 'none',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
  }
  const tabActive: React.CSSProperties = {
    ...tabBase,
    background: 'rgba(15,32,64,0.9)',
    color: '#CDD5E0',
    borderColor: '#2A3848',
  }
  const tabInactive: React.CSSProperties = {
    ...tabBase,
    background: 'transparent',
    color: '#485870',
    borderColor: 'transparent',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#CDD5E0', marginBottom: '4px' }}>승인 관리</h1>
        <p style={{ fontSize: '13px', color: '#687898', marginBottom: '6px' }}>
          {isCrossDept
            ? '전 부서 승인 요청을 검토합니다'
            : `${myDept ?? '소속'} 승인 요청을 검토합니다`}
        </p>
        <span style={{
          display: 'inline-block',
          fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
          background: 'rgba(74,124,192,0.12)', color: '#4A7CC0',
        }}>
          {roleLabel[myRole] ?? myRole}
        </span>
      </div>

      {/* 탭 */}
      <div>
        <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #1A2838', marginBottom: '0' }}>
          <Link href="/admin/approvals?tab=sources" style={tab === 'sources' ? tabActive : tabInactive}>
            취재원 열람 승인
            {pending.length > 0 && (
              <span style={{
                marginLeft: '6px', fontSize: '10px', fontWeight: 700,
                background: '#A87228', color: 'white',
                borderRadius: '10px', padding: '1px 6px',
              }}>
                {pending.length}
              </span>
            )}
          </Link>
          <Link href="/admin/approvals?tab=reports" style={tab === 'reports' ? tabActive : tabInactive}>
            정보보고 검토
            {submittedReports.length > 0 && (
              <span style={{
                marginLeft: '6px', fontSize: '10px', fontWeight: 700,
                background: '#4A7CC0', color: 'white',
                borderRadius: '10px', padding: '1px 6px',
              }}>
                {submittedReports.length}
              </span>
            )}
          </Link>
        </div>

        <div style={{
          background: 'rgba(15,32,64,0.85)', border: '1px solid #2A3848',
          borderTop: 'none', borderRadius: '0 8px 8px 8px',
          padding: '20px',
        }}>
          {tab === 'sources' ? (
            <ApprovalsClient pending={pending} recent={recent} />
          ) : (
            <ReportApprovalsClient reports={submittedReports} />
          )}
        </div>
      </div>
    </div>
  )
}
