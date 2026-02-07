-- Create enum types for roles and statuses
CREATE TYPE public.app_role AS ENUM ('admin', 'diretor', 'coordenador', 'professor');
CREATE TYPE public.session_status AS ENUM ('ABERTA', 'ENCERRADA', 'AUDITORIA_FINALIZADA', 'BLOQUEADA');
CREATE TYPE public.attendance_status AS ENUM ('PRESENTE', 'FALTA', 'JUSTIFICADO');
CREATE TYPE public.attendance_source AS ENUM ('AUTO_ALUNO', 'MANUAL_PROF', 'MANUAL_COORD');
CREATE TYPE public.change_request_status AS ENUM ('PENDENTE', 'APROVADO', 'REPROVADO');
CREATE TYPE public.entity_status AS ENUM ('ATIVO', 'INATIVO');

-- Profiles table for authenticated users (admin, diretor, coordenador, professor)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190),
  phone VARCHAR(20),
  status entity_status NOT NULL DEFAULT 'ATIVO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Courses table
CREATE TABLE public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(120) NOT NULL,
  director_user_id UUID REFERENCES auth.users(id),
  status entity_status NOT NULL DEFAULT 'ATIVO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subjects (disciplinas) table
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  workload_hours INT NOT NULL DEFAULT 0,
  status entity_status NOT NULL DEFAULT 'ATIVO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Students table (separate from auth.users since they don't login)
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  course_id UUID NOT NULL REFERENCES public.courses(id),
  status entity_status NOT NULL DEFAULT 'ATIVO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Classes (turmas) table
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id),
  code VARCHAR(30) NOT NULL UNIQUE,
  period VARCHAR(20) NOT NULL,
  shift VARCHAR(20),
  status entity_status NOT NULL DEFAULT 'ATIVO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Class subjects (oferta de disciplina na turma)
CREATE TABLE public.class_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id),
  subject_id UUID NOT NULL REFERENCES public.subjects(id),
  professor_user_id UUID NOT NULL REFERENCES auth.users(id),
  status entity_status NOT NULL DEFAULT 'ATIVO',
  UNIQUE (class_id, subject_id)
);

-- Class students (vínculo aluno-turma)
CREATE TABLE public.class_students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id),
  student_id UUID NOT NULL REFERENCES public.students(id),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  status entity_status NOT NULL DEFAULT 'ATIVO',
  UNIQUE (class_id, student_id)
);

-- Attendance sessions (sessões de aula)
CREATE TABLE public.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_token VARCHAR(64) NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  class_id UUID NOT NULL REFERENCES public.classes(id),
  subject_id UUID NOT NULL REFERENCES public.subjects(id),
  professor_user_id UUID NOT NULL REFERENCES auth.users(id),
  status session_status NOT NULL DEFAULT 'ABERTA',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  require_geo BOOLEAN NOT NULL DEFAULT FALSE,
  geo_lat DECIMAL(10,7),
  geo_lng DECIMAL(10,7),
  geo_radius_m INT DEFAULT 100,
  entry_code_hash VARCHAR(255) NOT NULL,
  audit_deadline_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Attendance records (registros de frequência)
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.attendance_sessions(id),
  student_id UUID NOT NULL REFERENCES public.students(id),
  final_status attendance_status NOT NULL DEFAULT 'FALTA',
  source attendance_source,
  registered_at TIMESTAMPTZ,
  geo_lat DECIMAL(10,7),
  geo_lng DECIMAL(10,7),
  geo_ok BOOLEAN,
  selfie_path VARCHAR(255),
  signature_path VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent VARCHAR(500),
  protocol VARCHAR(40) NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, student_id)
);

-- Attendance adjustments (trilha de auditoria imutável)
CREATE TABLE public.attendance_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES public.attendance_records(id),
  changed_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  changed_by_role app_role NOT NULL,
  from_status attendance_status NOT NULL,
  to_status attendance_status NOT NULL,
  justification TEXT NOT NULL,
  approved_by_user_id UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Change requests (solicitações de ajuste pós-auditoria)
