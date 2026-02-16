
-- Add coordinator_user_id to courses
ALTER TABLE public.courses
ADD COLUMN coordinator_user_id uuid DEFAULT null;
