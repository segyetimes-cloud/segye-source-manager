// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { can, CAN_EDIT_ANY_SOURCE, CAN_DELETE_SOURCE } from '@/lib/permissions'

/**
 * POST /api/sources/bulk
 * Body: { action: 'delete' | 'set_visibility' | 'add_tag' | 'remove_tag', ids: string[], value?: string }
 *
 * 권한: 소유자는 자신의 취재원만, admin+ 는 전체 대상.
 * 한 번에 최대 100건.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = (profile as any)?.role ?? 'reporter'
  const isAdmin = can(role, CAN_EDIT_ANY_SOURCE)
  const canBulkDelete = can(role, CAN_DELETE_SOURCE)

  const body = await request.json()
  const { action, ids, value } = body

  if (!action || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'action과 ids가 필요합니다' }, { status: 400 })
  }
  if (ids.length > 100) {
    return NextResponse.json({ error: '한 번에 최대 100개까지 처리 가능합니다' }, { status: 400 })
  }

  // 대상 취재원 조회 (소유자·태그 파악용)
  const { data: sources } = await supabase
    .from('sources')
    .select('id, owner_id, tags')
    .in('id', ids)
    .eq('is_deleted', false)

  if (!sources || sources.length === 0) {
    return NextResponse.json({ error: '대상 취재원을 찾을 수 없습니다' }, { status: 404 })
  }

  const ownedIds = sources.filter((s: any) => s.owner_id === user.id).map((s: any) => s.id)
  const targetIds = isAdmin ? sources.map((s: any) => s.id) : ownedIds

  if (targetIds.length === 0) {
    return NextResponse.json({ error: '수정 권한이 있는 취재원이 없습니다' }, { status: 403 })
  }

  let affected = 0

  switch (action) {
    case 'delete': {
      const deleteIds = (canBulkDelete || isAdmin) ? ids : ownedIds
      if (deleteIds.length === 0) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

      const { error } = await supabase
        .from('sources')
        .update({ is_deleted: true })
        .in('id', deleteIds)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      affected = deleteIds.length

      void supabase.from('audit_logs').insert({
        user_id: user.id,
        user_email: user.email,
        action: 'delete',
        resource_type: 'source',
        metadata: { bulk: true, count: affected },
      })
      break
    }

    case 'set_visibility': {
      if (!['shared', 'personal'].includes(value)) {
        return NextResponse.json({ error: 'value는 shared 또는 personal이어야 합니다' }, { status: 400 })
      }
      const { error } = await supabase
        .from('sources')
        .update({ visibility: value })
        .in('id', targetIds)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      affected = targetIds.length

      void supabase.from('audit_logs').insert({
        user_id: user.id,
        user_email: user.email,
        action: 'update',
        resource_type: 'source',
        metadata: { bulk: true, field: 'visibility', value, count: affected },
      })
      break
    }

    case 'add_tag': {
      if (!value?.trim()) return NextResponse.json({ error: 'value(태그)가 필요합니다' }, { status: 400 })
      const tag = value.trim()
      const updates = sources
        .filter((s: any) => targetIds.includes(s.id) && !((s.tags ?? []).includes(tag)))
        .map((s: any) =>
          supabase.from('sources').update({ tags: [...(s.tags ?? []), tag] }).eq('id', s.id)
        )
      await Promise.all(updates)
      affected = updates.length

      void supabase.from('audit_logs').insert({
        user_id: user.id,
        user_email: user.email,
        action: 'update',
        resource_type: 'source',
        metadata: { bulk: true, action: 'add_tag', tag, count: affected },
      })
      break
    }

    case 'remove_tag': {
      if (!value?.trim()) return NextResponse.json({ error: 'value(태그)가 필요합니다' }, { status: 400 })
      const tag = value.trim()
      const updates = sources
        .filter((s: any) => targetIds.includes(s.id))
        .map((s: any) =>
          supabase.from('sources')
            .update({ tags: (s.tags ?? []).filter((t: string) => t !== tag) })
            .eq('id', s.id)
        )
      await Promise.all(updates)
      affected = updates.length

      void supabase.from('audit_logs').insert({
        user_id: user.id,
        user_email: user.email,
        action: 'update',
        resource_type: 'source',
        metadata: { bulk: true, action: 'remove_tag', tag, count: affected },
      })
      break
    }

    default:
      return NextResponse.json({ error: '알 수 없는 action입니다' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, affected, action })
}
