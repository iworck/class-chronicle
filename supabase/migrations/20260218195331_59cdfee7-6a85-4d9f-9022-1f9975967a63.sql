
-- Add DELETE policy for professors on student_grades
-- Without this, deletions are silently ignored (RLS filters them out, no error returned)
CREATE POLICY "Professors can delete grades for their subjects"
ON public.student_grades
FOR DELETE
USING (
  has_role(auth.uid(), 'professor'::app_role)
  AND professor_user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM student_subject_enrollments sse
    JOIN class_students cs ON cs.student_id = sse.student_id
    JOIN class_subjects csub ON csub.class_id = cs.class_id AND csub.subject_id = sse.subject_id
    WHERE sse.id = student_grades.enrollment_id
      AND csub.professor_user_id = auth.uid()
      AND csub.grades_closed = false
      AND csub.status = 'ATIVO'
  )
);
