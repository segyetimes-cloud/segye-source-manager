export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      announcements: {
        Row: {
          id: string
          title: string
          body: string | null
          is_pinned: boolean
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          body?: string | null
          is_pinned?: boolean
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          body?: string | null
          is_pinned?: boolean
          created_by?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      audit_logs: {
        Row: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at: string
          export_row_count: number | null
          id: number
          ip_address: unknown
          is_vpn_access: boolean | null
          metadata: Json | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
          user_role: Database["public"]["Enums"]["user_role"] | null
          watermark_token: string | null
        }
        Insert: {
          action: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          export_row_count?: number | null
          id?: number
          ip_address?: unknown
          is_vpn_access?: boolean | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: Database["public"]["Enums"]["user_role"] | null
          watermark_token?: string | null
        }
        Update: {
          action?: Database["public"]["Enums"]["audit_action"]
          created_at?: string
          export_row_count?: number | null
          id?: number
          ip_address?: unknown
          is_vpn_access?: boolean | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
          user_role?: Database["public"]["Enums"]["user_role"] | null
          watermark_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_logs: {
        Row: {
          contacted_at: string
          created_at: string
          id: string
          is_sensitive: boolean
          method: string
          next_followup_at: string | null
          result: string | null
          source_id: string
          summary: string
          user_id: string
        }
        Insert: {
          contacted_at?: string
          created_at?: string
          id?: string
          is_sensitive?: boolean
          method?: string
          next_followup_at?: string | null
          result?: string | null
          source_id: string
          summary: string
          user_id: string
        }
        Update: {
          contacted_at?: string
          created_at?: string
          id?: string
          is_sensitive?: boolean
          method?: string
          next_followup_at?: string | null
          result?: string | null
          source_id?: string
          summary?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_logs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      export_logs: {
        Row: {
          exported_at: string
          filter_params: Json | null
          id: string
          row_count: number
          user_id: string
          watermark_id: string
        }
        Insert: {
          exported_at?: string
          filter_params?: Json | null
          id?: string
          row_count: number
          user_id: string
          watermark_id: string
        }
        Update: {
          exported_at?: string
          filter_params?: Json | null
          id?: string
          row_count?: number
          user_id?: string
          watermark_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      help_requests: {
        Row: {
          accepted_response_id: string | null
          body: string | null
          created_at: string
          id: string
          request_type: string
          requester_id: string
          reward_points: number
          status: Database["public"]["Enums"]["help_status"]
          target_name: string | null
          target_org: string | null
          target_source_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          accepted_response_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          request_type?: string
          requester_id: string
          reward_points?: number
          status?: Database["public"]["Enums"]["help_status"]
          target_name?: string | null
          target_org?: string | null
          target_source_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          accepted_response_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          request_type?: string
          requester_id?: string
          reward_points?: number
          status?: Database["public"]["Enums"]["help_status"]
          target_name?: string | null
          target_org?: string | null
          target_source_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_requests_target_source_id_fkey"
            columns: ["target_source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      help_responses: {
        Row: {
          attached_source_id: string | null
          body: string
          created_at: string
          id: string
          is_accepted: boolean
          request_id: string
          responder_id: string
          updated_at: string
          upvotes: number
        }
        Insert: {
          attached_source_id?: string | null
          body: string
          created_at?: string
          id?: string
          is_accepted?: boolean
          request_id: string
          responder_id: string
          updated_at?: string
          upvotes?: number
        }
        Update: {
          attached_source_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_accepted?: boolean
          request_id?: string
          responder_id?: string
          updated_at?: string
          upvotes?: number
        }
        Relationships: [
          {
            foreignKeyName: "help_responses_attached_source_id_fkey"
            columns: ["attached_source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_responses_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "help_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_responses_responder_id_fkey"
            columns: ["responder_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          ai_column_mapping: Json | null
          ai_confidence: Json | null
          completed_at: string | null
          created_at: string
          error_log: Json | null
          failed_rows: number | null
          file_size_bytes: number | null
          id: string
          original_filename: string
          processed_rows: number | null
          started_at: string | null
          status: string
          storage_path: string
          total_rows: number | null
          uploader_id: string
          user_confirmed_mapping: Json | null
        }
        Insert: {
          ai_column_mapping?: Json | null
          ai_confidence?: Json | null
          completed_at?: string | null
          created_at?: string
          error_log?: Json | null
          failed_rows?: number | null
          file_size_bytes?: number | null
          id?: string
          original_filename: string
          processed_rows?: number | null
          started_at?: string | null
          status?: string
          storage_path: string
          total_rows?: number | null
          uploader_id: string
          user_confirmed_mapping?: Json | null
        }
        Update: {
          ai_column_mapping?: Json | null
          ai_confidence?: Json | null
          completed_at?: string | null
          created_at?: string
          error_log?: Json | null
          failed_rows?: number | null
          file_size_bytes?: number | null
          id?: string
          original_filename?: string
          processed_rows?: number | null
          started_at?: string | null
          status?: string
          storage_path?: string
          total_rows?: number | null
          uploader_id?: string
          user_confirmed_mapping?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      information_reports: {
        Row: {
          author_department: string | null
          author_id: string
          category: string | null
          content: string
          created_at: string
          id: string
          is_deleted: boolean
          review_note: string | null
          reviewed_at: string | null
          reviewer_id: string | null
          sensitive_content: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          author_department?: string | null
          author_id: string
          category?: string | null
          content: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          sensitive_content?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_department?: string | null
          author_id?: string
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          is_deleted?: boolean
          review_note?: string | null
          reviewed_at?: string | null
          reviewer_id?: string | null
          sensitive_content?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "information_reports_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "information_reports_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          link_path: string | null
          related_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link_path?: string | null
          related_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          link_path?: string | null
          related_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      org_chart_reference: {
        Row: {
          department: string
          ext: string | null
          full_name: string
          id: number
          rank: string
        }
        Insert: {
          department: string
          ext?: string | null
          full_name: string
          id?: number
          rank: string
        }
        Update: {
          department?: string
          ext?: string | null
          full_name?: string
          id?: number
          rank?: string
        }
        Relationships: []
      }
      point_transactions: {
        Row: {
          created_at: string
          description: string | null
          id: string
          point_type: Database["public"]["Enums"]["point_type"]
          points: number
          related_report_id: string | null
          related_request_id: string | null
          related_source_id: string | null
          related_user_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          point_type: Database["public"]["Enums"]["point_type"]
          points: number
          related_report_id?: string | null
          related_request_id?: string | null
          related_source_id?: string | null
          related_user_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          point_type?: Database["public"]["Enums"]["point_type"]
          points?: number
          related_report_id?: string | null
          related_request_id?: string | null
          related_source_id?: string | null
          related_user_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_transactions_related_report_id_fkey"
            columns: ["related_report_id"]
            isOneToOne: false
            referencedRelation: "information_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_related_source_id_fkey"
            columns: ["related_source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_related_user_id_fkey"
            columns: ["related_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          desk_name: string | null
          email: string
          employee_id: string | null
          full_name: string
          id: string
          is_active: boolean
          last_login_at: string | null
          phone: string | null
          rank: Database["public"]["Enums"]["reporter_rank"] | null
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          desk_name?: string | null
          email: string
          employee_id?: string | null
          full_name?: string
          id: string
          is_active?: boolean
          last_login_at?: string | null
          phone?: string | null
          rank?: Database["public"]["Enums"]["reporter_rank"] | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          desk_name?: string | null
          email?: string
          employee_id?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          last_login_at?: string | null
          phone?: string | null
          rank?: Database["public"]["Enums"]["reporter_rank"] | null
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          reset_at: string
        }
        Insert: {
          count?: number
          key: string
          reset_at: string
        }
        Update: {
          count?: number
          key?: string
          reset_at?: string
        }
        Relationships: []
      }
      report_allowed_users: {
        Row: {
          created_at: string | null
          granted_by: string
          id: string
          report_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          granted_by: string
          id?: string
          report_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          granted_by?: string
          id?: string
          report_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_allowed_users_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_allowed_users_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "information_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_allowed_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_attachments: {
        Row: {
          id: string
          report_id: string
          filename: string
          storage_path: string
          file_size: number
          mime_type: string
          uploaded_by: string
          created_at: string
        }
        Insert: {
          id?: string
          report_id: string
          filename: string
          storage_path: string
          file_size?: number
          mime_type?: string
          uploaded_by: string
          created_at?: string
        }
        Update: {
          id?: string
          report_id?: string
          filename?: string
          storage_path?: string
          file_size?: number
          mime_type?: string
          uploaded_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_attachments_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "information_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_copy_logs: {
        Row: {
          copied_length: number | null
          copied_preview: string | null
          created_at: string | null
          id: string
          report_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          copied_length?: number | null
          copied_preview?: string | null
          created_at?: string | null
          id?: string
          report_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          copied_length?: number | null
          copied_preview?: string | null
          created_at?: string | null
          id?: string
          report_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_copy_logs_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "information_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_drafts: {
        Row: {
          allowed_user_ids: string[]
          author_id: string
          category: string
          content: string
          id: string
          source_ids: string[]
          tags: string[]
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          allowed_user_ids?: string[]
          author_id: string
          category?: string
          content?: string
          id?: string
          source_ids?: string[]
          tags?: string[]
          title?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          allowed_user_ids?: string[]
          author_id?: string
          category?: string
          content?: string
          id?: string
          source_ids?: string[]
          tags?: string[]
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_drafts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      report_revisions: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: string
          report_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          report_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_revisions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_revisions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "information_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_sources: {
        Row: {
          created_at: string
          id: string
          report_id: string
          source_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          report_id: string
          source_id: string
        }
        Update: {
          created_at?: string
          id?: string
          report_id?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_sources_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "information_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_access_approvals: {
        Row: {
          approver_id: string | null
          decided_at: string | null
          expires_at: string | null
          id: string
          reason: string
          reject_reason: string | null
          requested_at: string
          requester_id: string
          source_id: string
          status: Database["public"]["Enums"]["approval_status"]
        }
        Insert: {
          approver_id?: string | null
          decided_at?: string | null
          expires_at?: string | null
          id?: string
          reason: string
          reject_reason?: string | null
          requested_at?: string
          requester_id: string
          source_id: string
          status?: Database["public"]["Enums"]["approval_status"]
        }
        Update: {
          approver_id?: string | null
          decided_at?: string | null
          expires_at?: string | null
          id?: string
          reason?: string
          reject_reason?: string | null
          requested_at?: string
          requester_id?: string
          source_id?: string
          status?: Database["public"]["Enums"]["approval_status"]
        }
        Relationships: [
          {
            foreignKeyName: "source_access_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_access_approvals_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_access_approvals_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_bookmarks: {
        Row: {
          created_at: string
          id: string
          source_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          source_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          source_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_bookmarks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_copy_logs: {
        Row: {
          copied_length: number | null
          copied_preview: string | null
          created_at: string | null
          id: string
          source_id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          copied_length?: number | null
          copied_preview?: string | null
          created_at?: string | null
          id?: string
          source_id: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          copied_length?: number | null
          copied_preview?: string | null
          created_at?: string | null
          id?: string
          source_id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_copy_logs_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_edit_history: {
        Row: {
          change_note: string | null
          edited_at: string
          editor_id: string
          editor_name: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          source_id: string
        }
        Insert: {
          change_note?: string | null
          edited_at?: string
          editor_id: string
          editor_name: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          source_id: string
        }
        Update: {
          change_note?: string | null
          edited_at?: string
          editor_id?: string
          editor_name?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_edit_history_editor_id_fkey"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_edit_history_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_education: {
        Row: {
          admission_year: number | null
          created_at: string
          degree: string | null
          department: string | null
          graduation_year: number | null
          id: string
          is_graduated: boolean | null
          school_name: string
          school_type: string
          source_id: string
        }
        Insert: {
          admission_year?: number | null
          created_at?: string
          degree?: string | null
          department?: string | null
          graduation_year?: number | null
          id?: string
          is_graduated?: boolean | null
          school_name: string
          school_type: string
          source_id: string
        }
        Update: {
          admission_year?: number | null
          created_at?: string
          degree?: string | null
          department?: string | null
          graduation_year?: number | null
          id?: string
          is_graduated?: boolean | null
          school_name?: string
          school_type?: string
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_education_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_notes: {
        Row: {
          author_id: string
          content: string
          created_at: string | null
          id: string
          is_sensitive: boolean | null
          source_id: string
          updated_at: string | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string | null
          id?: string
          is_sensitive?: boolean | null
          source_id: string
          updated_at?: string | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_sensitive?: boolean | null
          source_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "source_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_notes_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_positions: {
        Row: {
          change_note: string | null
          change_source: string | null
          created_at: string
          created_by: string | null
          department: string | null
          ended_at: string | null
          id: string
          is_current: boolean
          organization: string
          position: string
          rank: string | null
          source_id: string
          started_at: string
        }
        Insert: {
          change_note?: string | null
          change_source?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          ended_at?: string | null
          id?: string
          is_current?: boolean
          organization: string
          position: string
          rank?: string | null
          source_id: string
          started_at: string
        }
        Update: {
          change_note?: string | null
          change_source?: string | null
          created_at?: string
          created_by?: string | null
          department?: string | null
          ended_at?: string | null
          id?: string
          is_current?: boolean
          organization?: string
          position?: string
          rank?: string | null
          source_id?: string
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_positions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_positions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_relationships: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_bidirectional: boolean | null
          relation_label: string | null
          relation_type: string
          source_a_id: string
          source_b_id: string
          strength: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_bidirectional?: boolean | null
          relation_label?: string | null
          relation_type: string
          source_a_id: string
          source_b_id: string
          strength?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_bidirectional?: boolean | null
          relation_label?: string | null
          relation_type?: string
          source_a_id?: string
          source_b_id?: string
          strength?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "source_relationships_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_relationships_source_a_id_fkey"
            columns: ["source_a_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_relationships_source_b_id_fkey"
            columns: ["source_b_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      source_usefulness_ratings: {
        Row: {
          comment: string | null
          id: string
          rated_at: string
          rater_id: string
          rating: number
          source_id: string
        }
        Insert: {
          comment?: string | null
          id?: string
          rated_at?: string
          rater_id: string
          rating: number
          source_id: string
        }
        Update: {
          comment?: string | null
          id?: string
          rated_at?: string
          rater_id?: string
          rating?: number
          source_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_usefulness_ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_usefulness_ratings_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          birthday: string | null
          birthday_lunar: boolean | null
          completeness_score: number
          crawl_source_url: string | null
          created_at: string
          current_department: string | null
          current_organization: string | null
          current_position: string | null
          email_primary: string | null
          email_secondary: string | null
          exam_batch: string | null
          full_name: string
          gender: string | null
          graduate_major: string | null
          graduate_school: string | null
          high_school: string | null
          high_school_year: number | null
          hometown_city: string | null
          hometown_province: string | null
          id: string
          is_deleted: boolean
          last_crawled_at: string | null
          name_en: string | null
          needs_review: boolean | null
          on_record_status: string | null
          owner_id: string
          personal_notes: string | null
          phone_primary: string | null
          phone_secondary: string | null
          political_tendency: string | null
          public_notes: string | null
          search_vector: unknown
          sensitivity: Database["public"]["Enums"]["sensitivity_level"]
          sns_links: Json | null
          specialty_areas: string[] | null
          tags: string[] | null
          university: string | null
          university_major: string | null
          university_year: number | null
          updated_at: string
          visibility: Database["public"]["Enums"]["source_visibility"]
        }
        Insert: {
          birthday?: string | null
          birthday_lunar?: boolean | null
          completeness_score?: number
          crawl_source_url?: string | null
          created_at?: string
          current_department?: string | null
          current_organization?: string | null
          current_position?: string | null
          email_primary?: string | null
          email_secondary?: string | null
          exam_batch?: string | null
          full_name: string
          gender?: string | null
          graduate_major?: string | null
          graduate_school?: string | null
          high_school?: string | null
          high_school_year?: number | null
          hometown_city?: string | null
          hometown_province?: string | null
          id?: string
          is_deleted?: boolean
          last_crawled_at?: string | null
          name_en?: string | null
          needs_review?: boolean | null
          on_record_status?: string | null
          owner_id: string
          personal_notes?: string | null
          phone_primary?: string | null
          phone_secondary?: string | null
          political_tendency?: string | null
          public_notes?: string | null
          search_vector?: unknown
          sensitivity?: Database["public"]["Enums"]["sensitivity_level"]
          sns_links?: Json | null
          specialty_areas?: string[] | null
          tags?: string[] | null
          university?: string | null
          university_major?: string | null
          university_year?: number | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["source_visibility"]
        }
        Update: {
          birthday?: string | null
          birthday_lunar?: boolean | null
          completeness_score?: number
          crawl_source_url?: string | null
          created_at?: string
          current_department?: string | null
          current_organization?: string | null
          current_position?: string | null
          email_primary?: string | null
          email_secondary?: string | null
          exam_batch?: string | null
          full_name?: string
          gender?: string | null
          graduate_major?: string | null
          graduate_school?: string | null
          high_school?: string | null
          high_school_year?: number | null
          hometown_city?: string | null
          hometown_province?: string | null
          id?: string
          is_deleted?: boolean
          last_crawled_at?: string | null
          name_en?: string | null
          needs_review?: boolean | null
          on_record_status?: string | null
          owner_id?: string
          personal_notes?: string | null
          phone_primary?: string | null
          phone_secondary?: string | null
          political_tendency?: string | null
          public_notes?: string | null
          search_vector?: unknown
          sensitivity?: Database["public"]["Enums"]["sensitivity_level"]
          sns_links?: Json | null
          specialty_areas?: string[] | null
          tags?: string[] | null
          university?: string | null
          university_major?: string | null
          university_year?: number | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["source_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "sources_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          device_label: string | null
          fingerprint_hash: string
          first_seen_at: string
          id: string
          ip_address: string | null
          last_seen_at: string
          user_id: string
        }
        Insert: {
          device_label?: string | null
          fingerprint_hash: string
          first_seen_at?: string
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          user_id: string
        }
        Update: {
          device_label?: string | null
          fingerprint_hash?: string
          first_seen_at?: string
          id?: string
          ip_address?: string | null
          last_seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_points_summary: {
        Row: {
          contribution_points: number
          help_points: number
          input_points: number
          rank_position: number | null
          total_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          contribution_points?: number
          help_points?: number
          input_points?: number
          rank_position?: number | null
          total_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          contribution_points?: number
          help_points?: number
          input_points?: number
          rank_position?: number | null
          total_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_points_summary_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      has_approved_access: { Args: { p_source_id: string }; Returns: boolean }
      is_active_user: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_deputy_or_above: { Args: never; Returns: boolean }
      is_desk_or_above: { Args: never; Returns: boolean }
      rate_limit_check: {
        Args: { p_key: string; p_limit: number; p_window_ms: number }
        Returns: {
          allowed: boolean
          count: number
          reset_at: string
        }[]
      }
      rate_limit_cleanup: { Args: never; Returns: undefined }
      try_log_export: {
        Args: {
          p_daily_limit: number
          p_filter_params: Json
          p_row_count: number
          p_user_id: string
          p_watermark_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      approval_status: "pending" | "approved" | "rejected"
      audit_action:
        | "view"
        | "create"
        | "update"
        | "delete"
        | "export"
        | "import"
        | "view_private"
        | "approve"
        | "reject"
        | "note_create"
        | "note_view"
        | "note_delete"
        | "copy"
        | "points_award"
        | "rating"
        | "login"
        | "login_failed"
        | "logout"
        | "idle_logout"
        | "new_device_login"
        | "session_invalidate_others"
        | "report_create"
        | "report_update"
        | "report_delete"
        | "report_submit"
        | "report_approve"
        | "report_reject"
      help_status: "open" | "resolved" | "closed"
      point_type:
        | "source_created"
        | "source_completed"
        | "contribution_used"
        | "usefulness_rating"
        | "help_provided"
        | "help_accepted"
        | "daily_login"
        | "penalty_deduct"
        | "note_created"
        | "report_award"
      reporter_rank: "기자" | "차장" | "부장" | "부국장" | "편집국장" | "편집인"
      sensitivity_level: "public" | "private"
      source_visibility: "personal" | "shared"
      user_role:
        | "superadmin"
        | "admin"
        | "deputy"
        | "reporter"
        | "section_editor"
        | "editor"
        | "publisher"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      approval_status: ["pending", "approved", "rejected"],
      audit_action: [
        "view",
        "create",
        "update",
        "delete",
        "export",
        "import",
        "view_private",
        "approve",
        "reject",
        "note_create",
        "note_view",
        "note_delete",
        "copy",
        "points_award",
        "rating",
        "login",
        "login_failed",
        "logout",
        "idle_logout",
        "new_device_login",
        "session_invalidate_others",
        "report_create",
        "report_update",
        "report_delete",
        "report_submit",
        "report_approve",
        "report_reject",
      ],
      help_status: ["open", "resolved", "closed"],
      point_type: [
        "source_created",
        "source_completed",
        "contribution_used",
        "usefulness_rating",
        "help_provided",
        "help_accepted",
        "daily_login",
        "penalty_deduct",
        "note_created",
        "report_award",
      ],
      reporter_rank: ["기자", "차장", "부장", "부국장", "편집국장", "편집인"],
      sensitivity_level: ["public", "private"],
      source_visibility: ["personal", "shared"],
      user_role: [
        "superadmin",
        "admin",
        "deputy",
        "reporter",
        "section_editor",
        "editor",
        "publisher",
      ],
    },
  },
} as const
