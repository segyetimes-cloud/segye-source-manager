export const dynamic = 'force-dynamic'   // 캐시 비활성화 — 항상 최신 데이터

import { createClient, createServiceClient } from '@/lib/supabase/server'
import NetworkGraph from '@/components/network/NetworkGraph'
import DuplicateWarning from '@/components/network/DuplicateWarning'
import { normalizeUniversity, normalizeExamBatch, normalizeOrganization } from '@/lib/normalize'

interface SourceRow {
  id: string
  full_name: string
  current_organization: string | null
  current_position: string | null
  university: string | null
  high_school: string | null
  exam_batch: string | null
  hometown_province: string | null
  tags: string[]
  personal_notes: string | null   // 이름 언급 감지용
  visibility: string
  owner_id: string
}

export interface AutoLink {
  source: string
  target: string
  type: string
  types: string[]
  label: string
  strength: number
  connectionCount: number
}

// ─── 가족 맥락 필터 ────────────────────────────────────────────────────────────
const FAMILY_WORDS = [
  '딸', '아들', '자녀', '아이', '부인', '아내', '남편', '와이프',
  '형', '동생', '오빠', '언니', '누나', '형제', '자매',
  '부친', '모친', '아버지', '어머니', '아버님', '어머님', '부모님', '부모',
  '조카', '손자', '손녀', '삼촌', '이모', '고모', '외삼촌',
  '친척', '처', '시어머니', '시아버지', '장인', '장모',
]
function hasFamilyContext(text: string): boolean {
  return FAMILY_WORDS.some(w => text.includes(w))
}

// ─── 일반 직책 (연결에서 제외) ─────────────────────────────────────────────────
// 너무 흔한 직함은 연결에 쓰지 않음
const GENERIC_POSITIONS = new Set([
  '기자', '전기자', '전 기자', '기자(전)', '부장', '차장', '국장', '부국장',
  '팀장', '팀원', '과장', '대리', '사원', '주임', '선임', '수석', '이사',
  '대표', '사장', '회장', '부사장', '전무', '상무', '본부장', '실장',
  '위원', '연구원', '연구위원', '교수', '강사', '교사', '강원',
  '의원', '보좌관', '비서관', '행정관',
])

// ─── 태그 → 기수 추출 ─────────────────────────────────────────────────────────
// "세계일보 11기", "세계일보 13기", "경향 17기" 등
function extractCohortFromTag(tag: string): string | null {
  if (!tag || hasFamilyContext(tag)) return null
  // "XX 숫자기" 또는 "XX숫자기" 패턴
  const m = tag.match(/^(.+?)\s*(\d+)\s*[기期차]$/)
  if (m) {
    const org = m[1].trim()
    const num = m[2]
    if (org.length >= 2) return `${org} ${num}기`
  }
  return null
}

// ─── 태그 → 위원회 추출 ────────────────────────────────────────────────────────
// "세계일보 독자권익위원회 위원", "OO위원회 위원장" 등
function extractCommitteeFromTag(tag: string): string | null {
  if (!tag || hasFamilyContext(tag)) return null
  // "~위원회 위원|위원장|이사|간사" 패턴
  const m = tag.match(/(.+위원회)\s*(위원장?|이사|간사|사무총장|회장|부회장|감사)?$/)
  if (m) return m[1].trim()
  return null
}

// ─── 자유 텍스트 → 위원회 목록 추출 ──────────────────────────────────────────
// personal_notes 같은 자유텍스트에서 "OO위원회" 패턴을 찾아 반환
function extractCommitteesFromText(text: string): string[] {
  if (!text || hasFamilyContext(text)) return []
  const results: string[] = []
  // "2글자 이상 한글+위원회|협의회|심의회|운영위|이사회|자문단" 패턴
  const regex = /([가-힣a-zA-Z\s]{2,}(?:위원회|협의회|심의회|운영위|이사회|자문단))/g
  let m
  while ((m = regex.exec(text)) !== null) {
    const committee = m[1].trim()
    if (committee.length >= 4 && !hasFamilyContext(committee) && !results.includes(committee))
      results.push(committee)
  }
  return results
}

