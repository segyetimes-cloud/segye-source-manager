import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDesk, isDeputyOrAbove as checkDeputyOrAbove } from '@/lib/roles'

// GET /api/sources/[id]/contact-logs
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const supabaseAny = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAny
    .from('profiles').select('role, department').eq('id', user.id).single()
  const role = profile?.role ?? ''
  const department = profile?.department ?? null

  const isSectionEditorOrAbove = ['section_editor', 'editor', 'publisher', 'superadmin'].includes(role)
  const isAdmin = role === 'admin'
  const isDeputy = role === 'deputy'

  let query = supabaseAny
    .from('contact_logs')
    .select('id, method, summary, result, contacted_at, next_followup_at, is_sensitive, user_id, profiles!user_id(full_name)')
    .eq('source_id', id)
    .order('contacted_at', { ascending: false })
    .limit(50)

  if (!isSectionEditorOrAbove) {
    if ((isAdmin || isDeputy) && department) {
      // 부장·차장: 같은 부서 구성원의 민감 연락 열람
      const { data: deptUsers } = await supabaseAny
        .from('profiles').select('id').eq('department', department)
      const deptIds: string[] = (deptUsers ?? []).map((u: any) => u.id as string)
      if (!deptIds.includes(user.id)) deptIds.push(user.id)
      query = query.or(`is_sensitive.eq.false,user_id.in.(${deptIds.join(',')})`)
    } else {
      // 기자: 자신이 작성한 민감 연락만
      query = query.or(`is_sensitive.eq.false,user_id.eq.${user.id}`)
    }
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ logs: data ?? [] })
}

// POST /api/sources/[id]/contact-logs
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const supabaseAny = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { method, summary, result, contacted_at, next_followup_at, is_sensitive } = body
  if (!summary?.trim()) return NextResponse.json({ error: '내용을 입력하세요.' }, { status: 400 })

  const VALID_METHODS = ['call', 'message', 'email', 'meet', 'other']

  const { data, error } = await supabaseAny
    .from('contact_logs')
    .insert({
      source_id: id,
      user_id: user.id,
      method: VALID_METHODS.includes(method) ? method : 'call',
      summary: summary.trim(),
      result: result?.trim() || null,
      contacted_at: contacted_at || new Date().toISOString(),
      next_followup_at: next_followup_at || null,
      is_sensitive: is_sensitive === true,
    })
    .select('id, method, summary, result, contacted_at, next_followup_at, is_sensitive, user_id, profiles!user_id(full_name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// DELETE /api/sources/[id]/contact-logs?log_id=UUID
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params
  const supabase = await createClient()
  const supabaseAny = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const logId = req.nextUrl.searchParams.get('log_id')
  if (!logId) return NextResponse.json({ error: 'log_id required' }, { status: 400 })

  const { error } = await supabaseAny
    .from('contact_logs')
    .delete()
    .eq('id', logId)
    .eq('user_id', user.id)   // 본인 기록만 삭제

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
