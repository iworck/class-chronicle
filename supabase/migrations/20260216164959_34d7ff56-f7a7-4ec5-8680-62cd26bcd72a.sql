
-- Create academic_matrices table
CREATE TABLE public.academic_matrices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code VARCHAR NOT NULL UNIQUE,
  instructions TEXT,
  course_id UUID NOT NULL REFERENCES public.courses(id),
  status public.entity_status NOT NULL DEFAULT 'ATIVO',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create matrix_subjects junction table
CREATE TABLE public.matrix_subjects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  matrix_id UUID NOT NULL REFERENCES public.academic_matrices(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id),
  semester INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(matrix_id, subject_id)
);

-- Enable RLS
ALTER TABLE public.academic_matrices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matrix_subjects ENABLE ROW LEVEL SECURITY;

-- RLS policies for academic_matrices
CREATE POLICY "Staff can view academic matrices" ON public.academic_matrices FOR SELECT USING (is_staff(auth.uid()));
CREATE POLICY "Admin can manage academic matrices" ON public.academic_matrices FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Super admin can manage all academic matrices" ON public.academic_matrices FOR ALL USING (is_super_admin(auth.uid()));

-- RLS policies for matrix_subjects
CREATE POLICY "Staff can view matrix subjects" ON public.matrix_subjects FOR SELECT USING (is_staff(auth.uid()));
CREATE POLICY "Admin can manage matrix subjects" ON public.matrix_subjects FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Super admin can manage all matrix subjects" ON public.matrix_subjects FOR ALL USING (is_super_admin(auth.uid()));

-- Indexes
CREATE INDEX idx_academic_matrices_course_id ON public.academic_matrices(course_id);
CREATE INDEX idx_matrix_subjects_matrix_id ON public.matrix_subjects(matrix_id);
CREATE INDEX idx_matrix_subjects_subject_id ON public.matrix_subjects(subject_id);
