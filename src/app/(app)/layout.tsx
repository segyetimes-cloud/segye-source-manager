import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
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
    <div className="flex min-h-screen" style={{ background: '#0A1628' }}>
      {/* 사이드바 */}
      <Sidebar profile={profile} />

      {/* 메인 콘텐츠 */}
      <main className="flex-1 ml-60 min-h-screen" style={{ background: '#0A1628' }}>
        <div className="p-4">
          {children}
        </div>
      </main>

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
