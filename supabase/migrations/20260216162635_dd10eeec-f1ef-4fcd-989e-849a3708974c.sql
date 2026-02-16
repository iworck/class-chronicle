
-- Update RLS: allow diretor and gerente to manage courses
DROP POLICY IF EXISTS "Admin can manage courses" ON public.courses;

CREATE POLICY "Admin diretor gerente can manage courses"
ON public.courses
FOR ALL
USING (
  is_super_admin(auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'diretor'::app_role)
  OR has_role(auth.uid(), 'gerente'::app_role)
);
