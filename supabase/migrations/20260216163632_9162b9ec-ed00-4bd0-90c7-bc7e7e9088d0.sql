
-- Add course_id to subjects table to link disciplines to courses
ALTER TABLE public.subjects
ADD COLUMN course_id uuid REFERENCES public.courses(id) DEFAULT null;

-- Create index for performance
CREATE INDEX idx_subjects_course_id ON public.subjects(course_id);
