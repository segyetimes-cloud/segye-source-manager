import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import UsersClient from '@/components/admin/UsersClient'

export default async function AdminUsersPage() {
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

  const isSuperadmin = profile?.role === 'superadmin'

  const { data: usersRaw } = await supabaseAny
    .from('profiles')
    .select(`
      id, email, full_name, role, department, desk_name,
      employee_id, phone, is_active, last_login_at, created_at
    `)
    .order('created_at', { ascending: false })

  const users = (usersRaw ?? []) as any[]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#E8F0FE' }}>계정 관리</h1>
        <p className="text-sm mt-1" style={{ color: '#8899BB' }}>
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
