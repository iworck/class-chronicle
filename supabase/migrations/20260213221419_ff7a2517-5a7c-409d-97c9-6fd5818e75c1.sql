
-- Table linking users to campuses (all roles that need campus scope)
CREATE TABLE public.user_campuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  campus_id uuid NOT NULL REFERENCES public.campuses(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, campus_id)
);

ALTER TABLE public.user_campuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage all user_campuses"
  ON public.user_campuses FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Admin can manage user_campuses of their institution"
  ON public.user_campuses FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') AND campus_id IN (
    SELECT id FROM campuses WHERE institution_id = get_user_institution_id(auth.uid())
  ))
  WITH CHECK (has_role(auth.uid(), 'admin') AND campus_id IN (
    SELECT id FROM campuses WHERE institution_id = get_user_institution_id(auth.uid())
  ));

CREATE POLICY "Users can view their own campus assignments"
  ON public.user_campuses FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Staff can view user_campuses"
  ON public.user_campuses FOR SELECT TO authenticated
  USING (is_staff(auth.uid()));

-- Table linking users to specific units within their campus
-- (for diretor, gerente, coordenador, professor — NOT aluno)
CREATE TABLE public.user_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, unit_id)
);

ALTER TABLE public.user_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can manage all user_units"
  ON public.user_units FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "Admin can manage user_units of their institution"
  ON public.user_units FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') AND unit_id IN (
    SELECT u.id FROM units u JOIN campuses c ON u.campus_id = c.id
    WHERE c.institution_id = get_user_institution_id(auth.uid())
  ))
  WITH CHECK (has_role(auth.uid(), 'admin') AND unit_id IN (
    SELECT u.id FROM units u JOIN campuses c ON u.campus_id = c.id
    WHERE c.institution_id = get_user_institution_id(auth.uid())
  ));

CREATE POLICY "Users can view their own unit assignments"
  ON public.user_units FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Staff can view user_units"
  ON public.user_units FOR SELECT TO authenticated
  USING (is_staff(auth.uid()));
