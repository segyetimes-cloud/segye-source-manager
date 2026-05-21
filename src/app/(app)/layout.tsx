import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/server'
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
  // ── ① proxy가 getUser()로 검증·주입한 userId를 헤더에서 읽는다 (네트워크 없음)
  //     proxy.ts가 x-user-id를 덮어쓰므로 클라이언트 스푸핑 불가
  const reqHeaders = await headers()
  const userId    = reqHeaders.get('x-user-id')
  const userEmail = reqHeaders.get('x-user-email') ?? ''

  console.log('[LAYOUT] proxy header →', { userId, userEmail })

  if (!userId) {
    // proxy를 거치지 않은 직접 접근 (비정상 경로)
    redirect('/login')
  }

  // ── ② 프로필 조회: 서비스 클라이언트로 RLS 없이 직접 조회
  //     createServiceClient()는 동기 함수 — await 불필요
  //     getSession() / getUser() 네트워크 호출 완전 제거
  //     세션 쿠키 상태와 무관하게 동작 → redirect race 구조적 불가
  const supabase = createServiceClient()
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  const profile = profileData as Profile | null

  console.log('[PROFILE]', { found: !!profile, active: profile?.is_active, err: profileError?.message })

  if (profileError || !profile || !profile.is_active) {
    // signOut 제거: 서버 컴포넌트에서는 쿠키 설정 불가 → 효과 없음
    redirect('/login?error=inactive')
  }

  // ③ user 객체: 헤더값 사용 (Watermark·CopyGuard용, 네트워크 없음)
  const user = { id: userId, email: userEmail }

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
