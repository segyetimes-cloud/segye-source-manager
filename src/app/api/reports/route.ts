// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/reports — 목록 조회
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const supabaseAny = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sp = request.nextUrl.searchParams
  const visibilityFilter = sp.get('visibility_filter') ?? 'all' // 'all' | 'mine'
  const q = sp.get('q') ?? ''
  const page = parseInt(sp.get('page') ?? '1')
  const pageSize = 20

  let query = supabaseAny
    .from('information_reports')
    .select(`
      id, title, content, tags, visibility, author_id, created_at, updated_at,
      profiles!author_id(full_name, department),
      report_sources(source_id, sources!source_id(id, full_name, current_organization))
    `, { count: 'exact' })
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (visibilityFilter === 'mine') {
    query = query.eq('author_id', user.id)
  }

  if (q) {
    // 취재원 이름으로도 검색
    const { data: matchingSources } = await supabaseAny
      .from('sources')
      .select('id')
      .ilike('full_name', `%${q}%`)
      .eq('is_deleted', false)
      .limit(100)

    const matchingSourceIds = (matchingSources ?? []).map((s: any) => s.id as string)
    let matchingReportIds: string[] = []

    if (matchingSourceIds.length > 0) {
      const { data: links } = await supabaseAny
        .from('report_sources')
        .select('report_id')
        .in('source_id', matchingSourceIds)
      matchingReportIds = [...new Set<string>((links ?? []).map((l: any) => l.report_id as string))]
    }

    if (matchingReportIds.length > 0) {
      query = query.or(
        `title.ilike.%${q}%,content.ilike.%${q}%,id.in.(${matchingReportIds.join(',')})`
      )
    } else {
      query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%`)
    }
  }

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ reports: data ?? [], total: count ?? 0 })
}

// POST /api/reports — 보고서 생성
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const supabaseAny = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { title, content, tags, visibility, source_ids } = body

  if (!title?.trim()) return NextResponse.json({ error: '제목을 입력해 주세요.' }, { status: 400 })
  if (!content?.trim()) return NextResponse.json({ error: '본문을 입력해 주세요.' }, { status: 400 })

  const { data: report, error } = await supabaseAny
    .from('information_reports')
    .insert({
      author_id: user.id,
      title: title.trim(),
      content: content.trim(),
      tags: tags ?? [],
      visibility: visibility ?? 'author_only',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 연결 취재원 등록
  if (Array.isArray(source_ids) && source_ids.length > 0) {
    const rows = source_ids.map((sid: string) => ({ report_id: report.id, source_id: sid }))
    await supabaseAny.from('report_sources').insert(rows)
  }

  return NextResponse.json(report, { status: 201 })
}
