
-- Allow coordinators to manage subjects linked to their courses
CREATE POLICY "Coordinator can manage subjects of their courses"
ON public.subjects FOR ALL
USING (
  has_role(auth.uid(), 'coordenador'::app_role)
  AND course_id IN (
    SELECT id FROM public.courses WHERE coordinator_user_id = auth.uid()
  )
);

-- Allow coordinators to manage academic matrices linked to their courses
CREATE POLICY "Coordinator can manage matrices of their courses"
ON public.academic_matrices FOR ALL
USING (
  has_role(auth.uid(), 'coordenador'::app_role)
  AND course_id IN (
    SELECT id FROM public.courses WHERE coordinator_user_id = auth.uid()
  )
);

-- Allow coordinators to manage matrix_subjects for matrices of their courses
CREATE POLICY "Coordinator can manage matrix subjects of their courses"
ON public.matrix_subjects FOR ALL
USING (
  has_role(auth.uid(), 'coordenador'::app_role)
  AND matrix_id IN (
    SELECT am.id FROM public.academic_matrices am
    JOIN public.courses c ON am.course_id = c.id
    WHERE c.coordinator_user_id = auth.uid()
  )
);
