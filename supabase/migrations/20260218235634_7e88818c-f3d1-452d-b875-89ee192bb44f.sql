-- Allow students to read subjects (needed for joined queries in student portal)
CREATE POLICY "Students can view subjects"
ON public.subjects FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.user_id = auth.uid()
  )
);

-- Allow students to read courses
CREATE POLICY "Students can view courses"
ON public.courses FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.user_id = auth.uid()
  )
);

-- Allow students to read academic_matrices
CREATE POLICY "Students can view academic matrices"
ON public.academic_matrices FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.students
    WHERE students.user_id = auth.uid()
  )
);

-- Allow students to view attendance sessions for their enrolled subjects
CREATE POLICY "Students can view attendance sessions"
ON public.attendance_sessions FOR SELECT
USING (
  subject_id IN (
    SELECT sse.subject_id 
    FROM public.student_subject_enrollments sse
    JOIN public.students s ON s.id = sse.student_id
    WHERE s.user_id = auth.uid()
  )
);
