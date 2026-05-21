'use client'

import { useState } from 'react'

interface UserProfile {
  id: string
  email: string
  full_name: string
  role: 'superadmin' | 'publisher' | 'editor' | 'section_editor' | 'admin' | 'deputy' | 'reporter'
  department: string | null
  desk_name: string | null
  employee_id: string | null
  phone: string | null
  rank: string | null
  is_active: boolean
  last_login_at: string | null
  created_at: string
}

const RANK_OPTIONS = ['기자', '차장', '부장', '부국장', '편집국장', '편집인'] as const
type ReporterRank = typeof RANK_OPTIONS[number]

const RANK_COLOR: Record<string, string> = {
  '기자': '#687898',
  '차장': '#3A90A8',
  '부장': '#3A90A8',
  '부국장': '#FFB800',
  '편집국장': '#FFB800',
  '편집인': '#FF6B35',
}

interface Props {
  users: UserProfile[]
  currentUserId: string
  isSuperadmin: boolean
  isAdmin: boolean
}

interface CreateForm {
  email: string
  password: string
  full_name: string
  role: string
  department: string
  desk_name: string
  employee_id: string
  phone: string
}

const ROLE_LABEL: Record<string, { label: string; className: string }> = {
  superadmin:     { label: '슈퍼관리자', className: 'role-superadmin' },
  publisher:      { label: '편집인',     className: 'role-superadmin' },
  editor:         { label: '국장',       className: 'role-superadmin' },
  section_editor: { label: '부국장',     className: 'role-admin' },
  admin:          { label: '부장',       className: 'role-admin' },
  deputy:         { label: '차장',       className: 'role-deputy' },
  reporter:       { label: '기자',       className: 'role-reporter' },
}

const EMPTY_FORM: CreateForm = {
  email: '', password: '', full_name: '', role: 'reporter',
  department: '', desk_name: '', employee_id: '', phone: '',
}

type Tab = 'active' | 'pending'

