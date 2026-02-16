
-- Create enum for subject enrollment status
CREATE TYPE public.enrollment_subject_status AS ENUM ('CURSANDO', 'APROVADO', 'REPROVADO', 'TRANCADO');

-- Table to track individual subject enrollments per student
CREATE TABLE public.student_subject_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  matrix_id UUID NOT NULL REFERENCES public.academic_matrices(id),
  subject_id UUID NOT NULL REFERENCES public.subjects(id),
  semester INTEGER NOT NULL DEFAULT 1,
  status public.enrollment_subject_status NOT NULL DEFAULT 'CURSANDO',
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(student_id, matrix_id, subject_id)
);

-- Enable RLS
ALTER TABLE public.student_subject_enrollments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Staff can view student enrollments"
ON public.student_subject_enrollments FOR SELECT
USING (is_staff(auth.uid()));

CREATE POLICY "Admin coord gerente can manage enrollments"
ON public.student_subject_enrollments FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'coordenador'::app_role) OR 
  has_role(auth.uid(), 'gerente'::app_role)
);

CREATE POLICY "Super admin can manage all enrollments"
ON public.student_subject_enrollments FOR ALL
USING (is_super_admin(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_student_subject_enrollments_updated_at
BEFORE UPDATE ON public.student_subject_enrollments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for performance
CREATE INDEX idx_student_subject_enrollments_student ON public.student_subject_enrollments(student_id);
CREATE INDEX idx_student_subject_enrollments_matrix ON public.student_subject_enrollments(matrix_id);
