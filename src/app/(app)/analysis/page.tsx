export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { can, CAN_VIEW_SENSITIVE_SOURCE } from '@/lib/permissions'
import { isDesk } from '@/lib/roles'
import AnalysisClient from '@/components/analysis/AnalysisClient'

interface SearchParams { id?: string; q?: string }

/** "사법고시 17회" → "사법고시" / "세계일보 13기" → "세계일보" / "수능" → null */
function extractExamType(batch: string): string | null {
  const parts = batch.trim().split(/\s+/)
  if (parts.length < 2) return null
  return parts.slice(0, -1).join(' ')
}

/** Extract a snippet around a name match in text */
function extractSnippet(
  text: string, name: string, ctxLen: number
): { before: string; match: string; after: string } | null {
  const lower = text.toLowerCase()
  const nameLower = name.toLowerCase()
  const idx = lower.indexOf(nameLower)
  if (idx === -1) return null
  const before = (idx > ctxLen ? '…' : '') + text.slice(Math.max(0, idx - ctxLen), idx)
  const match = text.slice(idx, idx + name.length)
  const end = idx + name.length
  const after = text.slice(end, end + ctxLen) + (end + ctxLen < text.length ? '…' : '')
  return { before, match, after }
}

export default async function AnalysisPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { id: selectedId, q: queryName } = await searchParams

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
  const isDeskRole = isDesk(userRole)

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
          tags, affiliations, specialty_areas, visibility, sensitivity,
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

      // 동호회·단체 공유
      const { data: sameAffiliationRaw } = src.affiliations?.length > 0
        ? await supabase.from('sources')
            .select('id, full_name, current_organization, current_position, affiliations, owner_id')
            .overlaps('affiliations', src.affiliations)
            .eq('is_deleted', false).neq('id', selectedId)
            .or(visFilter).limit(100)
        : { data: [] }

      // ── 정보보고 언급 검색 ──────────────────────────────────────────────────
      const fullName = src.full_name as string
      const escapedForLike = fullName.replace(/[%_\\]/g, '\\$&')

      // Reports with explicit source link
      const { data: linkedReportIdRows } = await supabase
        .from('report_sources')
        .select('report_id')
        .eq('source_id', selectedId)
        .limit(30)
      const linkedReportIds = (linkedReportIdRows ?? []).map((r: any) => r.report_id as string)

      // Text search OR explicit links
      const textOrParts = [
        `title.ilike.%${escapedForLike}%`,
        `content.ilike.%${escapedForLike}%`,
        `sensitive_content.ilike.%${escapedForLike}%`,
      ]
      if (linkedReportIds.length > 0) {
        textOrParts.push(`id.in.(${linkedReportIds.join(',')})`)
      }

      const { data: reportMentionsRaw } = await supabase
        .from('information_reports')
        .select('id, title, content, sensitive_content, visibility, status, created_at, author_id, profiles!author_id(full_name, department)')
        .eq('is_deleted', false)
        .or(textOrParts.join(','))
        .order('created_at', { ascending: false })
        .limit(20)

      // Co-mentioned sources (explicitly linked in the same reports)
      const mentionedReportIds = (reportMentionsRaw ?? []).map((r: any) => r.id as string)
      const { data: coMentionedRaw } = mentionedReportIds.length > 0
        ? await supabase
            .from('report_sources')
            .select('report_id, source_id, sources!source_id(id, full_name, current_organization, current_position)')
            .in('report_id', mentionedReportIds)
            .neq('source_id', selectedId)
            .limit(100)
        : { data: [] }

      // Process report mentions
      const reportMentions = (reportMentionsRaw ?? []).map((r: any) => {
        const contentSnippet = r.content ? extractSnippet(r.content, fullName, 90) : null
        const rawSensSnippet = r.sensitive_content ? extractSnippet(r.sensitive_content, fullName, 30) : null
        const p = r.profiles as { full_name: string; department: string | null } | null
        // For non-desk users: replace surrounding text with placeholders to protect sensitive info
        const sensitiveSnippet = rawSensSnippet
          ? isDeskRole
            ? rawSensSnippet
            : { before: '●●●●', match: rawSensSnippet.match, after: '●●●●' }
          : null
        return {
          id: r.id as string,
          title: r.title as string,
          status: r.status as string,
          visibility: r.visibility as string,
          created_at: r.created_at as string,
          authorName: p?.full_name ?? null,
          authorDept: p?.department ?? null,
          contentSnippet,
          sensitiveSnippet,
          hasSensitiveMatch: !!rawSensSnippet,
          canSeeSensitive: isDeskRole,
        }
      })

      // Deduplicate and count co-mentioned sources
      const coMentionedMap = new Map<string, { source: any; reportCount: number }>()
      for (const row of (coMentionedRaw ?? [])) {
        const coSrc = (row as any).sources
        if (!coSrc) continue
        const existing = coMentionedMap.get(coSrc.id)
        if (existing) existing.reportCount++
        else coMentionedMap.set(coSrc.id, { source: coSrc, reportCount: 1 })
      }
      const coMentionedViaReports = [...coMentionedMap.values()]
        .sort((a, b) => b.reportCount - a.reportCount)
        .slice(0, 20)

      // 등록 기자
      const { data: registrantsRaw } = await supabase
        .from('sources')
        .select('owner_id, visibility, profiles!owner_id(full_name, department, role)')
        .eq('full_name', src.full_name)
        .eq('is_deleted', false)

      // ── AI 추출 관계망 (보고서에서 추출된 인물·관계) ──────────────────────
      const nameEsc = fullName.replace(/[%_\\]/g, '\\$&')

      // 이 인물이 등장한 보고서들의 추출 엔티티
      const { data: mentionedReportEntityRows } = await (supabase as any)
        .from('report_extracted_entities')
        .select('report_id, name, role, mentions')
        .ilike('name', `%${nameEsc}%`)
        .limit(50)

      const extractedReportIds = [...new Set(
        (mentionedReportEntityRows ?? []).map((r: any) => r.report_id as string)
      )]

      // 해당 보고서들의 다른 등장 인물 (co-entities)
      const { data: coEntityRows } = extractedReportIds.length > 0
        ? await (supabase as any)
            .from('report_extracted_entities')
            .select('report_id, name, role, mentions')
            .in('report_id', extractedReportIds)
            .not('name', 'ilike', `%${nameEsc}%`)
            .limit(200)
        : { data: [] }

      // 이 인물 이름이 포함된 직접 관계
      const { data: directRelRows } = await (supabase as any)
        .from('report_extracted_relations')
        .select('report_id, from_name, to_name, rel_type, detail')
        .or(`from_name.ilike.%${nameEsc}%,to_name.ilike.%${nameEsc}%`)
        .limit(100)

      // co-entity 집계 (등장 보고서 수 기준 정렬)
      const coEntityMap = new Map<string, { name: string; role: string | null; reportCount: number }>()
      for (const row of (coEntityRows ?? [])) {
        const r = row as any
        const existing = coEntityMap.get(r.name)
        if (existing) existing.reportCount++
        else coEntityMap.set(r.name, { name: r.name, role: r.role, reportCount: 1 })
      }
      const coEntities = [...coEntityMap.values()]
        .sort((a, b) => b.reportCount - a.reportCount)
        .slice(0, 30)

      const directRelations = (directRelRows ?? []).map((r: any) => ({
        reportId:  r.report_id as string,
        fromName:  r.from_name as string,
        toName:    r.to_name as string,
        relType:   r.rel_type as string,
        detail:    r.detail as string | null,
      }))

      analysisData = {
        source: src,
        relationships: (relsRes.data ?? []) as any[],
        sameOrg: (sameOrgRaw ?? []) as any[],
        sameUniversity: (sameUniRaw ?? []) as any[],
        sameHighSchool: (sameHsRaw ?? []) as any[],
        sameExam: (sameExamRaw ?? []) as any[],
        sameTown: (sameTownRaw ?? []) as any[],
        sameAffiliation: (sameAffiliationRaw ?? []) as any[],
        reportMentions,
        coMentionedViaReports,
        registrants: (registrantsRaw ?? []) as any[],
        examType,
        // AI 추출 데이터
        extractedCoEntities: coEntities,
        extractedDirectRelations: directRelations,
      }
    }
  }

  // ── ?q=이름 모드: 취재원 DB 미등록 인물 검색 ──────────────────────────────
  let queryAnalysis: {
    queryName: string
    coEntities: { name: string; role: string | null; reportCount: number }[]
    directRelations: { fromName: string; toName: string; relType: string; detail: string | null; reportId: string }[]
    reportIds: string[]
  } | null = null

  if (queryName && !selectedId) {
    const qEsc = queryName.replace(/[%_\\]/g, '\\$&')

    const { data: qEntityRows } = await (supabase as any)
      .from('report_extracted_entities')
      .select('report_id, name, role, mentions')
      .ilike('name', `%${qEsc}%`)
      .limit(50)

    const qReportIds: string[] = Array.from(new Set<string>((qEntityRows ?? []).map((r: any) => r.report_id as string)))

    const { data: qCoRows } = qReportIds.length > 0
      ? await (supabase as any)
          .from('report_extracted_entities')
          .select('report_id, name, role')
          .in('report_id', qReportIds)
          .not('name', 'ilike', `%${qEsc}%`)
          .limit(200)
      : { data: [] }

    const { data: qRelRows } = await (supabase as any)
      .from('report_extracted_relations')
      .select('report_id, from_name, to_name, rel_type, detail')
      .or(`from_name.ilike.%${qEsc}%,to_name.ilike.%${qEsc}%`)
      .limit(100)

    const qCoMap = new Map<string, { name: string; role: string | null; reportCount: number }>()
    for (const row of (qCoRows ?? [])) {
      const r = row as any
      const existing = qCoMap.get(r.name)
      if (existing) existing.reportCount++
      else qCoMap.set(r.name, { name: r.name, role: r.role, reportCount: 1 })
    }

    queryAnalysis = {
      queryName,
      coEntities: [...qCoMap.values()].sort((a, b) => b.reportCount - a.reportCount).slice(0, 30),
      directRelations: (qRelRows ?? []).map((r: any) => ({
        reportId: r.report_id, fromName: r.from_name, toName: r.to_name,
        relType: r.rel_type, detail: r.detail,
      })),
      reportIds: qReportIds,
    }
  }

  return (
    <AnalysisClient
      allSources={allSources}
      selectedId={selectedId ?? null}
      analysisData={analysisData}
      queryName={queryName ?? null}
      queryAnalysis={queryAnalysis}
    />
  )
}
