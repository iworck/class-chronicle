
-- Add user_id column to students to link to auth.users
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);

-- Add unique constraint (one auth account per student)
ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_user_id_key;
ALTER TABLE public.students
  ADD CONSTRAINT students_user_id_key UNIQUE (user_id);

-- RLS: students can view their own record
CREATE POLICY "Students can view their own record"
  ON public.students FOR SELECT
  USING (auth.uid() = user_id);

-- RLS: students can view their own details
CREATE POLICY "Students can view their own details"
  ON public.student_details FOR SELECT
  USING (student_id IN (
    SELECT id FROM public.students WHERE user_id = auth.uid()
  ));

-- RLS: students can view their own course links
CREATE POLICY "Students can view their own course links"
  ON public.student_course_links FOR SELECT
  USING (student_id IN (
    SELECT id FROM public.students WHERE user_id = auth.uid()
  ));

-- RLS: students can view their own subject enrollments
CREATE POLICY "Students can view their own enrollments"
  ON public.student_subject_enrollments FOR SELECT
  USING (student_id IN (
    SELECT id FROM public.students WHERE user_id = auth.uid()
  ));

-- RLS: students can view their own grades
CREATE POLICY "Students can view their own grades"
  ON public.student_grades FOR SELECT
  USING (enrollment_id IN (
    SELECT sse.id FROM public.student_subject_enrollments sse
    JOIN public.students s ON s.id = sse.student_id
    WHERE s.user_id = auth.uid()
  ));

-- RLS: students can view their own attendance records
CREATE POLICY "Students can view their own attendance records"
  ON public.attendance_records FOR SELECT
  USING (student_id IN (
    SELECT id FROM public.students WHERE user_id = auth.uid()
  ));
