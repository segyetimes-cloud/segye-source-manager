'use client'
// ReportContentViewer → SecureContentViewer 래퍼
import SecureContentViewer from '@/components/common/SecureContentViewer'

interface Props {
  reportId: string
  content: string
  userId: string
  userFullName: string
  userDepartment: string | null
}

export default function ReportContentViewer({ reportId, content, userId, userFullName, userDepartment }: Props) {
  return (
    <SecureContentViewer
      apiPath={`/api/reports/${reportId}/copy-log`}
      content={content}
      userId={userId}
      userFullName={userFullName}
      userDepartment={userDepartment}
    />
  )
}
