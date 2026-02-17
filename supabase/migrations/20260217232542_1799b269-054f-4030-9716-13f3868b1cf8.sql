-- Allow professors to update their own class_subjects (ementa, bibliografias)
CREATE POLICY "Professors can update their own class subjects"
ON public.class_subjects
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'professor'::app_role) 
  AND professor_user_id = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'professor'::app_role) 
  AND professor_user_id = auth.uid()
);