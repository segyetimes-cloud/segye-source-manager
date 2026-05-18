'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'
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
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <div className="flex min-h-screen">
      {/* ── 사이드바 ── */}
      <Sidebar
        profile={profile}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {/* ── 모바일 딤 오버레이 ── */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-30"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── 모바일 상단 바 ── */}
      <header
        className="md:hidden fixed top-0 left-0 right-0 z-20 flex items-center justify-between px-4"
        style={{ height: 56, background: '#0A1628', borderBottom: '1px solid #1A3050' }}>
        <div className="flex items-center gap-2">
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'linear-gradient(145deg, rgba(30,144,255,0.18), rgba(0,212,255,0.08))',
            border: '1px solid rgba(30,144,255,0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Image
              src="/segye-logo.png"
              alt="세계일보"
              width={20}
              height={20}
              style={{ filter: 'brightness(0) invert(1)', opacity: 0.9 }}
            />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight" style={{ color: '#E8F0FE' }}>세계일보</p>
            <p style={{ fontSize: 10, color: '#5A7099', lineHeight: 1 }}>취재원 관리</p>
          </div>
        </div>

        {/* 햄버거 버튼 */}
        <button
          onClick={() => setMobileOpen(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, color: '#8899BB' }}
          aria-label="메뉴 열기">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
        </button>
      </header>

      {/* ── 메인 콘텐츠 ── */}
      <main
        className="flex-1 md:ml-60 min-h-screen"
        style={{ background: '#0A1628' }}>
        {/* 모바일: 상단 바 높이(56px)만큼 padding-top */}
        <div className="p-4 pt-[72px] md:pt-4">
          {children}
        </div>
      </main>
    </div>
  )
}
