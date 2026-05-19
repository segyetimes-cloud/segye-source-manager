import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = '세계일보 취재원 관리시스템'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0D1520 0%, #131C2C 50%, #0D1520 100%)',
          position: 'relative',
        }}
      >
        {/* 배경 격자 효과 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(30,144,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(30,144,255,0.04) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* 중앙 콘텐츠 */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 24,
            zIndex: 1,
          }}
        >
          {/* 배지 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 20px',
              borderRadius: 999,
              background: 'rgba(30,144,255,0.12)',
              border: '1px solid rgba(30,144,255,0.3)',
            }}
          >
            <span style={{ fontSize: 14, color: '#4A7CC0', letterSpacing: 2 }}>
              SEGYE ILBO
            </span>
          </div>

          {/* 메인 타이틀 */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <span
              style={{
                fontSize: 64,
                fontWeight: 800,
                color: '#CDD5E0',
                letterSpacing: -1,
              }}
            >
              취재원 관리시스템
            </span>
            <span
              style={{
                fontSize: 24,
                color: '#687898',
                letterSpacing: 1,
              }}
            >
              AI 기반 취재원 관리 · 공유 플랫폼
            </span>
          </div>

          {/* 하단 구분선 */}
          <div
            style={{
              width: 80,
              height: 2,
              background: 'linear-gradient(90deg, transparent, #4A7CC0, transparent)',
              marginTop: 8,
            }}
          />
        </div>

        {/* 우하단 워터마크 */}
        <div
          style={{
            position: 'absolute',
            bottom: 32,
            right: 48,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span style={{ fontSize: 14, color: '#263548' }}>세계일보</span>
        </div>
      </div>
    ),
    { ...size }
  )
}
