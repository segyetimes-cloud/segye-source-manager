'use client'

import { useState } from 'react'
import ExcelImporter from '@/components/sources/ExcelImporter'
import TextPasteImporter from '@/components/sources/TextPasteImporter'

export default function ImportPage() {
  const [tab, setTab] = useState<'excel' | 'paste'>('paste')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#CDD5E0' }}>📥 취재원 가져오기</h1>
        <p className="text-sm mt-1" style={{ color: '#8AAAC8' }}>
          엑셀 파일 또는 탭 구분 텍스트를 붙여넣어 여러 명을 한 번에 등록합니다
        </p>
      </div>

      {/* 탭 */}
      <div
        className="flex gap-1 p-1 rounded-xl"
        style={{ background: '#131C2C', border: '1px solid #1A2838' }}
      >
        {(
          [
            ['paste', '📋 텍스트 붙여넣기'],
            ['excel', '📊 엑셀 파일'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: tab === key ? '#1E2C40' : 'transparent',
              color: tab === key ? '#CDD5E0' : '#607898',
              border: tab === key ? '1px solid #263548' : '1px solid transparent',
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'paste' ? <TextPasteImporter /> : <ExcelImporter />}
    </div>
  )
}
