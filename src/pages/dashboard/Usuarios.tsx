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
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Search, Pencil, Shield, Loader2, Users, X,
} from 'lucide-react';

type AppRole = 'super_admin' | 'admin' | 'diretor' | 'gerente' | 'coordenador' | 'professor' | 'aluno';

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

interface Institution {
  id: string;
  name: string;
}

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrador',
  diretor: 'Diretor',
  gerente: 'Gerente',
  coordenador: 'Coordenador',
  professor: 'Professor',
  aluno: 'Aluno',
};

const ALL_ROLES: AppRole[] = ['super_admin', 'admin', 'diretor', 'gerente', 'coordenador', 'professor', 'aluno'];

const Usuarios = () => {
  const { hasRole } = useAuth();
  const isSuperAdmin = hasRole('super_admin');
  const isAdmin = hasRole('admin');
  const canManage = isSuperAdmin || isAdmin;

  // Only super_admin can assign super_admin role
  const assignableRoles = isSuperAdmin ? ALL_ROLES : ALL_ROLES.filter(r => r !== 'super_admin');

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [allRoles, setAllRoles] = useState<UserRole[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Edit profile dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formInstitutionId, setFormInstitutionId] = useState('');
  const [formStatus, setFormStatus] = useState<'ATIVO' | 'INATIVO'>('ATIVO');
  const [saving, setSaving] = useState(false);

  // Roles dialog
  const [rolesDialogOpen, setRolesDialogOpen] = useState(false);
  const [rolesUserId, setRolesUserId] = useState<string | null>(null);
  const [rolesUserName, setRolesUserName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<AppRole[]>([]);
  const [savingRoles, setSavingRoles] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [profileRes, rolesRes, instRes] = await Promise.all([
      supabase.from('profiles').select('*').order('name'),
      supabase.from('user_roles').select('*'),
      supabase.from('institutions').select('id, name').eq('status', 'ATIVO').order('name'),
    ]);

    if (profileRes.error) {
      toast({ title: 'Erro ao carregar usuários', description: profileRes.error.message, variant: 'destructive' });
    } else {
      setProfiles((profileRes.data as UserProfile[]) || []);
    }
    setAllRoles((rolesRes.data as UserRole[]) || []);
    setInstitutions((instRes.data as Institution[]) || []);
    setLoading(false);
  }

  function getRolesForUser(userId: string): AppRole[] {
    return allRoles.filter(r => r.user_id === userId).map(r => r.role);
  }

  // Edit profile
  function openEditProfile(profile: UserProfile) {
    setEditingProfile(profile);
    setFormName(profile.name);
    setFormEmail(profile.email || '');
    setFormPhone(profile.phone || '');
    setFormInstitutionId(profile.institution_id || '');
    setFormStatus(profile.status);
    setEditDialogOpen(true);
  }

  async function handleSaveProfile() {
    if (!formName.trim()) {
      toast({ title: 'Preencha o nome', variant: 'destructive' });
      return;
    }
    if (!editingProfile) return;

    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        name: formName.trim(),
        email: formEmail.trim() || null,
        phone: formPhone.trim() || null,
        institution_id: formInstitutionId || null,
        status: formStatus,
      })
      .eq('id', editingProfile.id);

    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Usuário atualizado com sucesso' });
      setEditDialogOpen(false);
      fetchAll();
    }
    setSaving(false);
  }

  // Manage roles
  function openRolesDialog(profile: UserProfile) {
    setRolesUserId(profile.id);
    setRolesUserName(profile.name);
    setSelectedRoles(getRolesForUser(profile.id));
    setRolesDialogOpen(true);
  }

  function toggleRole(role: AppRole) {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  }

  async function handleSaveRoles() {
    if (!rolesUserId) return;
    setSavingRoles(true);

    const currentRoles = getRolesForUser(rolesUserId);
    const toAdd = selectedRoles.filter(r => !currentRoles.includes(r));
    const toRemove = currentRoles.filter(r => !selectedRoles.includes(r));

    // Remove roles
    for (const role of toRemove) {
      const roleRecord = allRoles.find(r => r.user_id === rolesUserId && r.role === role);
      if (roleRecord) {
        await supabase.from('user_roles').delete().eq('id', roleRecord.id);
      }
    }

    // Add roles
    if (toAdd.length > 0) {
      const inserts = toAdd.map(role => ({ user_id: rolesUserId, role }));
      const { error } = await supabase.from('user_roles').insert(inserts);
      if (error) {
        toast({ title: 'Erro ao atribuir papéis', description: error.message, variant: 'destructive' });
        setSavingRoles(false);
        return;
      }
    }

    toast({ title: 'Papéis atualizados com sucesso' });
    setRolesDialogOpen(false);
    fetchAll();
    setSavingRoles(false);
  }

  const institutionMap = Object.fromEntries(institutions.map(i => [i.id, i.name]));

  const filtered = profiles.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Usuários</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie os usuários e seus níveis de acesso.
        </p>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="stats-card before:bg-primary">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-display font-bold text-foreground">{profiles.length}</p>
        </div>
        <div className="stats-card before:bg-success">
          <p className="text-sm text-muted-foreground">Ativos</p>
          <p className="text-2xl font-display font-bold text-foreground">{profiles.filter(p => p.status === 'ATIVO').length}</p>
        </div>
        <div className="stats-card before:bg-destructive">
          <p className="text-sm text-muted-foreground">Inativos</p>
          <p className="text-2xl font-display font-bold text-foreground">{profiles.filter(p => p.status === 'INATIVO').length}</p>
        </div>
      </div>

      {/* Table card */}
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Instituição</TableHead>
                <TableHead>Papéis</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((profile) => {
                const userRoles = getRolesForUser(profile.id);
                return (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">{profile.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{profile.email || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {profile.institution_id ? (institutionMap[profile.institution_id] || '—') : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {userRoles.length === 0 ? (
                          <span className="text-sm text-muted-foreground">Sem papel</span>
                        ) : (
                          userRoles.map(role => (
                            <Badge key={role} variant="outline" className="text-xs">
                              {ROLE_LABELS[role]}
                            </Badge>
                          ))
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={profile.status === 'ATIVO' ? 'default' : 'secondary'}>
                        {profile.status}
                      </Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditProfile(profile)} title="Editar perfil">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openRolesDialog(profile)} title="Gerenciar papéis">
                          <Shield className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Dialog: Edit Profile */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@exemplo.com" type="email" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <Label>Instituição</Label>
              <Select value={formInstitutionId || "none"} onValueChange={(v) => setFormInstitutionId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a instituição" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {institutions.map(inst => (
                    <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveProfile} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Manage Roles */}
      <Dialog open={rolesDialogOpen} onOpenChange={setRolesDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Papéis de {rolesUserName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Selecione os papéis que este usuário deve ter no sistema.
            </p>
            {assignableRoles.map(role => (
              <label
                key={role}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selectedRoles.includes(role)}
                  onCheckedChange={() => toggleRole(role)}
                />
                <div>
                  <p className="font-medium text-sm">{ROLE_LABELS[role]}</p>
                </div>
              </label>
            ))}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveRoles} disabled={savingRoles}>
              {savingRoles && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar Papéis
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Usuarios;
