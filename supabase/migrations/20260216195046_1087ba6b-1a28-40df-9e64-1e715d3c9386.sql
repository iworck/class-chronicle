-- Fix: Add WITH CHECK to professor UPDATE policy so the new row values also pass RLS
DROP POLICY IF EXISTS "Professors can update their own grades" ON public.student_grades;
CREATE POLICY "Professors can update their own grades"
  ON public.student_grades
  FOR UPDATE
  USING (has_role(auth.uid(), 'professor'::app_role) AND professor_user_id = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'professor'::app_role) AND professor_user_id = auth.uid());