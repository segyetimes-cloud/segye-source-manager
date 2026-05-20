import type { Metadata } from 'next'
import { headers } from 'next/headers'
import './globals.css'

export const metadata: Metadata = {
  title: '세계일보 취재원 관리시스템',
  description: 'AI기반 취재원 관리 및 공유 플랫폼',
  robots: { index: false, follow: false },
  openGraph: {
    title: '세계일보 취재원 관리시스템',
    description: 'AI기반 취재원 관리 및 공유 플랫폼',
    siteName: '세계일보',
    locale: 'ko_KR',
    type: 'website',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: '세계일보 취재원 관리시스템' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '세계일보 취재원 관리시스템',
    description: 'AI기반 취재원 관리 및 공유 플랫폼',
    images: ['/og-image.jpg'],
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 미들웨어(proxy.ts)가 x-nonce 헤더로 nonce를 전달 → 서버 컴포넌트에서 읽음
  const headersList = await headers()
  const nonce = headersList.get('x-nonce') ?? ''

  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full" style={{ background: '#0D1520', color: '#CDD5E0' }}>
        {/*
          __webpack_nonce__ 설정 스크립트:
          Next.js가 동적으로 로드하는 청크(chunk) 스크립트에 nonce를 적용하기 위해 필요.
          이 스크립트 자체는 nonce 속성으로 CSP를 통과하고, 'strict-dynamic'에 의해
          이 스크립트가 로드하는 모든 후속 스크립트도 신뢰됩니다.
        */}
        {nonce && (
          <script
            nonce={nonce}
            // eslint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{
              __html: `window.__webpack_nonce__=${JSON.stringify(nonce)}`,
            }}
          />
        )}
        {children}
      </body>
    </html>
  )
}
