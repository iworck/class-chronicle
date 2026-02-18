
-- Fix professor grade update policy: allow professors to update grades for enrollments in their class subjects
DROP POLICY IF EXISTS "Professors can update their own grades" ON public.student_grades;
DROP POLICY IF EXISTS "Professors can insert grades" ON public.student_grades;

-- New INSERT policy: professor can insert grades for their class subjects (grades_closed must be false)
CREATE POLICY "Professors can insert grades for their subjects"
ON public.student_grades FOR INSERT
WITH CHECK (
  has_role(auth.uid(), 'professor'::app_role)
  AND professor_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.student_subject_enrollments sse
    JOIN public.class_students cs ON cs.student_id = sse.student_id
    JOIN public.class_subjects csub
      ON csub.class_id = cs.class_id
      AND csub.subject_id = sse.subject_id
    WHERE sse.id = student_grades.enrollment_id
      AND csub.professor_user_id = auth.uid()
      AND csub.grades_closed = false
      AND csub.status = 'ATIVO'
  )
);

-- New UPDATE policy: professor can update grades for enrollments in their class subjects
CREATE POLICY "Professors can update grades for their subjects"
ON public.student_grades FOR UPDATE
USING (
  has_role(auth.uid(), 'professor'::app_role)
  AND EXISTS (
    SELECT 1
    FROM public.student_subject_enrollments sse
    JOIN public.class_students cs ON cs.student_id = sse.student_id
    JOIN public.class_subjects csub
      ON csub.class_id = cs.class_id
      AND csub.subject_id = sse.subject_id
    WHERE sse.id = student_grades.enrollment_id
      AND csub.professor_user_id = auth.uid()
      AND csub.grades_closed = false
      AND csub.status = 'ATIVO'
  )
)
WITH CHECK (
  has_role(auth.uid(), 'professor'::app_role)
  AND professor_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.student_subject_enrollments sse
    JOIN public.class_students cs ON cs.student_id = sse.student_id
    JOIN public.class_subjects csub
      ON csub.class_id = cs.class_id
      AND csub.subject_id = sse.subject_id
    WHERE sse.id = student_grades.enrollment_id
      AND csub.professor_user_id = auth.uid()
      AND csub.grades_closed = false
      AND csub.status = 'ATIVO'
  )
);
