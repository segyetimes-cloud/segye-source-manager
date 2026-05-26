/**
 * src/app/api/__tests__/route-handlers.test.ts
 *
 * API 라우트 핸들러 HTTP 상태 코드 단위 테스트 (10개)
 */

import { vi, describe, it, expect, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ── 최상위 모킹 ──────────────────────────────────────────────────────────────
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
  createServiceClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: vi.fn().mockResolvedValue({ data: { user: { id: 'new-user-id' } }, error: null }),
        deleteUser: vi.fn().mockResolvedValue({ error: null }),
      },
    },
    from: vi.fn().mockReturnValue({
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 'new-user-id', email: 'x@x.com' }, error: null }),
    }),
  })),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    getAll: vi.fn(() => []),
    set: vi.fn(),
    delete: vi.fn(),
  })),
  headers: vi.fn(() => new Map()),
}))

vi.mock('@/lib/rateLimit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 9, resetAt: new Date() }),
  getClientIp: vi.fn().mockReturnValue('127.0.0.1'),
}))

// ── 라우트 핸들러 임포트 ─────────────────────────────────────────────────────
import { GET as sourcesGET, POST as sourcesPOST } from '../sources/route'
import { GET as reportsGET, POST as reportsPOST } from '../reports/route'
import { GET as approvalsGET, PATCH as approvalsPATCH } from '../approvals/route'
import { POST as adminUsersPOST } from '../admin/users/route'
import { POST as loginAuditPOST } from '../auth/login-audit/route'

// ── Supabase 체인 목(Mock) 헬퍼 ─────────────────────────────────────────────
function makeSbChain(terminalData: any = null, terminalError: any = null) {
  const chain: any = {}
  for (const m of [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'in', 'not', 'or', 'and', 'ilike', 'like', 'is',
    'gte', 'gt', 'lte', 'lt', 'order', 'range', 'limit', 'textSearch',
  ]) {
    chain[m] = () => chain
  }
  chain.single = () => Promise.resolve({ data: terminalData, error: terminalError })
  chain.maybeSingle = () => Promise.resolve({ data: null, error: null })
  // Make chain directly awaitable (PostgrestFilterBuilder is PromiseLike)
  chain.then = (resolve: any, reject?: any) =>
    Promise.resolve({ data: terminalData ?? [], count: 0, error: terminalError }).then(resolve, reject)
  return chain
}

function mockAuthClient(user: { id: string; email: string } | null, profileData: any = null) {
  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'profiles') return makeSbChain(profileData)
      if (table === 'sources') return makeSbChain([], null)
      if (table === 'information_reports') return makeSbChain([], null)
      if (table === 'source_access_approvals') return makeSbChain([], null)
      if (table === 'audit_logs') return makeSbChain(null, null)
      return makeSbChain()
    }),
    rpc: vi.fn().mockResolvedValue({ data: [{ allowed: true, count: 0, reset_at: '' }], error: null }),
  }
  vi.mocked(createClient).mockResolvedValue(client as any)
  return client
}

// ── 공통 beforeEach ──────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()
})

// ── describe 1: GET /api/sources ─────────────────────────────────────────────
describe('GET /api/sources', () => {
  it('인증 없이 401 반환', async () => {
    mockAuthClient(null)
    const req = new NextRequest('http://localhost/api/sources')
    const res = await sourcesGET(req)
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ error: 'Unauthorized' })
  })

  it('기자 인증 후 200 반환', async () => {
    mockAuthClient({ id: 'u1', email: 't@t.com' }, { role: 'reporter', department: '정치부' })
    const req = new NextRequest('http://localhost/api/sources')
    const res = await sourcesGET(req)
    expect(res.status).toBe(200)
  })
})

// ── describe 2: POST /api/reports ────────────────────────────────────────────
describe('POST /api/reports', () => {
  it('인증 없이 401 반환', async () => {
    mockAuthClient(null)
    const req = new NextRequest('http://localhost/api/reports', {
      method: 'POST',
      body: JSON.stringify({ title: 'T', content: 'C' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await reportsPOST(req)
    expect(res.status).toBe(401)
  })

  it('제목 누락 시 400 반환', async () => {
    mockAuthClient({ id: 'u1', email: 't@t.com' }, { role: 'reporter', department: '정치부' })
    const req = new NextRequest('http://localhost/api/reports', {
      method: 'POST',
      body: JSON.stringify({ content: 'C' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await reportsPOST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/제목/)
  })

  it('본문 누락 시 400 반환', async () => {
    mockAuthClient({ id: 'u1', email: 't@t.com' }, { role: 'reporter', department: '정치부' })
    const req = new NextRequest('http://localhost/api/reports', {
      method: 'POST',
      body: JSON.stringify({ title: '제목만 있음' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await reportsPOST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/본문/)
  })
})

// ── describe 3: PATCH /api/approvals ────────────────────────────────────────
describe('PATCH /api/approvals', () => {
  it('인증 없이 401 반환', async () => {
    mockAuthClient(null)
    const req = new NextRequest('http://localhost/api/approvals', {
      method: 'PATCH',
      body: JSON.stringify({ approval_id: 'x', action: 'approve' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await approvalsPATCH(req)
    expect(res.status).toBe(401)
  })

  it('기자(reporter) 역할은 403 반환', async () => {
    mockAuthClient({ id: 'u1', email: 't@t.com' }, { role: 'reporter', department: '정치부' })
    const req = new NextRequest('http://localhost/api/approvals', {
      method: 'PATCH',
      body: JSON.stringify({ approval_id: 'x', action: 'approve' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await approvalsPATCH(req)
    expect(res.status).toBe(403)
  })
})

// ── describe 4: POST /api/admin/users ───────────────────────────────────────
describe('POST /api/admin/users', () => {
  it('인증 없이 401 반환', async () => {
    mockAuthClient(null)
    const req = new NextRequest('http://localhost/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email: 'x@x.com', password: 'pw', full_name: '홍길동' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await adminUsersPOST(req)
    expect(res.status).toBe(401)
  })

  it('기자(reporter) 역할은 403 반환', async () => {
    mockAuthClient({ id: 'u1', email: 't@t.com' }, { role: 'reporter' })
    const req = new NextRequest('http://localhost/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email: 'x@x.com', password: 'pw', full_name: '홍길동' }),
      headers: { 'content-type': 'application/json' },
    })
    const res = await adminUsersPOST(req)
    expect(res.status).toBe(403)
  })
})

// ── describe 5: POST /api/auth/login-audit ──────────────────────────────────
describe('POST /api/auth/login-audit', () => {
  it('action 없으면 400 반환', async () => {
    mockAuthClient({ id: 'u1', email: 't@t.com' })
    const req = new NextRequest('http://localhost/api/auth/login-audit', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: { 'content-type': 'application/json' },
    })
    const res = await loginAuditPOST(req)
    expect(res.status).toBe(400)
  })
})
