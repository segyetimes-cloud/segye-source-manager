import Link from 'next/link'

/**
 * (app) 라우트 그룹 404 페이지
 * page.tsx에서 notFound()를 호출하거나 존재하지 않는 경로 접근 시 표시됩니다.
 */
export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '48px', lineHeight: 1 }}>🔍</div>

      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#CDD5E0', margin: '0 0 8px' }}>
          페이지를 찾을 수 없습니다
        </h2>
        <p style={{ fontSize: '13px', color: '#5A7099', margin: 0 }}>
          요청하신 페이지가 존재하지 않거나 접근 권한이 없습니다.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link
          href="/sources"
          style={{
            background: 'linear-gradient(135deg, #4A7CC0, #0066CC)',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            padding: '9px 20px',
            fontSize: '13px',
            fontWeight: 600,
            textDecoration: 'none',
            cursor: 'pointer',
          }}
        >
          취재원 목록으로
        </Link>
        <Link
          href="/dashboard"
          style={{
            background: '#182035',
            border: '1px solid #1A2838',
            color: '#8AAAC8',
            borderRadius: '8px',
            padding: '9px 20px',
            fontSize: '13px',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          대시보드로 이동
        </Link>
      </div>
    </div>
  )
}
