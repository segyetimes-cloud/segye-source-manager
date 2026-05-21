import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'
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
  // ── ① Supabase 세션에서 사용자 인증 (단일 getUser 호출) ──────────────────
  //     proxy.ts가 updateSession으로 토큰 갱신 + 쿠키 전파를 처리한 뒤
  //     여기서 갱신된 쿠키로 getUser를 호출 → race condition 없음
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // ── ② 프로필 조회 (동일 클라이언트, 추가 네트워크 없음) ──────────────────
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = profileData as Profile | null

  if (profileError || !profile || !profile.is_active) {
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
