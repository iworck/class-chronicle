import { useState, useEffect, useMemo } from 'react';
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
import { toast } from '@/hooks/use-toast';
import {
  Plus, Search, Pencil, Trash2, Loader2, GraduationCap, Crown, Check, ChevronsUpDown,
} from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';

interface Course {
  id: string;
  name: string;
  unit_id: string | null;
  director_user_id: string | null;
  coordinator_user_id: string | null;
  status: 'ATIVO' | 'INATIVO';
  created_at: string;
}

interface Institution {
  id: string;
  name: string;
}

interface Campus {
  id: string;
  name: string;
  institution_id: string;
  director_user_id: string | null;
}

interface Unit {
  id: string;
  name: string;
  campus_id: string;
  manager_user_id: string | null;
}

interface Profile {
  id: string;
  name: string;
  email: string | null;
}

interface UserRole {
  user_id: string;
  role: string;
}

function SearchableUserSelect({
  value,
  onValueChange,
  profiles,
  placeholder,
  label,
}: {
  value: string;
  onValueChange: (v: string) => void;
  profiles: Profile[];
  placeholder: string;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = profiles.find(p => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? `${selected.name}${selected.email ? ` (${selected.email})` : ''}` : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder={`Buscar ${label} pelo nome...`} />
          <CommandList>
            <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="none"
                onSelect={() => { onValueChange(''); setOpen(false); }}
              >
                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                Nenhum
              </CommandItem>
              {profiles.map(p => (
                <CommandItem
                  key={p.id}
                  value={`${p.name} ${p.email || ''}`}
                  onSelect={() => { onValueChange(p.id); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
                  {p.name} {p.email ? `(${p.email})` : ''}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const Cursos = () => {
  const { hasRole, user } = useAuth();
  const canManage = hasRole('super_admin') || hasRole('admin') || hasRole('diretor') || hasRole('gerente');

  const [courses, setCourses] = useState<Course[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [allCampuses, setAllCampuses] = useState<Campus[]>([]);
  const [allUnits, setAllUnits] = useState<Unit[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [userCampusIds, setUserCampusIds] = useState<string[]>([]);
  const [allUserCampuses, setAllUserCampuses] = useState<{ user_id: string; campus_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);

  const [formName, setFormName] = useState('');
  const [formInstitutionId, setFormInstitutionId] = useState('');
  const [formCampusId, setFormCampusId] = useState('');
  const [formUnitId, setFormUnitId] = useState('');
  const [formDirectorId, setFormDirectorId] = useState('');
  const [formCoordinatorId, setFormCoordinatorId] = useState('');
  const [formStatus, setFormStatus] = useState<'ATIVO' | 'INATIVO'>('ATIVO');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [courseRes, instRes, campusRes, unitRes, profileRes, rolesRes, allUcRes] = await Promise.all([
      supabase.from('courses').select('*').order('name'),
      supabase.from('institutions').select('id, name').eq('status', 'ATIVO').order('name'),
      supabase.from('campuses').select('id, name, institution_id, director_user_id').eq('status', 'ATIVO').order('name'),
      supabase.from('units').select('id, name, campus_id, manager_user_id').eq('status', 'ATIVO').order('name'),
      supabase.from('profiles').select('id, name, email').eq('status', 'ATIVO').order('name'),
      supabase.from('user_roles').select('user_id, role'),
      supabase.from('user_campuses').select('user_id, campus_id'),
    ]);

    if (courseRes.error) {
      toast({ title: 'Erro ao carregar cursos', description: courseRes.error.message, variant: 'destructive' });
    } else {
      setCourses((courseRes.data as Course[]) || []);
    }

    setInstitutions((instRes.data as Institution[]) || []);
    setAllCampuses((campusRes.data as Campus[]) || []);
    setAllUnits((unitRes.data as Unit[]) || []);
    setProfiles((profileRes.data as Profile[]) || []);
    setUserRoles((rolesRes.data as UserRole[]) || []);
    setAllUserCampuses((allUcRes.data || []) as { user_id: string; campus_id: string }[]);

    if (user) {
      const myCampuses = (allUcRes.data || []).filter((uc: any) => uc.user_id === user.id).map((uc: any) => uc.campus_id);
      setUserCampusIds(myCampuses);
    }

    setLoading(false);
  }

  // Cascading filters for form selectors
  const filteredCampuses = useMemo(() => {
    if (!formInstitutionId) return [];
    return allCampuses.filter(c => c.institution_id === formInstitutionId);
  }, [allCampuses, formInstitutionId]);

  const filteredUnits = useMemo(() => {
    if (!formCampusId) return [];
    return allUnits.filter(u => u.campus_id === formCampusId);
  }, [allUnits, formCampusId]);

  // Helper: resolve set of campus IDs based on current form selections
  const resolvedCampusIds = useMemo(() => {
    if (formCampusId) return new Set([formCampusId]);
    if (formInstitutionId) {
      // Institution selected but no campus yet → use all campuses of the institution
      return new Set(allCampuses.filter(c => c.institution_id === formInstitutionId).map(c => c.id));
    }
    return null; // No scope → show all
  }, [formCampusId, formInstitutionId, allCampuses]);

  // Director profiles: ONLY role='diretor', scoped by campus/institution when selected
  const directorProfiles = useMemo(() => {
    const directorIds = new Set(
      userRoles.filter(r => r.role === 'diretor').map(r => r.user_id)
    );

    if (!resolvedCampusIds) {
      // No institution/campus selected → list all directors
      return profiles.filter(p => directorIds.has(p.id));
    }

    // Users linked to any of the resolved campuses (via user_campuses)
    const scopedUserIds = new Set(
      allUserCampuses.filter(uc => resolvedCampusIds.has(uc.campus_id)).map(uc => uc.user_id)
    );
    // Also include director_user_id directly set on campus records
    allCampuses
      .filter(c => resolvedCampusIds.has(c.id) && c.director_user_id)
      .forEach(c => scopedUserIds.add(c.director_user_id!));

    return profiles.filter(p => directorIds.has(p.id) && scopedUserIds.has(p.id));
  }, [profiles, userRoles, resolvedCampusIds, allUserCampuses, allCampuses]);

  // Coordinator profiles: roles 'coordenador' AND 'gerente', scoped by campus/institution
  // Gerente assumes coordinator responsibility when no coordinator is assigned
  const coordinatorProfiles = useMemo(() => {
    const allowedIds = new Set(
      userRoles.filter(r => r.role === 'coordenador' || r.role === 'gerente').map(r => r.user_id)
    );

    if (!resolvedCampusIds) {
      // No institution/campus selected → list all coordinators + gerentes
      return profiles.filter(p => allowedIds.has(p.id));
    }

    // Users linked to any of the resolved campuses
    const scopedUserIds = new Set(
      allUserCampuses.filter(uc => resolvedCampusIds.has(uc.campus_id)).map(uc => uc.user_id)
    );
    // Also include manager_user_id from units belonging to the selected campuses
    allUnits
      .filter(u => resolvedCampusIds.has(u.campus_id) && u.manager_user_id)
      .forEach(u => scopedUserIds.add(u.manager_user_id!));

    return profiles.filter(p => allowedIds.has(p.id) && scopedUserIds.has(p.id));
  }, [profiles, userRoles, resolvedCampusIds, allUserCampuses, allUnits]);

  // Helper maps for table display
  const unitMap = Object.fromEntries(allUnits.map(u => [u.id, u]));
  const campusMap = Object.fromEntries(allCampuses.map(c => [c.id, c]));
  const institutionMap = Object.fromEntries(institutions.map(i => [i.id, i]));
  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p.name]));

  // Resolve institution/campus from unit_id for editing
  function resolveHierarchyFromUnit(unitId: string | null) {
    if (!unitId) return { institutionId: '', campusId: '' };
    const unit = unitMap[unitId];
    if (!unit) return { institutionId: '', campusId: '' };
    const campus = campusMap[unit.campus_id];
    if (!campus) return { institutionId: '', campusId: unit.campus_id };
    return { institutionId: campus.institution_id, campusId: unit.campus_id };
  }

  function openCreate() {
    setEditing(null);
    setFormName('');
    setFormInstitutionId('');
    setFormCampusId('');
    setFormUnitId('');
    setFormDirectorId('');
    setFormCoordinatorId('');
    setFormStatus('ATIVO');
    setDialogOpen(true);
  }

  function openEdit(course: Course) {
    setEditing(course);
    setFormName(course.name);
    const { institutionId, campusId } = resolveHierarchyFromUnit(course.unit_id);
    setFormInstitutionId(institutionId);
    setFormCampusId(campusId);
    setFormUnitId(course.unit_id || '');
    setFormDirectorId(course.director_user_id || '');
    setFormCoordinatorId(course.coordinator_user_id || '');
    setFormStatus(course.status);
    setDialogOpen(true);
  }

  // Reset dependent fields on cascade change
  function handleInstitutionChange(v: string) {
    setFormInstitutionId(v === 'none' ? '' : v);
    setFormCampusId('');
    setFormUnitId('');
    setFormDirectorId('');
    setFormCoordinatorId('');
  }

  function handleCampusChange(v: string) {
    setFormCampusId(v === 'none' ? '' : v);
    setFormUnitId('');
    setFormDirectorId('');
    setFormCoordinatorId('');
  }

  function handleUnitChange(v: string) {
    setFormUnitId(v === 'none' ? '' : v);
  }

  async function handleSave() {
    if (!formName.trim()) {
      toast({ title: 'Preencha o nome do curso', variant: 'destructive' });
      return;
    }
    if (!formDirectorId) {
      toast({ title: 'O Diretor é obrigatório para aprovação do curso', variant: 'destructive' });
      return;
    }

    const payload: any = {
      name: formName.trim(),
      unit_id: formUnitId || null,
      director_user_id: formDirectorId || null,
      coordinator_user_id: formCoordinatorId || null,
      status: formStatus,
    };

    setSaving(true);
    if (editing) {
      const { error } = await supabase.from('courses').update(payload).eq('id', editing.id);
      if (error) {
        toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Curso atualizado com sucesso' });
        setDialogOpen(false);
        fetchAll();
      }
    } else {
      const { error } = await supabase.from('courses').insert(payload);
      if (error) {
        toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Curso criado com sucesso' });
        setDialogOpen(false);
        fetchAll();
      }
    }
    setSaving(false);
  }

  async function handleDeactivate(id: string) {
    const { error } = await supabase.from('courses').update({ status: 'INATIVO' }).eq('id', id);
    if (error) {
      toast({ title: 'Erro ao inativar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Curso inativado' });
      fetchAll();
    }
  }

  function getResponsavel(course: Course): { name: string; role: string } {
    if (course.coordinator_user_id && profileMap[course.coordinator_user_id]) {
      return { name: profileMap[course.coordinator_user_id], role: 'Coordenador' };
    }
    if (course.unit_id) {
      const unit = unitMap[course.unit_id];
      if (unit?.manager_user_id && profileMap[unit.manager_user_id]) {
        return { name: profileMap[unit.manager_user_id], role: 'Gerente' };
      }
    }
    if (course.director_user_id && profileMap[course.director_user_id]) {
      return { name: profileMap[course.director_user_id], role: 'Diretor' };
    }
    return { name: '—', role: '' };
  }

  function getCourseDisplayInfo(course: Course) {
    const unit = course.unit_id ? unitMap[course.unit_id] : null;
    const campus = unit ? campusMap[unit.campus_id] : null;
    const institution = campus ? institutionMap[campus.institution_id] : null;
    return { unit, campus, institution };
  }

  const filtered = courses.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.unit_id && unitMap[c.unit_id]?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = courses.filter(c => c.status === 'ATIVO').length;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Cursos</h1>
        <p className="text-muted-foreground text-sm">
          Gerencie os cursos vinculados às unidades. Hierarquia de responsabilidade: Coordenador → Gerente → Diretor.
        </p>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="stats-card before:bg-primary">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-display font-bold text-foreground">{courses.length}</p>
        </div>
        <div className="stats-card before:bg-success">
          <p className="text-sm text-muted-foreground">Ativos</p>
          <p className="text-2xl font-display font-bold text-foreground">{activeCount}</p>
        </div>
        <div className="stats-card before:bg-destructive">
          <p className="text-sm text-muted-foreground">Inativos</p>
          <p className="text-2xl font-display font-bold text-foreground">{courses.length - activeCount}</p>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-card rounded-xl border border-border shadow-card">
        <div className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between border-b border-border">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar curso..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {canManage && (
            <Button onClick={openCreate} size="sm">
              <Plus className="w-4 h-4 mr-2" /> Novo Curso
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <GraduationCap className="w-12 h-12 mb-4 opacity-30" />
            <p>Nenhum curso encontrado.</p>
            {canManage && (
              <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" /> Cadastrar primeiro curso
              </Button>
            )}
          </div>
        ) : (
          <TooltipProvider>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Instituição / Campus / Unidade</TableHead>
                  <TableHead>Diretor</TableHead>
                  <TableHead>Coordenador</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((course) => {
                  const { unit, campus, institution } = getCourseDisplayInfo(course);
                  const responsavel = getResponsavel(course);
                  const locationParts = [
                    institution?.name,
                    campus?.name,
                    unit?.name,
                  ].filter(Boolean);
                  return (
                    <TableRow key={course.id}>
                      <TableCell className="font-medium">{course.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {locationParts.length > 0 ? locationParts.join(' › ') : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {course.director_user_id ? (profileMap[course.director_user_id] || '—') : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {course.coordinator_user_id ? (profileMap[course.coordinator_user_id] || '—') : '—'}
                      </TableCell>
                      <TableCell>
                        {responsavel.name !== '—' ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1.5">
                                <Crown className="w-3.5 h-3.5 text-primary" />
                                <span className="text-sm font-medium text-foreground">{responsavel.name}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Responsável como <strong>{responsavel.role}</strong></p>
                              <p className="text-xs text-muted-foreground">Hierarquia: Coordenador → Gerente → Diretor</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={course.status === 'ATIVO' ? 'default' : 'secondary'}>
                          {course.status}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(course)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {course.status === 'ATIVO' && (
                            <Button variant="ghost" size="icon" onClick={() => handleDeactivate(course.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TooltipProvider>
        )}
      </div>

      {/* Dialog: Create/Edit Course */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Curso' : 'Novo Curso'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Nome *</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Engenharia de Software"
              />
            </div>

            {/* Cascading: Institution > Campus > Unit */}
            <div>
              <Label>Instituição</Label>
              <Select value={formInstitutionId || "none"} onValueChange={handleInstitutionChange}>
                <SelectTrigger><SelectValue placeholder="Selecione a instituição" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {institutions.map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Campus</Label>
              <Select
                value={formCampusId || "none"}
                onValueChange={handleCampusChange}
                disabled={!formInstitutionId}
              >
                <SelectTrigger><SelectValue placeholder={formInstitutionId ? "Selecione o campus" : "Selecione a instituição primeiro"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {filteredCampuses.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Unidade</Label>
              <Select
                value={formUnitId || "none"}
                onValueChange={handleUnitChange}
                disabled={!formCampusId}
              >
                <SelectTrigger><SelectValue placeholder={formCampusId ? "Selecione a unidade" : "Selecione o campus primeiro"} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {filteredUnits.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Diretor do Curso *</Label>
              <SearchableUserSelect
                value={formDirectorId}
                onValueChange={setFormDirectorId}
                profiles={directorProfiles}
                placeholder="Buscar e selecionar diretor..."
                label="diretor"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formCampusId
                  ? `Diretores vinculados ao campus selecionado (${directorProfiles.length} disponível${directorProfiles.length !== 1 ? 'is' : ''}).`
                  : formInstitutionId
                    ? `Diretores da instituição selecionada (${directorProfiles.length} disponível${directorProfiles.length !== 1 ? 'is' : ''}).`
                    : 'Listando todos os diretores cadastrados. Selecione uma instituição/campus para filtrar.'}
              </p>
            </div>

            <div>
              <Label>Coordenador do Curso</Label>
              <SearchableUserSelect
                value={formCoordinatorId}
                onValueChange={setFormCoordinatorId}
                profiles={coordinatorProfiles}
                placeholder="Buscar e selecionar coordenador ou gerente..."
                label="coordenador"
              />
              <p className="text-xs text-muted-foreground mt-1">
                {formCampusId
                  ? `Coordenadores e Gerentes vinculados ao campus selecionado (${coordinatorProfiles.length} disponível${coordinatorProfiles.length !== 1 ? 'is' : ''}). Gerente assume se não houver coordenador.`
                  : formInstitutionId
                    ? `Coordenadores e Gerentes da instituição selecionada (${coordinatorProfiles.length} disponível${coordinatorProfiles.length !== 1 ? 'is' : ''}).`
                    : 'Listando todos os coordenadores e gerentes. Selecione uma instituição/campus para filtrar.'}
              </p>
            </div>

            {/* Hierarchy info */}
            <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground text-sm">Hierarquia de responsabilidade:</p>
              <p>1. <strong>Coordenador</strong> — se informado, é o responsável pela edição</p>
              <p>2. <strong>Gerente</strong> — se não houver Coordenador, o Gerente da Unidade assume</p>
              <p>3. <strong>Diretor</strong> — se não houver Gerente, o Diretor assume a responsabilidade</p>
            </div>

            {editing && (
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
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Cursos;
