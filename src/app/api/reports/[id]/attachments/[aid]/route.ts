/**
 * GET /api/reports/[id]/attachments/[aid]
 * Returns a signed download URL (valid 1 hour) for the given attachment.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const STORAGE_BUCKET = 'report-attachments'
const SIGNED_URL_EXPIRY_SECONDS = 3600

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; aid: string }> },
) {
  const { id: reportId, aid: attachmentId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch attachment record — RLS ensures the user can only see accessible attachments
  const { data: attachmentRaw, error: fetchError } = await supabase
    .from('report_attachments')
    .select('id, report_id, storage_path, filename')
    .eq('id', attachmentId)
    .eq('report_id', reportId)
    .single()

  if (fetchError || !attachmentRaw) {
    return NextResponse.json({ error: '첨부파일을 찾을 수 없습니다.' }, { status: 404 })
  }

  const attachment = attachmentRaw as { id: string; report_id: string; storage_path: string; filename: string }

  const { data: signedData, error: signError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(attachment.storage_path, SIGNED_URL_EXPIRY_SECONDS, {
      download: attachment.filename,
    })

  if (signError || !signedData?.signedUrl) {
    return NextResponse.json(
      { error: `서명된 URL 생성 실패: ${signError?.message ?? '알 수 없는 오류'}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ url: signedData.signedUrl })
}
