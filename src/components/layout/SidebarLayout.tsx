'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
import NotificationBell from './NotificationBell'
import type { Profile } from '@/types/database'

interface Props {
  profile: Profile
  children: React.ReactNode
}

export default function SidebarLayout({ profile, children }: Props) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // 라우트 이동 시 사이드바 자동 닫기
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // 사이드바 열릴 때 body 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>

      {/* ── 사이드바 ── */}
      <Sidebar
        profile={profile}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* ── 모바일 딤 오버레이 ── */}
      {mobileOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── 모바일 상단 바 ── */}
      <header className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(145deg, rgba(30,144,255,0.18), rgba(0,212,255,0.08))',
            border: '1px solid rgba(30,144,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Image src="/segye-logo.png" alt="세계일보" width={20} height={20}
              style={{ filter: 'brightness(0) invert(1)', opacity: 0.9 }} />
          </div>
          <div>
            <p style={{ color: '#CDD5E0', fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>세계일보</p>
            <p style={{ color: '#5A7099', fontSize: 11, lineHeight: 1 }}>취재원 관리</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* 알림 벨 */}
          <NotificationBell />
          {/* 햄버거 버튼 */}
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="메뉴 열기"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: 8, color: '#687898',
            }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </header>

      {/* ── 메인 콘텐츠 ── */}
      <main
        className="app-main"
        style={{ flex: 1, minHeight: '100vh', background: '#0D1520' }}>
        <div style={{ padding: '1rem' }}>
          {children}
        </div>
      </main>

    </div>
  )
}
