'use client'
// ReportContentViewer → SecureContainer(1단계) + SecureContentViewer(canvas+워터마크)
import SecureContainer from '@/components/common/SecureContainer'
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
    <SecureContainer>
      <SecureContentViewer
        apiPath={`/api/reports/${reportId}/copy-log`}
        content={content}
        userId={userId}
        userFullName={userFullName}
        userDepartment={userDepartment}
      />
    </SecureContainer>
  )
}
