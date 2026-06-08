'use client'

import { useState } from 'react'

export interface AttachmentRow {
  id: string
  report_id: string
  filename: string
  storage_path: string
  file_size: number
  mime_type: string
  uploaded_by: string
  created_at: string
}

interface Props {
  reportId: string
  attachments: AttachmentRow[]
  canDelete: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function mimeIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼'
  if (mimeType === 'application/pdf') return '📄'
  if (
    mimeType === 'application/msword' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) return '📝'
  if (
    mimeType === 'application/vnd.ms-excel' ||
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) return '📊'
  if (mimeType === 'application/haansofthwp' || mimeType === 'application/x-hwp') return '📋'
  return '📎'
}

export default function ReportAttachments({ reportId, attachments: initial, canDelete }: Props) {
  const [attachments, setAttachments] = useState<AttachmentRow[]>(initial)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({})
  const [previewLoading, setPreviewLoading] = useState<string | null>(null)

  async function handleDownload(att: AttachmentRow) {
    if (downloading) return
    setDownloading(att.id)
    setError('')
    try {
      const res = await fetch(`/api/reports/${reportId}/attachments/${att.id}`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? '다운로드 URL 생성에 실패했습니다.')
        return
      }
      const { url } = await res.json()
      // Open in new tab — browser handles the download via content-disposition
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setError('다운로드 중 오류가 발생했습니다.')
    } finally {
      setDownloading(null)
    }
  }

  async function togglePreview(att: AttachmentRow) {
    if (previewUrls[att.id]) {
      setPreviewUrls(prev => { const n = {...prev}; delete n[att.id]; return n })
      return
    }
    setPreviewLoading(att.id)
    try {
      const res = await fetch(`/api/reports/${reportId}/attachments/${att.id}`)
      if (res.ok) {
        const { url } = await res.json()
        setPreviewUrls(prev => ({ ...prev, [att.id]: url }))
      }
    } catch {}
    setPreviewLoading(null)
  }

  async function handleDelete(att: AttachmentRow) {
    if (!confirm(`"${att.filename}" 파일을 삭제하시겠습니까?`)) return
    setDeleting(att.id)
    setError('')
    try {
      const res = await fetch(
        `/api/reports/${reportId}/attachments?attachmentId=${encodeURIComponent(att.id)}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? '첨부파일 삭제에 실패했습니다.')
        return
      }
      setAttachments(prev => prev.filter(a => a.id !== att.id))
    } catch {
      setError('삭제 중 오류가 발생했습니다.')
    } finally {
      setDeleting(null)
    }
  }

  if (attachments.length === 0) return null

  return (
    <div style={{
      background: '#182035',
      border: '1px solid #1A2838',
      borderRadius: '10px',
      padding: '14px 16px',
    }}>
      <h3 style={{
        fontSize: '13px', fontWeight: 600, color: '#8AAAC8',
        marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        📎 첨부파일 ({attachments.length}개)
      </h3>

      {error && (
        <p style={{
          fontSize: '12px', color: '#C04040',
          background: 'rgba(255,68,68,0.08)', borderRadius: '6px',
          padding: '6px 10px', marginBottom: '8px',
        }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {attachments.map(att => (
          <div
            key={att.id}
            style={{
              display: 'flex', flexDirection: 'column', gap: '6px',
              background: '#131C2C', border: '1px solid #1A2838',
              borderRadius: '7px', padding: '8px 12px',
            }}
          >
            {/* inner row: icon + name + buttons */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '16px', flexShrink: 0 }}>{mimeIcon(att.mime_type)}</span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: '13px', color: '#CDD5E0', fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  margin: 0,
                }}>
                  {att.filename}
                </p>
                <p style={{ fontSize: '11px', color: '#607898', margin: '1px 0 0' }}>
                  {formatFileSize(att.file_size)}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                {att.mime_type.startsWith('image/') && (
                  <button
                    type="button"
                    onClick={() => togglePreview(att)}
                    disabled={previewLoading === att.id}
                    style={{
                      background: previewUrls[att.id] ? 'rgba(0,204,102,0.08)' : 'rgba(30,144,255,0.08)',
                      border: `1px solid ${previewUrls[att.id] ? 'rgba(0,204,102,0.2)' : 'rgba(30,144,255,0.2)'}`,
                      color: previewUrls[att.id] ? '#3D9E6A' : '#4A7CC0',
                      borderRadius: '6px', padding: '4px 10px',
                      fontSize: '12px', fontWeight: 500,
                      cursor: previewLoading === att.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {previewLoading === att.id ? '...' : previewUrls[att.id] ? '닫기' : '미리보기'}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleDownload(att)}
                  disabled={downloading === att.id}
                  style={{
                    background: downloading === att.id ? '#131C2C' : 'rgba(30,144,255,0.08)',
                    border: '1px solid rgba(30,144,255,0.2)',
                    color: downloading === att.id ? '#607898' : '#4A7CC0',
                    borderRadius: '6px', padding: '4px 10px',
                    fontSize: '12px', fontWeight: 500, cursor: downloading === att.id ? 'not-allowed' : 'pointer',
                  }}
                >
                  {downloading === att.id ? '...' : '다운로드'}
                </button>

                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(att)}
                    disabled={deleting === att.id}
                    style={{
                      background: 'none',
                      border: '1px solid rgba(192,64,64,0.3)',
                      color: deleting === att.id ? '#607898' : '#904040',
                      borderRadius: '6px', padding: '4px 8px',
                      fontSize: '12px', cursor: deleting === att.id ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {deleting === att.id ? '...' : '삭제'}
                  </button>
                )}
              </div>
            </div>

            {/* 이미지 미리보기 */}
            {att.mime_type.startsWith('image/') && previewUrls[att.id] && (
              <div style={{ borderRadius: '8px', overflow: 'hidden' }}>
                <img
                  src={previewUrls[att.id]}
                  alt={att.filename}
                  style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain', display: 'block' }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
