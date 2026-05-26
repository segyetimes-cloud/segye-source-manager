'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function OTPContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') || '/dashboard'

  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'phone' | 'verify'>('phone')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function sendOTP() {
    setLoading(true)
    setError('')
    const supabase = createClient()

    const formatted = phone.startsWith('+82')
      ? phone
      : '+82' + phone.replace(/^0/, '').replace(/-/g, '')

    const { error } = await supabase.auth.signInWithOtp({ phone: formatted })
    if (error) {
      setError('OTP 전송 실패: ' + error.message)
    } else {
      setStep('verify')
    }
    setLoading(false)
  }

  async function verifyOTP() {
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/otp-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, otp }),
        credentials: 'same-origin',  // 쿠키 수신을 위해 필요
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? '인증 실패: 코드를 다시 확인해주세요.')
      } else {
        // HttpOnly 쿠키는 서버에서 Set-Cookie 헤더로 자동 설정됨
        router.push(next)
      }
    } catch {
      setError('네트워크 오류가 발생했습니다. 다시 시도해주세요.')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(135deg, #0D1520 0%, #131C2C 100%)' }}>

      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-4"
            style={{ background: 'rgba(255, 153, 0, 0.15)', border: '1px solid rgba(255,153,0,0.3)' }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="6" y="3" width="16" height="22" rx="3" stroke="#A87228" strokeWidth="1.5"/>
              <circle cx="14" cy="19" r="1.5" fill="#A87228"/>
              <path d="M10 8h8M10 11h5" stroke="#A87228" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="text-xl font-bold" style={{ color: '#CDD5E0' }}>외부 접속 인증</h1>
          <p className="text-sm mt-1" style={{ color: '#8AAAC8' }}>
            사외 접속 시 휴대전화 인증이 필요합니다
          </p>
        </div>

        <div className="glass-card p-6">
          {step === 'phone' ? (
            <>
              <label className="block text-sm font-medium mb-2" style={{ color: '#8AAAC8' }}>
                휴대전화번호
              </label>
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="010-0000-0000"
                style={{
                  background: '#182035', border: '1px solid #1A2838',
                  color: '#CDD5E0', borderRadius: '8px',
                  padding: '10px 14px', fontSize: '14px', width: '100%',
                }}
              />
              {error && (
                <p className="mt-2 text-sm" style={{ color: '#C04040' }}>{error}</p>
              )}
              <button
                onClick={sendOTP}
                disabled={loading || !phone}
                className="w-full mt-4 py-3 rounded-lg font-semibold text-sm"
                style={{
                  background: 'linear-gradient(135deg, #A87228, #FF6600)',
                  color: 'white', border: 'none',
                  opacity: loading || !phone ? 0.5 : 1,
                  cursor: loading || !phone ? 'not-allowed' : 'pointer',
                }}>
                {loading ? '전송 중...' : '인증번호 전송'}
              </button>
            </>
          ) : (
            <>
              <p className="text-sm mb-4" style={{ color: '#8AAAC8' }}>
                <span style={{ color: '#CDD5E0' }}>{phone}</span>으로<br/>
                인증번호 6자리를 입력해주세요
              </p>
              <input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                style={{
                  background: '#182035', border: '1px solid #1A2838',
                  color: '#CDD5E0', borderRadius: '8px',
                  padding: '10px 14px', fontSize: '20px',
                  width: '100%', letterSpacing: '0.3em', textAlign: 'center',
                }}
              />
              {error && (
                <p className="mt-2 text-sm" style={{ color: '#C04040' }}>{error}</p>
              )}
              <button
                onClick={verifyOTP}
                disabled={loading || otp.length !== 6}
                className="w-full mt-4 py-3 rounded-lg font-semibold text-sm"
                style={{
                  background: 'linear-gradient(135deg, #4A7CC0, #0066CC)',
                  color: 'white', border: 'none',
                  opacity: loading || otp.length !== 6 ? 0.5 : 1,
                  cursor: loading || otp.length !== 6 ? 'not-allowed' : 'pointer',
                }}>
                {loading ? '확인 중...' : '인증 확인'}
              </button>
              <button
                onClick={() => { setStep('phone'); setOtp(''); setError('') }}
                className="w-full mt-2 py-2 text-sm"
                style={{ color: '#8AAAC8', background: 'none', border: 'none', cursor: 'pointer' }}>
                전화번호 다시 입력
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function OTPPage() {
  return (
    <Suspense>
      <OTPContent />
    </Suspense>
  )
}
