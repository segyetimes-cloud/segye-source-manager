import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AuditClient from '@/components/admin/AuditClient'
import { CAN_VIEW_AUDIT_LOGS, can } from '@/lib/permissions'

interface SearchParams {
  action?: string
  user_email?: string
  resource_type?: string
  resource_id?: string
  date_from?: string
  date_to?: string
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
  if (!can(profile?.role, CAN_VIEW_AUDIT_LOGS)) {
    redirect('/dashboard')
  }

  const page         = Math.max(1, parseInt(params.page ?? '1'))
  const pageSize     = 50
  const action       = params.action       ?? ''
  const userEmail    = params.user_email   ?? ''
  const resourceType = params.resource_type ?? ''
  const resourceId   = params.resource_id  ?? ''
  const dateFrom     = params.date_from    ?? ''
  const dateTo       = params.date_to      ?? ''

  let query = supabaseAny
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (action)       query = query.eq('action', action)
  if (userEmail)    query = query.ilike('user_email', `%${userEmail}%`)
  if (resourceType) query = query.eq('resource_type', resourceType)
  if (resourceId)   query = query.ilike('resource_id', `%${resourceId}%`)
  if (dateFrom)     query = query.gte('created_at', new Date(dateFrom).toISOString())
  if (dateTo) {
    const toDate = new Date(dateTo)
    toDate.setDate(toDate.getDate() + 1)
    query = query.lt('created_at', toDate.toISOString())
  }

  const { data: logsRaw, count } = await query

  const logs       = (logsRaw ?? []) as any[]
  const totalPages = Math.ceil((count ?? 0) / pageSize)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#CDD5E0' }}>접근 로그</h1>
        <p className="text-sm mt-1" style={{ color: '#687898' }}>
          시스템 내 모든 주요 동작을 기록합니다 · 최대 5,000건 Excel 내보내기 지원
        </p>
      </div>
      <AuditClient
        logs={logs}
        totalCount={count ?? 0}
        currentPage={page}
        totalPages={totalPages}
        currentAction={action}
        currentEmail={userEmail}
        currentResourceType={resourceType}
        currentResourceId={resourceId}
        currentDateFrom={dateFrom}
        currentDateTo={dateTo}
      />
    </div>
  )
}
