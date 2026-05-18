import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // 병렬 데이터 조회
  type SourceRow = { id: string; full_name: string; current_organization: string | null; current_position: string | null; created_at: string; completeness_score: number }
  type PointsSummary = { total_points: number }
  type LeaderboardRow = { user_id: string; total_points: number; profiles: { full_name: string; department: string | null } | null }
  type HelpRow = { id: string; title: string; reward_points: number; created_at: string }

  const [
    { count: mySourceCount },
    { count: sharedSourceCount },
    { data: myPointsRaw },
    { data: leaderboardRaw },
    { data: recentSourcesRaw },
    { data: openHelpRaw },
  ] = await Promise.all([
    supabase.from('sources').select('*', { count: 'exact', head: true })
      .eq('owner_id', user.id).eq('is_deleted', false),
    supabase.from('sources').select('*', { count: 'exact', head: true })
      .eq('visibility', 'shared').eq('is_deleted', false),
    supabase.from('user_points_summary').select('*').eq('user_id', user.id).single(),
    supabase.from('user_points_summary')
      .select('user_id, total_points, profiles(full_name, department)')
      .order('total_points', { ascending: false }).limit(10),
    supabase.from('sources').select('id, full_name, current_organization, current_position, created_at, completeness_score')
      .eq('owner_id', user.id).eq('is_deleted', false)
      .order('created_at', { ascending: false }).limit(5),
    supabase.from('help_requests').select('id, title, reward_points, created_at')
      .eq('status', 'open').order('created_at', { ascending: false }).limit(5),
  ])

  const myPoints = myPointsRaw as PointsSummary | null
  const leaderboard = leaderboardRaw as LeaderboardRow[] | null
  const recentSources = recentSourcesRaw as SourceRow[] | null
  const openHelp = openHelpRaw as HelpRow[] | null
  const totalPoints = myPoints?.total_points ?? 0

  const scoreColor = (score: number) =>
    score >= 90 ? '#00CC66' : score >= 60 ? '#FF9900' : '#FF4444'

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#E8F0FE' }}>대시보드</h1>
          <p className="text-sm mt-1" style={{ color: '#8899BB' }}>
            {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
        </div>
        <Link
          href="/sources/new"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
          style={{ background: 'linear-gradient(135deg, #1E90FF, #0066CC)', color: 'white' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 2v12M2 8h12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          새 취재원 등록
        </Link>
      </div>

      {/* 통계 카드 4개 */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: '내 취재원', value: mySourceCount ?? 0, unit: '명', color: '#1E90FF', icon: '👤' },
          { label: '공유 취재원', value: sharedSourceCount ?? 0, unit: '명', color: '#00D4FF', icon: '🌐' },
          { label: '내 포인트', value: totalPoints, unit: 'pt', color: '#FFD700', icon: '⭐' },
          { label: '공개 도움요청', value: openHelp?.length ?? 0, unit: '건', color: '#00CC66', icon: '🙋' },
        ].map(stat => (
          <div key={stat.label} className="glass-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium mb-1" style={{ color: '#8899BB' }}>{stat.label}</p>
                <p className="text-3xl font-bold" style={{ color: stat.color }}>
                  {stat.value.toLocaleString()}
                </p>
                <p className="text-xs mt-1" style={{ color: '#4A6080' }}>{stat.unit}</p>
              </div>
              <span className="text-2xl">{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 메인 콘텐츠 2열 */}
      <div className="grid grid-cols-3 gap-6">

        {/* 최근 등록 취재원 */}
        <div className="col-span-2 glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: '#E8F0FE' }}>최근 등록한 취재원</h2>
            <Link href="/sources" className="text-xs" style={{ color: '#1E90FF' }}>
              전체 보기 →
            </Link>
          </div>

          {recentSources && recentSources.length > 0 ? (
            <div className="space-y-3">
              {recentSources.map(source => (
                <Link
                  key={source.id}
                  href={`/sources/${source.id}`}
                  className="flex items-center gap-4 p-3 rounded-lg transition-colors dashboard-source-link"
                  style={{ background: '#132850' }}>

                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold"
                    style={{ background: 'rgba(30,144,255,0.15)', color: '#1E90FF' }}>
                    {source.full_name[0]}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#E8F0FE' }}>
                      {source.full_name}
                    </p>
                    <p className="text-xs truncate" style={{ color: '#8899BB' }}>
                      {source.current_organization} {source.current_position}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="w-16 h-1.5 rounded-full" style={{ background: '#1A3050' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${source.completeness_score}%`,
                          background: scoreColor(source.completeness_score),
                        }}
                      />
                    </div>
                    <span className="text-xs font-mono w-8 text-right"
                      style={{ color: scoreColor(source.completeness_score) }}>
                      {source.completeness_score}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-8" style={{ color: '#4A6080' }}>
              <p className="text-sm">등록된 취재원이 없습니다</p>
              <Link href="/sources/new" className="text-xs mt-2 block" style={{ color: '#1E90FF' }}>
                첫 번째 취재원을 등록해보세요 →
              </Link>
            </div>
          )}
        </div>

        {/* 우측: 포인트 리더보드 */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: '#E8F0FE' }}>🏆 TOP 기여자</h2>
            <span className="text-xs" style={{ color: '#4A6080' }}>전체 공개</span>
          </div>

          {leaderboard && leaderboard.length > 0 ? (
            <div className="space-y-2">
              {leaderboard.map((item: any, idx) => {
                const isMe = item.user_id === user.id
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
                return (
                  <div
                    key={item.user_id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg"
                    style={{
                      background: isMe ? 'rgba(255,215,0,0.08)' : 'transparent',
                      border: isMe ? '1px solid rgba(255,215,0,0.2)' : '1px solid transparent',
                    }}>
                    <span className="text-sm w-5 text-center" style={{ color: '#4A6080' }}>
                      {medal || `${idx + 1}`}
                    </span>
                    <span className="flex-1 text-sm truncate" style={{ color: isMe ? '#FFD700' : '#E8F0FE' }}>
                      {item.profiles?.full_name || '—'}
                      {isMe && <span className="text-xs ml-1" style={{ color: '#FFD700' }}>(나)</span>}
                    </span>
                    <span className="text-sm font-bold flex-shrink-0" style={{ color: '#FFD700' }}>
                      {item.total_points}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-center text-sm py-4" style={{ color: '#4A6080' }}>
              포인트 집계 중...
            </p>
          )}
        </div>
      </div>

      {/* 도움 요청 미리보기 */}
      {openHelp && openHelp.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: '#E8F0FE' }}>🙋 도움이 필요한 동료</h2>
            <Link href="/help" className="text-xs" style={{ color: '#1E90FF' }}>
              전체 보기 →
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {openHelp.map((req: any) => (
              <Link
                key={req.id}
                href={`/help/${req.id}`}
                className="p-3 rounded-lg transition-colors"
                style={{ background: '#132850', border: '1px solid #1A3050' }}>
                <p className="text-sm font-medium truncate" style={{ color: '#E8F0FE' }}>
                  {req.title}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs" style={{ color: '#8899BB' }}>
                    {new Date(req.created_at).toLocaleDateString('ko-KR')}
                  </span>
                  <span className="text-xs font-bold" style={{ color: '#FFD700' }}>
                    +{req.reward_points}pt
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
