import type { Metadata } from 'next'
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
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full" style={{ background: '#0A1628', color: '#E8F0FE' }}>
        {children}
      </body>
    </html>
  )
}