// ─── 자유 텍스트 → 기수 목록 추출 ────────────────────────────────────────────
// personal_notes 에서 "세계일보 11기", "한국일보 7기" 같은 패턴 추출
function extractCohortsFromText(text: string): string[] {
  if (!text) return []
  const results: string[] = []
  const regex = /([가-힣a-zA-Z]{2,})\s*(\d+)\s*[기期차]/g
  let m
  while ((m = regex.exec(text)) !== null) {
    const org = m[1].trim()
    const num = m[2]
    if (org.length >= 2) {
      const cohort = `${org} ${num}기`
      if (!results.includes(cohort)) results.push(cohort)
    }
  }
  return results
}

// ─── 태그 → 속성 추출 ─────────────────────────────────────────────────────────
function extractAttributesFromTags(tags: string[]): {
  universities: string[]
  exams: string[]
  orgs: string[]
  cohorts: string[]       // 기수 (세계일보 11기 등)
  committees: string[]    // 위원회
} {
  const universities: string[] = []
  const exams: string[] = []
  const orgs: string[] = []
  const cohorts: string[] = []
  const committees: string[] = []

  for (const tag of tags) {
    if (!tag || hasFamilyContext(tag)) continue
    const t = tag.trim()

    // 대학
    if (t.length <= 30 && /대학교|대학|공대|의대|법대|사범대|예술대|신학대|카이스트|포스텍|유니스트|지스트/.test(t)) {
      const { normalized } = normalizeUniversity(t)
      if (!universities.includes(normalized)) universities.push(normalized)
    }
    // 고시·시험 기수
    if (t.length <= 25 && /행시|사시|외시|입시|고시|변시|기고시|공채|사법고시|행정고시|외무고시|입법고시/.test(t)) {
      const { normalized } = normalizeExamBatch(t)
      if (!exams.includes(normalized)) exams.push(normalized)
    }
    // 정부부처 기관
    if (t.length >= 3 && t.length <= 15 && /(부|처|청|원|위원회)$/.test(t)) {
      const { normalized } = normalizeOrganization(t)
      if (!orgs.includes(normalized)) orgs.push(normalized)
    }
    // 기수 (세계일보 11기, 경향 17기 등)
    const cohort = extractCohortFromTag(t)
    if (cohort && !cohorts.includes(cohort)) cohorts.push(cohort)
    // 위원회
    const committee = extractCommitteeFromTag(t)
    if (committee && !committees.includes(committee)) committees.push(committee)
  }
  return { universities, exams, orgs, cohorts, committees }
}

// ─── 텍스트 안에 이름이 포함됐는지 확인 ─────────────────────────────────────────
// 가족 맥락과 함께 등장하는 이름은 제외
function textMentionsName(text: string, name: string): boolean {
  if (!text || !name || name.length < 2) return false
  const idx = text.indexOf(name)
  if (idx === -1) return false

  // 이름 등장 전 10자 안에 가족 단어가 있으면 제외
  const before = text.slice(Math.max(0, idx - 10), idx)
  if (hasFamilyContext(before)) return false

  return true
}

