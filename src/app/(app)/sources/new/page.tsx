import { createClient } from '@/lib/supabase/server'
import SourceForm from '@/components/sources/SourceForm'

export default async function NewSourcePage({
  searchParams,
}: {
  searchParams: Promise<{ from_help?: string }>
}) {
  const params = await searchParams
  const supabase = await createClient()
  const supabaseAny = supabase as any

  let initialData: Record<string, unknown> = {}
  let helpContext: { title: string; body: string | null; target_name: string | null; target_org: string | null; acceptedBody: string | null } | null = null

  if (params.from_help) {
    const { data: helpReq } = await supabaseAny
      .from('help_requests')
      .select(`
        title, body, target_name, target_org,
        help_responses!request_id(body, is_accepted)
      `)
      .eq('id', params.from_help)
      .single()

    if (helpReq) {
      const acceptedResp = (helpReq.help_responses as any[])?.find((r: any) => r.is_accepted)
      helpContext = {
        title: helpReq.title,
        body: helpReq.body,
        target_name: helpReq.target_name,
        target_org: helpReq.target_org,
        acceptedBody: acceptedResp?.body ?? null,
      }

      // 가능한 필드 자동 매핑
      if (helpReq.target_name) initialData.full_name = helpReq.target_name
      if (helpReq.target_org) initialData.current_organization = helpReq.target_org
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#E8F0FE' }}>새 취재원 등록</h1>
        <p className="text-sm mt-1" style={{ color: '#8899BB' }}>
          항목을 많이 채울수록 더 많은 포인트를 획득할 수 있습니다
        </p>
      </div>

      {helpContext && (
        <div className="glass-card p-4" style={{ border: '1px solid rgba(0,204,102,0.2)', background: 'rgba(0,204,102,0.03)' }}>
          <p className="text-xs font-semibold mb-2" style={{ color: '#00CC66' }}>📋 도움 게시판에서 가져온 정보</p>
          <p className="text-sm font-medium mb-1" style={{ color: '#E8F0FE' }}>{helpContext.title}</p>
          {helpContext.target_name && (
            <p className="text-xs" style={{ color: '#8899BB' }}>대상: {helpContext.target_name} {helpContext.target_org && `(${helpContext.target_org})`}</p>
          )}
          {helpContext.acceptedBody && (
            <details className="mt-2">
              <summary className="text-xs cursor-pointer" style={{ color: '#4A6080' }}>채택된 응답 보기</summary>
              <p className="text-xs mt-1 whitespace-pre-wrap leading-relaxed" style={{ color: '#8899BB' }}>{helpContext.acceptedBody}</p>
            </details>
          )}
          <p className="text-xs mt-2" style={{ color: '#4A6080' }}>아래 양식에 정보를 입력한 후 저장하세요</p>
        </div>
      )}

      <SourceForm mode="create" initialData={initialData as any} />
    </div>
  )
}
