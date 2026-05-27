/**
 * /api/reports/[id]/attachments
 *
 * NOTE: Before using this route, create a `report-attachments` bucket
 * in the Supabase Storage Dashboard (Settings > Storage) with public = false.
 *
 * GET    — List attachments for a report
 * POST   — Upload a file (multipart/form-data, field: "file"), max 20 MB
 * DELETE — Delete an attachment (?attachmentId=xxx)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isDesk } from '@/lib/roles'
import { randomUUID } from 'crypto'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 MB

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/haansofthwp',
  'application/x-hwp',
])

const STORAGE_BUCKET = 'report-attachments'

// GET /api/reports/[id]/attachments
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reportId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('report_attachments')
    .select('*')
    .eq('report_id', reportId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ attachments: data ?? [] })
}

// POST /api/reports/[id]/attachments
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reportId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Parse multipart form data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: '파일 데이터를 읽을 수 없습니다.' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'file 필드가 필요합니다.' }, { status: 400 })
  }

  // Validate size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `파일 크기는 20MB를 초과할 수 없습니다. (현재: ${(file.size / 1024 / 1024).toFixed(1)}MB)` },
      { status: 413 },
    )
  }

  // Validate mime type
  const mimeType = file.type || 'application/octet-stream'
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    return NextResponse.json(
      { error: `허용되지 않는 파일 형식입니다: ${mimeType}` },
      { status: 415 },
    )
  }

  // Sanitise filename — strip path separators
  const safeFilename = file.name.replace(/[/\\]/g, '_')
  const storagePath = `${reportId}/${randomUUID()}-${safeFilename}`

  // Upload to Supabase Storage
  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: mimeType,
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json(
      { error: `스토리지 업로드 실패: ${uploadError.message}` },
      { status: 500 },
    )
  }

  // Insert DB record
  const { data: attachment, error: dbError } = await supabase
    .from('report_attachments')
    .insert({
      report_id:    reportId,
      filename:     safeFilename,
      storage_path: storagePath,
      file_size:    file.size,
      mime_type:    mimeType,
      uploaded_by:  user.id,
    })
    .select()
    .single()

  if (dbError) {
    // Attempt to clean up the uploaded file on DB failure
    await supabase.storage.from(STORAGE_BUCKET).remove([storagePath])
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json(attachment, { status: 201 })
}

// DELETE /api/reports/[id]/attachments?attachmentId=xxx
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: reportId } = await params
  const attachmentId = request.nextUrl.searchParams.get('attachmentId')
  if (!attachmentId) {
    return NextResponse.json({ error: 'attachmentId 쿼리 파라미터가 필요합니다.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profileRaw } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = profileRaw as { role: string } | null
  const userIsDesk = isDesk(profile?.role)

  // Fetch the attachment to verify ownership and get storage path
  const { data: attachmentRaw, error: fetchError } = await supabase
    .from('report_attachments')
    .select('id, report_id, storage_path, uploaded_by')
    .eq('id', attachmentId)
    .eq('report_id', reportId)
    .single()

  if (fetchError || !attachmentRaw) {
    return NextResponse.json({ error: '첨부파일을 찾을 수 없습니다.' }, { status: 404 })
  }

  const attachment = attachmentRaw as {
    id: string; report_id: string; storage_path: string; uploaded_by: string
  }

  // Only uploader or desk can delete
  if (attachment.uploaded_by !== user.id && !userIsDesk) {
    return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 })
  }

  // Delete from storage first
  const { error: storageError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([attachment.storage_path])

  if (storageError) {
    return NextResponse.json(
      { error: `스토리지 삭제 실패: ${storageError.message}` },
      { status: 500 },
    )
  }

  // Delete DB record
  const { error: dbError } = await supabase
    .from('report_attachments')
    .delete()
    .eq('id', attachmentId)

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
