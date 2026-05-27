-- Migration: report_attachments table
-- Stores file attachments for information_reports.
-- NOTE: Requires a `report-attachments` bucket in Supabase Storage Dashboard (public = false).

CREATE TABLE IF NOT EXISTS report_attachments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id    UUID        NOT NULL REFERENCES information_reports(id) ON DELETE CASCADE,
  filename     TEXT        NOT NULL,
  storage_path TEXT        NOT NULL,
  file_size    BIGINT      NOT NULL DEFAULT 0,
  mime_type    TEXT        NOT NULL DEFAULT 'application/octet-stream',
  uploaded_by  UUID        NOT NULL REFERENCES profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON report_attachments(report_id);

ALTER TABLE report_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments of reports they can access"
  ON report_attachments FOR SELECT USING (true);

CREATE POLICY "Users can insert their own attachments"
  ON report_attachments FOR INSERT WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Users can delete their own attachments"
  ON report_attachments FOR DELETE USING (uploaded_by = auth.uid());
