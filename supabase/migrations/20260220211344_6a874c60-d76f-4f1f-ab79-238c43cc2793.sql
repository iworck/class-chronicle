
-- Add lesson_entry_id FK to link sessions to specific lesson plan entries
ALTER TABLE public.attendance_sessions
ADD COLUMN lesson_entry_id uuid REFERENCES public.lesson_plan_entries(id);

-- Add close_token_hash for secure session closing verification
ALTER TABLE public.attendance_sessions
ADD COLUMN close_token_hash character varying;

-- Index for quick lookup
CREATE INDEX idx_attendance_sessions_lesson_entry_id ON public.attendance_sessions(lesson_entry_id);
