
-- Tabela de vínculos de curso do aluno (suporta múltiplos vínculos)
CREATE TABLE public.student_course_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL,
  campus_id uuid REFERENCES public.campuses(id) ON DELETE SET NULL,
  unit_id uuid REFERENCES public.units(id) ON DELETE SET NULL,
  course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  matrix_id uuid REFERENCES public.academic_matrices(id) ON DELETE SET NULL,
  status public.entity_status NOT NULL DEFAULT 'ATIVO',
  enrollment_status public.enrollment_status NOT NULL DEFAULT 'MATRICULADO',
  linked_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_student_course_links_student_id ON public.student_course_links(student_id);
CREATE INDEX idx_student_course_links_course_id ON public.student_course_links(course_id);

-- Trigger de updated_at
CREATE TRIGGER update_student_course_links_updated_at
  BEFORE UPDATE ON public.student_course_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.student_course_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin coord diretor gerente can manage student course links"
  ON public.student_course_links
  FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'coordenador'::app_role) OR
    has_role(auth.uid(), 'diretor'::app_role) OR
    has_role(auth.uid(), 'gerente'::app_role) OR
    is_super_admin(auth.uid())
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role) OR
    has_role(auth.uid(), 'coordenador'::app_role) OR
    has_role(auth.uid(), 'diretor'::app_role) OR
    has_role(auth.uid(), 'gerente'::app_role) OR
    is_super_admin(auth.uid())
  );

CREATE POLICY "Staff can view student course links"
  ON public.student_course_links
  FOR SELECT
  USING (is_staff(auth.uid()));
