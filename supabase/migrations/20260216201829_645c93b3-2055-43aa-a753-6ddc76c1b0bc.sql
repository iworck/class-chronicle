
-- Add grades_closed flag to class_subjects
ALTER TABLE public.class_subjects ADD COLUMN grades_closed boolean NOT NULL DEFAULT false;
