import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import DashboardChartsCollapsible from '@/components/dashboard/DashboardChartsCollapsible'
import type { ChartData } from '@/components/dashboard/DashboardCharts'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  type SourceRow = { id: string; full_name: string; current_organization: string | null; current_position: string | null; created_at: string; completeness_score: number; visibility: string; sensitivity: string }
  type RecentViewRow = { id: string; full_name: string; current_organization: string | null; current_position: string | null; completeness_score: number }
  type PointsSummary = { total_points: number }
  type LeaderboardRow = { user_id: string; total_points: number; profiles: { full_name: string; department: string | null } | null }
  type HelpRow = { id: string; title: string; reward_points: number; created_at: string }
  type ReportRow = { category: string | null }
  type FollowupRow = { id: string; next_followup_at: string; summary: string | null; source_id: string; sources: { id: string; full_name: string; current_organization: string | null } | null }

  const [
    { count: sharedSourceCount },
    { data: myPointsRaw },
    { data: leaderboardRaw },
    { data: recentSourcesRaw },
    { data: openHelpRaw },
    { data: mySourcesForChartRaw },
    { data: allSharedSourcesRaw },
    { data: myReportsRaw },
    { data: followupRaw },
    { data: recentViewLogsRaw },
  ] = await Promise.all([
    supabase.from('sources').select('*', { count: 'exact', head: true })
      .eq('visibility', 'shared').eq('is_deleted', false),
    supabase.from('user_points_summary').select('*').eq('user_id', user.id).single(),
    supabase.from('user_points_summary')
      .select('user_id, total_points, profiles(full_name, department)')
      .order('total_points', { ascending: false }).limit(10),
    supabase.from('sources')
      .select('id, full_name, current_organization, current_position, created_at, completeness_score')
      .eq('owner_id', user.id).eq('is_deleted', false)
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('help_requests').select('id, title, reward_points, created_at')
      .eq('status', 'open').order('created_at', { ascending: false }).limit(5),
    // 차트용: 내 전체 취재원 (created_at, completeness_score, current_organization)
    supabase.from('sources')
      .select('created_at, completeness_score, current_organization')
      .eq('owner_id', user.id).eq('is_deleted', false),
    // 공유 취재원 sensitivity 현황
    supabase.from('sources')
      .select('sensitivity')
      .eq('visibility', 'shared').eq('is_deleted', false),
    // 내 보고서 카테고리
    supabase.from('information_reports')
      .select('category')
      .eq('author_id', user.id).eq('is_deleted', false),
    // Followup 쿼리 추가: 7일 이내 next_followup_at 있는 내 연락 이력
    supabase
      .from('contact_logs')
      .select('id, next_followup_at, summary, source_id, sources!source_id(id, full_name, current_organization)')
      .not('next_followup_at', 'is', null)
      .lte('next_followup_at', (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString() })())
      .eq('user_id', user.id)
      .order('next_followup_at', { ascending: true })
      .limit(8),
    // 최근 열람 로그 (view / view_private)
    (supabase.from('audit_logs')
      .select('resource_id, created_at')
      .eq('user_id', user.id)
      .eq('resource_type', 'source')
      .in('action', ['view', 'view_private'])
      .order('created_at', { ascending: false })
      .limit(30)) as unknown as Promise<{ data: { resource_id: string | null }[] | null; error: unknown }>,
  ])

  const myPoints = myPointsRaw as PointsSummary | null
  const leaderboard = leaderboardRaw as LeaderboardRow[] | null
  const recentSources = recentSourcesRaw as SourceRow[] | null
  const openHelp = openHelpRaw as HelpRow[] | null
  const totalPoints = myPoints?.total_points ?? 0
  const followups = (followupRaw ?? []) as FollowupRow[]

  // 최근 열람: 중복 제거 후 최신 5개 source_id 추출
  const seenViewIds = new Set<string>()
  const recentViewIds: string[] = []
  for (const v of ((recentViewLogsRaw ?? []) as { resource_id: string | null }[])) {
    if (v.resource_id && !seenViewIds.has(v.resource_id)) {
      seenViewIds.add(v.resource_id)
      recentViewIds.push(v.resource_id)
      if (recentViewIds.length >= 5) break
    }
  }
  let recentViewSources: RecentViewRow[] = []
  if (recentViewIds.length > 0) {
    const { data: rvData } = await supabase
      .from('sources')
      .select('id, full_name, current_organization, current_position, completeness_score')
      .in('id', recentViewIds)
      .eq('is_deleted', false)
    const sourceMap = new Map(((rvData ?? []) as RecentViewRow[]).map(s => [s.id, s]))
    recentViewSources = recentViewIds.map(sid => sourceMap.get(sid)).filter(Boolean) as RecentViewRow[]
  }

  // ── 차트 데이터 계산 ──────────────────────────────────────
  const mySourcesForChart = (mySourcesForChartRaw ?? []) as { created_at: string; completeness_score: number; current_organization: string | null }[]
  const allSharedSources = (allSharedSourcesRaw ?? []) as { sensitivity: string }[]
  const myReports = (myReportsRaw ?? []) as ReportRow[]

  // 1. 일별 등록 추이 (최근 30일)
  const days: string[] = []
  const dailyMap = new Map<string, number>()
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    days.push(key)
    dailyMap.set(key, 0)
  }
  for (const s of mySourcesForChart) {
    const key = new Date(s.created_at).toISOString().slice(0, 10)
    if (dailyMap.has(key)) dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1)
  }
  // 5일 간격 + 첫날 + 마지막날만 레이블 표시, 나머지는 빈 문자열
  const monthlyTrend = days.map((k, i) => {
    const d = new Date(k)
    const show = i === 0 || i === days.length - 1 || i % 5 === 0
    const label = show ? `${d.getMonth() + 1}/${d.getDate()}` : ''
    return { label, count: dailyMap.get(k) ?? 0 }
  })

  // 2. 완성도 분포 (5구간)
  const buckets = [0, 0, 0, 0, 0]
  for (const s of mySourcesForChart) {
    const idx = Math.min(4, Math.floor((s.completeness_score ?? 0) / 20))
    buckets[idx]++
  }
  const bucketColors = ['#C04040', '#A87228', '#4A7CC0', '#3A90A8', '#3D9E6A']
  const completeness: ChartData['completeness'] = [
    { label: '0-20', count: buckets[0], color: bucketColors[0] },
    { label: '21-40', count: buckets[1], color: bucketColors[1] },
    { label: '41-60', count: buckets[2], color: bucketColors[2] },
    { label: '61-80', count: buckets[3], color: bucketColors[3] },
    { label: '81+', count: buckets[4], color: bucketColors[4] },
  ]
  const avgCompleteness = mySourcesForChart.length > 0
    ? Math.round(mySourcesForChart.reduce((s, x) => s + (x.completeness_score ?? 0), 0) / mySourcesForChart.length)
    : 0

  // 3. 보고서 카테고리
  const catMap = new Map<string, number>()
  for (const r of myReports) {
    const cat = r.category ?? '일반'
    catMap.set(cat, (catMap.get(cat) ?? 0) + 1)
  }
  const catColors: Record<string, string> = {
    '일반': '#4A7CC0', '단독': '#C04040', '공동취재': '#3A90A8',
    '인터뷰': '#7E6E48', '배경설명': '#5A7099', '분석': '#3D9E6A', '기타': '#607898',
  }
  const reportCategories: ChartData['reportCategories'] = Array.from(catMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, color: catColors[name] ?? '#607898' }))

  // 4. 상위 출입처 TOP 5
  const orgMap = new Map<string, number>()
  for (const s of mySourcesForChart) {
    if (s.current_organization) {
      orgMap.set(s.current_organization, (orgMap.get(s.current_organization) ?? 0) + 1)
    }
  }
  const topOrgs: ChartData['topOrgs'] = Array.from(orgMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  // 5. 공유 취재원 현황
  const sharedCount = allSharedSources.length
  const sensitiveCount = allSharedSources.filter(s => s.sensitivity === 'private').length

  const chartData: ChartData = {
    monthlyTrend,
    completeness,
    reportCategories,
    topOrgs,
    myReportCount: myReports.length,
    avgCompleteness,
    sharedCount,
    sensitiveCount,
  }

  const scoreColor = (score: number) =>
    score >= 90 ? '#3D9E6A' : score >= 60 ? '#A87228' : '#C04040'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '2rem' }}>

      {/* ── 헤더 ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#CDD5E0', margin: 0 }}>대시보드</h1>
          <p style={{ fontSize: '12px', color: '#5A7099', marginTop: '3px' }}>
            {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </div>
        <Link
          href="/sources/new"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'linear-gradient(135deg, #4A7CC0, #0066CC)',
            color: 'white', borderRadius: '8px',
            padding: '8px 14px', fontSize: '13px',
            fontWeight: 600, textDecoration: 'none', flexShrink: 0,
          }}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v12M2 8h12" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
          <span className="db-new-btn-text">새 취재원 등록</span>
        </Link>
      </div>

      {/* ── 통계 바 (한 줄 3개) ── */}
      <div className="db-stats-bar" style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}>
        {[
          { label: '공유 취재원', value: (sharedSourceCount ?? 0).toLocaleString(), unit: '명', color: '#3A90A8', icon: '🌐', href: '/sources' },
          { label: '내 포인트', value: totalPoints.toLocaleString(), unit: 'pt', color: '#C8921A', icon: '⭐', href: null },
          { label: '내 정보보고', value: myReports.length.toLocaleString(), unit: '건', color: '#3D9E6A', icon: '📋', href: '/reports' },
        ].map((stat, i) => (
          <div key={stat.label} style={{
            padding: '18px 20px',
            borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: '14px' }}>{stat.icon}</span>
              <span style={{ fontSize: '11px', color: '#6A8AAA', fontWeight: 500 }}>{stat.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontSize: '26px', fontWeight: 700, color: stat.color, lineHeight: 1 }}>
                {stat.value}
              </span>
              <span style={{ fontSize: '12px', color: '#6A8AAA' }}>{stat.unit}</span>
            </div>
            {stat.href && (
              <Link href={stat.href} style={{ fontSize: '11px', color: '#4A7CC0', textDecoration: 'none', marginTop: 4, display: 'block' }}>
                바로가기 →
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* ── 팔로업 예정 (있을 때만, 최대 4개) ── */}
      {followups.length > 0 && (
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#CDD5E0', margin: 0 }}>📅 팔로업 예정</h2>
              <p style={{ fontSize: '11px', color: '#5A7099', marginTop: 2 }}>7일 이내 연락 예정</p>
            </div>
            <Link href="/sources" style={{ fontSize: '12px', color: '#4A7CC0', textDecoration: 'none' }}>전체 보기 →</Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {followups.slice(0, 4).map((f: FollowupRow) => {
              const due = new Date(f.next_followup_at)
              const now = new Date()
              const isOverdue = due < now
              const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              const dueTxt = isOverdue ? `${Math.abs(diffDays)}일 지남` : diffDays === 0 ? '오늘' : `${diffDays}일 후`
              const dueColor = isOverdue ? '#C04040' : diffDays <= 1 ? '#A87228' : '#3D9E6A'
              return (
                <Link key={f.id} href={f.sources ? `/sources/${f.sources.id}` : '/sources'}
                  style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 14px', borderRadius: 8,
                    background: '#182035',
                    border: `1px solid ${isOverdue ? 'rgba(192,64,64,0.25)' : '#1A2838'}`,
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: `${dueColor}22`, color: dueColor,
                      fontSize: 13, fontWeight: 700,
                    }}>
                      {f.sources?.full_name?.[0] ?? '?'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#CDD5E0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {f.sources?.full_name ?? '—'}
                        {f.sources?.current_organization && (
                          <span style={{ fontSize: 11, color: '#607898', marginLeft: 6, fontWeight: 400 }}>{f.sources.current_organization}</span>
                        )}
                      </p>
                      {f.summary && (
                        <p style={{ fontSize: 11, color: '#8AAAC8', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.summary}</p>
                      )}
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, flexShrink: 0,
                      padding: '3px 9px', borderRadius: 20,
                      background: `${dueColor}18`, color: dueColor,
                    }}>{dueTxt}</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* ── 메인 2컬럼 그리드 ── */}
      <div className="db-2col">

        {/* 최근 등록한 취재원 */}
        <div className="glass-card db-card-mobile" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#CDD5E0', margin: 0 }}>최근 등록한 취재원</h2>
            <Link href="/sources" style={{ fontSize: '12px', color: '#4A7CC0', textDecoration: 'none' }}>전체 보기 →</Link>
          </div>
          {recentSources && recentSources.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recentSources.slice(0, 4).map(source => (
                <Link
                  key={source.id}
                  href={`/sources/${source.id}`}
                  style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, background: '#182035' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(30,144,255,0.12)', color: '#4A7CC0',
                    fontSize: 12, fontWeight: 700,
                  }}>
                    {source.full_name[0]}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#CDD5E0', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {source.full_name}
                    </p>
                    <p style={{ fontSize: 11, color: '#8AAAC8', margin: '1px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {[source.current_organization, source.current_position].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                    <div style={{ width: 32, height: 4, borderRadius: 4, background: '#1A2838' }}>
                      <div style={{ height: '100%', borderRadius: 4, width: `${source.completeness_score}%`, background: scoreColor(source.completeness_score) }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: scoreColor(source.completeness_score), minWidth: 20, textAlign: 'right' }}>
                      {source.completeness_score}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '28px 0', color: '#607898' }}>
              <p style={{ fontSize: 13, margin: '0 0 8px' }}>아직 등록한 취재원이 없습니다</p>
              <Link href="/sources/new" style={{ fontSize: 12, color: '#4A7CC0', textDecoration: 'none' }}>첫 번째 취재원 등록하기 →</Link>
            </div>
          )}
        </div>

        {/* TOP 기여자 */}
        <div className="glass-card db-card-mobile" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#CDD5E0', margin: 0 }}>🏆 TOP 기여자</h2>
            <span style={{ fontSize: '11px', color: '#5A7099' }}>이번 달</span>
          </div>
          {leaderboard && leaderboard.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(leaderboard as any[]).slice(0, 6).map((item: any, idx: number) => {
                const isMe = item.user_id === user.id
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
                return (
                  <div key={item.user_id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 10px', borderRadius: 7,
                    background: isMe ? 'rgba(200,146,26,0.08)' : 'transparent',
                    border: `1px solid ${isMe ? 'rgba(200,146,26,0.2)' : 'transparent'}`,
                  }}>
                    <span style={{ fontSize: 13, minWidth: 20, textAlign: 'center', color: '#607898' }}>{medal || `${idx + 1}`}</span>
                    <span style={{ flex: 1, fontSize: 13, color: isMe ? '#C8921A' : '#CDD5E0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.profiles?.full_name || '—'}
                      {isMe && <span style={{ fontSize: 10, color: '#C8921A', marginLeft: 4 }}>(나)</span>}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#C8921A', flexShrink: 0 }}>{item.total_points}pt</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p style={{ textAlign: 'center', fontSize: 13, color: '#607898', padding: '20px 0' }}>집계 중...</p>
          )}
        </div>
      </div>

      {/* ── 도움 요청 (있을 때만, 3개까지) ── */}
      {openHelp && openHelp.length > 0 && (
        <div className="glass-card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#CDD5E0', margin: 0 }}>🙋 도움이 필요한 동료</h2>
            <Link href="/help" style={{ fontSize: '12px', color: '#4A7CC0', textDecoration: 'none' }}>전체 보기 →</Link>
          </div>
          <div className="db-help-grid">
            {openHelp.slice(0, 3).map((req: any) => (
              <Link key={req.id} href={`/help/${req.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  padding: '12px 14px', borderRadius: 8,
                  background: '#182035', border: '1px solid #1A2838',
                  height: '100%',
                }}>
                  <p style={{ fontSize: 13, fontWeight: 500, color: '#CDD5E0', margin: '0 0 10px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {req.title}
                  </p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: '#607898' }}>
                      {new Date(req.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#C8921A' }}>+{req.reward_points}pt</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── 통계 상세 (접기/펼치기) ── */}
      <DashboardChartsCollapsible data={chartData} />

    </div>
  )
}
