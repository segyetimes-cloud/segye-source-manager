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
          <p className="text-sm mt-1" style={{ color: '#8AAAC8' }}>
            명함 사진을 여러 장 찍거나 선택한 뒤 한꺼번에 분석해 취재원을 등록합니다
          </p>
        </div>
        <a href="/sources/new"
          style={{
            flexShrink: 0, padding: '8px 14px', borderRadius: '8px',
            fontSize: '13px', fontWeight: 500, textDecoration: 'none',
            background: '#182035', color: '#8AAAC8', border: '1px solid #1A2838',
          }}>
          ✏️ 직접 입력
        </a>
      </div>

      {/* 배치 스캐너 */}
      <BusinessCardBatchScanner />

    </div>
  )
}
