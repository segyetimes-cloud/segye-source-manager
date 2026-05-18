import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import SourceForm from '@/components/sources/SourceForm'

interface Params {
  params: Promise<{ id: string }>
}

export default async function EditSourcePage({ params }: Params) {
  const { id } = await params
  const supabase = await createClient()
  const supabaseAny = supabase as any

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: sourceRaw } = await supabaseAny
    .from('sources')
    .select('*')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()

  if (!sourceRaw) notFound()
  const source = sourceRaw as any

  // 소유자 또는 admin만 수정 가능
  if (source.owner_id !== user.id) {
    const { data: profileRaw } = await supabaseAny
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const profile = profileRaw as { role: string } | null
    if (!['admin', 'superadmin'].includes(profile?.role ?? '')) {
      redirect(`/sources/${id}?error=forbidden`)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#E8F0FE' }}>취재원 수정</h1>
        <p className="text-sm mt-1" style={{ color: '#8899BB' }}>
          <span style={{ color: '#1E90FF', fontWeight: 600 }}>{source.full_name}</span> 정보를 수정합니다
        </p>
      </div>
      <SourceForm mode="edit" initialData={source} />
    </div>
  )
}
