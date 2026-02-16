-- Make course_id nullable since course assignment happens during enrollment
ALTER TABLE public.students ALTER COLUMN course_id DROP NOT NULL;