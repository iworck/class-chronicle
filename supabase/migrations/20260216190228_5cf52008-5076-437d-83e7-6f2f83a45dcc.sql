
-- Grade template items linked to class_subjects
-- Supports parent/child hierarchy: sub-items compose a parent item
-- counts_in_final determines if item directly impacts the final weighted average
CREATE TABLE public.grade_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_subject_id UUID NOT NULL REFERENCES public.class_subjects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'prova',
  weight NUMERIC NOT NULL DEFAULT 1,
  counts_in_final BOOLEAN NOT NULL DEFAULT true,
  parent_item_id UUID REFERENCES public.grade_template_items(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by class_subject
CREATE INDEX idx_grade_template_items_class_subject ON public.grade_template_items(class_subject_id);

-- RLS
ALTER TABLE public.grade_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view grade templates"
ON public.grade_template_items FOR SELECT
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert grade templates"
ON public.grade_template_items FOR INSERT
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update grade templates"
ON public.grade_template_items FOR UPDATE
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can delete grade templates"
ON public.grade_template_items FOR DELETE
USING (public.is_staff(auth.uid()));

-- Also add counts_in_final to student_grades so we track which grades count
ALTER TABLE public.student_grades ADD COLUMN IF NOT EXISTS counts_in_final BOOLEAN NOT NULL DEFAULT true;
