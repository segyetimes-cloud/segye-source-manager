'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

type Tab = 'login' | 'signup'

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('login')

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

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    })

    if (error) {
      const msg = error.message.toLowerCase()
      setLoginError(
        msg.includes('invalid login credentials') || msg.includes('invalid credentials')
          ? '이메일 또는 비밀번호가 올바르지 않습니다.'
          : msg.includes('ban') || msg.includes('banned')
            ? '가입 신청이 관리자 승인 대기 중입니다.\n승인 완료 후 로그인할 수 있습니다.'
            : msg.includes('email not confirmed')
              ? '이메일 인증이 필요합니다. 이메일을 확인해주세요.'
              : `로그인 중 오류가 발생했습니다. (${error.message})`
      )
      setLoginLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
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
    border: '1px solid #1A3050',
    color: '#E8F0FE',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '14px',
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.2s',
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        background: 'linear-gradient(160deg, #060E1E 0%, #0A1628 40%, #0D1F3C 100%)',
      }}
    >
      {/* 배경 글로우 */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute rounded-full"
          style={{
            top: '15%', left: '20%',
            width: '40vw', height: '40vw',
            background: 'radial-gradient(circle, rgba(30,144,255,0.07) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            bottom: '10%', right: '15%',
            width: '30vw', height: '30vw',
            background: 'radial-gradient(circle, rgba(0,212,255,0.05) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative w-full max-w-md">
        {/* ── 로고 영역 ── */}
        <div className="text-center mb-8">
          {/* 로고 이미지 — 흰색 처리 */}
          <div className="flex justify-center mb-4">
            <div
              style={{
                width: '90px',
                height: '90px',
                borderRadius: '22px',
                background: 'linear-gradient(145deg, rgba(30,144,255,0.15) 0%, rgba(0,212,255,0.08) 100%)',
                border: '1px solid rgba(30,144,255,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 8px 32px rgba(30,144,255,0.15)',
              }}
            >
              <Image
                src="/segye-logo.png"
                alt="세계일보 로고"
                width={60}
                height={60}
                style={{
                  filter: 'brightness(0) invert(1)',
                  opacity: 0.92,
                }}
              />
            </div>
          </div>

          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#E8F0FE' }}>
            세계일보
          </h1>
          <p className="text-sm mt-1" style={{ color: '#5A7099' }}>
            AI기반 취재원 관리시스템
          </p>
        </div>

        {/* ── 카드 ── */}
        <div
          style={{
            background: 'rgba(12, 28, 56, 0.85)',
            border: '1px solid rgba(30,80,160,0.35)',
            borderRadius: '16px',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          }}
        >
          {/* 탭 */}
          <div
            className="flex"
            style={{ borderBottom: '1px solid rgba(30,80,160,0.3)' }}
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
                  color: tab === t ? '#1E90FF' : '#4A6080',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  borderBottom: tab === t ? '2px solid #1E90FF' : '2px solid transparent',
                  transition: 'all 0.2s',
                  marginBottom: '-1px',
                }}
              >
                {t === 'login' ? '로그인' : '회원가입'}
              </button>
            ))}
          </div>

          <div className="p-8">
            {/* ───── 로그인 탭 ───── */}
            {tab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#8899BB' }}>
                    이메일
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="name@segye.com"
                    required
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = '#1E90FF')}
                    onBlur={e => (e.target.style.borderColor = '#1A3050')}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: '#8899BB' }}>
                    비밀번호
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                    placeholder="비밀번호 입력"
                    required
                    style={inputStyle}
                    onFocus={e => (e.target.style.borderColor = '#1E90FF')}
                    onBlur={e => (e.target.style.borderColor = '#1A3050')}
                  />
                </div>

                {loginError && (
                  <div
                    className="rounded-lg p-3 text-sm"
                    style={{
                      background: loginError.includes('승인 대기')
                        ? 'rgba(255,153,0,0.1)'
                        : 'rgba(255,68,68,0.1)',
                      color: loginError.includes('승인 대기') ? '#FF9900' : '#FF6666',
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
                      : 'linear-gradient(135deg, #1E90FF 0%, #0055CC 100%)',
                    color: 'white',
                    transition: 'opacity 0.2s',
                    boxShadow: loginLoading ? 'none' : '0 4px 16px rgba(30,144,255,0.3)',
                  }}
                >
                  {loginLoading ? '로그인 중...' : '로그인'}
                </button>

                <p className="text-center text-xs pt-2" style={{ color: '#3A5070' }}>
                  계정 문의:{' '}
                  <span style={{ color: '#1E90FF' }}>관리자에게 연락하세요</span>
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
                        <path d="M6 14l5 5 11-11" stroke="#00CC66" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold" style={{ color: '#E8F0FE' }}>가입 신청 완료!</p>
                      <p className="text-sm mt-2" style={{ color: '#8899BB' }}>
                        관리자 승인 후 이메일로 안내가 발송됩니다.
                      </p>
                      <p className="text-xs mt-1" style={{ color: '#4A6080' }}>
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
                        border: '1px solid #1A3050',
                        background: 'none',
                        color: '#1E90FF',
                        cursor: 'pointer',
                      }}
                    >
                      로그인 화면으로
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: '#8899BB' }}>
                        이름
                      </label>
                      <input
                        type="text"
                        value={signupName}
                        onChange={e => setSignupName(e.target.value)}
                        placeholder="홍길동"
                        required
                        style={inputStyle}
                        onFocus={e => (e.target.style.borderColor = '#1E90FF')}
                        onBlur={e => (e.target.style.borderColor = '#1A3050')}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: '#8899BB' }}>
                        이메일
                      </label>
                      <input
                        type="email"
                        value={signupEmail}
                        onChange={e => setSignupEmail(e.target.value)}
                        placeholder="name@segye.com"
                        required
                        style={inputStyle}
                        onFocus={e => (e.target.style.borderColor = '#1E90FF')}
                        onBlur={e => (e.target.style.borderColor = '#1A3050')}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: '#8899BB' }}>
                        비밀번호 <span style={{ color: '#3A5070', fontWeight: 400 }}>(8자 이상)</span>
                      </label>
                      <input
                        type="password"
                        value={signupPassword}
                        onChange={e => setSignupPassword(e.target.value)}
                        placeholder="비밀번호 설정"
                        required
                        style={inputStyle}
                        onFocus={e => (e.target.style.borderColor = '#1E90FF')}
                        onBlur={e => (e.target.style.borderColor = '#1A3050')}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2" style={{ color: '#8899BB' }}>
                        비밀번호 확인
                      </label>
                      <input
                        type="password"
                        value={signupPassword2}
                        onChange={e => setSignupPassword2(e.target.value)}
                        placeholder="비밀번호 재입력"
                        required
                        style={inputStyle}
                        onFocus={e => (e.target.style.borderColor = '#1E90FF')}
                        onBlur={e => (e.target.style.borderColor = '#1A3050')}
                      />
                    </div>

                    {signupError && (
                      <div
                        className="rounded-lg p-3 text-sm"
                        style={{
                          background: 'rgba(255,68,68,0.1)',
                          color: '#FF6666',
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

                    <p className="text-center text-xs pt-1" style={{ color: '#3A5070' }}>
                      가입 후 관리자 승인이 완료되어야 로그인 가능합니다
                    </p>
                  </form>
                )}
              </>
            )}
          </div>
        </div>

        <p className="text-center text-xs mt-5" style={{ color: '#2A3A50' }}>
          본 시스템은 사내 VPN 접속 환경에서만 이용 가능합니다
        </p>
      </div>
    </div>
  )
}