CREATE TABLE public.change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id UUID NOT NULL REFERENCES public.attendance_records(id),
  requested_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  requested_by_role app_role NOT NULL,
  requested_to_status attendance_status NOT NULL,
  justification TEXT NOT NULL,
  status change_request_status NOT NULL DEFAULT 'PENDENTE',
  decided_by_user_id UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  decision_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enrollment suggestions (professor sugere aluno não listado)
CREATE TABLE public.enrollment_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id),
  student_enrollment VARCHAR(30) NOT NULL,
  suggested_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  justification TEXT NOT NULL,
  status change_request_status NOT NULL DEFAULT 'PENDENTE',
  decided_by_user_id UUID REFERENCES auth.users(id),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollment_suggestions ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user has any administrative role
CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
  )
$$;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Staff can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Admin can manage profiles" ON public.profiles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- User roles policies
CREATE POLICY "Users can view their own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admin can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Courses policies
CREATE POLICY "Staff can view courses" ON public.courses
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Admin can manage courses" ON public.courses
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Subjects policies
CREATE POLICY "Staff can view subjects" ON public.subjects
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Admin can manage subjects" ON public.subjects
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Students policies
CREATE POLICY "Staff can view students" ON public.students
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Coordinators and admin can manage students" ON public.students
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'coordenador')
  );

-- Classes policies
CREATE POLICY "Staff can view classes" ON public.classes
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Coordinators and admin can manage classes" ON public.classes
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'coordenador')
  );

-- Class subjects policies
CREATE POLICY "Staff can view class subjects" ON public.class_subjects
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Coordinators and admin can manage class subjects" ON public.class_subjects
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'coordenador')
  );

-- Class students policies
CREATE POLICY "Staff can view class students" ON public.class_students
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Coordinators and admin can manage class students" ON public.class_students
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'coordenador')
  );

-- Attendance sessions policies
CREATE POLICY "Staff can view sessions" ON public.attendance_sessions
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Professors can manage their own sessions" ON public.attendance_sessions
  FOR ALL USING (auth.uid() = professor_user_id);

-- Attendance records policies  
CREATE POLICY "Staff can view records" ON public.attendance_records
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Public can insert records for open sessions" ON public.attendance_records
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions 
      WHERE id = session_id AND status = 'ABERTA'
    )
  );

CREATE POLICY "Professors can update records of their sessions" ON public.attendance_records
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions 
      WHERE id = session_id AND professor_user_id = auth.uid()
    )
  );

-- Attendance adjustments policies
CREATE POLICY "Staff can view adjustments" ON public.attendance_adjustments
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can insert adjustments" ON public.attendance_adjustments
  FOR INSERT WITH CHECK (public.is_staff(auth.uid()));

-- Change requests policies
CREATE POLICY "Staff can view change requests" ON public.change_requests
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can manage change requests" ON public.change_requests
  FOR ALL USING (public.is_staff(auth.uid()));

-- Enrollment suggestions policies
CREATE POLICY "Staff can view enrollment suggestions" ON public.enrollment_suggestions
  FOR SELECT USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can manage enrollment suggestions" ON public.enrollment_suggestions
  FOR ALL USING (public.is_staff(auth.uid()));

-- Create indexes for performance
CREATE INDEX idx_students_course ON public.students(course_id);
CREATE INDEX idx_classes_course ON public.classes(course_id);
CREATE INDEX idx_class_subjects_prof ON public.class_subjects(professor_user_id);
CREATE INDEX idx_sessions_status ON public.attendance_sessions(status, opened_at);
CREATE INDEX idx_sessions_class ON public.attendance_sessions(class_id);
CREATE INDEX idx_records_session ON public.attendance_records(session_id);
CREATE INDEX idx_adjustments_record ON public.attendance_adjustments(record_id);
CREATE INDEX idx_change_requests_status ON public.change_requests(status, created_at);

-- Create storage bucket for selfies and signatures
INSERT INTO storage.buckets (id, name, public) VALUES ('attendance-evidence', 'attendance-evidence', false);

-- Storage policies for attendance evidence
CREATE POLICY "Public can upload evidence" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'attendance-evidence');

CREATE POLICY "Staff can view evidence" ON storage.objects
  FOR SELECT USING (bucket_id = 'attendance-evidence' AND public.is_staff(auth.uid()));

-- Profile creation trigger on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), NEW.email);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();