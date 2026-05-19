import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AuditClient from '@/components/admin/AuditClient'

interface SearchParams {
  action?: string
  user_email?: string
  page?: string
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const supabaseAny = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileRaw } = await supabaseAny
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const profile = profileRaw as { role: string } | null
  if (!['admin', 'superadmin'].includes(profile?.role ?? '')) {
    redirect('/dashboard')
  }

  const page = parseInt(params.page ?? '1')
  const pageSize = 50
  const action = params.action ?? ''
  const userEmail = params.user_email ?? ''

  let query = supabaseAny
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (action) query = query.eq('action', action)
  if (userEmail) query = query.ilike('user_email', `%${userEmail}%`)

  const { data: logsRaw, count } = await query

  const logs = (logsRaw ?? []) as any[]
  const totalPages = Math.ceil((count ?? 0) / pageSize)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#CDD5E0' }}>접근 로그</h1>
        <p className="text-sm mt-1" style={{ color: '#687898' }}>
          시스템 내 모든 주요 동작을 기록합니다 (조회/수정/내보내기)
        </p>
      </div>
      <AuditClient
        logs={logs}
        totalCount={count ?? 0}
        currentPage={page}
        totalPages={totalPages}
        currentAction={action}
        currentEmail={userEmail}
      />
    </div>
  )
}
