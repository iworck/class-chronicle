-- Add diretor role to the admin/coord policy for managing grades
DROP POLICY IF EXISTS "Admin and coord can manage all grades" ON public.student_grades;
CREATE POLICY "Admin coord and diretor can manage all grades"
  ON public.student_grades
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR has_role(auth.uid(), 'diretor'::app_role)
    OR is_super_admin(auth.uid())
  );