'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  link_path: string | null
  is_read: boolean
  created_at: string
}

const TYPE_ICONS: Record<string, string> = {
  approval_result: '✅',
  report_shared: '📋',
  help_accepted: '🏆',
  system: '🔔',
}

export default function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    const res = await fetch('/api/notifications')
    if (res.ok) {
      const data = await res.json()
      setUnread(data.unread ?? 0)
      setNotifications(data.notifications ?? [])
    }
  }, [])

  // Realtime 구독
  useEffect(() => {
    fetchNotifications()

    const supabase = createClient()
    // createBrowserClient는 싱글톤 — 동일 이름 채널이 남아있으면 subscribe 후 .on() 재호출 불가
    // 매번 고유한 채널명을 사용해 충돌 방지
    const channelName = `notifications_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        () => { fetchNotifications() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [fetchNotifications])

  // 패널 외부 클릭 시 닫기
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  async function handleOpen() {
    setOpen(prev => !prev)
    if (!open && unread > 0) {
      // 전체 읽음 처리
      await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      setUnread(0)
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    }
  }

  async function handleClick(n: Notification) {
    setOpen(false)
    if (n.link_path) router.push(n.link_path)
  }

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return '방금'
    if (mins < 60) return `${mins}분 전`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}시간 전`
    return `${Math.floor(hrs / 24)}일 전`
  }

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      {/* 벨 버튼 */}
      <button
        type="button"
        onClick={handleOpen}
        style={{
          position: 'relative', background: 'none', border: 'none',
          cursor: 'pointer', fontSize: '20px', padding: '4px 6px',
          lineHeight: 1, color: '#8AAAC8',
        }}
        title="알림"
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: '0px', right: '0px',
            background: '#C04040', color: '#fff',
            fontSize: '9px', fontWeight: 700,
            borderRadius: '8px', padding: '1px 4px',
            minWidth: '14px', textAlign: 'center',
            lineHeight: '14px',
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {/* 드롭다운 패널 */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          width: '320px', maxHeight: '420px',
          background: '#131C2C', border: '1px solid #1A2838',
          borderRadius: '10px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          overflow: 'hidden', zIndex: 1000,
        }}>
          {/* 헤더 */}
          <div style={{
            padding: '12px 16px 10px',
            borderBottom: '1px solid #1A2838',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#DCE8F4' }}>알림</span>
            {notifications.some(n => !n.is_read) && (
              <button
                type="button"
                onClick={async () => {
                  await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
                  setUnread(0)
                  setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
                }}
                style={{ fontSize: '11px', color: '#4A7CC0', background: 'none', border: 'none', cursor: 'pointer' }}>
                모두 읽음
              </button>
            )}
          </div>

          {/* 목록 */}
          <div style={{ overflowY: 'auto', maxHeight: '360px' }}>
            {loading ? (
              <p style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: '#607898' }}>불러오는 중…</p>
            ) : notifications.length === 0 ? (
              <p style={{ padding: '32px 16px', textAlign: 'center', fontSize: '13px', color: '#607898' }}>
                알림이 없습니다
              </p>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(26,40,56,0.8)',
                    cursor: n.link_path ? 'pointer' : 'default',
                    background: n.is_read ? 'transparent' : 'rgba(74,124,192,0.06)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (n.link_path) (e.currentTarget as HTMLElement).style.background = 'rgba(74,124,192,0.1)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = n.is_read ? 'transparent' : 'rgba(74,124,192,0.06)' }}
                >
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>
                      {TYPE_ICONS[n.type] ?? '🔔'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', color: '#DCE8F4', fontWeight: n.is_read ? 400 : 600, margin: 0, lineHeight: 1.4 }}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p style={{ fontSize: '12px', color: '#607898', margin: '2px 0 0', lineHeight: 1.4 }}>
                          {n.body}
                        </p>
                      )}
                      <p style={{ fontSize: '11px', color: '#384860', marginTop: '4px' }}>
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                    {!n.is_read && (
                      <div style={{
                        width: '6px', height: '6px', borderRadius: '50%',
                        background: '#4A7CC0', flexShrink: 0, marginTop: '5px',
                      }} />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
