
-- Create institutions table
CREATE TABLE IF NOT EXISTS public.institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  slug VARCHAR NOT NULL UNIQUE,
  status public.entity_status NOT NULL DEFAULT 'ATIVO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

-- Create campuses table
CREATE TABLE IF NOT EXISTS public.campuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES public.institutions(id),
  name VARCHAR NOT NULL,
  city VARCHAR,
  state VARCHAR,
  director_user_id UUID,
  status public.entity_status NOT NULL DEFAULT 'ATIVO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.campuses ENABLE ROW LEVEL SECURITY;

-- Create units table
CREATE TABLE IF NOT EXISTS public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campus_id UUID NOT NULL REFERENCES public.campuses(id),
  name VARCHAR NOT NULL,
  manager_user_id UUID,
  status public.entity_status NOT NULL DEFAULT 'ATIVO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Create semesters table
CREATE TABLE IF NOT EXISTS public.semesters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id),
  name VARCHAR NOT NULL,
  start_date DATE,
  end_date DATE,
  status public.entity_status NOT NULL DEFAULT 'ATIVO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.semesters ENABLE ROW LEVEL SECURITY;

-- Add columns to existing tables
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES public.institutions(id);
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id);
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS semester_id UUID REFERENCES public.semesters(id);

-- Helper functions
CREATE OR REPLACE FUNCTION public.get_user_institution_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT institution_id FROM public.profiles WHERE id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'
  )
$$;

-- RLS: Institutions
CREATE POLICY "Super admin can manage institutions"
  ON public.institutions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Staff can view institutions"
  ON public.institutions FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- RLS: Campuses
CREATE POLICY "Super admin can manage all campuses"
  ON public.campuses FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Admin can manage campuses of their institution"
  ON public.campuses FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND institution_id = public.get_user_institution_id(auth.uid())
  );

CREATE POLICY "Staff can view campuses"
  ON public.campuses FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- RLS: Units
CREATE POLICY "Super admin can manage all units"
  ON public.units FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Admin can manage units of their institution"
  ON public.units FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    AND campus_id IN (
      SELECT id FROM public.campuses
      WHERE institution_id = public.get_user_institution_id(auth.uid())
    )
  );

CREATE POLICY "Director can manage units of their campus"
  ON public.units FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'diretor')
    AND campus_id IN (
      SELECT id FROM public.campuses WHERE director_user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can view units"
  ON public.units FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- RLS: Semesters
CREATE POLICY "Admin and coordenador can manage semesters"
  ON public.semesters FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordenador')
  );

CREATE POLICY "Staff can view semesters"
  ON public.semesters FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
