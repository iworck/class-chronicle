
-- Table for professor lesson plan entries per class_subject
CREATE TABLE public.lesson_plan_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  class_subject_id UUID NOT NULL REFERENCES public.class_subjects(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  entry_type TEXT NOT NULL DEFAULT 'AULA' CHECK (entry_type IN ('AULA', 'ATIVIDADE', 'AVALIACAO')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lesson_plan_entries ENABLE ROW LEVEL SECURITY;

-- Professor can manage their own lesson plans
CREATE POLICY "Professors can manage their lesson plan entries"
ON public.lesson_plan_entries
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.class_subjects cs
    WHERE cs.id = lesson_plan_entries.class_subject_id
    AND cs.professor_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.class_subjects cs
    WHERE cs.id = lesson_plan_entries.class_subject_id
    AND cs.professor_user_id = auth.uid()
  )
);

-- Staff can view all lesson plan entries
CREATE POLICY "Staff can view lesson plan entries"
ON public.lesson_plan_entries
FOR SELECT
USING (is_staff(auth.uid()));

-- Admin/coord/super_admin can manage all lesson plan entries
CREATE POLICY "Admins can manage all lesson plan entries"
ON public.lesson_plan_entries
FOR ALL
USING (
  is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role)
)
WITH CHECK (
  is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'coordenador'::app_role)
);

-- Trigger for updated_at
CREATE TRIGGER update_lesson_plan_entries_updated_at
BEFORE UPDATE ON public.lesson_plan_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_lesson_plan_entries_class_subject ON public.lesson_plan_entries(class_subject_id);
CREATE INDEX idx_lesson_plan_entries_date ON public.lesson_plan_entries(entry_date);
