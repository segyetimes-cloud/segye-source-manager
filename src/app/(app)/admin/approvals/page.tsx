import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ApprovalsClient from '@/components/admin/ApprovalsClient'

// 승인 권한이 있는 역할
const APPROVER_ROLES = ['superadmin', 'publisher', 'editor', 'section_editor', 'admin'] as const
// 전 부서 승인 가능 역할 (나머지 admin 은 소속 부서만)
const CROSS_DEPT_ROLES = ['superadmin', 'publisher', 'editor', 'section_editor'] as const

export default async function AdminApprovalsPage() {
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

  // 부장(admin): 자기 부서 요청자 ID 먼저 수집
  let deptUserIds: string[] | null = null
  if (!isCrossDept && myDept) {
    const { data: deptUsers } = await supabaseAny
      .from('profiles')
      .select('id')
      .eq('department', myDept)
    deptUserIds = (deptUsers ?? []).map((u: any) => u.id as string)
  }

  // ── pending 쿼리 ────────────────────────────────────────────────────────────
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

  // ── recent 쿼리 ─────────────────────────────────────────────────────────────
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

  const { data: pendingRaw } = await pendingQuery
  const { data: recentRaw } = await recentQuery

  const pending = (pendingRaw ?? []) as any[]
  const recent = (recentRaw ?? []) as any[]

  const roleLabel: Record<string, string> = {
    superadmin: '시스템 관리자',
    publisher: '편집인',
    editor: '국장',
    section_editor: '부국장',
    admin: `부장${myDept ? ` (${myDept})` : ''}`,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#CDD5E0' }}>민감정보 열람 승인</h1>
        <p className="text-sm mt-1" style={{ color: '#687898' }}>
          {isCrossDept
            ? '전 부서 기자들의 민감정보 열람 요청을 검토하고 승인/거절합니다'
            : `${myDept ?? '소속'} 기자들의 민감정보 열람 요청을 검토하고 승인/거절합니다`}
        </p>
        <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded"
          style={{ background: 'rgba(74,124,192,0.12)', color: '#4A7CC0' }}>
          {roleLabel[myRole] ?? myRole}
        </span>
      </div>
      <ApprovalsClient pending={pending} recent={recent} />
    </div>
  )
}
