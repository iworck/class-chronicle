-- Audit log for deleted attendance sessions
CREATE TABLE public.attendance_session_deletions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  class_id uuid NOT NULL,
  subject_id uuid NOT NULL,
  lesson_entry_id uuid,
  opened_at timestamptz,
  closed_at timestamptz,
  session_status text,
  records_deleted_count integer NOT NULL DEFAULT 0,
  deleted_by_user_id uuid NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  reason text DEFAULT 'Exclusão manual pelo professor'
);

ALTER TABLE public.attendance_session_deletions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view deletion logs"
ON public.attendance_session_deletions
FOR SELECT USING (is_staff(auth.uid()));

CREATE POLICY "Authenticated users can insert deletion logs"
ON public.attendance_session_deletions
FOR INSERT WITH CHECK (auth.uid() = deleted_by_user_id);
