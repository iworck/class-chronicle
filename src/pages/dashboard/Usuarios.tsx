import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import {
  Search, Pencil, Shield, Loader2, Users, MapPin, Plus, UserPlus, KeyRound, Mail, MessageSquare, Eye, Copy,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

type AppRole = 'super_admin' | 'admin' | 'diretor' | 'gerente' | 'coordenador' | 'professor' | 'aluno';

const CAMPUS_ROLES: AppRole[] = ['diretor', 'gerente', 'coordenador', 'professor', 'aluno'];
const UNIT_ROLES: AppRole[] = ['diretor', 'gerente', 'coordenador', 'professor'];

interface UserProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: 'ATIVO' | 'INATIVO';
  institution_id: string | null;
  created_at: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

interface Institution { id: string; name: string; }
interface Campus { id: string; name: string; institution_id: string; }
interface Unit { id: string; name: string; campus_id: string; }
interface UserCampus { id: string; user_id: string; campus_id: string; }
interface UserUnit { id: string; user_id: string; unit_id: string; }

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  diretor: 'Diretor',
  gerente: 'Gerente',
  coordenador: 'Coordenador',
  professor: 'Professor',
  aluno: 'Aluno',
};

const ROLE_SINGULAR: Record<string, string> = {
  ADMs: 'Administrador',
  Diretores: 'Diretor',
  Gerentes: 'Gerente',
  Coordenadores: 'Coordenador',
  Professores: 'Professor',
  Alunos: 'Aluno',
};

const ALL_ROLES: AppRole[] = ['super_admin', 'admin', 'diretor', 'gerente', 'coordenador', 'professor', 'aluno'];

type TabKey = 'todos' | 'admin' | 'diretor' | 'gerente' | 'coordenador' | 'professor' | 'aluno';

const TABS: { key: TabKey; label: string; icon: React.ReactNode; role?: AppRole }[] = [
  { key: 'todos', label: 'Todos', icon: <Users className="w-4 h-4" /> },
  { key: 'admin', label: 'ADMs', icon: <Shield className="w-4 h-4" />, role: 'admin' },
  { key: 'diretor', label: 'Diretores', icon: <UserPlus className="w-4 h-4" />, role: 'diretor' },
  { key: 'gerente', label: 'Gerentes', icon: <UserPlus className="w-4 h-4" />, role: 'gerente' },
  { key: 'coordenador', label: 'Coordenadores', icon: <UserPlus className="w-4 h-4" />, role: 'coordenador' },
  { key: 'professor', label: 'Professores', icon: <UserPlus className="w-4 h-4" />, role: 'professor' },
  { key: 'aluno', label: 'Alunos', icon: <UserPlus className="w-4 h-4" />, role: 'aluno' },
];

