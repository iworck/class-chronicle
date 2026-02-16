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
import { toast } from '@/hooks/use-toast';
import {
  Plus, Search, Pencil, Trash2, Loader2, GraduationCap, Crown,
} from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

interface Course {
  id: string;
  name: string;
  unit_id: string | null;
  director_user_id: string | null;
  coordinator_user_id: string | null;
  status: 'ATIVO' | 'INATIVO';
  created_at: string;
}

interface UnitOption {
  id: string;
  name: string;
  campus_name: string | null;
  manager_user_id: string | null;
}

interface Profile {
  id: string;
  name: string;
  email: string | null;
}

const Cursos = () => {
  const { hasRole } = useAuth();
  const canManage = hasRole('super_admin') || hasRole('admin') || hasRole('diretor') || hasRole('gerente');

  const [courses, setCourses] = useState<Course[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);

  const [formName, setFormName] = useState('');
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
    const [courseRes, unitRes, profileRes] = await Promise.all([
      supabase.from('courses').select('*').order('name'),
      supabase.from('units').select('id, name, manager_user_id, campuses(name)').eq('status', 'ATIVO').order('name'),
      supabase.from('profiles').select('id, name, email').eq('status', 'ATIVO').order('name'),
    ]);

    if (courseRes.error) {
      toast({ title: 'Erro ao carregar cursos', description: courseRes.error.message, variant: 'destructive' });
    } else {
      setCourses((courseRes.data as Course[]) || []);
    }

    const unitData = (unitRes.data || []).map((u: any) => ({
      id: u.id,
      name: u.name,
      manager_user_id: u.manager_user_id,
      campus_name: u.campuses?.name || null,
    }));
    setUnits(unitData);
    setProfiles((profileRes.data as Profile[]) || []);
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setFormName('');
    setFormUnitId('');
    setFormDirectorId('');
    setFormCoordinatorId('');
    setFormStatus('ATIVO');
    setDialogOpen(true);
  }

  function openEdit(course: Course) {
    setEditing(course);
    setFormName(course.name);
    setFormUnitId(course.unit_id || '');
    setFormDirectorId(course.director_user_id || '');
    setFormCoordinatorId(course.coordinator_user_id || '');
    setFormStatus(course.status);
    setDialogOpen(true);
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

  const unitMap = Object.fromEntries(units.map(u => [u.id, u]));
  const profileMap = Object.fromEntries(profiles.map(p => [p.id, p.name]));

  /** Hierarquia de responsabilidade: Coordenador > Gerente da Unidade > Diretor */
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
                  <TableHead>Unidade</TableHead>
                  <TableHead>Diretor</TableHead>
                  <TableHead>Coordenador</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((course) => {
                  const unit = course.unit_id ? unitMap[course.unit_id] : null;
                  const responsavel = getResponsavel(course);
                  return (
                    <TableRow key={course.id}>
                      <TableCell className="font-medium">{course.name}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {unit ? `${unit.name}${unit.campus_name ? ` (${unit.campus_name})` : ''}` : '—'}
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
        <DialogContent className="max-w-lg">
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
            <div>
              <Label>Unidade</Label>
              <Select value={formUnitId || "none"} onValueChange={(v) => setFormUnitId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione a unidade (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {units.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} {u.campus_name ? `(${u.campus_name})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Diretor do Curso *</Label>
              <Select value={formDirectorId || "none"} onValueChange={(v) => setFormDirectorId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o diretor (obrigatório)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.email ? `(${p.email})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                O Diretor é obrigatório para aprovação do curso.
              </p>
            </div>
            <div>
              <Label>Coordenador do Curso</Label>
              <Select value={formCoordinatorId || "none"} onValueChange={(v) => setFormCoordinatorId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione o coordenador (opcional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.email ? `(${p.email})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Se informado, o Coordenador será o responsável pela edição do curso.
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
