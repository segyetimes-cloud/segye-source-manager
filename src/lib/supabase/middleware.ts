import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            // 세션 쿠키로 강제: maxAge/expires 제거 → 브라우저 종료 시 자동 삭제
            // (영속 쿠키로 두면 브라우저 닫고 재접속해도 로그인이 유지되는 보안 취약점 발생)
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { maxAge: _m, expires: _e, ...sessionOpts } = options ?? {}
            supabaseResponse.cookies.set(name, value, sessionOpts)
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  return { supabaseResponse, user }
}
