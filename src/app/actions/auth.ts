'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

/**
 * 서버 액션으로 로그인 처리
 *
 * 서버에서 signInWithPassword → Set-Cookie 헤더로 세션 쿠키 응답에 포함 → redirect('/dashboard')
 * 브라우저 클라이언트(document.cookie) 방식의 타이밍 경쟁 및 Uncaught Promise 에러 원천 제거
 * 성공 시 이 함수는 redirect()를 던지므로 클라이언트에 return값이 전달되지 않음
 */
export async function loginAction(
  email: string,
  password: string
): Promise<{ error: string } | never> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    const msg = error.message.toLowerCase()
    return {
      error:
        msg.includes('invalid login credentials') || msg.includes('invalid credentials')
          ? '이메일 또는 비밀번호가 올바르지 않습니다.'
          : msg.includes('ban') || msg.includes('banned')
            ? '가입 신청이 관리자 승인 대기 중입니다.\n승인 완료 후 로그인할 수 있습니다.'
            : msg.includes('email not confirmed')
              ? '이메일 인증이 필요합니다. 이메일을 확인해주세요.'
              : `로그인 중 오류가 발생했습니다. (${error.message})`,
    }
  }

  // 성공 시 — Set-Cookie 헤더가 응답에 포함된 상태로 리다이렉트
  // 브라우저는 쿠키를 받은 후 /dashboard로 이동 → proxy가 유효한 세션 쿠키를 확인
  redirect('/dashboard')
}
