-- Add plan approval status to class_subjects
-- PENDENTE = professor still editing, APROVADO = coordinator approved (locked for edits, visible to students)
ALTER TABLE public.class_subjects
ADD COLUMN plan_status text NOT NULL DEFAULT 'PENDENTE';

-- Add comment for clarity
COMMENT ON COLUMN public.class_subjects.plan_status IS 'PENDENTE = editable by professor, APROVADO = locked/approved by coordinator, visible to students';