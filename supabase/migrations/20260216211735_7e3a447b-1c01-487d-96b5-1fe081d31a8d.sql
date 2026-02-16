
-- Populate role_permissions for all fixed roles based on the approved inventory
-- First, clear any existing role_permissions to avoid duplicates
DELETE FROM public.role_permissions;

-- Helper: Insert role_permissions by matching module+action from permissions table
-- SUPER_ADMIN: all permissions
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'super_admin', id FROM public.permissions;

-- ADMIN: all except instituicoes criar/editar/excluir and permissoes gerenciar (gets it via admin check)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'admin', id FROM public.permissions
WHERE NOT (module = 'instituicoes' AND action IN ('criar', 'editar', 'excluir'));

-- DIRETOR: view instituicoes/campi, manage unidades/cursos/turmas/alunos/notas/presenca (no excluir), view+create+edit usuarios, view+export relatorios
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'diretor', id FROM public.permissions
WHERE 
  (module = 'instituicoes' AND action = 'visualizar')
  OR (module = 'campi' AND action = 'visualizar')
  OR (module = 'unidades' AND action IN ('visualizar', 'criar', 'editar'))
  OR (module = 'cursos' AND action IN ('visualizar', 'criar', 'editar'))
  OR (module = 'disciplinas' AND action = 'visualizar')
  OR (module = 'turmas' AND action IN ('visualizar', 'criar', 'editar'))
  OR (module = 'alunos' AND action IN ('visualizar', 'criar', 'editar'))
  OR (module = 'notas' AND action IN ('visualizar', 'criar', 'editar'))
  OR (module = 'presenca' AND action IN ('visualizar', 'criar', 'editar'))
  OR (module = 'usuarios' AND action IN ('visualizar', 'criar', 'editar'))
  OR (module = 'relatorios' AND action IN ('visualizar', 'exportar'));

-- GERENTE: manage cursos/turmas/alunos/notas/presenca (no excluir), view unidades/disciplinas, view+export relatorios
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'gerente', id FROM public.permissions
WHERE 
  (module = 'unidades' AND action = 'visualizar')
  OR (module = 'cursos' AND action IN ('visualizar', 'criar', 'editar'))
  OR (module = 'disciplinas' AND action = 'visualizar')
  OR (module = 'turmas' AND action IN ('visualizar', 'criar', 'editar'))
  OR (module = 'alunos' AND action IN ('visualizar', 'criar', 'editar'))
  OR (module = 'notas' AND action IN ('visualizar', 'criar', 'editar'))
  OR (module = 'presenca' AND action IN ('visualizar', 'criar', 'editar'))
  OR (module = 'relatorios' AND action IN ('visualizar', 'exportar'));

-- COORDENADOR: manage disciplinas/turmas (full), manage alunos/notas/presenca (no excluir), view cursos, view configuracoes, view+export relatorios
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'coordenador', id FROM public.permissions
WHERE 
  (module = 'cursos' AND action = 'visualizar')
  OR (module = 'disciplinas' AND action IN ('visualizar', 'criar', 'editar', 'excluir'))
  OR (module = 'turmas' AND action IN ('visualizar', 'criar', 'editar', 'excluir'))
  OR (module = 'alunos' AND action IN ('visualizar', 'criar', 'editar'))
  OR (module = 'notas' AND action IN ('visualizar', 'criar', 'editar'))
  OR (module = 'presenca' AND action IN ('visualizar', 'criar', 'editar'))
  OR (module = 'configuracoes' AND action = 'visualizar')
  OR (module = 'relatorios' AND action IN ('visualizar', 'exportar'));

-- PROFESSOR: view turmas/alunos, manage notas/presenca (criar/editar)
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'professor', id FROM public.permissions
WHERE 
  (module = 'turmas' AND action = 'visualizar')
  OR (module = 'alunos' AND action = 'visualizar')
  OR (module = 'notas' AND action IN ('visualizar', 'criar', 'editar'))
  OR (module = 'presenca' AND action IN ('visualizar', 'criar', 'editar'));

-- ALUNO: view own notas/presenca only
INSERT INTO public.role_permissions (role, permission_id)
SELECT 'aluno', id FROM public.permissions
WHERE 
  (module = 'notas' AND action = 'visualizar')
  OR (module = 'presenca' AND action = 'visualizar');