// ─── 관계 링크 생성 ──────────────────────────────────────────────────────────
function buildAutoLinks(sources: SourceRow[]): {
  links: AutoLink[]
  duplicateNames: string[]
  dedupMap: Map<string, string>   // 비대표 ID → 대표 ID
} {
  type PairConn = { type: string; label: string; strength: number }
  const pairMap = new Map<string, PairConn[]>()

  // ── 중복 이름 감지 & 대표 ID 매핑 ────────────────────────────────────────
  // 같은 full_name을 가진 레코드가 여럿이면 첫 번째를 "대표"로 삼고
  // 나머지 ID를 대표 ID로 리매핑 → 그래프에 하나의 노드만 표시
  const nameCounts = new Map<string, string[]>()
  for (const s of sources) {
    if (!nameCounts.has(s.full_name)) nameCounts.set(s.full_name, [])
    nameCounts.get(s.full_name)!.push(s.id)
  }
  const duplicateNames = [...nameCounts.entries()]
    .filter(([, ids]) => ids.length >= 2)
    .map(([name]) => name)

  // dedupMap: 비대표 ID → 대표 ID
  const dedupMap = new Map<string, string>()
  for (const [, ids] of nameCounts) {
    if (ids.length >= 2) {
      const canonical = ids[0]
      for (let i = 1; i < ids.length; i++) dedupMap.set(ids[i], canonical)
    }
  }
  // ID 정규화 — 중복 레코드는 대표 ID로 수렴
  function resolveId(id: string): string {
    return dedupMap.get(id) ?? id
  }

  function addConn(
    aId: string, bId: string,
    type: string, label: string, strength: number
  ) {
    const a = resolveId(aId)
    const b = resolveId(bId)
    if (a === b) return  // 자기 자신(또는 중복 통합) 연결 방지
    const key = [a, b].sort().join('||')
    if (!pairMap.has(key)) pairMap.set(key, [])
    const list = pairMap.get(key)!
    if (!list.some(e => e.type === type && e.label === label))
      list.push({ type, label, strength })
  }

  function groupByField(attr: keyof SourceRow) {
    const groups = new Map<string, SourceRow[]>()
    for (const s of sources) {
      const val = s[attr]
      if (!val || typeof val !== 'string' || !val.trim()) continue
      const k = val.trim()
      if (!groups.has(k)) groups.set(k, [])
      groups.get(k)!.push(s)
    }
    return groups
  }

  function pairAll(
    members: SourceRow[], maxSize: number,
    type: string, labelFn: (k: string) => string,
    strength: number, key: string
  ) {
    if (members.length < 2 || members.length > maxSize) return
    for (let i = 0; i < members.length; i++)
      for (let j = i + 1; j < members.length; j++)
        addConn(members[i].id, members[j].id, type, labelFn(key), strength)
  }

  // ① 소속 기관 — 동료 (강도 3)
  for (const [k, m] of groupByField('current_organization'))
    pairAll(m, 30, 'same_org', k => `동료 (${k})`, 3, k)

  // ② 대학 동문 (강도 2)
  for (const [k, m] of groupByField('university'))
    pairAll(m, 25, 'same_university', k => `동문 (${k})`, 2, k)

  // ③ 고교 동문 (강도 2)
  for (const [k, m] of groupByField('high_school'))
    pairAll(m, 25, 'same_highschool', k => `고교동문 (${k})`, 2, k)

  // ④ 시험 동기 (강도 4) — exam_batch 정규화 후 그룹핑 (사시28기·사시28회·사법고시28회 → 동일 그룹)
  const examBatchNormGroups = new Map<string, SourceRow[]>()
  for (const s of sources) {
    if (!s.exam_batch?.trim()) continue
    const { normalized } = normalizeExamBatch(s.exam_batch)
    if (!examBatchNormGroups.has(normalized)) examBatchNormGroups.set(normalized, [])
    examBatchNormGroups.get(normalized)!.push(s)
  }
  for (const [k, m] of examBatchNormGroups)
    pairAll(m, 60, 'same_exam', k => `동기 (${k})`, 4, k)

  // ⑤ 출신 광역시도 — 동향 (강도 1)
  for (const [k, m] of groupByField('hometown_province'))
    pairAll(m, 20, 'same_hometown', k => `동향 (${k})`, 1, k)

  // ⑥ 공통 태그 (가족 맥락 제외)
  const tagGroup = new Map<string, SourceRow[]>()
  for (const s of sources) {
    if (!Array.isArray(s.tags)) continue
    for (const tag of s.tags) {
      if (!tag || hasFamilyContext(tag) || tag.length > 30) continue
      if (!tagGroup.has(tag)) tagGroup.set(tag, [])
      tagGroup.get(tag)!.push(s)
    }
  }
  for (const [k, m] of tagGroup)
    pairAll(m, 30, 'same_tag', k => `공통태그 (${k})`, 1, k)

  // ⑦ 직책/위원회 공유
  // A) current_position 기반 — 구체적 직책명 (7자 이상)
  for (const [pos, members] of groupByField('current_position')) {
    const trimmed = pos.trim()
    if (trimmed.length < 7) continue
    if (GENERIC_POSITIONS.has(trimmed)) continue
    if (/(위원|소장|원장|회장|의장|이사장|위원장|단장|사무총장)/.test(trimmed)) {
      pairAll(members, 40, 'same_position', k => `같은 직책 (${k})`, 2, trimmed)
    }
  }
  // B) org+position 조합 — 짧은 직책(위원/이사 등)도 같은 기관이면 연결
  //    예: current_organization="세계일보 독자권익위원회", current_position="위원"
  const orgPosGroup = new Map<string, SourceRow[]>()
  for (const s of sources) {
    const org = s.current_organization?.trim()
    const pos = s.current_position?.trim()
    if (!org || !pos) continue
    // 기관명에 위원회/협회/학회/재단 포함이고 직책이 역할어 포함
    if (/(위원회|협회|학회|연구회|재단|포럼|네트워크|클럽)/.test(org) &&
        /(위원장?|이사|간사|감사|회장|부회장|사무총장|회원)/.test(pos)) {
      const key = org   // 같은 기관명으로 묶음
      if (!orgPosGroup.has(key)) orgPosGroup.set(key, [])
      // 중복 방지
      if (!orgPosGroup.get(key)!.some(x => x.id === s.id))
        orgPosGroup.get(key)!.push(s)
    }
  }
  for (const [org, members] of orgPosGroup)
    pairAll(members, 60, 'same_position', k => `위원 (${k})`, 3, org)

  // ⑧ 태그 파생 — 대학·시험·기관 교차 매칭 + 위원회 + 기수
  //    + personal_notes 자유텍스트에서도 위원회·기수 추출
  const tagUnivSources      = new Map<string, SourceRow[]>()
  const tagExamSources      = new Map<string, SourceRow[]>()
  const tagOrgSources       = new Map<string, SourceRow[]>()
  const tagCohortSources    = new Map<string, SourceRow[]>()    // 기수 (세계일보 11기)
  const tagCommitteeSources = new Map<string, SourceRow[]>()   // 위원회

  function addToGroup(map: Map<string, SourceRow[]>, key: string, s: SourceRow) {
    if (!map.has(key)) map.set(key, [])
    if (!map.get(key)!.some(x => x.id === s.id)) map.get(key)!.push(s)
  }

  for (const s of sources) {
    // ─ 태그 기반 파싱
    if (Array.isArray(s.tags)) {
      const { universities, exams, orgs, cohorts, committees } = extractAttributesFromTags(s.tags)
      for (const u of universities) addToGroup(tagUnivSources, u, s)
      for (const e of exams) addToGroup(tagExamSources, e, s)
      for (const o of orgs) addToGroup(tagOrgSources, o, s)
      for (const c of cohorts) addToGroup(tagCohortSources, c, s)
      for (const cm of committees) addToGroup(tagCommitteeSources, cm, s)
    }

    // ─ personal_notes 자유텍스트 파싱 (정보란에 입력된 위원회·기수 정보 반영)
    if (s.personal_notes) {
      for (const cm of extractCommitteesFromText(s.personal_notes))
        addToGroup(tagCommitteeSources, cm, s)
      for (const c of extractCohortsFromText(s.personal_notes))
        addToGroup(tagCohortSources, c, s)
    }
  }

  // ── 성능 최적화: 필드별 정규화 맵 사전 빌드 (반복 filter() 제거) ────────────
  const univFieldMap = new Map<string, SourceRow[]>()
  // examFieldMap: ④에서 이미 normGroups로 빌드했으므로 재활용
  const examFieldMap = examBatchNormGroups
  const orgFieldMap  = new Map<string, SourceRow[]>()
  const orgRawMap    = new Map<string, SourceRow[]>()   // 위원회 포함 검색용
  for (const s of sources) {
    if (s.university) {
      const n = normalizeUniversity(s.university).normalized
      if (!univFieldMap.has(n)) univFieldMap.set(n, [])
      univFieldMap.get(n)!.push(s)
    }
    if (s.current_organization) {
      const n = normalizeOrganization(s.current_organization).normalized
      if (!orgFieldMap.has(n)) orgFieldMap.set(n, [])
      orgFieldMap.get(n)!.push(s)
      // raw map for committee substring search
      const raw = s.current_organization.trim()
      if (!orgRawMap.has(raw)) orgRawMap.set(raw, [])
      orgRawMap.get(raw)!.push(s)
    }
  }

  for (const [univ, tagMembers] of tagUnivSources) {
    const fieldMembers = univFieldMap.get(univ) ?? []
    for (const tm of tagMembers)
      for (const fm of fieldMembers)
        if (tm.id !== fm.id) addConn(tm.id, fm.id, 'same_university', `동문 (${univ})`, 2)
    pairAll(tagMembers, 25, 'same_university', k => `동문 (${k})`, 1, univ)
  }

  for (const [exam, tagMembers] of tagExamSources) {
    const fieldMembers = examFieldMap.get(exam) ?? []
    for (const tm of tagMembers)
      for (const fm of fieldMembers)
        if (tm.id !== fm.id) addConn(tm.id, fm.id, 'same_exam', `동기 (${exam})`, 3)
    pairAll(tagMembers, 60, 'same_exam', k => `동기 (${k})`, 2, exam)
  }

  for (const [org, tagMembers] of tagOrgSources) {
    const fieldMembers = orgFieldMap.get(org) ?? []
    for (const tm of tagMembers)
      for (const fm of fieldMembers)
        if (tm.id !== fm.id) addConn(tm.id, fm.id, 'same_org', `동료 (${org})`, 2)
  }

  // ⑩ 기수 연결 — "세계일보 11기", "세계일보 13기" 등 (강도 4 — 시험동기와 동급)
  for (const [cohort, members] of tagCohortSources)
    pairAll(members, 60, 'same_exam', k => `동기 (${k})`, 4, cohort)
  // 기수 태그 ↔ exam_batch 필드 교차 매칭
  for (const [cohort, tagMembers] of tagCohortSources) {
    const fieldMembers = examFieldMap.get(cohort) ?? []
    for (const tm of tagMembers)
      for (const fm of fieldMembers)
        if (tm.id !== fm.id) addConn(tm.id, fm.id, 'same_exam', `동기 (${cohort})`, 4)
  }

  // ⑪ 위원회 태그 연결 — "세계일보 독자권익위원회" 등 (강도 3)
  for (const [committee, members] of tagCommitteeSources)
    pairAll(members, 60, 'same_position', k => `위원 (${k})`, 3, committee)
  // 위원회 태그 ↔ current_organization 필드 교차 매칭
  for (const [committee, tagMembers] of tagCommitteeSources) {
    const fieldMembers: SourceRow[] = []
    for (const [raw, rows] of orgRawMap) {
      if (raw.includes(committee) || raw === committee) fieldMembers.push(...rows)
    }
    for (const tm of tagMembers)
      for (const fm of fieldMembers)
        if (tm.id !== fm.id) addConn(tm.id, fm.id, 'same_position', `위원 (${committee})`, 3)
  }

  // ⑨ 이름 언급 연결 — personal_notes + tags에서 다른 취재원 이름 감지
  //    (가족 맥락 필터 적용, 자기 언급 제외)
  //
  //    예: A의 notes에 "박희준과 친분있음" → A↔박희준 연결
  //        A의 notes에 "딸 박희준 재학 중" → 무시 (가족 맥락)
  const nameToSources = new Map<string, SourceRow[]>()
  for (const s of sources) {
    const name = s.full_name?.trim()
    if (!name) continue
    if (!nameToSources.has(name)) nameToSources.set(name, [])
    nameToSources.get(name)!.push(s)
  }

  for (const s of sources) {
    // notes + tags 텍스트 합산
    const searchText = [
      s.personal_notes ?? '',
      ...(Array.isArray(s.tags) ? s.tags : []),
    ].join(' ')

    if (!searchText.trim()) continue

    for (const [name, targets] of nameToSources) {
      // 자기 이름은 건너뜀
      if (targets.some(t => t.id === s.id)) continue
      // 가족 맥락 없이 이름 등장 시 연결
      if (textMentionsName(searchText, name)) {
        for (const target of targets) {
          addConn(s.id, target.id, 'mention', `언급 (${name})`, 2)
        }
      }
    }
  }

  // ── 집계: 쌍별 단일 링크 합산 ──────────────────────────────────────────────
  const links: AutoLink[] = []
  for (const [key, conns] of pairMap) {
    const [aId, bId] = key.split('||')
    const totalStrength = conns.reduce((s, c) => s + c.strength, 0)
    const sorted = [...conns].sort((a, b) => b.strength - a.strength)
    const primaryType = sorted[0].type
    const types = [...new Set(conns.map(c => c.type))]
    const label = [...new Set(conns.map(c => c.label))].join(' · ')
    links.push({
      source: aId, target: bId,
      type: primaryType, types, label,
      strength: totalStrength,
      connectionCount: conns.length,
    })
  }

  return { links, duplicateNames, dedupMap }
}

