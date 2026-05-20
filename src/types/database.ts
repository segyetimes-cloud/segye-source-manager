export type UserRole = 'superadmin' | 'publisher' | 'editor' | 'section_editor' | 'admin' | 'deputy' | 'reporter'
// superadmin  : 시스템 관리자
// publisher   : 편집인  — 전 부서 승인 가능
// editor      : 국장    — 전 부서 승인 가능
// section_editor : 부국장 — 전 부서 승인 가능
// admin       : 부장    — 소속 부서 신청만 승인 가능
// deputy      : 차장
// reporter    : 기자
export type SourceVisibility = 'personal' | 'shared'
export type SensitivityLevel = 'public' | 'private'
export type ReportVisibility = 'author_only' | 'desk_above' | 'all'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export type AuditAction = 'view' | 'create' | 'update' | 'delete' | 'export' | 'import' | 'view_private' | 'approve' | 'reject'
export type PointType = 'source_created' | 'source_completed' | 'contribution_used' | 'usefulness_rating' | 'help_provided' | 'help_accepted' | 'daily_login' | 'penalty_deduct'
export type HelpStatus = 'open' | 'resolved' | 'closed'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string
          role: UserRole
          department: string | null
          desk_name: string | null
          employee_id: string | null
          phone: string | null
          is_active: boolean
          last_login_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      sources: {
        Row: {
          id: string
          owner_id: string
          visibility: SourceVisibility
          full_name: string
          name_en: string | null
          gender: string | null
          birthday: string | null
          birthday_lunar: boolean
          hometown_province: string | null
          hometown_city: string | null
          high_school: string | null
          high_school_year: number | null
          university: string | null
          university_major: string | null
          university_year: number | null
          graduate_school: string | null
          graduate_major: string | null
          phone_primary: string | null
          phone_secondary: string | null
          email_primary: string | null
          email_secondary: string | null
          sns_links: Record<string, string>
          current_organization: string | null
          current_position: string | null
          current_department: string | null
          sensitivity: SensitivityLevel
          personal_notes: string | null
          tags: string[]
          exam_batch: string | null
          political_tendency: string | null
          specialty_areas: string[]
          completeness_score: number
          last_crawled_at: string | null
          crawl_source_url: string | null
          needs_review: boolean
          is_deleted: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['sources']['Row'], 'id' | 'completeness_score' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['sources']['Insert']>
      }
      source_positions: {
        Row: {
          id: string
          source_id: string
          organization: string
          department: string | null
          position: string
          rank: string | null
          started_at: string
          ended_at: string | null
          is_current: boolean
          change_source: string | null
          change_note: string | null
          created_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['source_positions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['source_positions']['Insert']>
      }
      source_education: {
        Row: {
          id: string
          source_id: string
          school_type: string
          school_name: string
          department: string | null
          degree: string | null
          admission_year: number | null
          graduation_year: number | null
          is_graduated: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['source_education']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['source_education']['Insert']>
      }
      source_relationships: {
        Row: {
          id: string
          source_a_id: string
          source_b_id: string
          relation_type: string
          relation_label: string | null
          strength: number
          is_bidirectional: boolean
          created_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['source_relationships']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['source_relationships']['Insert']>
      }
      source_access_approvals: {
        Row: {
          id: string
          source_id: string
          requester_id: string
          approver_id: string | null
          reason: string
          status: ApprovalStatus
          requested_at: string
          decided_at: string | null
          expires_at: string | null
          reject_reason: string | null
        }
        Insert: Omit<Database['public']['Tables']['source_access_approvals']['Row'], 'id' | 'requested_at'>
        Update: Partial<Database['public']['Tables']['source_access_approvals']['Insert']>
      }
      audit_logs: {
        Row: {
          id: number
          user_id: string | null
          user_email: string | null
          user_role: UserRole | null
          action: AuditAction
          resource_type: string
          resource_id: string | null
          ip_address: string | null
          user_agent: string | null
          is_vpn_access: boolean
          export_row_count: number | null
          watermark_token: string | null
          metadata: Record<string, unknown>
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'>
        Update: never
      }
      source_edit_history: {
        Row: {
          id: string
          source_id: string
          editor_id: string
          editor_name: string
          field_name: string
          old_value: string | null
          new_value: string | null
          change_note: string | null
          edited_at: string
        }
        Insert: Omit<Database['public']['Tables']['source_edit_history']['Row'], 'id' | 'edited_at'>
        Update: never
      }
      point_transactions: {
        Row: {
          id: string
          user_id: string
          point_type: PointType
          points: number
          related_source_id: string | null
          related_request_id: string | null
          related_user_id: string | null
          description: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['point_transactions']['Row'], 'id' | 'created_at'>
        Update: never
      }
      user_points_summary: {
        Row: {
          user_id: string
          total_points: number
          input_points: number
          contribution_points: number
          help_points: number
          rank_position: number | null
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_points_summary']['Row'], 'updated_at'>
        Update: Partial<Database['public']['Tables']['user_points_summary']['Insert']>
      }
      source_usefulness_ratings: {
        Row: {
          id: string
          source_id: string
          rater_id: string
          rating: number
          comment: string | null
          rated_at: string
        }
        Insert: Omit<Database['public']['Tables']['source_usefulness_ratings']['Row'], 'id' | 'rated_at'>
        Update: Partial<Database['public']['Tables']['source_usefulness_ratings']['Insert']>
      }
      help_requests: {
        Row: {
          id: string
          requester_id: string
          title: string
          body: string | null
          request_type: string
          target_source_id: string | null
          target_name: string | null
          target_org: string | null
          status: HelpStatus
          accepted_response_id: string | null
          reward_points: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['help_requests']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['help_requests']['Insert']>
      }
      help_responses: {
        Row: {
          id: string
          request_id: string
          responder_id: string
          body: string
          attached_source_id: string | null
          is_accepted: boolean
          upvotes: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['help_responses']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['help_responses']['Insert']>
      }
      import_jobs: {
        Row: {
          id: string
          uploader_id: string
          original_filename: string
          storage_path: string
          file_size_bytes: number | null
          total_rows: number | null
          processed_rows: number
          failed_rows: number
          status: string
          ai_column_mapping: Record<string, string> | null
          ai_confidence: Record<string, number> | null
          user_confirmed_mapping: Record<string, string> | null
          error_log: unknown[]
          started_at: string | null
          completed_at: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['import_jobs']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['import_jobs']['Insert']>
      }
      export_logs: {
        Row: {
          id: string
          user_id: string
          row_count: number
          filter_params: Record<string, unknown> | null
          watermark_id: string
          exported_at: string
        }
        Insert: Omit<Database['public']['Tables']['export_logs']['Row'], 'id' | 'exported_at'>
        Update: never
      }
      information_reports: {
        Row: {
          id: string
          author_id: string
          title: string
          content: string
          tags: string[]
          visibility: ReportVisibility
          is_deleted: boolean
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['information_reports']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['information_reports']['Insert']>
      }
      report_sources: {
        Row: {
          id: string
          report_id: string
          source_id: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['report_sources']['Row'], 'id' | 'created_at'>
        Update: never
      }
    }
    Views: Record<string, never>
    Functions: {
      current_user_role: { Args: Record<string, never>; Returns: UserRole }
      is_admin: { Args: Record<string, never>; Returns: boolean }
      is_active_user: { Args: Record<string, never>; Returns: boolean }
      has_approved_access: { Args: { p_source_id: string }; Returns: boolean }
    }
    Enums: {
      user_role: UserRole
      source_visibility: SourceVisibility
      sensitivity_level: SensitivityLevel
      approval_status: ApprovalStatus
      audit_action: AuditAction
      point_type: PointType
      help_status: HelpStatus
    }
  }
}

// 편의 타입 별칭
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

// ── 정보보고 편의 타입 ────────────────────────────────────────────────────────
export type InformationReport = Database['public']['Tables']['information_reports']['Row']
export type ReportSource = Database['public']['Tables']['report_sources']['Row']
