/**
 * sources/[id] 상세 페이지 로딩 상태
 *
 * Next.js 16 — client navigation 시 서버 렌더링 완료 전까지 이 컴포넌트가 표시됩니다.
 * (app)/layout.tsx 에 Suspense 없이 await 가 많은 page.tsx 를 사용할 경우
 * "이전 페이지가 유지되는" 현상을 방지합니다.
 */
export default function SourceDetailLoading() {
  return (
    <div className="max-w-4xl mx-auto space-y-6" style={{ animation: 'pulse 1.5s ease-in-out infinite' }}>
      {/* 헤더 스켈레톤 */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div style={{ width: 64, height: 64, borderRadius: 12, background: '#1A2838' }} />
          <div className="space-y-2">
            <div style={{ width: 160, height: 24, borderRadius: 6, background: '#1A2838' }} />
            <div style={{ width: 220, height: 16, borderRadius: 6, background: '#1A2838' }} />
            <div className="flex gap-2">
              <div style={{ width: 80, height: 20, borderRadius: 99, background: '#1A2838' }} />
              <div style={{ width: 60, height: 20, borderRadius: 99, background: '#1A2838' }} />
              <div style={{ width: 100, height: 20, borderRadius: 99, background: '#1A2838' }} />
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <div style={{ width: 60, height: 32, borderRadius: 8, background: '#1A2838' }} />
          <div style={{ width: 50, height: 32, borderRadius: 8, background: '#1A2838' }} />
        </div>
      </div>

      {/* 기본 정보 카드 스켈레톤 */}
      <div className="glass-card p-5">
        <div style={{ width: 120, height: 16, borderRadius: 6, background: '#1A2838', marginBottom: 16 }} />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="flex flex-col gap-1">
              <div style={{ width: 60, height: 12, borderRadius: 4, background: '#1A2838' }} />
              <div style={{ width: 140, height: 16, borderRadius: 4, background: '#1A2838' }} />
            </div>
          ))}
        </div>
      </div>

      {/* 직책 이력 스켈레톤 */}
      <div className="glass-card p-5">
        <div style={{ width: 100, height: 16, borderRadius: 6, background: '#1A2838', marginBottom: 16 }} />
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} style={{ height: 56, borderRadius: 8, background: '#1A2838' }} />
          ))}
        </div>
      </div>

      {/* 정보 카드 스켈레톤 */}
      <div className="glass-card p-5">
        <div style={{ width: 80, height: 16, borderRadius: 6, background: '#1A2838', marginBottom: 16 }} />
        <div style={{ height: 80, borderRadius: 8, background: '#1A2838' }} />
      </div>
    </div>
  )
}
