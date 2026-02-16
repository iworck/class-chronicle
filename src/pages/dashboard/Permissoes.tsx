import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import {
  Shield, Plus, Pencil, Trash2, Loader2, Search, Users, Lock, Eye, Settings2, CheckCircle2,
} from 'lucide-react';

// Types
interface Permission {
  id: string;
  module: string;
  action: string;
  description: string | null;
}

interface RolePermission {
  id: string;
  role: string;
  permission_id: string;
}

interface CustomRole {
  id: string;
  name: string;
  description: string | null;
  institution_id: string | null;
  created_at: string;
}

interface CustomRolePermission {
  id: string;
  custom_role_id: string;
  permission_id: string;
}

interface UserCustomRole {
  id: string;
  user_id: string;
  custom_role_id: string;
}

interface UserProfile {
  id: string;
  name: string;
  email: string | null;
}

type AppRole = 'super_admin' | 'admin' | 'diretor' | 'gerente' | 'coordenador' | 'professor' | 'aluno';

const FIXED_ROLES: { key: AppRole; label: string }[] = [
  { key: 'super_admin', label: 'Super Admin' },
  { key: 'admin', label: 'Administrador' },
  { key: 'diretor', label: 'Diretor' },
  { key: 'gerente', label: 'Gerente' },
  { key: 'coordenador', label: 'Coordenador' },
  { key: 'professor', label: 'Professor' },
  { key: 'aluno', label: 'Aluno' },
];

const MODULE_LABELS: Record<string, string> = {
  instituicoes: 'Instituições',
  campi: 'Campi',
  unidades: 'Unidades',
  cursos: 'Cursos',
  disciplinas: 'Disciplinas',
  turmas: 'Turmas',
  alunos: 'Alunos',
  notas: 'Notas',
  presenca: 'Presença',
  usuarios: 'Usuários',
  configuracoes: 'Configurações',
  relatorios: 'Relatórios',
  permissoes: 'Permissões',
};

const ACTION_LABELS: Record<string, string> = {
  visualizar: 'Visualizar',
  criar: 'Criar',
  editar: 'Editar',
  excluir: 'Excluir',
  exportar: 'Exportar',
  gerenciar: 'Gerenciar',
};

