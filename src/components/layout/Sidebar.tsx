'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/database'

const navItems = [
  {
    href: '/dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="1" y="1" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="10" y="1" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="1" y="10" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="10" y="10" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
    label: '대시보드',
  },
  {
    href: '/sources',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M2 16c0-3.314 3.134-6 7-6s7 2.686 7 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    label: '취재원 목록',
  },
  {
    href: '/reports',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect x="2" y="2" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M5 6h8M5 9h8M5 12h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      </svg>
    ),
    label: '정보보고',
  },
  {
    href: '/network',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <circle cx="9" cy="9" r="2" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="3" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="15" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="3" cy="15" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="15" cy="15" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M4.5 4.5L7.5 7.5M10.5 7.5L13.5 4.5M4.5 13.5L7.5 10.5M10.5 10.5L13.5 13.5"
          stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    ),
    label: '관계망 그래프',
  },
  {
    href: '/help',
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M2 3h14a1 1 0 011 1v8a1 1 0 01-1 1H6l-4 3V4a1 1 0 011-1z"
          stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
    label: '도움 요청',
  },
]

const adminNavItems = [
  { href: '/admin/approvals', label: '열람 승인 관리' },
  { href: '/admin/users', label: '계정 관리' },
  { href: '/admin/audit', label: '접근 로그' },
  { href: '/admin/help-rewards', label: '🏆 도움 보너스' },
  { href: '/admin/stats', label: '📊 실적 집계' },
]

interface SidebarProps {
  profile: Profile
  mobileOpen?: boolean
  onMobileClose?: () => void
}

export default function Sidebar({ profile, mobileOpen = false, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isActive = (href: string) => {
    if (href === '/sources' || href === '/reports') return pathname.startsWith(href)
    return pathname === href
  }

  const roleLabel = {
    superadmin: '최고관리자',
    admin: '데스크',
    deputy: '차장',
    reporter: '기자',
  }[profile.role]

  const roleClass = `role-${profile.role}`

  return (
    <aside
      className={`app-sidebar flex flex-col h-screen w-60 fixed left-0 top-0 z-40${mobileOpen ? ' sidebar-open' : ''}`}
      style={{ background: '#0D1520', borderRight: '1px solid #1A2838' }}>

      {/* 모바일 닫기 버튼 */}
      {onMobileClose && (
        <button
          className="sidebar-close-btn"
          onClick={onMobileClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#485870', fontSize: 22, lineHeight: 1, padding: 4 }}
          aria-label="메뉴 닫기">
          ×
        </button>
      )}

      {/* 로고 */}
      <div className="px-5 py-2.5" style={{ borderBottom: '1px solid #1A2838' }}>
        <div className="flex items-center gap-3">
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(145deg, rgba(30,144,255,0.18) 0%, rgba(0,212,255,0.08) 100%)',
              border: '1px solid rgba(30,144,255,0.22)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Image
              src="/segye-logo.png"
              alt="세계일보 로고"
              width={24}
              height={24}
              style={{
                filter: 'brightness(0) invert(1)',
                opacity: 0.9,
              }}
            />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight" style={{ color: '#CDD5E0' }}>세계일보</p>
            <p className="text-xs leading-tight" style={{ color: '#5A7099' }}>취재원 관리</p>
          </div>
        </div>
      </div>

      {/* 내 정보 */}
      <div className="px-3 py-2 mx-3 mt-2 rounded-lg"
        style={{ background: '#131C2C', border: '1px solid #1A2838' }}>
        <p className="text-sm font-semibold truncate" style={{ color: '#CDD5E0' }}>
          {profile.full_name || profile.email}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-xs px-2 py-0.5 rounded-full ${roleClass}`}>
            {roleLabel}
          </span>
          {profile.department && (
            <span className="text-xs truncate" style={{ color: '#485870' }}>
              {profile.department}
            </span>
          )}
        </div>
      </div>

      {/* 메인 네비게이션 */}
      <nav className="flex-1 px-3 mt-2 space-y-0.5 overflow-y-auto">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={{
              color: isActive(item.href) ? '#4A7CC0' : '#687898',
              background: isActive(item.href) ? 'rgba(30,144,255,0.1)' : 'transparent',
              border: isActive(item.href) ? '1px solid rgba(30,144,255,0.2)' : '1px solid transparent',
            }}>
            <span style={{ color: isActive(item.href) ? '#4A7CC0' : '#485870' }}>
              {item.icon}
            </span>
            {item.label}
          </Link>
        ))}

        {/* 어드민 메뉴 */}
        {(profile.role === 'admin' || profile.role === 'superadmin') && (
          <div className="mt-2 pt-2" style={{ borderTop: '1px solid #1A2838' }}>
            <p className="text-xs font-semibold px-3 mb-1" style={{ color: '#485870' }}>
              관리자 메뉴
            </p>
            {adminNavItems.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm transition-all"
                style={{
                  color: pathname === item.href ? '#7E6E48' : '#687898',
                  background: pathname === item.href ? 'rgba(255,215,0,0.08)' : 'transparent',
                }}>
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      {/* 하단: 로그아웃 */}
      <div className="px-3 py-2" style={{ borderTop: '1px solid #1A2838' }}>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-1.5 rounded-lg text-sm w-full transition-all"
          style={{ color: '#485870' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#C04040')}
          onMouseLeave={e => (e.currentTarget.style.color = '#485870')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 2H13a1 1 0 011 1v10a1 1 0 01-1 1H10M7 11l3-3-3-3M10 8H2"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          로그아웃
        </button>
      </div>
    </aside>
  )
}
