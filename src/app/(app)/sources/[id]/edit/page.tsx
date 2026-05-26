import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { can, CAN_EDIT_ANY_SOURCE } from '@/lib/permissions'
import { decryptNullable } from '@/lib/crypto'
import SourceForm from '@/components/sources/SourceForm'
import type { Source } from '@/types/database'

interface Params {
  params: Promise<{ id: string }>
}

export default async function SourceEditPage({ params }: Params) {
  const { id } = await params
  const supabase = await createClient()

  // ── 인증 확인 ──────────────────────────────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // ── 사용자 프로필 ──────────────────────────────────────────────────────────
  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const profile = profileRaw as { role: string } | null
  const userRole = profile?.role ?? 'reporter'
  const isAdminFlag = can(userRole, CAN_EDIT_ANY_SOURCE)

  // ── 취재원 조회 ─────────────────────────────────────────────────────────────
  const { data: sourceRaw, error } = await supabase
    .from('sources')
    .select('*')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()

  if (error || !sourceRaw) notFound()

  const source = sourceRaw as Source

  // ── 수정 권한 확인: 소유자 또는 부장+ ─────────────────────────────────────
  if (source.owner_id !== user.id && !isAdminFlag) {
    notFound()
  }

  // ── 암호화 필드 복호화 (편집 폼에 원문 노출) ──────────────────────────────
  source.phone_primary   = decryptNullable(source.phone_primary)
  source.phone_secondary = decryptNullable(source.phone_secondary)
  source.personal_notes  = decryptNullable(source.personal_notes)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#DCE8F4' }}>
            취재원 수정
          </h1>
          <p className="text-sm mt-1" style={{ color: '#8AAAC8' }}>
            {source.full_name} 취재원 정보를 수정합니다
          </p>
        </div>
        <Link
          href={`/sources/${source.id}`}
          title="상세 페이지로 돌아가기"
          style={{
            width: '32px', height: '32px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
            color: '#94A3B8', fontSize: '16px', textDecoration: 'none',
            lineHeight: 1, flexShrink: 0,
          }}
        >
          ✕
        </Link>
      </div>

      <SourceForm mode="edit" initialData={source} />
    </div>
  )
}
