
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sourceId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const rating = Number(body.rating)
  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: '1~5점 사이 값을 입력하세요' }, { status: 400 })
  }

  // 소유자는 자신의 취재원을 평가할 수 없음
  const { data: source } = await supabase
    .from('sources')
    .select('owner_id')
    .eq('id', sourceId)
    .single()

  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (source.owner_id === user.id) {
    return NextResponse.json({ error: '본인 취재원은 평가할 수 없습니다' }, { status: 403 })
  }

  // UPSERT — 1인 1평가
  const { data: existing } = await supabase
    .from('source_usefulness_ratings')
    .select('id, rating')
    .eq('source_id', sourceId)
    .eq('rater_id', user.id)
    .single()

  if (existing) {
    // 기존 평가 수정
    await supabase
      .from('source_usefulness_ratings')
      .update({ rating })
      .eq('id', existing.id)
  } else {
    // 신규 평가 → 포인트 지급
    await supabase
      .from('source_usefulness_ratings')
      .insert({ source_id: sourceId, rater_id: user.id, rating })

    // 4점 이상이면 소유자에게 포인트 지급
    if (rating >= 4) {
      const serviceClient = createServiceClient()
      await serviceClient
        .from('point_transactions')
        .insert({
          user_id: source.owner_id,
          point_type: 'usefulness_rating',
          points: 3,
          related_source_id: sourceId,
          related_user_id: user.id,
          description: `취재원 유용성 평가 ${rating}점 수신`,
        })
    }

    // 평가자에게도 소액 포인트 (+2)
    const serviceClient = createServiceClient()
    await serviceClient
      .from('point_transactions')
      .insert({
        user_id: user.id,
        point_type: 'contribution_used',
        points: 1,
        related_source_id: sourceId,
        description: '취재원 유용성 평가 참여',
      })
  }

  return NextResponse.json({ ok: true, rating })
}