const Permissoes = () => {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('super_admin');
  const isAdmin = hasRole('admin');
  const canManage = isSuperAdmin || isAdmin;

  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [customRolePermissions, setCustomRolePermissions] = useState<CustomRolePermission[]>([]);
  const [userCustomRoles, setUserCustomRoles] = useState<UserCustomRole[]>([]);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);

  // Custom role dialog
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<CustomRole | null>(null);
  const [roleName, setRoleName] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Permission assignment dialog for custom roles
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [permRoleId, setPermRoleId] = useState<string | null>(null);
  const [permRoleName, setPermRoleName] = useState('');
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);

  // User assignment dialog
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [assignRoleId, setAssignRoleId] = useState<string | null>(null);
  const [assignRoleName, setAssignRoleName] = useState('');
  const [assignedUsers, setAssignedUsers] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [savingUsers, setSavingUsers] = useState(false);

  // Delete confirm
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState<CustomRole | null>(null);

  // Fixed role permissions editing
  const [fixedRoleDialogOpen, setFixedRoleDialogOpen] = useState(false);
  const [fixedRoleKey, setFixedRoleKey] = useState<string>('');
  const [fixedRoleLabel, setFixedRoleLabel] = useState('');
  const [fixedSelectedPerms, setFixedSelectedPerms] = useState<string[]>([]);
  const [savingFixed, setSavingFixed] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [permRes, rpRes, crRes, crpRes, ucrRes, profileRes] = await Promise.all([
      supabase.from('permissions').select('*').order('module').order('action'),
      supabase.from('role_permissions').select('*'),
      supabase.from('custom_roles').select('*').order('name'),
      supabase.from('custom_role_permissions').select('*'),
      supabase.from('user_custom_roles').select('*'),
      supabase.from('profiles').select('id, name, email').order('name'),
    ]);
    setPermissions((permRes.data as Permission[]) || []);
    setRolePermissions((rpRes.data as RolePermission[]) || []);
    setCustomRoles((crRes.data as CustomRole[]) || []);
    setCustomRolePermissions((crpRes.data as CustomRolePermission[]) || []);
    setUserCustomRoles((ucrRes.data as UserCustomRole[]) || []);
    setProfiles((profileRes.data as UserProfile[]) || []);
    setLoading(false);
  }

  // Group permissions by module
  const permissionsByModule = useMemo(() => {
    const map: Record<string, Permission[]> = {};
    permissions.forEach(p => {
      if (!map[p.module]) map[p.module] = [];
      map[p.module].push(p);
    });
    return map;
  }, [permissions]);

  const modules = useMemo(() => Object.keys(permissionsByModule).sort(), [permissionsByModule]);

  // --- Fixed Roles Tab ---
  function openFixedRoleDialog(role: { key: string; label: string }) {
    setFixedRoleKey(role.key);
    setFixedRoleLabel(role.label);
    const current = rolePermissions.filter(rp => rp.role === role.key).map(rp => rp.permission_id);
    setFixedSelectedPerms(current);
    setFixedRoleDialogOpen(true);
  }

  function toggleFixedPerm(permId: string) {
    setFixedSelectedPerms(prev => prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]);
  }

  function toggleFixedModule(module: string) {
    const modulePermIds = (permissionsByModule[module] || []).map(p => p.id);
    const allSelected = modulePermIds.every(id => fixedSelectedPerms.includes(id));
    if (allSelected) {
      setFixedSelectedPerms(prev => prev.filter(id => !modulePermIds.includes(id)));
    } else {
      setFixedSelectedPerms(prev => [...new Set([...prev, ...modulePermIds])]);
    }
  }

  async function handleSaveFixedPerms() {
    if (!isSuperAdmin) { toast({ title: 'Somente Super Admin pode editar permissões de papéis fixos', variant: 'destructive' }); return; }
    setSavingFixed(true);
    const current = rolePermissions.filter(rp => rp.role === fixedRoleKey).map(rp => rp.permission_id);
    const toAdd = fixedSelectedPerms.filter(id => !current.includes(id));
    const toRemove = current.filter(id => !fixedSelectedPerms.includes(id));

    if (toRemove.length > 0) {
      for (const permId of toRemove) {
        await supabase.from('role_permissions').delete().eq('role', fixedRoleKey).eq('permission_id', permId);
      }
    }
    if (toAdd.length > 0) {
      const { error } = await supabase.from('role_permissions').insert(
        toAdd.map(permission_id => ({ role: fixedRoleKey, permission_id }))
      );
      if (error) { toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' }); setSavingFixed(false); return; }
    }
    toast({ title: 'Permissões atualizadas' });
    setFixedRoleDialogOpen(false);
    fetchAll();
    setSavingFixed(false);
  }

  function getFixedRolePermCount(roleKey: string): number {
    return rolePermissions.filter(rp => rp.role === roleKey).length;
  }

  // --- Custom Roles ---
  function openCreateRole() {
    setEditingRole(null);
    setRoleName('');
    setRoleDescription('');
    setRoleDialogOpen(true);
  }

  function openEditRole(role: CustomRole) {
    setEditingRole(role);
    setRoleName(role.name);
    setRoleDescription(role.description || '');
    setRoleDialogOpen(true);
  }

  async function handleSaveRole() {
    if (!roleName.trim()) { toast({ title: 'Informe o nome do papel', variant: 'destructive' }); return; }
    setSaving(true);
    if (editingRole) {
      const { error } = await supabase.from('custom_roles').update({
        name: roleName.trim(),
        description: roleDescription.trim() || null,
      }).eq('id', editingRole.id);
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); setSaving(false); return; }
      toast({ title: 'Papel atualizado' });
    } else {
      const { error } = await supabase.from('custom_roles').insert({
        name: roleName.trim(),
        description: roleDescription.trim() || null,
      });
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); setSaving(false); return; }
      toast({ title: 'Papel criado' });
    }
    setRoleDialogOpen(false);
    fetchAll();
    setSaving(false);
  }

  function openDeleteRole(role: CustomRole) {
    setDeletingRole(role);
    setDeleteDialogOpen(true);
  }

  async function handleDeleteRole() {
    if (!deletingRole) return;
    const { error } = await supabase.from('custom_roles').delete().eq('id', deletingRole.id);
    if (error) { toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Papel excluído' });
    setDeleteDialogOpen(false);
    fetchAll();
  }

  // --- Custom Role Permissions ---
  function openPermDialog(role: CustomRole) {
    setPermRoleId(role.id);
    setPermRoleName(role.name);
    const current = customRolePermissions.filter(crp => crp.custom_role_id === role.id).map(crp => crp.permission_id);
    setSelectedPerms(current);
    setPermDialogOpen(true);
  }

  function togglePerm(permId: string) {
    setSelectedPerms(prev => prev.includes(permId) ? prev.filter(id => id !== permId) : [...prev, permId]);
  }

  function toggleModule(module: string) {
    const modulePermIds = (permissionsByModule[module] || []).map(p => p.id);
    const allSelected = modulePermIds.every(id => selectedPerms.includes(id));
    if (allSelected) {
      setSelectedPerms(prev => prev.filter(id => !modulePermIds.includes(id)));
    } else {
      setSelectedPerms(prev => [...new Set([...prev, ...modulePermIds])]);
    }
  }

  async function handleSavePerms() {
    if (!permRoleId) return;
    setSavingPerms(true);
    const current = customRolePermissions.filter(crp => crp.custom_role_id === permRoleId).map(crp => crp.permission_id);
    const toAdd = selectedPerms.filter(id => !current.includes(id));
    const toRemove = current.filter(id => !selectedPerms.includes(id));

    if (toRemove.length > 0) {
      for (const permId of toRemove) {
        await supabase.from('custom_role_permissions').delete().eq('custom_role_id', permRoleId).eq('permission_id', permId);
      }
    }
    if (toAdd.length > 0) {
      const { error } = await supabase.from('custom_role_permissions').insert(
        toAdd.map(permission_id => ({ custom_role_id: permRoleId!, permission_id }))
      );
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); setSavingPerms(false); return; }
    }
    toast({ title: 'Permissões atualizadas' });
    setPermDialogOpen(false);
    fetchAll();
    setSavingPerms(false);
  }

  function getCustomRolePermCount(roleId: string): number {
    return customRolePermissions.filter(crp => crp.custom_role_id === roleId).length;
  }

  function getCustomRoleUserCount(roleId: string): number {
    return userCustomRoles.filter(ucr => ucr.custom_role_id === roleId).length;
  }

  // --- User Assignment ---
  function openUserDialog(role: CustomRole) {
    setAssignRoleId(role.id);
    setAssignRoleName(role.name);
    setAssignedUsers(userCustomRoles.filter(ucr => ucr.custom_role_id === role.id).map(ucr => ucr.user_id));
    setUserSearch('');
    setUserDialogOpen(true);
  }

  function toggleUser(userId: string) {
    setAssignedUsers(prev => prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]);
  }

  const filteredProfiles = useMemo(() => {
    if (!userSearch.trim()) return profiles;
    const s = userSearch.toLowerCase();
    return profiles.filter(p => p.name.toLowerCase().includes(s) || (p.email || '').toLowerCase().includes(s));
  }, [profiles, userSearch]);

  async function handleSaveUsers() {
    if (!assignRoleId) return;
    setSavingUsers(true);
    const current = userCustomRoles.filter(ucr => ucr.custom_role_id === assignRoleId).map(ucr => ucr.user_id);
    const toAdd = assignedUsers.filter(id => !current.includes(id));
    const toRemove = current.filter(id => !assignedUsers.includes(id));

    if (toRemove.length > 0) {
      for (const userId of toRemove) {
        await supabase.from('user_custom_roles').delete().eq('custom_role_id', assignRoleId).eq('user_id', userId);
      }
    }
    if (toAdd.length > 0) {
      const { error } = await supabase.from('user_custom_roles').insert(
        toAdd.map(user_id => ({ custom_role_id: assignRoleId!, user_id }))
      );
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); setSavingUsers(false); return; }
    }
    toast({ title: 'Usuários atualizados' });
    setUserDialogOpen(false);
    fetchAll();
    setSavingUsers(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Permission matrix component (reused for both dialogs)
  function PermissionMatrix({
    selectedPermIds,
    onTogglePerm,
    onToggleModule,
  }: {
    selectedPermIds: string[];
    onTogglePerm: (id: string) => void;
    onToggleModule: (module: string) => void;
  }) {
    return (
      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {modules.map(module => {
          const modulePerms = permissionsByModule[module] || [];
          const allSelected = modulePerms.every(p => selectedPermIds.includes(p.id));
          const someSelected = modulePerms.some(p => selectedPermIds.includes(p.id));
          return (
            <div key={module} className="border border-border rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <Checkbox
                  checked={allSelected}
                  ref={undefined}
                  onCheckedChange={() => onToggleModule(module)}
                  className={someSelected && !allSelected ? 'opacity-60' : ''}
                />
                <span className="font-semibold text-foreground">
                  {MODULE_LABELS[module] || module}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {modulePerms.filter(p => selectedPermIds.includes(p.id)).length}/{modulePerms.length}
                </Badge>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 ml-7">
                {modulePerms.map(perm => (
                  <label key={perm.id} className="flex items-center gap-2 cursor-pointer text-sm">
                    <Checkbox
                      checked={selectedPermIds.includes(perm.id)}
                      onCheckedChange={() => onTogglePerm(perm.id)}
                    />
                    <span className="text-muted-foreground">
                      {ACTION_LABELS[perm.action] || perm.action}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-3">
            <Shield className="w-7 h-7 text-primary" />
            Papéis e Permissões
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie papéis fixos, crie papéis customizados e atribua permissões granulares.
          </p>
        </div>
      </div>

      <Tabs defaultValue="fixed" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="fixed" className="flex items-center gap-2">
            <Lock className="w-4 h-4" />
            Papéis Fixos
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            Customizados
          </TabsTrigger>
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Visão Geral
          </TabsTrigger>
        </TabsList>

        {/* ===== Fixed Roles Tab ===== */}
        <TabsContent value="fixed">
          <div className="bg-card rounded-xl border border-border shadow-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Papéis do Sistema
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              Configure as permissões de cada papel fixo do sistema. {!isSuperAdmin && 'Somente Super Admins podem editar.'}
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {FIXED_ROLES.map(role => (
                <div
                  key={role.key}
                  className="border border-border rounded-lg p-4 flex flex-col gap-3 hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-5 h-5 text-primary" />
                      <span className="font-semibold text-foreground">{role.label}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {getFixedRolePermCount(role.key)} perm.
                    </Badge>
                  </div>
                  {isSuperAdmin && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => openFixedRoleDialog(role)}
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      Editar Permissões
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* ===== Custom Roles Tab ===== */}
        <TabsContent value="custom">
          <div className="bg-card rounded-xl border border-border shadow-card p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Papéis Customizados</h2>
                <p className="text-sm text-muted-foreground">
                  Crie papéis personalizados com permissões específicas e atribua a usuários.
                </p>
              </div>
              {canManage && (
                <Button onClick={openCreateRole}>
                  <Plus className="w-4 h-4 mr-2" />
                  Novo Papel
                </Button>
              )}
            </div>

            {customRoles.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Settings2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Nenhum papel customizado criado.</p>
                <p className="text-sm mt-1">Clique em "Novo Papel" para começar.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-center">Permissões</TableHead>
                    <TableHead className="text-center">Usuários</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customRoles.map(role => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {role.description || '—'}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{getCustomRolePermCount(role.id)}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{getCustomRoleUserCount(role.id)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" title="Permissões" onClick={() => openPermDialog(role)}>
                            <Lock className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Usuários" onClick={() => openUserDialog(role)}>
                            <Users className="w-4 h-4" />
                          </Button>
                          {canManage && (
                            <>
                              <Button variant="ghost" size="icon" title="Editar" onClick={() => openEditRole(role)}>
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" title="Excluir" onClick={() => openDeleteRole(role)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ===== Overview Tab ===== */}
        <TabsContent value="overview">
          <div className="bg-card rounded-xl border border-border shadow-card p-6">
            <h2 className="text-lg font-semibold text-foreground mb-4">Matriz de Permissões</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Visão geral de todas as permissões atribuídas a cada papel.
            </p>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card z-10 min-w-[140px]">Módulo / Ação</TableHead>
                    {FIXED_ROLES.map(role => (
                      <TableHead key={role.key} className="text-center text-xs min-w-[80px]">
                        {role.label}
                      </TableHead>
                    ))}
                    {customRoles.map(cr => (
                      <TableHead key={cr.id} className="text-center text-xs min-w-[80px]">
                        {cr.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modules.map(module => (
                    <>
                      <TableRow key={`header-${module}`} className="bg-muted/50">
                        <TableCell colSpan={1 + FIXED_ROLES.length + customRoles.length} className="font-semibold text-foreground sticky left-0">
                          {MODULE_LABELS[module] || module}
                        </TableCell>
                      </TableRow>
                      {(permissionsByModule[module] || []).map(perm => (
                        <TableRow key={perm.id}>
                          <TableCell className="pl-6 text-sm text-muted-foreground sticky left-0 bg-card">
                            {ACTION_LABELS[perm.action] || perm.action}
                          </TableCell>
                          {FIXED_ROLES.map(role => {
                            const has = rolePermissions.some(rp => rp.role === role.key && rp.permission_id === perm.id);
                            return (
                              <TableCell key={role.key} className="text-center">
                                {has ? (
                                  <CheckCircle2 className="w-4 h-4 text-success mx-auto" />
                                ) : (
                                  <span className="text-muted-foreground/30">—</span>
                                )}
                              </TableCell>
                            );
                          })}
                          {customRoles.map(cr => {
                            const has = customRolePermissions.some(crp => crp.custom_role_id === cr.id && crp.permission_id === perm.id);
                            return (
                              <TableCell key={cr.id} className="text-center">
                                {has ? (
                                  <CheckCircle2 className="w-4 h-4 text-accent mx-auto" />
                                ) : (
                                  <span className="text-muted-foreground/30">—</span>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== Fixed Role Permissions Dialog ===== */}
      <Dialog open={fixedRoleDialogOpen} onOpenChange={setFixedRoleDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Permissões — {fixedRoleLabel}</DialogTitle>
          </DialogHeader>
          <PermissionMatrix
            selectedPermIds={fixedSelectedPerms}
            onTogglePerm={toggleFixedPerm}
            onToggleModule={toggleFixedModule}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveFixedPerms} disabled={savingFixed}>
              {savingFixed && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Create/Edit Custom Role Dialog ===== */}
      <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? 'Editar Papel' : 'Novo Papel Customizado'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={roleName} onChange={e => setRoleName(e.target.value)} placeholder="Ex: Secretário Acadêmico" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={roleDescription} onChange={e => setRoleDescription(e.target.value)} placeholder="Descreva as responsabilidades deste papel..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveRole} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingRole ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Custom Role Permissions Dialog ===== */}
      <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Permissões — {permRoleName}</DialogTitle>
          </DialogHeader>
          <PermissionMatrix
            selectedPermIds={selectedPerms}
            onTogglePerm={togglePerm}
            onToggleModule={toggleModule}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSavePerms} disabled={savingPerms}>
              {savingPerms && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== User Assignment Dialog ===== */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Usuários — {assignRoleName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="max-h-[40vh] overflow-y-auto space-y-1 border border-border rounded-lg p-2">
              {filteredProfiles.map(profile => (
                <label
                  key={profile.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-muted cursor-pointer"
                >
                  <Checkbox
                    checked={assignedUsers.includes(profile.id)}
                    onCheckedChange={() => toggleUser(profile.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{profile.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
                  </div>
                </label>
              ))}
              {filteredProfiles.length === 0 && (
                <p className="text-center py-4 text-muted-foreground text-sm">Nenhum usuário encontrado.</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {assignedUsers.length} usuário(s) selecionado(s)
            </p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveUsers} disabled={savingUsers}>
              {savingUsers && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Delete Confirmation ===== */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Papel</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Tem certeza que deseja excluir o papel <strong>{deletingRole?.name}</strong>?
            Todos os vínculos de permissões e usuários serão removidos.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={handleDeleteRole}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Permissoes;
