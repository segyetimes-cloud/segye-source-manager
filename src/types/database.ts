export * from './database.generated'

import type { Database } from './database.generated'

// Enum type aliases (derived from the generated Database enums)
export type UserRole = Database['public']['Enums']['user_role']
export type SourceVisibility = Database['public']['Enums']['source_visibility']
export type SensitivityLevel = Database['public']['Enums']['sensitivity_level']
export type ApprovalStatus = Database['public']['Enums']['approval_status']
export type AuditAction = Database['public']['Enums']['audit_action']
export type PointType = Database['public']['Enums']['point_type']
export type HelpStatus = Database['public']['Enums']['help_status']

// ReportVisibility is NOT a Postgres enum — it's stored as text but we add a TypeScript union for safety
export type ReportVisibility = 'author_only' | 'desk_above' | 'team' | 'all'

// Convenience Row type aliases
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Source = Database['public']['Tables']['sources']['Row']
export type SourcePosition = Database['public']['Tables']['source_positions']['Row']
export type SourceEducation = Database['public']['Tables']['source_education']['Row']
export type SourceRelationship = Database['public']['Tables']['source_relationships']['Row']
export type SourceAccessApproval = Database['public']['Tables']['source_access_approvals']['Row']
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
export type SourceEditHistory = Database['public']['Tables']['source_edit_history']['Row']
export type PointTransaction = Database['public']['Tables']['point_transactions']['Row']
export type UserPointsSummary = Database['public']['Tables']['user_points_summary']['Row']
export type HelpRequest = Database['public']['Tables']['help_requests']['Row']
export type HelpResponse = Database['public']['Tables']['help_responses']['Row']
export type ImportJob = Database['public']['Tables']['import_jobs']['Row']

// Information report types
export type InformationReport = Database['public']['Tables']['information_reports']['Row']
export type ReportSource = Database['public']['Tables']['report_sources']['Row']
