'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const SESSION_KEY = '_sgy_session'

export default function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(true)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const isNewLogin = params.get('_init') === '1'
    const hasSession = !!sessionStorage.getItem(SESSION_KEY)

    if (isNewLogin || hasSession) {
      sessionStorage.setItem(SESSION_KEY, 'active')
      if (isNewLogin) {
        const url = new URL(window.location.href)
        url.searchParams.delete('_init')
        window.history.replaceState({}, '', url.toString())
      }
      return
    }

    // 브라우저를 닫고 재접속한 경우 — sessionStorage 없음 → 강제 로그아웃
    setAuthorized(false)
    createClient().auth.signOut().finally(() => {
      router.replace('/login')
    })
  }, [router])

  if (!authorized) return null
  return <>{children}</>
}
