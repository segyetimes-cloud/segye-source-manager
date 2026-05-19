import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SidebarLayout from '@/components/layout/SidebarLayout'
import Watermark from '@/components/layout/Watermark'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 프로필 조회
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = profileData as import('@/types/database').Profile | null

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut()
    redirect('/login?error=inactive')
  }

  return (
    <div className="min-h-screen" style={{ background: '#0D1520' }}>
      <SidebarLayout profile={profile}>
        {children}
      </SidebarLayout>

      {/* 워터마크 오버레이 (보안) */}
      <Watermark
        userId={user.id}
        userEmail={user.email ?? ''}
        userName={profile.full_name ?? ''}
        department={profile.department ?? ''}
      />
    </div>
  )
}
