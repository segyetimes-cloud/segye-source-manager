import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UsersClient from '@/components/admin/UsersClient'

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
  const ADMIN_ROLES = ['admin', 'section_editor', 'editor', 'publisher', 'superadmin']
  if (!ADMIN_ROLES.includes(profile?.role ?? '')) {
    redirect('/dashboard')
  }

  // 슈퍼관리자·편집인·국장·부국장은 전체 역할 변경 권한
  const isSuperadmin = ['superadmin', 'publisher', 'editor', 'section_editor'].includes(profile?.role ?? '')

  const { data: usersRaw } = await supabase
    .from('profiles')
    .select(`
      id, email, full_name, role, rank, department, desk_name,
      employee_id, phone, is_active, last_login_at, created_at
    `)
    .order('created_at', { ascending: false })

  const users = (usersRaw ?? []) as any[]

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