const Usuarios = () => {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('super_admin');
  const isAdmin = hasRole('admin');
  const canManage = isSuperAdmin || isAdmin;
  const assignableRoles = isSuperAdmin ? ALL_ROLES : ALL_ROLES.filter(r => r !== 'super_admin');

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [allRoles, setAllRoles] = useState<UserRole[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [allUserCampuses, setAllUserCampuses] = useState<UserCampus[]>([]);
  const [allUserUnits, setAllUserUnits] = useState<UserUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('todos');

  // Edit profile dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formInstitutionId, setFormInstitutionId] = useState('');
  const [formCampusId, setFormCampusId] = useState('');
  const [formUnitId, setFormUnitId] = useState('');
  const [formStatus, setFormStatus] = useState<'ATIVO' | 'INATIVO'>('ATIVO');
  const [saving, setSaving] = useState(false);

  // Password reset dialog
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetUserName, setResetUserName] = useState('');
  const [resetMethod, setResetMethod] = useState<'email' | 'whatsapp' | 'screen'>('email');
  const [resetJustification, setResetJustification] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);

  // Roles dialog
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  const [rolesUserId, setRolesUserId] = useState<string | null>(null);
  const [rolesUserName, setRolesUserName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);

  // Assignments dialog
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignUserId, setAssignUserId] = useState<string | null>(null);
  const [assignUserName, setAssignUserName] = useState('');
  const [assignUserCampuses, setAssignUserCampuses] = useState<string[]>([]);
  const [assignUserUnits, setAssignUserUnits] = useState<string[]>([]);
  const [savingAssign, setSavingAssign] = useState(false);

  // Quick-add role dialog (from tab)
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddRole, setQuickAddRole] = useState<AppRole | null>(null);
  const [quickAddUserId, setQuickAddUserId] = useState('');
  const [quickAddSaving, setQuickAddSaving] = useState(false);

  // Create user dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newInstitutionId, setNewInstitutionId] = useState('');
  const [newCampusId, setNewCampusId] = useState('');
  const [newUnitId, setNewUnitId] = useState('');
  const [newRole, setNewRole] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [profileRes, rolesRes, instRes, campusRes, unitRes, ucRes, uuRes] = await Promise.all([
      supabase.from('profiles').select('*').order('name'),
      supabase.from('user_roles').select('*'),
      supabase.from('institutions').select('id, name').eq('status', 'ATIVO').order('name'),
      supabase.from('campuses').select('id, name, institution_id').eq('status', 'ATIVO').order('name'),
      supabase.from('units').select('id, name, campus_id').eq('status', 'ATIVO').order('name'),
      supabase.from('user_campuses').select('*'),
      supabase.from('user_units').select('*'),
    ]);
    if (profileRes.error) {
      toast({ title: 'Erro ao carregar usuários', description: profileRes.error.message, variant: 'destructive' });
    } else {
      setProfiles((profileRes.data as UserProfile[]) || []);
    }
    setAllRoles((rolesRes.data as UserRole[]) || []);
    setInstitutions((instRes.data as Institution[]) || []);
    setCampuses((campusRes.data as Campus[]) || []);
    setUnits((unitRes.data as Unit[]) || []);
    setAllUserCampuses((ucRes.data as UserCampus[]) || []);
    setAllUserUnits((uuRes.data as UserUnit[]) || []);
    setLoading(false);
  }

  function getRolesForUser(userId: string): AppRole[] {
    return allRoles.filter(r => r.user_id === userId).map(r => r.role);
  }

  function getUserCampusNames(userId: string): string[] {
    const campusIds = allUserCampuses.filter(uc => uc.user_id === userId).map(uc => uc.campus_id);
    return campuses.filter(c => campusIds.includes(c.id)).map(c => c.name);
  }

  function getUserUnitNames(userId: string): string[] {
    const unitIds = allUserUnits.filter(uu => uu.user_id === userId).map(uu => uu.unit_id);
    return units.filter(u => unitIds.includes(u.id)).map(u => u.name);
  }

  // Filter by tab
  function getFilteredProfiles(): UserProfile[] {
    let list = profiles;
    if (activeTab !== 'todos') {
      const roleFilter = activeTab as AppRole;
      const userIdsWithRole = new Set(allRoles.filter(r => r.role === roleFilter).map(r => r.user_id));
      list = list.filter(p => userIdsWithRole.has(p.id));
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(s) || (p.email || '').toLowerCase().includes(s));
    }
    return list;
  }

  // Count by role
  function countByRole(role: AppRole): number {
    return new Set(allRoles.filter(r => r.role === role).map(r => r.user_id)).size;
  }

  // --- Profile edit ---
  function openEditProfile(profile: UserProfile) {
    setEditingProfile(profile);
    setFormName(profile.name);
    setFormEmail(profile.email || '');
    setFormPhone(profile.phone || '');
    setFormInstitutionId(profile.institution_id || '');
    // Load existing campus/unit for this user
    const userCampus = allUserCampuses.find(uc => uc.user_id === profile.id);
    setFormCampusId(userCampus?.campus_id || '');
    const userUnit = allUserUnits.find(uu => uu.user_id === profile.id);
    setFormUnitId(userUnit?.unit_id || '');
    setFormStatus(profile.status);
    setEditDialogOpen(true);
  }

  const editCampusesFiltered = formInstitutionId ? campuses.filter(c => c.institution_id === formInstitutionId) : [];
  const editUnitsFiltered = formCampusId ? units.filter(u => u.campus_id === formCampusId) : [];

  async function handleSaveProfile() {
    if (!formName.trim()) { toast({ title: 'Preencha o nome', variant: 'destructive' }); return; }
    if (!editingProfile) return;
    setSaving(true);

    // Update profile
    const { error } = await supabase.from('profiles').update({
      name: formName.trim(), email: formEmail.trim() || null, phone: formPhone.trim() || null,
      institution_id: formInstitutionId || null, status: formStatus,
    }).eq('id', editingProfile.id);
    if (error) { toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' }); setSaving(false); return; }

    // Update campus assignment
    const currentCampus = allUserCampuses.find(uc => uc.user_id === editingProfile.id);
    if (formCampusId && !currentCampus) {
      await supabase.from('user_campuses').insert({ user_id: editingProfile.id, campus_id: formCampusId });
    } else if (formCampusId && currentCampus && currentCampus.campus_id !== formCampusId) {
      await supabase.from('user_campuses').delete().eq('id', currentCampus.id);
      await supabase.from('user_campuses').insert({ user_id: editingProfile.id, campus_id: formCampusId });
    } else if (!formCampusId && currentCampus) {
      await supabase.from('user_campuses').delete().eq('id', currentCampus.id);
    }

    // Update unit assignment
    const currentUnit = allUserUnits.find(uu => uu.user_id === editingProfile.id);
    if (formUnitId && !currentUnit) {
      await supabase.from('user_units').insert({ user_id: editingProfile.id, unit_id: formUnitId });
    } else if (formUnitId && currentUnit && currentUnit.unit_id !== formUnitId) {
      await supabase.from('user_units').delete().eq('id', currentUnit.id);
      await supabase.from('user_units').insert({ user_id: editingProfile.id, unit_id: formUnitId });
    } else if (!formUnitId && currentUnit) {
      await supabase.from('user_units').delete().eq('id', currentUnit.id);
    }

    toast({ title: 'Usuário atualizado com sucesso' }); setEditDialogOpen(false); fetchAll();
    setSaving(false);
  }

  // --- Password Reset ---
  function openResetDialog(profile: UserProfile) {
    setResetUserId(profile.id);
    setResetUserName(profile.name);
    setResetMethod('email');
    setResetJustification('');
    setGeneratedPassword(null);
    setResetDialogOpen(true);
  }

  async function handleResetPassword() {
    if (!resetUserId) return;
    if (resetMethod === 'screen' && !resetJustification.trim()) {
      toast({ title: 'Informe a justificativa', variant: 'destructive' });
      return;
    }
    setResettingPassword(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          user_id: resetUserId,
          method: resetMethod,
          justification: resetJustification.trim() || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast({ title: 'Erro ao resetar senha', description: result.error, variant: 'destructive' });
      } else {
        if (resetMethod === 'screen' && result.password) {
          setGeneratedPassword(result.password);
          toast({ title: 'Senha resetada com sucesso' });
        } else {
          toast({ title: result.message || 'Senha resetada com sucesso' });
          setResetDialogOpen(false);
        }
      }
    } catch (err: any) {
      toast({ title: 'Erro ao resetar senha', description: err.message, variant: 'destructive' });
    }
    setResettingPassword(false);
  }

  function copyPassword() {
    if (generatedPassword) {
      navigator.clipboard.writeText(generatedPassword);
      toast({ title: 'Senha copiada para a área de transferência' });
    }
  }

  // --- Roles ---
  function openRolesDialog(profile: UserProfile) {
    setRolesUserId(profile.id);
    setRolesUserName(profile.name);
    setSelectedRoles(getRolesForUser(profile.id));
    setRolesDialogOpen(true);
  }

  function toggleRole(role: AppRole) {
    setSelectedRoles(prev => prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]);
  }

  async function handleSaveRoles() {
    if (!rolesUserId) return;
    setSavingRoles(true);
    const currentRoles = getRolesForUser(rolesUserId);
    const toAdd = selectedRoles.filter(r => !currentRoles.includes(r));
    const toRemove = currentRoles.filter(r => !selectedRoles.includes(r));
    for (const role of toRemove) {
      const rec = allRoles.find(r => r.user_id === rolesUserId && r.role === role);
      if (rec) await supabase.from('user_roles').delete().eq('id', rec.id);
    }
    if (toAdd.length > 0) {
      const { error } = await supabase.from('user_roles').insert(toAdd.map(role => ({ user_id: rolesUserId, role })));
      if (error) { toast({ title: 'Erro ao atribuir papéis', description: error.message, variant: 'destructive' }); setSavingRoles(false); return; }
    }
    toast({ title: 'Papéis atualizados com sucesso' }); setRolesDialogOpen(false); fetchAll(); setSavingRoles(false);
  }

  // --- Assignments ---
  function openAssignDialog(profile: UserProfile) {
    setAssignUserId(profile.id);
    setAssignUserName(profile.name);
    setAssignUserCampuses(allUserCampuses.filter(uc => uc.user_id === profile.id).map(uc => uc.campus_id));
    setAssignUserUnits(allUserUnits.filter(uu => uu.user_id === profile.id).map(uu => uu.unit_id));
    setAssignDialogOpen(true);
  }

  function toggleCampus(campusId: string) {
    setAssignUserCampuses(prev => {
      if (prev.includes(campusId)) {
        const unitsOfCampus = units.filter(u => u.campus_id === campusId).map(u => u.id);
        setAssignUserUnits(prevU => prevU.filter(uid => !unitsOfCampus.includes(uid)));
        return prev.filter(id => id !== campusId);
      }
      return [...prev, campusId];
    });
  }

  function toggleUnit(unitId: string) {
    setAssignUserUnits(prev => prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]);
  }

  async function handleSaveAssignments() {
    if (!assignUserId) return;
    setSavingAssign(true);
    const currentCampusIds = allUserCampuses.filter(uc => uc.user_id === assignUserId).map(uc => uc.campus_id);
    const campusesToAdd = assignUserCampuses.filter(id => !currentCampusIds.includes(id));
    const campusesToRemove = currentCampusIds.filter(id => !assignUserCampuses.includes(id));
    for (const cid of campusesToRemove) await supabase.from('user_campuses').delete().eq('user_id', assignUserId).eq('campus_id', cid);
    if (campusesToAdd.length > 0) {
      const { error } = await supabase.from('user_campuses').insert(campusesToAdd.map(campus_id => ({ user_id: assignUserId, campus_id })));
      if (error) { toast({ title: 'Erro ao vincular campus', description: error.message, variant: 'destructive' }); setSavingAssign(false); return; }
    }
    const currentUnitIds = allUserUnits.filter(uu => uu.user_id === assignUserId).map(uu => uu.unit_id);
    const unitsToAdd = assignUserUnits.filter(id => !currentUnitIds.includes(id));
    const unitsToRemove = currentUnitIds.filter(id => !assignUserUnits.includes(id));
    for (const uid of unitsToRemove) await supabase.from('user_units').delete().eq('user_id', assignUserId).eq('unit_id', uid);
    if (unitsToAdd.length > 0) {
      const { error } = await supabase.from('user_units').insert(unitsToAdd.map(unit_id => ({ user_id: assignUserId, unit_id })));
      if (error) { toast({ title: 'Erro ao vincular unidades', description: error.message, variant: 'destructive' }); setSavingAssign(false); return; }
    }
    toast({ title: 'Vínculos atualizados com sucesso' }); setAssignDialogOpen(false); fetchAll(); setSavingAssign(false);
  }

  function userNeedsAssignment(userId: string): boolean {
    return getRolesForUser(userId).some(r => CAMPUS_ROLES.includes(r));
  }
  function userNeedsUnitAssignment(userId: string): boolean {
    return getRolesForUser(userId).some(r => UNIT_ROLES.includes(r));
  }

  function getCampusesForUser(userId: string): Campus[] {
    const profile = profiles.find(p => p.id === userId);
    if (!profile?.institution_id) return campuses;
    return campuses.filter(c => c.institution_id === profile.institution_id);
  }

  // --- Quick-add role from tab ---
  function openQuickAdd(role: AppRole) {
    setQuickAddRole(role);
    setQuickAddUserId('');
    setQuickAddOpen(true);
  }

  function getAvailableUsersForRole(role: AppRole): UserProfile[] {
    const usersWithRole = new Set(allRoles.filter(r => r.role === role).map(r => r.user_id));
    return profiles.filter(p => !usersWithRole.has(p.id) && p.status === 'ATIVO');
  }

  async function handleQuickAddRole() {
    if (!quickAddRole || !quickAddUserId) return;
    setQuickAddSaving(true);
    const { error } = await supabase.from('user_roles').insert({ user_id: quickAddUserId, role: quickAddRole });
    if (error) { toast({ title: 'Erro ao adicionar papel', description: error.message, variant: 'destructive' }); }
    else { toast({ title: `${ROLE_LABELS[quickAddRole]} adicionado com sucesso` }); setQuickAddOpen(false); fetchAll(); }
    setQuickAddSaving(false);
  }

  async function handleRemoveRoleFromUser(userId: string, role: AppRole) {
    const rec = allRoles.find(r => r.user_id === userId && r.role === role);
    if (!rec) return;
    const { error } = await supabase.from('user_roles').delete().eq('id', rec.id);
    if (error) { toast({ title: 'Erro ao remover papel', description: error.message, variant: 'destructive' }); }
    else { toast({ title: 'Papel removido' }); fetchAll(); }
  }

  const institutionMap = Object.fromEntries(institutions.map(i => [i.id, i.name]));

  // --- Create user ---
  function openCreateDialog() {
    setNewName('');
    setNewEmail('');
    setNewPassword('');
    setNewPhone('');
    setNewInstitutionId('');
    setNewCampusId('');
    setNewUnitId('');
    setNewRole(activeTab !== 'todos' && currentTabConfig?.role ? currentTabConfig.role : '');
    setCreateDialogOpen(true);
  }

  const newCampusesFiltered = newInstitutionId ? campuses.filter(c => c.institution_id === newInstitutionId) : [];
  const newUnitsFiltered = newCampusId ? units.filter(u => u.campus_id === newCampusId) : [];

  async function handleCreateUser() {
    if (!newName.trim() || !newEmail.trim() || !newPassword) {
      toast({ title: 'Preencha nome, email e senha', variant: 'destructive' });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: 'Senha deve ter no mínimo 6 caracteres', variant: 'destructive' });
      return;
    }
    setCreatingUser(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
         body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim(),
          password: newPassword,
          phone: newPhone.trim() || undefined,
          institution_id: newInstitutionId || undefined,
          campus_id: newCampusId || undefined,
          unit_id: newUnitId || undefined,
          role: newRole || undefined,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast({ title: 'Erro ao criar usuário', description: result.error, variant: 'destructive' });
      } else {
        toast({ title: 'Usuário criado com sucesso' });
        setCreateDialogOpen(false);
        fetchAll();
      }
    } catch (err: any) {
      toast({ title: 'Erro ao criar usuário', description: err.message, variant: 'destructive' });
    }
    setCreatingUser(false);
  }
  const filtered = getFilteredProfiles();
  const currentTabConfig = TABS.find(t => t.key === activeTab);

  // Columns to show depend on tab
  const showCampusCol = activeTab === 'todos' || CAMPUS_ROLES.includes(activeTab as AppRole);
  const showUnitCol = UNIT_ROLES.includes(activeTab as AppRole);
  const showRolesCol = activeTab === 'todos';

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Usuários</h1>
          <p className="text-muted-foreground text-sm">
            Gerencie os usuários, papéis e vínculos com campus/unidades.
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Usuário
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <div className="stats-card before:bg-primary">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-xl font-display font-bold text-foreground">{profiles.length}</p>
        </div>
        <div className="stats-card before:bg-chart-1">
          <p className="text-xs text-muted-foreground">ADMs</p>
          <p className="text-xl font-display font-bold text-foreground">{countByRole('admin')}</p>
        </div>
        <div className="stats-card before:bg-chart-2">
          <p className="text-xs text-muted-foreground">Diretores</p>
          <p className="text-xl font-display font-bold text-foreground">{countByRole('diretor')}</p>
        </div>
        <div className="stats-card before:bg-chart-3">
          <p className="text-xs text-muted-foreground">Gerentes</p>
          <p className="text-xl font-display font-bold text-foreground">{countByRole('gerente')}</p>
        </div>
        <div className="stats-card before:bg-chart-4">
          <p className="text-xs text-muted-foreground">Coordenadores</p>
          <p className="text-xl font-display font-bold text-foreground">{countByRole('coordenador')}</p>
        </div>
        <div className="stats-card before:bg-chart-5">
          <p className="text-xs text-muted-foreground">Professores</p>
          <p className="text-xl font-display font-bold text-foreground">{countByRole('professor')}</p>
        </div>
        <div className="stats-card before:bg-accent">
          <p className="text-xs text-muted-foreground">Alunos</p>
          <p className="text-xl font-display font-bold text-foreground">{countByRole('aluno')}</p>
        </div>
        <div className="stats-card before:bg-destructive">
          <p className="text-xs text-muted-foreground">Inativos</p>
          <p className="text-xl font-display font-bold text-foreground">{profiles.filter(p => p.status === 'INATIVO').length}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <TabsList className="flex-wrap h-auto gap-1">
            {TABS.map(tab => (
              <TabsTrigger key={tab.key} value={tab.key} className="gap-1.5 text-xs sm:text-sm">
                {tab.icon}
                {tab.label}
                {tab.role && <span className="ml-1 text-xs opacity-60">({countByRole(tab.role)})</span>}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Search + Add button */}
        <div className="bg-card rounded-xl border border-border shadow-card">
          <div className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between border-b border-border">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {canManage && activeTab !== 'todos' && currentTabConfig?.role && (
              <Button size="sm" onClick={() => openQuickAdd(currentTabConfig.role!)}>
                <Plus className="w-4 h-4 mr-1" />
                Adicionar {ROLE_SINGULAR[currentTabConfig.label] || currentTabConfig.label}
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="w-12 h-12 mb-4 opacity-30" />
              <p>Nenhum usuário encontrado.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Instituição</TableHead>
                    {showRolesCol && <TableHead>Papéis</TableHead>}
                    {showCampusCol && <TableHead>Campus</TableHead>}
                    {showUnitCol && <TableHead>Unidades</TableHead>}
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((profile) => {
                    const userRoles = getRolesForUser(profile.id);
                    const campusNames = getUserCampusNames(profile.id);
                    const unitNames = getUserUnitNames(profile.id);
                    return (
                      <TableRow key={profile.id}>
                        <TableCell className="font-medium">{profile.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{profile.email || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {profile.institution_id ? (institutionMap[profile.institution_id] || '—') : '—'}
                        </TableCell>
                        {showRolesCol && (
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {userRoles.length === 0 ? (
                                <span className="text-sm text-muted-foreground">Sem papel</span>
                              ) : userRoles.map(role => (
                                <Badge key={role} variant="outline" className="text-xs">{ROLE_LABELS[role]}</Badge>
                              ))}
                            </div>
                          </TableCell>
                        )}
                        {showCampusCol && (
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {campusNames.length === 0 ? <span className="text-sm text-muted-foreground">—</span>
                                : campusNames.map(n => <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>)}
                            </div>
                          </TableCell>
                        )}
                        {showUnitCol && (
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {unitNames.length === 0 ? <span className="text-sm text-muted-foreground">—</span>
                                : unitNames.map(n => <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>)}
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge variant={profile.status === 'ATIVO' ? 'default' : 'secondary'}>{profile.status}</Badge>
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right space-x-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditProfile(profile)} title="Editar perfil">
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openResetDialog(profile)} title="Resetar senha">
                              <KeyRound className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => openRolesDialog(profile)} title="Gerenciar papéis">
                              <Shield className="w-4 h-4" />
                            </Button>
                            {userNeedsAssignment(profile.id) && (
                              <Button variant="ghost" size="icon" onClick={() => openAssignDialog(profile)} title="Vínculos campus/unidades">
                                <MapPin className="w-4 h-4" />
                              </Button>
                            )}
                            {activeTab !== 'todos' && currentTabConfig?.role && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => handleRemoveRoleFromUser(profile.id, currentTabConfig.role!)}
                                title={`Remover papel de ${currentTabConfig.label.replace(/s$/, '')}`}
                              >
                                <span className="text-lg leading-none">×</span>
                              </Button>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Tabs>

      {/* Dialog: Edit Profile */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div><Label>Nome *</Label><Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome completo" /></div>
            <div><Label>Email</Label><Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@exemplo.com" type="email" /></div>
            <div><Label>Telefone</Label><Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="(11) 99999-9999" /></div>
            <div>
              <Label>Instituição</Label>
              <Select value={formInstitutionId || "none"} onValueChange={(v) => { setFormInstitutionId(v === "none" ? "" : v); setFormCampusId(''); setFormUnitId(''); }}>
                <SelectTrigger><SelectValue placeholder="Selecione a instituição" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {institutions.map(inst => <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {formInstitutionId && editCampusesFiltered.length > 0 && (
              <div>
                <Label>Campus</Label>
                <Select value={formCampusId || "none"} onValueChange={(v) => { setFormCampusId(v === "none" ? "" : v); setFormUnitId(''); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione o campus" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {editCampusesFiltered.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {formCampusId && editUnitsFiltered.length > 0 && (
              <div>
                <Label>Unidade</Label>
                <Select value={formUnitId || "none"} onValueChange={(v) => setFormUnitId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {editUnitsFiltered.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v as 'ATIVO' | 'INATIVO')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVO">Ativo</SelectItem>
                  <SelectItem value="INATIVO">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Reset Password */}
      <Dialog open={resetDialogOpen} onOpenChange={(open) => { setResetDialogOpen(open); if (!open) setGeneratedPassword(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resetar Senha — {resetUserName}</DialogTitle></DialogHeader>
          {generatedPassword ? (
            <div className="space-y-4 py-2">
              <div className="bg-muted rounded-lg p-4 text-center">
                <p className="text-xs text-muted-foreground mb-2">Nova senha gerada:</p>
                <p className="text-xl font-mono font-bold text-foreground tracking-widest">{generatedPassword}</p>
              </div>
              <Button variant="outline" className="w-full" onClick={copyPassword}>
                <Copy className="w-4 h-4 mr-2" />
                Copiar Senha
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Anote esta senha. Ela não será exibida novamente.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">Escolha como deseja enviar a nova senha ao usuário.</p>
              <div className="space-y-2">
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${resetMethod === 'email' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                  <input type="radio" name="resetMethod" checked={resetMethod === 'email'} onChange={() => setResetMethod('email')} className="sr-only" />
                  <Mail className={`w-5 h-5 ${resetMethod === 'email' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-medium text-sm">Enviar por E-mail</p>
                    <p className="text-xs text-muted-foreground">A nova senha será enviada ao email do usuário</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${resetMethod === 'whatsapp' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                  <input type="radio" name="resetMethod" checked={resetMethod === 'whatsapp'} onChange={() => setResetMethod('whatsapp')} className="sr-only" />
                  <MessageSquare className={`w-5 h-5 ${resetMethod === 'whatsapp' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-medium text-sm">Enviar por WhatsApp</p>
                    <p className="text-xs text-muted-foreground">A nova senha será enviada via WhatsApp</p>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${resetMethod === 'screen' ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                  <input type="radio" name="resetMethod" checked={resetMethod === 'screen'} onChange={() => setResetMethod('screen')} className="sr-only" />
                  <Eye className={`w-5 h-5 ${resetMethod === 'screen' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div>
                    <p className="font-medium text-sm">Exibir em Tela</p>
                    <p className="text-xs text-muted-foreground">A nova senha será exibida na tela (requer justificativa)</p>
                  </div>
                </label>
              </div>
              {resetMethod === 'screen' && (
                <div>
                  <Label>Justificativa *</Label>
                  <Textarea
                    value={resetJustification}
                    onChange={(e) => setResetJustification(e.target.value)}
                    placeholder="Informe o motivo para exibir a senha em tela..."
                    rows={3}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">{generatedPassword ? 'Fechar' : 'Cancelar'}</Button></DialogClose>
            {!generatedPassword && (
              <Button onClick={handleResetPassword} disabled={resettingPassword} variant="destructive">
                {resettingPassword && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Resetar Senha
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Manage Roles */}
      <Dialog open={rolesDialogOpen} onOpenChange={setRolesDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Papéis de {rolesUserName}</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Selecione os papéis que este usuário deve ter no sistema.</p>
            {assignableRoles.map(role => (
              <label key={role} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors">
                <Checkbox checked={selectedRoles.includes(role)} onCheckedChange={() => toggleRole(role)} />
                <p className="font-medium text-sm">{ROLE_LABELS[role]}</p>
              </label>
            ))}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSaveRoles} disabled={savingRoles}>
              {savingRoles && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar Papéis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Manage Assignments */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Vínculos de {assignUserName}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Selecione os campi e unidades aos quais este usuário está vinculado.</p>
            {assignUserId && getCampusesForUser(assignUserId).map(campus => {
              const campusSelected = assignUserCampuses.includes(campus.id);
              const campusUnits = units.filter(u => u.campus_id === campus.id);
              const showUnits = campusSelected && userNeedsUnitAssignment(assignUserId);
              return (
                <div key={campus.id} className="border border-border rounded-lg overflow-hidden">
                  <label className="flex items-center gap-3 p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                    <Checkbox checked={campusSelected} onCheckedChange={() => toggleCampus(campus.id)} />
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      <p className="font-medium text-sm">{campus.name}</p>
                    </div>
                  </label>
                  {showUnits && campusUnits.length > 0 && (
                    <div className="px-3 py-2 space-y-1 border-t border-border bg-background">
                      <p className="text-xs text-muted-foreground mb-2">Unidades deste campus:</p>
                      {campusUnits.map(unit => (
                        <label key={unit.id} className="flex items-center gap-3 p-2 rounded hover:bg-muted/30 cursor-pointer transition-colors">
                          <Checkbox checked={assignUserUnits.includes(unit.id)} onCheckedChange={() => toggleUnit(unit.id)} />
                          <p className="text-sm">{unit.name}</p>
                        </label>
                      ))}
                    </div>
                  )}
                  {showUnits && campusUnits.length === 0 && (
                    <div className="px-3 py-2 border-t border-border">
                      <p className="text-xs text-muted-foreground italic">Nenhuma unidade cadastrada neste campus.</p>
                    </div>
                  )}
                </div>
              );
            })}
            {assignUserId && getCampusesForUser(assignUserId).length === 0 && (
              <p className="text-sm text-muted-foreground italic">Nenhum campus disponível. Verifique se o usuário possui uma instituição vinculada.</p>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSaveAssignments} disabled={savingAssign}>
              {savingAssign && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Salvar Vínculos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Quick-add role */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar {quickAddRole ? ROLE_LABELS[quickAddRole] : ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Selecione o usuário que receberá o papel de {quickAddRole ? ROLE_LABELS[quickAddRole] : ''}.
            </p>
            <div>
              <Label>Usuário</Label>
              <Select value={quickAddUserId || "none"} onValueChange={(v) => setQuickAddUserId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione um usuário" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecione...</SelectItem>
                  {quickAddRole && getAvailableUsersForRole(quickAddRole).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name} {p.email ? `(${p.email})` : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleQuickAddRole} disabled={quickAddSaving || !quickAddUserId}>
              {quickAddSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Create User */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Usuário</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome completo *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <Label>Email *</Label>
              <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@exemplo.com" type="email" />
            </div>
            <div>
              <Label>Senha *</Label>
              <Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" type="password" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <Label>Instituição</Label>
              <Select value={newInstitutionId || "none"} onValueChange={(v) => { setNewInstitutionId(v === "none" ? "" : v); setNewCampusId(''); setNewUnitId(''); }}>
                <SelectTrigger><SelectValue placeholder="Selecione a instituição" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {institutions.map(inst => <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {newInstitutionId && newCampusesFiltered.length > 0 && (
              <div>
                <Label>Campus</Label>
                <Select value={newCampusId || "none"} onValueChange={(v) => { setNewCampusId(v === "none" ? "" : v); setNewUnitId(''); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione o campus (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {newCampusesFiltered.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {newCampusId && newUnitsFiltered.length > 0 && (
              <div>
                <Label>Unidade</Label>
                <Select value={newUnitId || "none"} onValueChange={(v) => setNewUnitId(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione a unidade (opcional)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhuma</SelectItem>
                    {newUnitsFiltered.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Papel inicial</Label>
              <Select value={newRole || "none"} onValueChange={(v) => setNewRole(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione um papel (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {assignableRoles.map(role => (
                    <SelectItem key={role} value={role}>{ROLE_LABELS[role]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleCreateUser} disabled={creatingUser}>
              {creatingUser && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Criar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Usuarios;
