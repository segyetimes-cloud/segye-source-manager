'use client'

import { useEffect, useState } from 'react'

interface PointSummary {
  total_points: number
  my_rank: number
}
interface Transaction {
  id: string
  point_type: string
  points: number
  description: string | null
  created_at: string
}

const TYPE_LABEL: Record<string, string> = {
  source_created:      '취재원 등록/보완',
  usefulness_rating:   '유용성 평가 수신',
  contribution_used:   '평가 참여',
  help_accepted:       '도움 채택 보상',
  help_provided:       '도움 응답',
  penalty_deduct:      '에스크로 차감',
  report_award:        '보고서 포인트',
}

function card(children: React.ReactNode, style?: React.CSSProperties) {
  return (
    <div style={{
      background: '#131C2C',
      border: '1px solid #1A2838',
      borderRadius: '12px',
      padding: '24px',
      ...style,
    }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#8AAAC8', marginBottom: '16px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
      {children}
    </h2>
  )
}

function Row({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(26,40,56,0.7)' }}>
      <div>
        <span style={{ fontSize: '13px', color: '#CDD5E0' }}>{label}</span>
        {sub && <span style={{ fontSize: '11px', color: '#607898', marginLeft: '8px' }}>{sub}</span>}
      </div>
      <span style={{ fontSize: '13px', fontWeight: 600, color: accent ?? '#4A9EFF' }}>{value}</span>
    </div>
  )
}

function Tip({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid rgba(26,40,56,0.7)' }}>
      <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>{icon}</span>
      <p style={{ fontSize: '13px', color: '#CDD5E0', lineHeight: 1.6, margin: 0 }}>{children}</p>
    </div>
  )
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return '방금'
  if (mins < 60) return `${mins}분 전`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}시간 전`
  return `${Math.floor(hrs / 24)}일 전`
}

export default function PointsGuidePage() {
  const [summary, setSummary] = useState<PointSummary | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/points').then(r => r.json()).then(d => {
      setSummary(d.summary ?? null)
      setTransactions(d.transactions ?? [])
    }).finally(() => setLoading(false))
  }, [])

  return (
    <div style={{ maxWidth: '780px', margin: '0 auto', padding: '32px 20px' }}>

      {/* 헤더 */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#CDD5E0', margin: 0 }}>내 점수 안내</h1>
        <p style={{ fontSize: '13px', color: '#607898', marginTop: '6px' }}>포인트 적립 방법과 현황을 확인하세요</p>
      </div>

      {/* ── 내 점수 현황 ── */}
      {card(
        <>
          <SectionTitle>내 점수 현황</SectionTitle>
          {loading ? (
            <p style={{ fontSize: '13px', color: '#485870', textAlign: 'center', padding: '16px 0' }}>불러오는 중…</p>
          ) : summary ? (
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '120px', background: 'rgba(74,158,255,0.07)', border: '1px solid rgba(74,158,255,0.2)', borderRadius: '10px', padding: '20px', textAlign: 'center' }}>
                <p style={{ fontSize: '32px', fontWeight: 700, color: '#4A9EFF', margin: 0 }}>{summary.total_points.toLocaleString()}</p>
                <p style={{ fontSize: '12px', color: '#607898', marginTop: '4px' }}>누적 포인트</p>
              </div>
              <div style={{ flex: 1, minWidth: '120px', background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: '10px', padding: '20px', textAlign: 'center' }}>
                <p style={{ fontSize: '32px', fontWeight: 700, color: '#00D4FF', margin: 0 }}>{summary.my_rank ?? '-'}</p>
                <p style={{ fontSize: '12px', color: '#607898', marginTop: '4px' }}>현재 순위</p>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '13px', color: '#485870' }}>데이터를 불러올 수 없습니다.</p>
          )}
        </>
      , { marginBottom: '16px' })}

      {/* ── 포인트 적립 방법 ── */}
      {card(
        <>
          <SectionTitle>포인트 적립 방법</SectionTitle>

          <p style={{ fontSize: '12px', color: '#607898', marginBottom: '12px' }}>취재원 등록</p>
          <Row label="완성도 55점 이상으로 등록" value="+30 pt" sub="전화·이메일·소속·직책 모두 입력 시" />
          <Row label="완성도 35점 이상으로 등록" value="+15 pt" sub="기본 정보 + 연락처 중 하나" />
          <Row label="기본 등록 (35점 미만)" value="+5 pt" />

          <p style={{ fontSize: '12px', color: '#607898', marginTop: '16px', marginBottom: '12px' }}>정보 보완 (기존 취재원 수정)</p>
          <Row label="전화번호 추가" value="+4 pt" />
          <Row label="소속기관 추가" value="+2.5 pt" />
          <Row label="이메일 추가" value="+2 pt" />
          <Row label="대학교 추가" value="+2.5 pt" />
          <Row label="고등학교 추가" value="+2 pt" />
          <Row label="이름·직책 추가" value="+1.5 pt 각" />
          <Row label="기타 필드(생년월일·전공 등)" value="+0.5~1 pt" />

          <p style={{ fontSize: '12px', color: '#607898', marginTop: '16px', marginBottom: '12px' }}>평가 & 도움</p>
          <Row label="내 취재원이 4점 이상 평가받기" value="+3 pt" />
          <Row label="다른 취재원에 유용성 평가 남기기" value="+1 pt" />
          <Row label="도움 요청 — 내 응답이 채택될 때" value="리워드 pt" sub="요청자가 지정한 포인트 전액" />

          <p style={{ fontSize: '12px', color: '#607898', marginTop: '16px', marginBottom: '12px' }}>특별 포인트</p>
          <Row label="보고서 기여 인정 (부장 이상 지급)" value="1~1,000 pt" accent="#FFD700" />
          <Row label="관리자 수동 보너스" value="1~500 pt" accent="#FFD700" />
        </>
      , { marginBottom: '16px' })}

      {/* ── 완성도 점수 계산표 ── */}
      {card(
        <>
          <SectionTitle>완성도 점수 계산표</SectionTitle>
          <p style={{ fontSize: '12px', color: '#607898', marginBottom: '12px' }}>취재원 1명당 최대 60점 (별도: 정보 작성 시 +20~40점)</p>

          <p style={{ fontSize: '11px', color: '#485870', fontWeight: 600, marginBottom: '6px' }}>기본 정보 (최대 20점)</p>
          <Row label="이름" value="5점" accent="#CDD5E0" />
          <Row label="소속기관" value="8점" accent="#CDD5E0" />
          <Row label="직책" value="5점" accent="#CDD5E0" />
          <Row label="생년월일" value="2점" accent="#CDD5E0" />

          <p style={{ fontSize: '11px', color: '#485870', fontWeight: 600, marginTop: '12px', marginBottom: '6px' }}>연락처 (최대 20점)</p>
          <Row label="전화번호" value="13점" accent="#CDD5E0" />
          <Row label="이메일" value="7점" accent="#CDD5E0" />

          <p style={{ fontSize: '11px', color: '#485870', fontWeight: 600, marginTop: '12px', marginBottom: '6px' }}>학력 (최대 20점)</p>
          <Row label="대학교" value="8점" accent="#CDD5E0" />
          <Row label="고등학교" value="6점" accent="#CDD5E0" />
          <Row label="전공" value="3점" accent="#CDD5E0" />
          <Row label="대학원" value="2점" accent="#CDD5E0" />
          <Row label="고시기수" value="1점" accent="#CDD5E0" />

          <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(74,158,255,0.06)', borderRadius: '8px', border: '1px solid rgba(74,158,255,0.15)' }}>
            <p style={{ fontSize: '12px', color: '#8AAAC8', margin: 0, lineHeight: 1.6 }}>
              💡 <strong>팁:</strong> 전화번호(13점)와 소속기관(8점)이 가장 비중이 큽니다.
              이 두 가지만 추가해도 완성도 35점을 넘겨 <span style={{ color: '#4A9EFF' }}>+15pt</span>를 받을 수 있습니다.
            </p>
          </div>
        </>
      , { marginBottom: '16px' })}

      {/* ── 포인트 잘 모으는 방법 ── */}
      {card(
        <>
          <SectionTitle>포인트 잘 모으는 방법</SectionTitle>
          <Tip icon="📱">
            <strong>전화번호를 꼭 입력하세요.</strong> 전화번호 하나가 완성도 13점 = 전체의 21%입니다.
            전화번호 + 소속 + 이름만 입력해도 완성도 26점, 이메일까지 추가하면 33점이 됩니다.
          </Tip>
          <Tip icon="🏆">
            <strong>완성도 55점을 목표로 하세요.</strong> 55점 이상이면 등록 즉시 30pt를 받습니다.
            이름·소속·직책·전화·이메일·대학교를 모두 입력하면 46점 → 고교까지 추가하면 52점 → 생년월일 포함 54점.
          </Tip>
          <Tip icon="✏️">
            <strong>이미 있는 취재원도 채워주세요.</strong> 빈 칸을 채울 때마다 증분 포인트가 쌓입니다.
            취재원 목록에서 전화번호 없는 분을 찾아 추가하는 것만으로도 매번 +4pt.
          </Tip>
          <Tip icon="⭐">
            <strong>평가를 꼭 남기세요.</strong> 다른 기자의 취재원을 사용한 후 유용성 평가를 남기면 +1pt,
            평가받은 기자는 +3pt. 서로에게 이득입니다.
          </Tip>
          <Tip icon="💬">
            <strong>도움 요청에 응해보세요.</strong> 내 응답이 채택되면 요청자가 건 리워드 포인트를 전부 받습니다.
            도움 요청 게시판을 자주 확인하세요.
          </Tip>
          <Tip icon="📋">
            <strong>보고서를 열심히 작성하세요.</strong> 부장 이상이 내 보고서에 최대 1,000pt를 지급할 수 있습니다.
            품질 좋은 정보 보고를 꾸준히 올리면 큰 보상이 됩니다.
          </Tip>
        </>
      , { marginBottom: '16px' })}

      {/* ── 최근 적립 내역 ── */}
      {card(
        <>
          <SectionTitle>최근 적립 내역</SectionTitle>
          {loading ? (
            <p style={{ fontSize: '13px', color: '#485870', textAlign: 'center', padding: '16px 0' }}>불러오는 중…</p>
          ) : transactions.length === 0 ? (
            <p style={{ fontSize: '13px', color: '#485870', textAlign: 'center', padding: '16px 0' }}>아직 적립 내역이 없습니다</p>
          ) : (
            transactions.slice(0, 15).map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(26,40,56,0.7)' }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: '13px', color: '#CDD5E0', margin: 0, lineHeight: 1.4 }}>
                    {t.description ?? TYPE_LABEL[t.point_type] ?? t.point_type}
                  </p>
                  <p style={{ fontSize: '11px', color: '#485870', margin: '2px 0 0' }}>{timeAgo(t.created_at)}</p>
                </div>
                <span style={{
                  fontSize: '13px', fontWeight: 700, flexShrink: 0, marginLeft: '12px',
                  color: t.points >= 0 ? '#4A9EFF' : '#C04040',
                }}>
                  {t.points >= 0 ? '+' : ''}{t.points} pt
                </span>
              </div>
            ))
          )}
        </>
      )}
    </div>
  )
}
