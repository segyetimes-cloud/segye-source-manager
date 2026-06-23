import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDesk } from '@/lib/roles'
import { extractAndStoreRelations } from '@/lib/extractReportRelations'

type Params = { params: Promise<{ id: string }> }

/**
 * GET /api/reports/[id]/extract-relations
 * DB에 저장된 추출 결과를 반환합니다 (없으면 빈 배열).
 */
export async function GET(
  _req: NextRequest,
  { params }: Params,
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 간단한 열람 권한 확인
  const { data: reportRaw } = await supabase
    .from('information_reports')
    .select('id, author_id, visibility')
    .eq('id', id).eq('is_deleted', false).single()
  if (!reportRaw) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profileRaw } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const isDeskUser = isDesk((profileRaw as any)?.role)
  const isAuthor   = (reportRaw as any).author_id === user.id
  const vis        = (reportRaw as any).visibility as string

  if (!isDeskUser && !isAuthor) {
    if (vis === 'author_only' || vis === 'desk_above') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const [entitiesRes, relationsRes] = await Promise.all([
    (supabase as any).from('report_extracted_entities')
      .select('name, role, mentions').eq('report_id', id).order('name'),
    (supabase as any).from('report_extracted_relations')
      .select('from_name, to_name, rel_type, detail').eq('report_id', id),
  ])

  const entities  = (entitiesRes.data  ?? []).map((e: any) => ({ name: e.name as string, role: e.role as string | null, mentions: e.mentions as string }))
  const relations = (relationsRes.data ?? []).map((r: any) => ({ from: r.from_name as string, to: r.to_name as string, type: r.rel_type as string, detail: r.detail as string | null }))

  // 취재원 DB 매칭
  const names: string[] = Array.from(new Set<string>(entities.map((e: { name: string }) => e.name)))
  let sourceMatches: { name: string; sourceId: string; organization: string | null; position: string | null }[] = []
  if (names.length > 0) {
    const orCond = names.map((n: string) => `full_name.ilike.%${n.replace(/[%_\\]/g, '\\$&')}%`).join(',')
    const { data: sources } = await supabase
      .from('sources').select('id, full_name, current_organization, current_position')
      .or(orCond).eq('is_deleted', false).limit(30)
    sourceMatches = (sources ?? []).map(s => ({
      name: s.full_name, sourceId: s.id,
      organization: s.current_organization, position: s.current_position,
    }))
  }

  return NextResponse.json({ entities, relations, sourceMatches })
}

/**
 * POST /api/reports/[id]/extract-relations
 * 수동 재추출 트리거 — AI 재분석 후 DB 갱신, 결과 반환.
 */
export async function POST(
  _req: NextRequest,
  { params }: Params,
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profileRaw } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const isDeskUser = isDesk((profileRaw as any)?.role)

  const { data: reportRaw } = await supabase
    .from('information_reports')
    .select('id, author_id, author_department, title, content, visibility, status')
    .eq('id', id).eq('is_deleted', false).single()
  if (!reportRaw) return NextResponse.json({ error: '보고서를 찾을 수 없습니다.' }, { status: 404 })

  const report = reportRaw as {
    id: string; author_id: string; author_department: string | null
    title: string; content: string;
    visibility: string; status: string
  }
  const isAuthor = report.author_id === user.id
  if (!isDeskUser && !isAuthor) {
    if (report.visibility === 'author_only' || report.visibility === 'desk_above') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  await extractAndStoreRelations(
    supabase, id, report.title, report.content,
  )

  // 갱신 후 GET과 동일 형식으로 반환
  const [entitiesRes, relationsRes] = await Promise.all([
    (supabase as any).from('report_extracted_entities')
      .select('name, role, mentions').eq('report_id', id).order('name'),
    (supabase as any).from('report_extracted_relations')
      .select('from_name, to_name, rel_type, detail').eq('report_id', id),
  ])

  const entities  = (entitiesRes.data  ?? []).map((e: any) => ({ name: e.name as string, role: e.role as string | null, mentions: e.mentions as string }))
  const relations = (relationsRes.data ?? []).map((r: any) => ({ from: r.from_name as string, to: r.to_name as string, type: r.rel_type as string, detail: r.detail as string | null }))

  const names: string[] = Array.from(new Set<string>(entities.map((e: { name: string }) => e.name)))
  let sourceMatches: { name: string; sourceId: string; organization: string | null; position: string | null }[] = []
  if (names.length > 0) {
    const orCond = names.map((n: string) => `full_name.ilike.%${n.replace(/[%_\\]/g, '\\$&')}%`).join(',')
    const { data: sources } = await supabase
      .from('sources').select('id, full_name, current_organization, current_position')
      .or(orCond).eq('is_deleted', false).limit(30)
    sourceMatches = (sources ?? []).map(s => ({
      name: s.full_name, sourceId: s.id,
      organization: s.current_organization, position: s.current_position,
    }))
  }

  return NextResponse.json({ entities, relations, sourceMatches })
}
