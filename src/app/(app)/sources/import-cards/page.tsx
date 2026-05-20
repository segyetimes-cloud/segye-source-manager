/**
 * /sources/import-cards
 * 명함 사진 여러 장 → 일괄 OCR → 취재원 일괄 등록
 */

import BusinessCardBatchScanner from '@/components/sources/BusinessCardBatchScanner'

export default function ImportCardsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-5">

      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#CDD5E0' }}>
            📇 명함 일괄 등록
          </h1>
          <p className="text-sm mt-1" style={{ color: '#687898' }}>
            명함 사진을 여러 장 찍거나 선택한 뒤 한꺼번에 분석해 취재원을 등록합니다
          </p>
        </div>
        <a href="/sources/new"
          style={{
            flexShrink: 0, padding: '8px 14px', borderRadius: '8px',
            fontSize: '13px', fontWeight: 500, textDecoration: 'none',
            background: '#182035', color: '#687898', border: '1px solid #1A2838',
          }}>
          ✏️ 직접 입력
        </a>
      </div>

      {/* 안내 배너 */}
      <div style={{
        padding: '12px 16px', borderRadius: '10px',
        background: 'rgba(30,144,255,0.04)', border: '1px solid rgba(30,144,255,0.15)',
        display: 'flex', flexWrap: 'wrap', gap: '20px',
      }}>
        {[
          { icon: '📷', title: '촬영',  desc: '카메라로 명함을 한 장씩 연속 촬영' },
          { icon: '🖼️', title: '선택',  desc: '갤러리에서 여러 장을 한꺼번에 선택' },
          { icon: '🔍', title: '분석',  desc: 'AI가 이름·소속·전화번호 자동 추출' },
          { icon: '✅', title: '확인',  desc: '내용 수정 후 한꺼번에 등록' },
        ].map(step => (
          <div key={step.title} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>{step.icon}</span>
            <div>
              <p style={{ fontSize: '12px', fontWeight: 700, color: '#CDD5E0', margin: 0 }}>{step.title}</p>
              <p style={{ fontSize: '11px', color: '#485870', margin: 0 }}>{step.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* 배치 스캐너 */}
      <BusinessCardBatchScanner />

    </div>
  )
}
