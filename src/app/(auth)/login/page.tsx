'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { loginAction } from '@/app/actions/auth'

type Tab = 'login' | 'signup'

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>('login')
  const [idleMessage, setIdleMessage] = useState(false)

  useEffect(() => {
    // window.location은 클라이언트에서만 접근 가능하므로 useEffect 내에서 처리
    const params = new URLSearchParams(window.location.search)
    if (params.get('reason') === 'idle') setIdleMessage(true)
  }, [])

  // 로그인 상태
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  // 회원가입 상태
  const [signupName, setSignupName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupPassword2, setSignupPassword2] = useState('')
  const [signupError, setSignupError] = useState('')
  const [signupLoading, setSignupLoading] = useState(false)
  const [signupDone, setSignupDone] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError('')

    // ── ① 잠금 여부 선확인 ───────────────────────────────────────────────────
    try {
      const lockRes = await fetch(
        `/api/auth/check-lockout?email=${encodeURIComponent(loginEmail)}`,
        { credentials: 'same-origin' }
      )
      const lockData = await lockRes.json()
      if (lockData.locked) {
        const until = lockData.until
          ? new Date(lockData.until).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
          : ''
        setLoginError(`로그인 시도가 너무 많습니다.\n${until ? until + ' 이후에 다시 시도하세요.' : '잠시 후 다시 시도하세요.'}`)
        setLoginLoading(false)
        return
      }
    } catch {
      // 잠금 체크 실패는 무시하고 계속
    }

    // ── ② 서버 액션으로 로그인 ───────────────────────────────────────────────
    // loginAction: 서버에서 signInWithPassword → Set-Cookie 헤더로 세션 저장 → redirect('/dashboard')
    // 브라우저 클라이언트(document.cookie) 방식의 타이밍 경쟁 및 Uncaught Promise 에러 원천 제거
    const result = await loginAction(loginEmail, loginPassword)

    // result가 있으면 에러 (성공 시 서버에서 redirect하므로 여기 도달하지 않음)
    if (result?.error) {
      setLoginError(result.error)
      setLoginLoading(false)
    }
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setSignupError('')

    if (signupPassword !== signupPassword2) {
      setSignupError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (signupPassword.length < 8) {
      setSignupError('비밀번호는 8자 이상이어야 합니다.')
      return
    }

    setSignupLoading(true)

    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: signupEmail,
        password: signupPassword,
        full_name: signupName,
      }),
    })

    let data: { error?: string; success?: boolean } = {}
    try {
      data = await res.json()
    } catch {
      setSignupError('서버 응답을 읽을 수 없습니다. 잠시 후 다시 시도해주세요.')
      setSignupLoading(false)
      return
    }
    if (!res.ok) {
      setSignupError(data.error ?? '회원가입 중 오류가 발생했습니다.')
      setSignupLoading(false)
      return
    }

    setSignupDone(true)
    setSignupLoading(false)
  }

  const inputStyle: React.CSSProperties = {
    background: '#0D1F3C',
    border: '1px solid #1A2838',
    color: '#CDD5E0',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '14px',
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.2s',
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background: 'linear-gradient(160deg, #060E1E 0%, #0D1520 50%, #0A1828 100%)',
      }}
    >
      {/* ── 내부 컨테이너 (max-width로 좌우 집중) ── */}
      <div
        className="flex w-full min-h-screen md:min-h-0 md:rounded-2xl overflow-hidden"
        style={{
          maxWidth: '1100px',
          width: '100%',
          minHeight: '600px',
          boxShadow: '0 0 80px rgba(0,0,0,0.6)',
        }}
      >
      {/* ── 왼쪽 패널 — 히어로 콘텐츠 ── */}
      <div
        className="hidden md:flex flex-col justify-between relative overflow-hidden"
        style={{ flex: 1, padding: '48px 56px', background: 'linear-gradient(160deg, #060E1E 0%, #0D1520 50%, #0A1828 100%)' }}
      >
        {/* 배경 글로우 */}
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            top: '10%', left: '20%',
            width: '50vw', height: '50vw',
            background: 'radial-gradient(circle, rgba(30,144,255,0.06) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            bottom: '15%', right: '30%',
            width: '30vw', height: '30vw',
            background: 'radial-gradient(circle, rgba(0,212,255,0.04) 0%, transparent 70%)',
          }}
        />

        {/* 1. 로고 영역 */}
        <div className="flex items-center gap-4 relative z-10">
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '14px',
              background: 'rgba(30,144,255,0.15)',
              border: '1px solid rgba(30,144,255,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Image
              src="/segye-logo.png"
              alt="세계일보 로고"
              width={40}
              height={40}
              style={{ filter: 'brightness(0) invert(1)', opacity: 0.92, objectFit: 'contain' }}
            />
          </div>
          <div>
            <div
              style={{
                fontSize: '18px',
                fontWeight: 700,
                letterSpacing: '3px',
                color: '#4A9EFF',
              }}
            >
              THE SEGYE TIMES
            </div>
            <div
              style={{
                fontSize: '13px',
                letterSpacing: '0.4px',
                color: 'rgba(180,200,230,0.55)',
                marginTop: '4px',
              }}
            >
              가장 먼저, 그리고 끝까지&nbsp;&nbsp;·&nbsp;&nbsp;First to report, Last to cover
            </div>
          </div>
        </div>

        {/* 2. 메인 헤딩 */}
        <div className="relative z-10" style={{ marginTop: 'auto', marginBottom: 'auto' }}>
          <h1 style={{ fontSize: '72px', fontWeight: 700, lineHeight: 1.15, marginBottom: '28px' }}>
            <span
              style={{
                background: 'linear-gradient(135deg, #4A9EFF, #00D4FF)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              AI 취재원
            </span>
            <br />
            <span style={{ color: '#FFFFFF' }}>관리 시스템</span>
          </h1>
          <p
            style={{
              fontSize: '16px',
              color: 'rgba(180,200,230,0.7)',
              lineHeight: 1.75,
              maxWidth: '420px',
            }}
          >
            기자들이 보유한 취재원 정보를 안전하게 관리하고,{'\n'}
            조직 전체의 인적 네트워크를 체계화하는 스마트 플랫폼
          </p>
        </div>

        {/* 3. 기능 카드 3개 */}
        <div className="flex gap-2 relative z-10">
          {/* 카드 1: 취재원 및 정보 공유 */}
          <div
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              padding: '10px 12px',
              transition: 'background 0.2s',
              cursor: 'default',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                background: 'rgba(30,144,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                marginBottom: '7px',
              }}
            >
              👤
            </div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#CDD5E0', margin: '0 0 3px' }}>취재원 및 정보 공유</p>
            <p style={{ fontSize: '10px', color: '#6A8AAA', margin: 0 }}>등록·검색·이력</p>
          </div>

          {/* 카드 2: 정보보고 관리 (active) */}
          <div
            style={{
              flex: 1,
              background: 'rgba(30,144,255,0.08)',
              border: '1px solid rgba(30,144,255,0.4)',
              borderRadius: '10px',
              padding: '10px 12px',
              transition: 'background 0.2s',
              cursor: 'default',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(30,144,255,0.13)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(30,144,255,0.08)')}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                background: 'rgba(30,144,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                marginBottom: '7px',
              }}
            >
              📋
            </div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#CDD5E0', margin: '0 0 3px' }}>정보보고 관리</p>
            <p style={{ fontSize: '10px', color: '#6A8AAA', margin: 0 }}>작성·공유·보안</p>
          </div>

          {/* 카드 3: 관계망 시각화 */}
          <div
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '10px',
              padding: '10px 12px',
              transition: 'background 0.2s',
              cursor: 'default',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
          >
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                background: 'rgba(30,144,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                marginBottom: '7px',
              }}
            >
              🕸️
            </div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#CDD5E0', margin: '0 0 3px' }}>관계망 시각화</p>
            <p style={{ fontSize: '10px', color: '#6A8AAA', margin: 0 }}>자동 인맥 분석</p>
          </div>
        </div>
      </div>

      {/* ── 오른쪽 패널 (고정 360px) — 폼 영역 ── */}
      <div
        className="w-full flex flex-col justify-center"
        style={{
          width: '360px',
          minWidth: '320px',
          flexShrink: 0,
          background: 'rgba(6,14,30,0.95)',
          borderLeft: '1px solid rgba(30,80,160,0.2)',
          padding: '48px 32px',
        }}
      >
        {/* 브랜드 헤더 */}
        <div className="mb-8">
          <p style={{ fontSize: '16px', fontWeight: 700, color: '#CDD5E0', margin: 0 }}>
            세계일보{' '}
            <span style={{ fontSize: '12px', fontWeight: 400, color: '#5A7099' }}>
              취재원 및 정보 공유 시스템
            </span>
          </p>
        </div>

        {/* 자동 로그아웃 알림 */}
        {idleMessage && (
          <div style={{
            marginBottom: '20px', padding: '12px 16px', borderRadius: '10px',
            background: 'rgba(255,153,0,0.08)', border: '1px solid rgba(255,153,0,0.25)',
            display: 'flex', alignItems: 'center', gap: '10px',
          }}>
            <span style={{ fontSize: '18px' }}>⏰</span>
            <p style={{ fontSize: '13px', color: '#A87228', margin: 0, lineHeight: 1.5 }}>
              장시간 활동이 없어 자동 로그아웃되었습니다.<br />
              <span style={{ color: '#8AAAC8' }}>다시 로그인하면 계속 사용할 수 있습니다.</span>
            </p>
          </div>
        )}

        {/* 탭 */}
        <div
          className="flex"
          style={{ borderBottom: '1px solid rgba(30,80,160,0.3)', marginBottom: '0' }}
        >
          {(['login', 'signup'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              type="button"
              style={{
                flex: 1,
                padding: '14px',
                fontSize: '14px',
                fontWeight: tab === t ? 600 : 400,
                color: tab === t ? '#4A7CC0' : '#607898',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                borderBottom: tab === t ? '2px solid #4A7CC0' : '2px solid transparent',
                transition: 'all 0.2s',
                marginBottom: '-1px',
              }}
            >
              {t === 'login' ? '로그인' : '회원가입'}
            </button>
          ))}
        </div>

        {/* 폼 영역 */}
        <div style={{ paddingTop: '32px' }}>
          {/* ───── 로그인 탭 ───── */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#8AAAC8' }}>
                  이메일
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={e => setLoginEmail(e.target.value)}
                  placeholder="name@segye.com"
                  required
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#4A7CC0')}
                  onBlur={e => (e.target.style.borderColor = '#1A2838')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#8AAAC8' }}>
                  비밀번호
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="비밀번호 입력"
                  required
                  style={inputStyle}
                  onFocus={e => (e.target.style.borderColor = '#4A7CC0')}
                  onBlur={e => (e.target.style.borderColor = '#1A2838')}
                />
              </div>

              {loginError && (
                <div
                  className="rounded-lg p-3 text-sm"
                  style={{
                    background: loginError.includes('승인 대기')
                      ? 'rgba(255,153,0,0.1)'
                      : 'rgba(255,68,68,0.1)',
                    color: loginError.includes('승인 대기') ? '#A87228' : '#BC5050',
                    border: `1px solid ${loginError.includes('승인 대기') ? 'rgba(255,153,0,0.25)' : 'rgba(255,68,68,0.2)'}`,
                    whiteSpace: 'pre-line',
                    lineHeight: '1.6',
                  }}
                >
                  {loginError.includes('승인 대기') && <span style={{ marginRight: '6px' }}>⏳</span>}
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                disabled={loginLoading}
                style={{
                  width: '100%',
                  padding: '11px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '14px',
                  border: 'none',
                  cursor: loginLoading ? 'not-allowed' : 'pointer',
                  background: loginLoading
                    ? 'rgba(30,144,255,0.35)'
                    : 'linear-gradient(135deg, #4A7CC0 0%, #0055CC 100%)',
                  color: 'white',
                  transition: 'opacity 0.2s',
                  boxShadow: loginLoading ? 'none' : '0 4px 16px rgba(30,144,255,0.3)',
                }}
              >
                {loginLoading ? '로그인 중...' : '로그인'}
              </button>

              <p className="text-center text-xs pt-2" style={{ color: '#384860' }}>
                계정 문의:{' '}
                <span style={{ color: '#4A7CC0' }}>관리자에게 연락하세요</span>
              </p>
            </form>
          )}

          {/* ───── 회원가입 탭 ───── */}
          {tab === 'signup' && (
            <>
              {signupDone ? (
                <div className="text-center py-6 space-y-4">
                  <div
                    className="mx-auto w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(0,204,102,0.15)', border: '1px solid rgba(0,204,102,0.3)' }}
                  >
                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                      <path d="M6 14l5 5 11-11" stroke="#3D9E6A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: '#CDD5E0' }}>가입 신청 완료!</p>
                    <p className="text-sm mt-2" style={{ color: '#8AAAC8' }}>
                      관리자 승인 후 이메일로 안내가 발송됩니다.
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#607898' }}>
                      승인까지 최대 1영업일이 소요될 수 있습니다.
                    </p>
                  </div>
                  <button
                    onClick={() => { setSignupDone(false); setTab('login') }}
                    style={{
                      marginTop: '8px',
                      padding: '9px 24px',
                      borderRadius: '8px',
                      fontSize: '14px',
                      border: '1px solid #1A2838',
                      background: 'none',
                      color: '#4A7CC0',
                      cursor: 'pointer',
                    }}
                  >
                    로그인 화면으로
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSignup} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#8AAAC8' }}>
                      이름
                    </label>
                    <input
                      type="text"
                      value={signupName}
                      onChange={e => setSignupName(e.target.value)}
                      placeholder="홍길동"
                      required
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = '#4A7CC0')}
                      onBlur={e => (e.target.style.borderColor = '#1A2838')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#8AAAC8' }}>
                      이메일
                    </label>
                    <input
                      type="email"
                      value={signupEmail}
                      onChange={e => setSignupEmail(e.target.value)}
                      placeholder="name@segye.com"
                      required
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = '#4A7CC0')}
                      onBlur={e => (e.target.style.borderColor = '#1A2838')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#8AAAC8' }}>
                      비밀번호 <span style={{ color: '#384860', fontWeight: 400 }}>(8자 이상)</span>
                    </label>
                    <input
                      type="password"
                      value={signupPassword}
                      onChange={e => setSignupPassword(e.target.value)}
                      placeholder="비밀번호 설정"
                      required
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = '#4A7CC0')}
                      onBlur={e => (e.target.style.borderColor = '#1A2838')}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: '#8AAAC8' }}>
                      비밀번호 확인
                    </label>
                    <input
                      type="password"
                      value={signupPassword2}
                      onChange={e => setSignupPassword2(e.target.value)}
                      placeholder="비밀번호 재입력"
                      required
                      style={inputStyle}
                      onFocus={e => (e.target.style.borderColor = '#4A7CC0')}
                      onBlur={e => (e.target.style.borderColor = '#1A2838')}
                    />
                  </div>

                  {signupError && (
                    <div
                      className="rounded-lg p-3 text-sm"
                      style={{
                        background: 'rgba(255,68,68,0.1)',
                        color: '#BC5050',
                        border: '1px solid rgba(255,68,68,0.2)',
                      }}
                    >
                      {signupError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={signupLoading}
                    style={{
                      width: '100%',
                      padding: '11px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '14px',
                      border: 'none',
                      cursor: signupLoading ? 'not-allowed' : 'pointer',
                      background: signupLoading
                        ? 'rgba(0,204,102,0.3)'
                        : 'linear-gradient(135deg, #00AA55 0%, #008844 100%)',
                      color: 'white',
                      boxShadow: signupLoading ? 'none' : '0 4px 16px rgba(0,170,85,0.25)',
                    }}
                  >
                    {signupLoading ? '처리 중...' : '가입 신청'}
                  </button>

                  <p className="text-center text-xs pt-1" style={{ color: '#384860' }}>
                    가입 후 관리자 승인이 완료되어야 로그인 가능합니다
                  </p>
                </form>
              )}
            </>
          )}
        </div>

        {/* 하단 안내 */}
        <p className="text-center text-xs mt-auto pt-10" style={{ color: '#2A3A50' }}>
          본 시스템은 사내 VPN 환경에서만 이용 가능합니다
        </p>
      </div>
      </div>
    </div>
  )
}
