import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatsClient from '@/components/admin/StatsClient'

export default async function AdminStatsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileRaw } = await (supabase as any)
    .from('profiles').select('role').eq('id', user.id).single()
  const role = (profileRaw as any)?.role
  if (!['admin', 'superadmin'].includes(role)) redirect('/dashboard')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#CDD5E0' }}>📊 실적 집계</h1>
        <p className="text-sm mt-1" style={{ color: '#687898' }}>
          기간별 사용자 취재원 등록·수정·포인트 실적을 조회합니다
        </p>
      </div>
      <StatsClient />
    </div>
  )
}
