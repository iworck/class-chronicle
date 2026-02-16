
-- Add Diretor to class_subjects management policy
DROP POLICY IF EXISTS "Coordinators and admin can manage class subjects" ON public.class_subjects;
CREATE POLICY "Admin coord diretor gerente can manage class subjects"
  ON public.class_subjects
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR has_role(auth.uid(), 'diretor'::app_role)
    OR has_role(auth.uid(), 'gerente'::app_role)
    OR is_super_admin(auth.uid())
  );

-- Add Diretor to classes management policy
DROP POLICY IF EXISTS "Coordinators and admin can manage classes" ON public.classes;
CREATE POLICY "Admin coord diretor gerente can manage classes"
  ON public.classes
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR has_role(auth.uid(), 'diretor'::app_role)
    OR has_role(auth.uid(), 'gerente'::app_role)
    OR is_super_admin(auth.uid())
  );

-- Add Diretor to class_students management policy
DROP POLICY IF EXISTS "Coordinators and admin can manage class students" ON public.class_students;
CREATE POLICY "Admin coord diretor gerente can manage class students"
  ON public.class_students
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR has_role(auth.uid(), 'diretor'::app_role)
    OR has_role(auth.uid(), 'gerente'::app_role)
    OR is_super_admin(auth.uid())
  );

-- Add Diretor to students management policy
DROP POLICY IF EXISTS "Coordinators and admin can manage students" ON public.students;
CREATE POLICY "Admin coord diretor gerente can manage students"
  ON public.students
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR has_role(auth.uid(), 'diretor'::app_role)
    OR has_role(auth.uid(), 'gerente'::app_role)
    OR is_super_admin(auth.uid())
  );

-- Add Diretor to student_subject_enrollments management policy
DROP POLICY IF EXISTS "Admin coord gerente can manage enrollments" ON public.student_subject_enrollments;
CREATE POLICY "Admin coord diretor gerente can manage enrollments"
  ON public.student_subject_enrollments
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR has_role(auth.uid(), 'diretor'::app_role)
    OR has_role(auth.uid(), 'gerente'::app_role)
    OR is_super_admin(auth.uid())
  );

-- Add Gerente to student_grades management policy
DROP POLICY IF EXISTS "Admin coord and diretor can manage all grades" ON public.student_grades;
CREATE POLICY "Admin coord diretor gerente can manage all grades"
  ON public.student_grades
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR has_role(auth.uid(), 'diretor'::app_role)
    OR has_role(auth.uid(), 'gerente'::app_role)
    OR is_super_admin(auth.uid())
  );