export default function UsersClient({ users: initialUsers, currentUserId, isSuperadmin, isAdmin }: Props) {
  const [users, setUsers]           = useState(initialUsers)
  const [processing, setProcessing] = useState<string | null>(null)
  const [search, setSearch]         = useState('')
  const [tab, setTab]               = useState<Tab>('active')

  // 역할 편집
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editRole, setEditRole]       = useState<string>('')
  const [hoveringRole, setHoveringRole] = useState<string | null>(null)

  // 직급 편집
  const [editingRankUser, setEditingRankUser] = useState<string | null>(null)
  const [editRank, setEditRank] = useState<string>('')

  // 승인 인라인 상태 (pending 탭)
  const [approveRoles, setApproveRoles] = useState<Record<string, string>>({})

  // 계정 생성 모달
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm]         = useState<CreateForm>(EMPTY_FORM)
  const [createLoading, setCreateLoading]   = useState(false)
  const [createError, setCreateError]       = useState<string | null>(null)
  const [createSuccess, setCreateSuccess]   = useState(false)
  const [showPassword, setShowPassword]     = useState(false)

  const activeUsers  = users.filter(u => u.is_active)
  const pendingUsers = users.filter(u => !u.is_active)

  const filterUsers = (list: UserProfile[]) =>
    list.filter(u =>
      u.full_name.includes(search) ||
      u.email.includes(search) ||
      (u.department ?? '').includes(search)
    )

  const filteredActive  = filterUsers(activeUsers)
  const filteredPending = filterUsers(pendingUsers)

  async function toggleActive(userId: string, currentActive: boolean) {
    if (userId === currentUserId) {
      alert('본인 계정은 비활성화할 수 없습니다')
      return
    }
    if (!confirm(`이 계정을 ${currentActive ? '비활성화' : '활성화'}하시겠습니까?`)) return
    setProcessing(userId)
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: userId, is_active: !currentActive }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: !currentActive } : u))
    }
    setProcessing(null)
  }

  async function changeRank(userId: string, newRank: string) {
    setProcessing(userId + '_rank')
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: userId, rank: newRank || null }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, rank: newRank || null } : u))
    } else {
      const data = await res.json()
      alert(data.error ?? '직급 변경 실패')
    }
    setEditingRankUser(null)
    setProcessing(null)
  }

  async function changeRole(userId: string, newRole: string) {
    setProcessing(userId)
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: userId, role: newRole }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole as UserProfile['role'] } : u))
    } else {
      const data = await res.json()
      alert(data.error ?? '역할 변경 실패')
    }
    setEditingUser(null)
    setProcessing(null)
  }

  async function approveUser(userId: string) {
    const role = approveRoles[userId] ?? 'reporter'
    if (!confirm(`"${users.find(u => u.id === userId)?.full_name}" 님을 [${ROLE_LABEL[role]?.label ?? role}]로 승인하시겠습니까?`)) return
    setProcessing(userId + '_approve')
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: userId, action: 'approve', role }),
    })
    if (res.ok) {
      // 승인 → is_active=true + role 업데이트
      setUsers(prev => prev.map(u =>
        u.id === userId ? { ...u, is_active: true, role: role as UserProfile['role'] } : u
      ))
    } else {
      const data = await res.json()
      alert(data.error ?? '승인 실패')
    }
    setProcessing(null)
  }

  async function rejectUser(userId: string) {
    if (!confirm('이 가입 신청을 거절하고 계정을 삭제하시겠습니까?')) return
    setProcessing(userId + '_reject')
    // 비활성 상태 유지 (is_active=false) — 완전 삭제는 service role 필요하므로 일단 비활성 표시
    // 실제로는 is_active=false 상태를 유지하며 관리자가 나중에 정리
    alert('거절 처리되었습니다. 계정은 비활성 상태로 유지됩니다.')
    setProcessing(null)
  }

  async function activateUser(userId: string) {
    const target = users.find(u => u.id === userId)
    if (!confirm(`"${target?.full_name}" 님을 승인하시겠습니까?\n승인 즉시 비밀번호 설정 링크가 이메일로 발송됩니다.`)) return
    setProcessing(userId + '_activate')
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: userId, action: 'activate' }),
    })
    if (res.ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active: true } : u))
      alert(`승인 완료\n${target?.email ?? ''} 으로 비밀번호 설정 링크가 발송되었습니다.\n링크를 클릭해 비밀번호를 설정하면 로그인할 수 있습니다.`)
    } else {
      const data = await res.json()
      alert(data.error ?? '승인 처리 실패')
    }
    setProcessing(null)
  }

  async function sendResetEmail(userId: string) {
    if (!confirm('비밀번호 재설정 이메일을 발송하시겠습니까?')) return
    setProcessing(userId + '_reset')
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target_user_id: userId, send_reset_email: true }),
    })
    if (res.ok) {
      alert('재설정 이메일이 발송되었습니다')
    } else {
      const data = await res.json()
      alert(data.error ?? '발송 실패')
    }
    setProcessing(null)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(null)
    setCreateLoading(true)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email:       createForm.email,
        password:    createForm.password,
        full_name:   createForm.full_name,
        role:        createForm.role || 'reporter',
        department:  createForm.department  || null,
        desk_name:   createForm.desk_name   || null,
        employee_id: createForm.employee_id || null,
        phone:       createForm.phone       || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setCreateError(data.error ?? '계정 생성에 실패했습니다')
      setCreateLoading(false)
      return
    }
    setUsers(prev => [data as UserProfile, ...prev])
    setCreateSuccess(true)
    setCreateForm(EMPTY_FORM)
    setCreateLoading(false)
  }

  function closeModal() {
    setShowCreateForm(false)
    setCreateForm(EMPTY_FORM)
    setCreateError(null)
    setCreateSuccess(false)
    setShowPassword(false)
  }

  const stats = {
    total:    activeUsers.length,
    pending:  pendingUsers.length,
    deputies: activeUsers.filter(u => u.role === 'deputy').length,
    reporters: activeUsers.filter(u => u.role === 'reporter').length,
    admins:   activeUsers.filter(u => u.role === 'admin').length,
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', background: '#0D1520', border: '1px solid #1A2838',
    color: '#CDD5E0', borderRadius: '8px', padding: '9px 12px',
    fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', color: '#687898', marginBottom: '4px',
  }

  return (
    <div className="space-y-6">
      {/* 통계 + 새 계정 버튼 */}
      <div className="flex items-center justify-between gap-4">
        <div className="grid grid-cols-5 gap-3 flex-1">
          {[
            { label: '활성',    value: stats.total,     color: '#3D9E6A' },
            { label: '가입대기', value: stats.pending,   color: '#A87228' },
            { label: '기자',    value: stats.reporters,  color: '#4A7CC0' },
            { label: '차장',    value: stats.deputies,   color: '#3A90A8' },
            { label: '데스크',  value: stats.admins,     color: '#7E6E48' },
          ].map(s => (
            <div key={s.label} className="glass-card p-3 text-center">
              <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs mt-0.5" style={{ color: '#485870' }}>{s.label}</div>
            </div>
          ))}
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          style={{
            background: 'rgba(30,144,255,0.15)', border: '1px solid rgba(30,144,255,0.4)',
            color: '#4A7CC0', borderRadius: '8px', padding: '10px 18px',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
          }}>
          + 새 계정 생성
        </button>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#0D1520', border: '1px solid #1A2838' }}>
        {([
          { key: 'active',  label: `활성 계정 (${activeUsers.length})` },
          { key: 'pending', label: `가입 대기 (${pendingUsers.length})`, badge: pendingUsers.length > 0 },
        ] as { key: Tab; label: string; badge?: boolean }[]).map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: '8px 14px', borderRadius: '9px', fontSize: '13px', fontWeight: 600,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
              background: tab === t.key ? '#182035' : 'transparent',
              color: tab === t.key ? '#CDD5E0' : '#485870',
              outline: tab === t.key ? '1px solid #1A2838' : 'none',
            }}>
            {t.label}
            {t.badge && (
              <span style={{
                marginLeft: '6px', background: '#A87228', color: 'white',
                borderRadius: '999px', padding: '1px 6px', fontSize: '11px',
              }}>
                {pendingUsers.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 검색 */}
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="이름, 이메일, 부서로 검색..."
        style={{
          width: '100%', background: '#131C2C', border: '1px solid #1A2838',
          color: '#CDD5E0', borderRadius: '8px', padding: '10px 14px',
          fontSize: '14px', outline: 'none',
        }}
      />

      {/* ── 활성 계정 탭 ── */}
      {tab === 'active' && (
        <div className="space-y-1">
          {filteredActive.map(u => (
            <div key={u.id} className="glass-card"
              style={{
                padding: '7px 12px',
                border: u.id === currentUserId ? '1px solid rgba(30,144,255,0.3)' : '1px solid #1A2838',
              }}>
              <div className="flex items-center justify-between gap-3">
                {/* 아바타 */}
                <div className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'rgba(30,144,255,0.15)', color: '#4A7CC0', border: '1px solid rgba(30,144,255,0.2)' }}>
                  {u.full_name[0]}
                </div>

                {/* 이름 + 배지들 + 이메일 — 한 줄 */}
                <div className="flex items-center gap-2 flex-1 min-w-0 flex-wrap">
                  <span className="text-sm font-semibold flex-shrink-0" style={{ color: '#CDD5E0' }}>{u.full_name}</span>
                  {u.id === currentUserId && (
                    <span className="text-xs px-1.5 rounded flex-shrink-0" style={{ background: 'rgba(30,144,255,0.1)', color: '#4A7CC0' }}>나</span>
                  )}

                  {/* 역할 배지 */}
                  {editingUser === u.id ? (
                    <select
                      value={editRole} autoFocus disabled={processing === u.id}
                      onChange={e => { setEditRole(e.target.value); changeRole(u.id, e.target.value) }}
                      onBlur={() => { if (processing !== u.id) setEditingUser(null) }}
                      style={{
                        background: '#182035', border: '1px solid #4A7CC0',
                        color: '#CDD5E0', borderRadius: '6px', padding: '1px 6px',
                        fontSize: '11px', cursor: 'pointer', fontWeight: 600,
                        opacity: processing === u.id ? 0.5 : 1,
                      }}>
                      <option value="reporter">기자</option>
                      <option value="deputy">차장</option>
                      <option value="admin">부장</option>
                      {isSuperadmin && <option value="section_editor">부국장</option>}
                      {isSuperadmin && <option value="editor">국장</option>}
                      {isSuperadmin && <option value="publisher">편집인</option>}
                      {isSuperadmin && <option value="superadmin">슈퍼관리자</option>}
                    </select>
                  ) : (
                    (() => {
                      const canEdit = u.id !== currentUserId && (isSuperadmin || isAdmin)
                      const isHovering = hoveringRole === u.id
                      return (
                        <button
                          onClick={() => { if (canEdit) { setEditingUser(u.id); setEditRole(u.role) } }}
                          onMouseEnter={() => canEdit && setHoveringRole(u.id)}
                          onMouseLeave={() => setHoveringRole(null)}
                          title={canEdit ? '클릭하여 역할 변경' : ''}
                          className={`text-xs px-1.5 rounded flex-shrink-0 ${ROLE_LABEL[u.role]?.className ?? ''}`}
                          style={{
                            cursor: canEdit ? 'pointer' : 'default', fontWeight: 600,
                            display: 'inline-flex', alignItems: 'center', gap: '2px',
                            opacity: isHovering ? 0.8 : 1,
                            outline: isHovering ? '1px dashed currentColor' : 'none',
                            outlineOffset: '1px',
                          }}>
                          {processing === u.id ? '변경 중...' : (
                            <>{ROLE_LABEL[u.role]?.label ?? u.role}{canEdit && <span style={{ fontSize: '9px', opacity: isHovering ? 1 : 0.4 }}>✏️</span>}</>
                          )}
                        </button>
                      )
                    })()
                  )}

                  {/* 직급 배지 — 인라인 */}
                  {u.id !== currentUserId && (
                    editingRankUser === u.id ? (
                      <select
                        value={editRank} autoFocus disabled={processing === u.id + '_rank'}
                        onChange={e => { setEditRank(e.target.value); changeRank(u.id, e.target.value) }}
                        onBlur={() => { if (processing !== u.id + '_rank') setEditingRankUser(null) }}
                        style={{
                          background: '#182035', border: '1px solid #FFB800',
                          color: '#CDD5E0', borderRadius: '6px', padding: '1px 6px',
                          fontSize: '11px', cursor: 'pointer', fontWeight: 600,
                          opacity: processing === u.id + '_rank' ? 0.5 : 1,
                        }}>
                        <option value="">미설정</option>
                        {RANK_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <button type="button" title="직급 변경"
                        onClick={() => { setEditingRankUser(u.id); setEditRank(u.rank ?? '') }}
                        style={{
                          fontSize: '11px', fontWeight: 600,
                          color: u.rank ? (RANK_COLOR[u.rank] ?? '#687898') : '#485870',
                          background: 'transparent', border: 'none',
                          padding: '0 2px', cursor: 'pointer', flexShrink: 0,
                        }}>
                        {u.rank ?? '직급 미설정'} ✏️
                      </button>
                    )
                  )}

                  {/* 이메일 · 부서 — 같은 줄, 공간 남으면 표시 */}
                  <span className="text-xs truncate" style={{ color: '#485870', minWidth: 0 }}>
                    {u.email}
                    {u.department && ` · ${u.department}`}
                    {u.last_login_at && ` · ${new Date(u.last_login_at).toLocaleDateString('ko-KR')}`}
                  </span>
                </div>

                {/* 버튼 영역 */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {u.id !== currentUserId && (
                    <button onClick={() => activateUser(u.id)} disabled={processing === u.id + '_activate'}
                      className="text-xs px-2.5 py-1 rounded font-medium"
                      style={{
                        background: 'rgba(0,204,102,0.1)', color: '#3D9E6A',
                        border: '1px solid rgba(0,204,102,0.25)',
                        cursor: processing === u.id + '_activate' ? 'not-allowed' : 'pointer',
                        opacity: processing === u.id + '_activate' ? 0.5 : 1,
                      }}>
                      {processing === u.id + '_activate' ? '...' : '✓ 승인'}
                    </button>
                  )}
                  {u.id !== currentUserId && (
                    <button onClick={() => sendResetEmail(u.id)} disabled={processing === u.id + '_reset'}
                      title="비밀번호 재설정" className="text-xs px-2 py-1 rounded"
                      style={{
                        background: 'transparent', color: '#485870', border: '1px solid #1A2838',
                        cursor: processing === u.id + '_reset' ? 'not-allowed' : 'pointer',
                        opacity: processing === u.id + '_reset' ? 0.5 : 1,
                      }}>
                      {processing === u.id + '_reset' ? '...' : '🔑'}
                    </button>
                  )}
                  <button onClick={() => toggleActive(u.id, u.is_active)}
                    disabled={processing === u.id || u.id === currentUserId}
                    className="text-xs px-2.5 py-1 rounded font-medium"
                    style={{
                      background: 'rgba(255,68,68,0.1)', color: '#C04040',
                      border: '1px solid rgba(255,68,68,0.2)',
                      cursor: (processing === u.id || u.id === currentUserId) ? 'not-allowed' : 'pointer',
                      opacity: u.id === currentUserId ? 0.4 : 1,
                    }}>
                    비활성화
                  </button>
                </div>
              </div>
            </div>
          ))}

          {filteredActive.length === 0 && (
            <div className="glass-card p-8 text-center">
              <p className="text-sm" style={{ color: '#485870' }}>검색 결과가 없습니다</p>
            </div>
          )}
        </div>
      )}

      {/* ── 가입 대기 탭 ── */}
      {tab === 'pending' && (
        <div className="space-y-3">
          {filteredPending.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <p className="text-2xl mb-3">✅</p>
              <p className="text-sm font-medium" style={{ color: '#CDD5E0' }}>대기 중인 가입 신청이 없습니다</p>
              <p className="text-xs mt-1" style={{ color: '#485870' }}>자가 가입 신청 시 이곳에 표시됩니다</p>
            </div>
          ) : (
            filteredPending.map(u => {
              const selectedRole = approveRoles[u.id] ?? 'reporter'
              const isApproving = processing === u.id + '_approve'
              return (
                <div key={u.id} className="glass-card p-4"
                  style={{ border: '1px solid rgba(255,153,0,0.25)', background: 'rgba(255,153,0,0.03)' }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* 아바타 */}
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: 'rgba(255,153,0,0.15)', color: '#A87228', border: '1px solid rgba(255,153,0,0.3)' }}>
                        {u.full_name[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold" style={{ color: '#CDD5E0' }}>{u.full_name}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded"
                            style={{ background: 'rgba(255,153,0,0.15)', color: '#A87228', border: '1px solid rgba(255,153,0,0.3)' }}>
                            승인 대기
                          </span>
                        </div>
                        <div className="text-xs mt-0.5" style={{ color: '#485870' }}>{u.email}</div>
                        <div className="text-xs mt-0.5" style={{ color: '#485870' }}>
                          신청일: {new Date(u.created_at).toLocaleString('ko-KR')}
                        </div>
                      </div>
                    </div>

                    {/* 승인 액션 */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* 역할 선택 */}
                      <select
                        value={selectedRole}
                        onChange={e => setApproveRoles(prev => ({ ...prev, [u.id]: e.target.value }))}
                        style={{
                          background: '#182035', border: '1px solid #1A2838',
                          color: '#CDD5E0', borderRadius: '8px', padding: '7px 10px',
                          fontSize: '13px', cursor: 'pointer',
                        }}>
                        <option value="reporter">기자</option>
                        <option value="deputy">차장</option>
                        {isSuperadmin && <option value="admin">부장</option>}
                        {isSuperadmin && <option value="section_editor">부국장</option>}
                        {isSuperadmin && <option value="editor">국장</option>}
                        {isSuperadmin && <option value="publisher">편집인</option>}
                        {isSuperadmin && <option value="superadmin">슈퍼관리자</option>}
                      </select>

                      {/* 승인 버튼 */}
                      <button
                        onClick={() => approveUser(u.id)}
                        disabled={isApproving}
                        style={{
                          background: isApproving ? 'rgba(0,204,102,0.1)' : 'rgba(0,204,102,0.2)',
                          border: '1px solid rgba(0,204,102,0.4)',
                          color: '#3D9E6A', borderRadius: '8px', padding: '7px 16px',
                          fontSize: '13px', fontWeight: 700, cursor: isApproving ? 'not-allowed' : 'pointer',
                          opacity: isApproving ? 0.6 : 1,
                        }}>
                        {isApproving ? '처리 중...' : '✓ 승인'}
                      </button>

                      {/* 거절 버튼 */}
                      <button
                        onClick={() => rejectUser(u.id)}
                        disabled={!!processing}
                        style={{
                          background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.25)',
                          color: '#C04040', borderRadius: '8px', padding: '7px 12px',
                          fontSize: '13px', cursor: processing ? 'not-allowed' : 'pointer',
                        }}>
                        거절
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── 계정 생성 모달 ── */}
      {showCreateForm && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', padding: '16px',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="glass-card"
            style={{
              width: '100%', maxWidth: '560px', background: '#131C2C',
              border: '1px solid #1A2838', borderRadius: '12px', overflow: 'hidden',
            }}>
            <div style={{
              padding: '20px 24px 16px', borderBottom: '1px solid #1A2838',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#CDD5E0' }}>새 계정 생성</h2>
              <button onClick={closeModal}
                style={{ background: 'none', border: 'none', color: '#485870', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>
                ×
              </button>
            </div>

            {createSuccess ? (
              <div style={{ padding: '32px 24px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>
                <p style={{ color: '#3D9E6A', fontSize: '15px', fontWeight: 600, marginBottom: '8px' }}>계정이 생성되었습니다.</p>
                <p style={{ color: '#687898', fontSize: '13px', marginBottom: '24px' }}>임시 비밀번호를 해당 기자에게 전달해주세요.</p>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <button onClick={() => { setCreateSuccess(false); setCreateError(null) }}
                    style={{ background: 'rgba(30,144,255,0.15)', border: '1px solid rgba(30,144,255,0.4)', color: '#4A7CC0', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                    추가 생성
                  </button>
                  <button onClick={closeModal}
                    style={{ background: '#182035', border: '1px solid #1A2838', color: '#687898', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', cursor: 'pointer' }}>
                    닫기
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreate} style={{ padding: '20px 24px' }}>
                {createError && (
                  <div style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '13px', color: '#C04040' }}>
                    {createError}
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={labelStyle}>이름 <span style={{ color: '#C04040' }}>*</span></label>
                    <input type="text" required value={createForm.full_name}
                      onChange={e => setCreateForm(f => ({ ...f, full_name: e.target.value }))}
                      placeholder="홍길동" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>이메일 <span style={{ color: '#C04040' }}>*</span></label>
                    <input type="email" required value={createForm.email}
                      onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="user@segye.com" style={inputStyle} />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <label style={labelStyle}>임시 비밀번호 <span style={{ color: '#C04040' }}>*</span></label>
                    <div style={{ position: 'relative' }}>
                      <input type={showPassword ? 'text' : 'password'} required minLength={8}
                        value={createForm.password}
                        onChange={e => setCreateForm(f => ({ ...f, password: e.target.value }))}
                        placeholder="8자 이상" style={{ ...inputStyle, paddingRight: '40px' }} />
                      <button type="button" onClick={() => setShowPassword(v => !v)}
                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#485870', fontSize: '14px', lineHeight: 1, padding: '2px' }}>
                        {showPassword ? '🙈' : '👁'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>역할</label>
                    <select value={createForm.role} onChange={e => setCreateForm(f => ({ ...f, role: e.target.value }))}
                      style={{ ...inputStyle, cursor: 'pointer' }}>
                      <option value="reporter">기자</option>
                      <option value="deputy">차장</option>
                      {isSuperadmin && <option value="admin">부장</option>}
                      {isSuperadmin && <option value="section_editor">부국장</option>}
                      {isSuperadmin && <option value="editor">국장</option>}
                      {isSuperadmin && <option value="publisher">편집인</option>}
                      {isSuperadmin && <option value="superadmin">슈퍼관리자</option>}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>부서</label>
                    <input type="text" value={createForm.department}
                      onChange={e => setCreateForm(f => ({ ...f, department: e.target.value }))}
                      placeholder="사회부" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>사번</label>
                    <input type="text" value={createForm.employee_id}
                      onChange={e => setCreateForm(f => ({ ...f, employee_id: e.target.value }))}
                      placeholder="20240001" style={inputStyle} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={labelStyle}>전화번호</label>
                    <input type="tel" value={createForm.phone}
                      onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="010-0000-0000" style={inputStyle} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                  <button type="button" onClick={closeModal}
                    style={{ background: '#182035', border: '1px solid #1A2838', color: '#687898', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', cursor: 'pointer' }}>
                    취소
                  </button>
                  <button type="submit" disabled={createLoading}
                    style={{
                      background: createLoading ? 'rgba(30,144,255,0.1)' : 'rgba(30,144,255,0.2)',
                      border: '1px solid rgba(30,144,255,0.5)', color: '#4A7CC0',
                      borderRadius: '8px', padding: '10px 24px', fontSize: '13px', fontWeight: 600,
                      cursor: createLoading ? 'not-allowed' : 'pointer', opacity: createLoading ? 0.7 : 1,
                    }}>
                    {createLoading ? '생성 중...' : '생성 완료'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
