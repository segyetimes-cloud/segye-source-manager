'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ReportDeleteButton({ reportId }: { reportId: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm('이 보고서를 삭제하시겠습니까?')) return
    setDeleting(true)
    const res = await fetch(`/api/reports/${reportId}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/reports')
    } else {
      alert('삭제에 실패했습니다.')
      setDeleting(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      style={{
        padding: '9px 20px',
        background: 'rgba(255,68,68,0.1)',
        border: '1px solid rgba(255,68,68,0.3)',
        color: '#FF4444',
        borderRadius: '8px',
        fontSize: '13px',
        cursor: deleting ? 'not-allowed' : 'pointer',
      }}>
      {deleting ? '삭제 중...' : '삭제'}
    </button>
  )
}
