
-- Add device fingerprint and review columns to attendance_records
ALTER TABLE public.attendance_records 
  ADD COLUMN IF NOT EXISTS device_fingerprint text,
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_reason text;

-- Update the existing RLS policy to allow anon users to also read sessions by class code
-- (needed for the new flow where students look up sessions by class code)

-- Allow public/anon to read open sessions by class code (for attendance registration)
CREATE POLICY "Public can view open sessions by class code"
  ON public.attendance_sessions
  FOR SELECT
  USING (status = 'ABERTA'::session_status);
