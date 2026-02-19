
-- Allow students to view grade template items for subjects they are enrolled in
CREATE POLICY "Students can view grade template items for their subjects"
ON public.grade_template_items
FOR SELECT
USING (
  class_subject_id IN (
    SELECT cs.id
    FROM class_subjects cs
    WHERE cs.subject_id IN (
      SELECT sse.subject_id
      FROM student_subject_enrollments sse
      JOIN students s ON s.id = sse.student_id
      WHERE s.user_id = auth.uid()
    )
  )
);
