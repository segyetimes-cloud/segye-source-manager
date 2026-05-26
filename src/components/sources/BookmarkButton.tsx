'use client'

import { useState, useTransition } from 'react'

interface Props {
  sourceId: string
  initialBookmarked: boolean
}

export default function BookmarkButton({ sourceId, initialBookmarked }: Props) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked)
  const [isPending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => {
      try {
        if (bookmarked) {
          await fetch(`/api/bookmarks?source_id=${sourceId}`, { method: 'DELETE' })
          setBookmarked(false)
        } else {
          await fetch('/api/bookmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_id: sourceId }),
          })
          setBookmarked(true)
        }
      } catch {
        // 실패해도 UI는 원래 상태 유지
      }
    })
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      title={bookmarked ? '즐겨찾기 해제' : '즐겨찾기 추가'}
      style={{
        background: bookmarked ? 'rgba(168,114,40,0.15)' : 'rgba(26,40,56,0.8)',
        border: `1px solid ${bookmarked ? 'rgba(168,114,40,0.4)' : '#1A2838'}`,
        color: bookmarked ? '#A87228' : '#8AAAC8',
        borderRadius: 8,
        padding: '7px 14px',
        fontSize: 13,
        cursor: isPending ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        fontWeight: bookmarked ? 600 : 400,
        transition: 'all 0.15s',
        whiteSpace: 'nowrap',
      }}>
      {isPending ? '...' : bookmarked ? '★ 즐겨찾기' : '☆ 즐겨찾기'}
    </button>
  )
}
