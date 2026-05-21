import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SidebarLayout from '@/components/layout/SidebarLayout'
import Watermark from '@/components/layout/Watermark'
import ScreenshotGuard from '@/components/common/ScreenshotGuard'
import IdleLogout from '@/components/common/IdleLogout'
import DeviceGuard from '@/components/common/DeviceGuard'
import CopyGuard from '@/components/common/CopyGuard'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // ── ① proxy가 getUser()로 검증한 userId/email을 헤더에서 읽는다 (네트워크 없음)
  const reqHeaders = await headers()
  const userId    = reqHeaders.get('x-user-id')
  const userEmail = reqHeaders.get('x-user-email') ?? ''

  console.log('[LAYOUT] proxy header →', { userId, userEmail })

  if (!userId) {
    // proxy를 거치지 않은 직접 접근 — 로그인으로
    redirect('/login')
  }

  // ── ② 세션에서 user 객체 읽기 (쿠키 읽기, 네트워크 없음)
  //     getUser() 대신 getSession() 사용 → Supabase API 호출 없음
  //     proxy가 이미 유효성 검사를 완료했으므로 안전
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const user = session?.user ?? null

  console.log('[LAYOUT] session →', { hasSession: !!session, hasUser: !!user, uid: user?.id })

  if (!user) {
    // 세션 쿠키가 없는 edge case (거의 발생 안 함)
    redirect('/login')
  }

  // ── ③ 프로필 조회 (proxy 헤더의 userId 기준)
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  const profile = profileData as import('@/types/database').Profile | null

  console.log('[PROFILE]', { found: !!profile, active: profile?.is_active })

  if (!profile || !profile.is_active) {
    await supabase.auth.signOut()
    redirect('/login?error=inactive')
  }

  return (
    <ScreenshotGuard>
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

      {/* 유휴 세션 자동 로그아웃 (15분 무활동 시 경고 → 2분 후 자동 로그아웃) */}
      <IdleLogout />

      {/* 새 기기 접속 알림 (기기 지문 감지) */}
      <DeviceGuard />

      {/* 클립보드 복사 워터마크 (텍스트 유출 추적) */}
      <CopyGuard userId={user.id} userEmail={user.email ?? ''} userFullName={profile.full_name ?? ''} />
    </ScreenshotGuard>
  )
}