const TYPE_LABELS: Record<string, string> = {
  same_org:        '동료',
  same_university: '대학동문',
  same_highschool: '고교동문',
  same_exam:       '시험/기수동기',
  same_hometown:   '동향',
  same_tag:        '공통태그',
  same_position:   '직책/위원회',
  mention:         '직접언급',
  manual:          '수동등록',
}

export default async function NetworkPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Service Role 클라이언트 — RLS 우회하여 personal_notes 전체 접근
  // (이름 언급 연결 감지에 필요. 노트 내용 자체는 클라이언트에 전송 안 함)
  const svc = createServiceClient()

  // ── 연결 감지용: 전체 소스 (삭제 안 된 것) — personal_notes 포함
  // 개인 소스도 포함해야 "김용출"처럼 personal로 등록된 취재원의 이름 언급이 감지됨
  const SOURCE_LIMIT = 400
  const { data: allSourcesRaw, count: totalSourceCount } = await svc
    .from('sources')
    .select(`
      id, full_name, current_organization, current_position,
      university, high_school, exam_batch, hometown_province,
      tags, personal_notes, visibility, owner_id
    `, { count: 'exact' })
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })
    .limit(SOURCE_LIMIT)

  const allSources = (allSourcesRaw ?? []) as SourceRow[]

  // ── 노드 표시용: 공유 소스 + 본인 개인 소스만
  const visibleIds = new Set<string>(
    allSources
      .filter(s => s.visibility === 'shared' || s.owner_id === user.id)
      .map(s => s.id)
  )

  const { links: autoLinks, duplicateNames, dedupMap } = buildAutoLinks(allSources)

  // 수동 관계 병합
  const { data: manualRelsRaw } = await svc
    .from('source_relationships')
    .select('source_a_id, source_b_id, relation_type, relation_label, strength')
    .limit(500)

  const manualLinks: AutoLink[] = (manualRelsRaw ?? []).map(r => ({
    source: r.source_a_id,
    target: r.source_b_id,
    type: r.relation_type ?? 'manual',
    types: [r.relation_type ?? 'manual'],
    label: r.relation_label ?? '관계',
    strength: r.strength ?? 2,
    connectionCount: 1,
  }))

  const allLinks = [...autoLinks, ...manualLinks]

  const connectedIds = new Set<string>()
  allLinks.forEach(l => { connectedIds.add(l.source); connectedIds.add(l.target) })

  const degreeMap = new Map<string, number>()
  allLinks.forEach(l => {
    degreeMap.set(l.source, (degreeMap.get(l.source) ?? 0) + l.connectionCount)
    degreeMap.set(l.target, (degreeMap.get(l.target) ?? 0) + l.connectionCount)
  })

  const nodes = allSources
    .filter(s => {
      // 중복 비대표 ID는 노드에서 제외 (대표 ID 하나만 표시)
      if (dedupMap.has(s.id)) return false
      // 연결이 있어야 하고, 노드 표시 권한(공유 or 본인 소유)이 있어야 함
      return connectedIds.has(s.id) && visibleIds.has(s.id)
    })
    .map(s => ({
      id: s.id,
      label: s.full_name,
      org: s.current_organization,
      position: s.current_position,
      tags: s.tags ?? [],
      isOwner: s.owner_id === user.id,
      degree: degreeMap.get(s.id) ?? 1,
      // 여전히 DB에 중복 레코드가 존재함을 표시 (삭제 유도)
      isDuplicate: duplicateNames.includes(s.full_name),
    }))

  const linkTypeCounts = allLinks.reduce((acc, l) => {
    for (const t of l.types) acc[t] = (acc[t] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-bold" style={{ color: '#CDD5E0' }}>🕸️ 관계망 그래프</h1>
          {/* 통계: 모바일에서는 한 줄 요약만 */}
          <p className="text-xs mt-0.5" style={{ color: '#485870' }}>
            {nodes.length}명 · {allLinks.length}쌍 연결
          </p>
        </div>
        {/* PC에서만 상세 통계 표시 */}
        <div className="hidden md:block text-right text-xs flex-shrink-0" style={{ color: '#485870' }}>
          {Object.entries(linkTypeCounts).map(([type, count]) => (
            <p key={type}>{TYPE_LABELS[type] ?? type}: {count}건</p>
          ))}
        </div>
      </div>

      {/* 중복 이름 경고 */}
      <DuplicateWarning duplicateNames={duplicateNames} />

      {/* 취재원 수 초과 경고 */}
      {(totalSourceCount ?? 0) > SOURCE_LIMIT && (
        <div style={{
          padding: '8px 14px', borderRadius: '8px', fontSize: '12px',
          background: 'rgba(168,114,40,0.1)', border: '1px solid rgba(168,114,40,0.3)',
          color: '#A87228',
        }}>
          ⚠ 전체 {totalSourceCount}명 중 최근 수정 순 {SOURCE_LIMIT}명만 그래프에 표시됩니다.
        </div>
      )}

      <div className="graph-container" style={{ height: 'calc(100vh - 140px)', minHeight: '420px' }}>
        <NetworkGraph nodes={nodes} links={allLinks} />
      </div>
    </div>
  )
}
