export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { can, CAN_VIEW_SENSITIVE_SOURCE } from '@/lib/permissions'
import AnalysisClient from '@/components/analysis/AnalysisClient'

interface SearchParams { id?: string }

/** "사법고시 17회" → "사법고시" / "세계일보 13기" → "세계일보" / "수능" → null */
function extractExamType(batch: string): string | null {
  const parts = batch.trim().split(/\s+/)
  if (parts.length < 2) return null
  return parts.slice(0, -1).join(' ')
}

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { id: selectedId } = await searchParams

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const userRole = (profileRaw as any)?.role ?? 'reporter'
  const canSeeSensitive = can(userRole, CAN_VIEW_SENSITIVE_SOURCE)

  // 검색용 경량 목록
  let listQuery = supabase
    .from('sources')
    .select('id, full_name, current_organization, current_position, owner_id')
    .eq('is_deleted', false)
    .order('full_name', { ascending: true })

  if (!canSeeSensitive) {
    listQuery = listQuery.or(`visibility.eq.shared,owner_id.eq.${user.id}`)
  }

  const { data: sourceList } = await listQuery
  const allSources = (sourceList ?? []) as {
    id: string; full_name: string
    current_organization: string | null; current_position: string | null; owner_id: string
  }[]

  let analysisData = null

  if (selectedId) {
    const [srcRes, relsRes] = await Promise.all([
      supabase
        .from('sources')
        .select(`
          id, full_name, current_organization, current_position,
          phone_primary, email_primary,
          university, university_major, university_year,
          high_school, high_school_year,
          exam_batch,
          hometown_province, hometown_city,
          tags, specialty_areas, visibility, sensitivity,
          owner_id, created_at, updated_at,
          profiles!owner_id(full_name, department, role)
        `)
        .eq('id', selectedId)
        .eq('is_deleted', false)
        .maybeSingle(),

      supabase
        .from('source_relationships')
        .select(`
          id, relation_type, relation_label, is_bidirectional, strength,
          source_a_id, source_b_id,
          source_a:sources!source_relationships_source_a_id_fkey(id, full_name, current_organization, current_position),
          source_b:sources!source_relationships_source_b_id_fkey(id, full_name, current_organization, current_position)
        `)
        .or(`source_a_id.eq.${selectedId},source_b_id.eq.${selectedId}`),
    ])

    const src = srcRes.data as any
    if (src) {
      const visFilter = `visibility.eq.shared,owner_id.eq.${user.id}`

      // 소속 동료
      const { data: sameOrgRaw } = src.current_organization
        ? await supabase.from('sources')
            .select('id, full_name, current_position, owner_id')
            .eq('current_organization', src.current_organization)
            .eq('is_deleted', false).neq('id', selectedId)
            .or(visFilter).limit(50)
        : { data: [] }

      // 대학 동문 (학과·학번 포함)
      const { data: sameUniRaw } = src.university
        ? await supabase.from('sources')
            .select('id, full_name, current_organization, current_position, university_major, university_year, owner_id')
            .eq('university', src.university)
            .eq('is_deleted', false).neq('id', selectedId)
            .or(visFilter).limit(60)
        : { data: [] }

      // 고교 동문 (학번 포함)
      const { data: sameHsRaw } = src.high_school
        ? await supabase.from('sources')
            .select('id, full_name, current_organization, current_position, high_school_year, owner_id')
            .eq('high_school', src.high_school)
            .eq('is_deleted', false).neq('id', selectedId)
            .or(visFilter).limit(60)
        : { data: [] }

      // 시험·기수: 같은 시험 유형 전체 (예: "사법고시" 전체, 그 안에서 기수별 분류)
      const examType = src.exam_batch ? extractExamType(src.exam_batch) : null
      const { data: sameExamRaw } = src.exam_batch
        ? examType
          ? await supabase.from('sources')
              .select('id, full_name, current_organization, current_position, exam_batch, owner_id')
              .ilike('exam_batch', `${examType} %`)
              .eq('is_deleted', false).neq('id', selectedId)
              .or(visFilter).limit(60)
          : await supabase.from('sources')
              .select('id, full_name, current_organization, current_position, exam_batch, owner_id')
              .eq('exam_batch', src.exam_batch)
              .eq('is_deleted', false).neq('id', selectedId)
              .or(visFilter).limit(60)
        : { data: [] }

      // 출신 지역 (시/군/구 포함)
      const { data: sameTownRaw } = src.hometown_province
        ? await supabase.from('sources')
            .select('id, full_name, current_organization, current_position, hometown_city, owner_id')
            .eq('hometown_province', src.hometown_province)
            .eq('is_deleted', false).neq('id', selectedId)
            .or(visFilter).limit(60)
        : { data: [] }

      // 등록 기자
      const { data: registrantsRaw } = await supabase
        .from('sources')
        .select('owner_id, visibility, profiles!owner_id(full_name, department, role)')
        .eq('full_name', src.full_name)
        .eq('is_deleted', false)

      analysisData = {
        source: src,
        relationships: (relsRes.data ?? []) as any[],
        sameOrg: (sameOrgRaw ?? []) as any[],
        sameUniversity: (sameUniRaw ?? []) as any[],
        sameHighSchool: (sameHsRaw ?? []) as any[],
        sameExam: (sameExamRaw ?? []) as any[],
        sameTown: (sameTownRaw ?? []) as any[],
        registrants: (registrantsRaw ?? []) as any[],
        examType,
      }
    }
  }

  return (
    <AnalysisClient
      allSources={allSources}
      selectedId={selectedId ?? null}
      analysisData={analysisData}
    />
  )
}
