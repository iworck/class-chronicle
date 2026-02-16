
-- Enum for enrollment status
CREATE TYPE public.enrollment_status AS ENUM ('MATRICULADO', 'TRANCADO', 'CANCELADO', 'TRANSFERIDO');

-- Personal data table (separate from students)
CREATE TABLE public.student_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  cpf varchar(14) UNIQUE,
  phone varchar(20),
  email varchar(255),
  birth_date date,
  address_street varchar(255),
  address_number varchar(20),
  address_complement varchar(100),
  address_neighborhood varchar(100),
  address_city varchar(100),
  address_state varchar(2),
  address_zip varchar(10),
  enrollment_status enrollment_status NOT NULL DEFAULT 'MATRICULADO',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id)
);

ALTER TABLE public.student_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view student details"
  ON public.student_details FOR SELECT
  USING (is_staff(auth.uid()));

CREATE POLICY "Admin coord gerente can manage student details"
  ON public.student_details FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR has_role(auth.uid(), 'gerente'::app_role)
  );

CREATE POLICY "Super admin can manage all student details"
  ON public.student_details FOR ALL
  USING (is_super_admin(auth.uid()));

-- Student documents tracking table
CREATE TABLE public.student_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  document_type varchar(50) NOT NULL, -- RG, CPF, COMPROVANTE_RESIDENCIA, HISTORICO, FOTO, OUTROS
  file_path text NOT NULL,
  file_name varchar(255) NOT NULL,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view student documents"
  ON public.student_documents FOR SELECT
  USING (is_staff(auth.uid()));

CREATE POLICY "Admin coord gerente can manage student documents"
  ON public.student_documents FOR ALL
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
    OR has_role(auth.uid(), 'gerente'::app_role)
  );

CREATE POLICY "Super admin can manage all student documents"
  ON public.student_documents FOR ALL
  USING (is_super_admin(auth.uid()));

-- Course change/cancel requests (student requests, coordinator approves)
CREATE TABLE public.student_course_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  request_type varchar(20) NOT NULL, -- TROCA, CANCELAMENTO, TRANCAMENTO
  current_course_id uuid NOT NULL REFERENCES public.courses(id),
  target_course_id uuid REFERENCES public.courses(id), -- only for TROCA
  justification text NOT NULL,
  status change_request_status NOT NULL DEFAULT 'PENDENTE',
  decided_by_user_id uuid,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_course_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view course requests"
  ON public.student_course_requests FOR SELECT
  USING (is_staff(auth.uid()));

CREATE POLICY "Staff can insert course requests"
  ON public.student_course_requests FOR INSERT
  WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Coordinator and admin can manage course requests"
  ON public.student_course_requests FOR UPDATE
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'coordenador'::app_role)
  );

CREATE POLICY "Super admin can manage all course requests"
  ON public.student_course_requests FOR ALL
  USING (is_super_admin(auth.uid()));

-- Storage bucket for student documents
INSERT INTO storage.buckets (id, name, public) VALUES ('student-documents', 'student-documents', false);

CREATE POLICY "Staff can view student document files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'student-documents' AND is_staff(auth.uid()));

CREATE POLICY "Staff can upload student document files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'student-documents' AND is_staff(auth.uid()));

CREATE POLICY "Staff can delete student document files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'student-documents' AND is_staff(auth.uid()));

-- Trigger for updated_at on student_details
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_student_details_updated_at
  BEFORE UPDATE ON public.student_details
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
