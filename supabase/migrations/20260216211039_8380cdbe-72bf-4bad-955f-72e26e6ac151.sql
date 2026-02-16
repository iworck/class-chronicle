
-- Permissions table: defines granular permissions per module
CREATE TABLE public.permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(module, action)
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- Only super_admin and admin can read permissions
CREATE POLICY "Staff can view permissions"
  ON public.permissions FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Super admins can manage permissions"
  ON public.permissions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Custom roles table
CREATE TABLE public.custom_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(name, institution_id)
);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view custom roles"
  ON public.custom_roles FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can manage custom roles"
  ON public.custom_roles FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'admin')
      AND institution_id = public.get_user_institution_id(auth.uid())
    )
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'admin')
      AND institution_id = public.get_user_institution_id(auth.uid())
    )
  );

-- Role-permission mapping for fixed roles
CREATE TABLE public.role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role TEXT NOT NULL,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role, permission_id)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view role permissions"
  ON public.role_permissions FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Super admins can manage role permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- Custom role permission mapping
CREATE TABLE public.custom_role_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  custom_role_id UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(custom_role_id, permission_id)
);

ALTER TABLE public.custom_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view custom role permissions"
  ON public.custom_role_permissions FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can manage custom role permissions"
  ON public.custom_role_permissions FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- User-custom role assignment
CREATE TABLE public.user_custom_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  custom_role_id UUID NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, custom_role_id)
);

ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view user custom roles"
  ON public.user_custom_roles FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Admins can manage user custom roles"
  ON public.user_custom_roles FOR ALL TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

-- Trigger for updated_at on custom_roles
CREATE TRIGGER update_custom_roles_updated_at
  BEFORE UPDATE ON public.custom_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default permissions for all modules
INSERT INTO public.permissions (module, action, description) VALUES
  ('instituicoes', 'visualizar', 'Visualizar instituições'),
  ('instituicoes', 'criar', 'Criar instituições'),
  ('instituicoes', 'editar', 'Editar instituições'),
  ('instituicoes', 'excluir', 'Excluir instituições'),
  ('campi', 'visualizar', 'Visualizar campi'),
  ('campi', 'criar', 'Criar campi'),
  ('campi', 'editar', 'Editar campi'),
  ('campi', 'excluir', 'Excluir campi'),
  ('unidades', 'visualizar', 'Visualizar unidades'),
  ('unidades', 'criar', 'Criar unidades'),
  ('unidades', 'editar', 'Editar unidades'),
  ('unidades', 'excluir', 'Excluir unidades'),
  ('cursos', 'visualizar', 'Visualizar cursos'),
  ('cursos', 'criar', 'Criar cursos'),
  ('cursos', 'editar', 'Editar cursos'),
  ('cursos', 'excluir', 'Excluir cursos'),
  ('disciplinas', 'visualizar', 'Visualizar disciplinas'),
  ('disciplinas', 'criar', 'Criar disciplinas'),
  ('disciplinas', 'editar', 'Editar disciplinas'),
  ('disciplinas', 'excluir', 'Excluir disciplinas'),
  ('turmas', 'visualizar', 'Visualizar turmas'),
  ('turmas', 'criar', 'Criar turmas'),
  ('turmas', 'editar', 'Editar turmas'),
  ('turmas', 'excluir', 'Excluir turmas'),
  ('alunos', 'visualizar', 'Visualizar alunos'),
  ('alunos', 'criar', 'Criar/matricular alunos'),
  ('alunos', 'editar', 'Editar alunos'),
  ('alunos', 'excluir', 'Excluir alunos'),
  ('notas', 'visualizar', 'Visualizar notas'),
  ('notas', 'criar', 'Lançar notas'),
  ('notas', 'editar', 'Editar notas'),
  ('notas', 'excluir', 'Excluir notas'),
  ('presenca', 'visualizar', 'Visualizar presenças'),
  ('presenca', 'criar', 'Registrar presenças'),
  ('presenca', 'editar', 'Editar presenças'),
  ('presenca', 'excluir', 'Excluir presenças'),
  ('usuarios', 'visualizar', 'Visualizar usuários'),
  ('usuarios', 'criar', 'Criar usuários'),
  ('usuarios', 'editar', 'Editar usuários'),
  ('usuarios', 'excluir', 'Excluir usuários'),
  ('configuracoes', 'visualizar', 'Visualizar configurações'),
  ('configuracoes', 'editar', 'Editar configurações'),
  ('relatorios', 'visualizar', 'Visualizar relatórios'),
  ('relatorios', 'exportar', 'Exportar relatórios'),
  ('permissoes', 'visualizar', 'Visualizar permissões'),
  ('permissoes', 'gerenciar', 'Gerenciar papéis e permissões');
