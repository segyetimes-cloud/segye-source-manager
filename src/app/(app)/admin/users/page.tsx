import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UsersClient from '@/components/admin/UsersClient'
import { can, CAN_APPROVE_ACCESS } from '@/lib/permissions'
import { isCrossDept } from '@/lib/roles'
import type { Profile } from '@/types/database'

export default async function AdminUsersPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const profile = profileRaw as { role: string } | null
  if (!can(profile?.role, CAN_APPROVE_ACCESS)) {
    redirect('/dashboard')
  }

  // 슈퍼관리자·편집인·국장·부국장은 전체 역할 변경 권한
  const isSuperadmin = isCrossDept(profile?.role)

  const { data: usersRaw } = await supabase
    .from('profiles')
    .select(`
      id, email, full_name, role, rank, department, desk_name,
      employee_id, phone, is_active, last_login_at, created_at
    `)
    .order('created_at', { ascending: false })

  const users = (usersRaw ?? []) as Profile[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#CDD5E0' }}>계정 관리</h1>
        <p className="text-sm mt-1" style={{ color: '#687898' }}>
          기자 계정의 권한 및 활성 상태를 관리합니다
        </p>
      </div>
      <UsersClient
        users={users}
        currentUserId={user.id}
        isSuperadmin={isSuperadmin}
        isAdmin={profile?.role === 'admin' || isSuperadmin}
      />
    </div>
  )
}
