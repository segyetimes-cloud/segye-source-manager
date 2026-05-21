// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/profiles/search?q=이름&limit=15
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const q = url.searchParams.get('q') ?? ''
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '15'), 30)

  if (!q.trim()) return NextResponse.json({ users: [] })

  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, department, rank')
    .or(`full_name.ilike.*${q}*,department.ilike.*${q}*`)
    .eq('is_active', true)
    .neq('id', user.id)   // 자기 자신 제외
    .order('full_name', { ascending: true })
    .limit(limit)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data ?? [] })
}
