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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Search, Pencil, Trash2, BookOpen, Link2, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

type Subject = Tables<'subjects'>;
type ClassSubject = Tables<'class_subjects'> & {
  classes?: { code: string; period: string } | null;
  subjects?: { name: string; code: string } | null;
};

const Disciplinas = () => {
  const { hasRole } = useAuth();
  const canManage = hasRole('admin') || hasRole('coordenador');

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formWorkload, setFormWorkload] = useState('0');
  const [formStatus, setFormStatus] = useState<'ATIVO' | 'INATIVO'>('ATIVO');
  const [saving, setSaving] = useState(false);

  // Vínculo state
  const [bindings, setBindings] = useState<ClassSubject[]>([]);
  const [bindingsLoading, setBindingsLoading] = useState(true);
  const [bindDialogOpen, setBindDialogOpen] = useState(false);
  const [editingBinding, setEditingBinding] = useState<ClassSubject | null>(null);
  const [classes, setClasses] = useState<{ id: string; code: string; period: string }[]>([]);
  const [professors, setProfessors] = useState<{ id: string; name: string }[]>([]);
  const [bindSubjectId, setBindSubjectId] = useState('');
  const [bindClassId, setBindClassId] = useState('');
  const [bindProfessorId, setBindProfessorId] = useState('');
  const [bindSaving, setBindSaving] = useState(false);
  const [bindSearch, setBindSearch] = useState('');

  useEffect(() => {
    fetchSubjects();
    fetchBindings();
    fetchClasses();
    fetchProfessors();
  }, []);

  async function fetchSubjects() {
    setLoading(true);
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .order('name');
    if (error) {
      toast({ title: 'Erro ao carregar disciplinas', description: error.message, variant: 'destructive' });
    } else {
      setSubjects(data || []);
    }
    setLoading(false);
  }

  async function fetchBindings() {
    setBindingsLoading(true);
    const { data, error } = await supabase
      .from('class_subjects')
      .select('*, classes(code, period), subjects(name, code)')
      .order('class_id');
    if (error) {
      toast({ title: 'Erro ao carregar vínculos', description: error.message, variant: 'destructive' });
    } else {
      setBindings((data as ClassSubject[]) || []);
    }
    setBindingsLoading(false);
  }

  async function fetchClasses() {
    const { data } = await supabase
      .from('classes')
      .select('id, code, period')
      .eq('status', 'ATIVO')
      .order('code');
    setClasses(data || []);
  }

  async function fetchProfessors() {
    const { data } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'professor');
    if (data && data.length > 0) {
      const ids = data.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', ids)
        .order('name');
      setProfessors(profiles || []);
    }
  }

  // === Subject CRUD ===

  function openCreate() {
    setEditing(null);
    setFormName('');
    setFormCode('');
    setFormWorkload('0');
    setFormStatus('ATIVO');
    setDialogOpen(true);
  }

  function openEdit(s: Subject) {
    setEditing(s);
    setFormName(s.name);
    setFormCode(s.code);
    setFormWorkload(String(s.workload_hours));
    setFormStatus(s.status);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formCode.trim()) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from('subjects')
        .update({
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          workload_hours: parseInt(formWorkload) || 0,
          status: formStatus,
        })
        .eq('id', editing.id);
      if (error) {
        toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Disciplina atualizada com sucesso' });
        setDialogOpen(false);
        fetchSubjects();
      }
    } else {
      const { error } = await supabase
        .from('subjects')
        .insert({
          name: formName.trim(),
          code: formCode.trim().toUpperCase(),
          workload_hours: parseInt(formWorkload) || 0,
          status: formStatus,
        });
      if (error) {
        toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Disciplina criada com sucesso' });
        setDialogOpen(false);
        fetchSubjects();
      }
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const { error } = await supabase
      .from('subjects')
      .update({ status: 'INATIVO' })
      .eq('id', id);
    if (error) {
      toast({ title: 'Erro ao inativar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Disciplina inativada' });
      fetchSubjects();
    }
  }

  // === Binding CRUD ===

  function openCreateBinding() {
    setEditingBinding(null);
    setBindSubjectId('');
    setBindClassId('');
    setBindProfessorId('');
    setBindDialogOpen(true);
  }

  function openEditBinding(b: ClassSubject) {
    setEditingBinding(b);
    setBindSubjectId(b.subject_id);
    setBindClassId(b.class_id);
    setBindProfessorId(b.professor_user_id);
    setBindDialogOpen(true);
  }

  async function handleSaveBinding() {
    if (!bindSubjectId || !bindClassId || !bindProfessorId) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    setBindSaving(true);
    if (editingBinding) {
      const { error } = await supabase
        .from('class_subjects')
        .update({
          subject_id: bindSubjectId,
          class_id: bindClassId,
          professor_user_id: bindProfessorId,
        })
        .eq('id', editingBinding.id);
      if (error) {
        toast({ title: 'Erro ao atualizar vínculo', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Vínculo atualizado com sucesso' });
        setBindDialogOpen(false);
        fetchBindings();
      }
    } else {
      const { error } = await supabase
        .from('class_subjects')
        .insert({
          subject_id: bindSubjectId,
          class_id: bindClassId,
          professor_user_id: bindProfessorId,
        });
      if (error) {
        toast({ title: 'Erro ao criar vínculo', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Vínculo criado com sucesso' });
        setBindDialogOpen(false);
        fetchBindings();
      }
    }
    setBindSaving(false);
  }

  async function handleRemoveBinding(id: string) {
    const { error } = await supabase
      .from('class_subjects')
      .update({ status: 'INATIVO' })
      .eq('id', id);
    if (error) {
      toast({ title: 'Erro ao remover vínculo', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Vínculo inativado' });
      fetchBindings();
    }
  }

  // === Filters ===

  const filtered = subjects.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase())
  );

  const filteredBindings = bindings.filter((b) => {
    if (!bindSearch) return true;
    const q = bindSearch.toLowerCase();
    const profName = professors.find((p) => p.id === b.professor_user_id)?.name || '';
    return (
      (b.subjects?.name || '').toLowerCase().includes(q) ||
      (b.subjects?.code || '').toLowerCase().includes(q) ||
      (b.classes?.code || '').toLowerCase().includes(q) ||
      profName.toLowerCase().includes(q)
    );
  });

  const activeCount = subjects.filter((s) => s.status === 'ATIVO').length;
  const activeBindings = bindings.filter((b) => b.status === 'ATIVO').length;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Disciplinas</h1>
        <p className="text-muted-foreground text-sm">Gerencie disciplinas e vínculos com turmas e professores.</p>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-4 gap-4 mb-6">
        <div className="stats-card before:bg-primary">
          <p className="text-sm text-muted-foreground">Total Disciplinas</p>
          <p className="text-2xl font-display font-bold text-foreground">{subjects.length}</p>
        </div>
        <div className="stats-card before:bg-success">
          <p className="text-sm text-muted-foreground">Ativas</p>
          <p className="text-2xl font-display font-bold text-foreground">{activeCount}</p>
        </div>
        <div className="stats-card before:bg-accent">
          <p className="text-sm text-muted-foreground">Vínculos Ativos</p>
          <p className="text-2xl font-display font-bold text-foreground">{activeBindings}</p>
        </div>
        <div className="stats-card before:bg-destructive">
          <p className="text-sm text-muted-foreground">Inativas</p>
          <p className="text-2xl font-display font-bold text-foreground">{subjects.length - activeCount}</p>
        </div>
      </div>

      <Tabs defaultValue="disciplinas">
        <TabsList className="mb-4">
          <TabsTrigger value="disciplinas">
            <BookOpen className="w-4 h-4 mr-2" />
            Disciplinas
          </TabsTrigger>
          <TabsTrigger value="vinculos">
            <Link2 className="w-4 h-4 mr-2" />
            Vínculos Turma-Professor
          </TabsTrigger>
        </TabsList>

        {/* ===== TAB DISCIPLINAS ===== */}
        <TabsContent value="disciplinas">
          <div className="bg-card rounded-xl border border-border shadow-card">
            <div className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between border-b border-border">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar disciplina..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {canManage && (
                <Button onClick={openCreate} size="sm">
                  <Plus className="w-4 h-4 mr-2" /> Nova Disciplina
                </Button>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                Nenhuma disciplina encontrada.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Carga Horária</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-mono text-sm">{s.code}</TableCell>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell>{s.workload_hours}h</TableCell>
                      <TableCell>
                        <Badge variant={s.status === 'ATIVO' ? 'default' : 'secondary'}>
                          {s.status}
                        </Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          {s.status === 'ATIVO' && (
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ===== TAB VÍNCULOS ===== */}
        <TabsContent value="vinculos">
          <div className="bg-card rounded-xl border border-border shadow-card">
            <div className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between border-b border-border">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar vínculo..."
                  value={bindSearch}
                  onChange={(e) => setBindSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {canManage && (
                <Button onClick={openCreateBinding} size="sm">
                  <Plus className="w-4 h-4 mr-2" /> Novo Vínculo
                </Button>
              )}
            </div>

            {bindingsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredBindings.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                Nenhum vínculo encontrado.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Disciplina</TableHead>
                    <TableHead>Turma</TableHead>
                    <TableHead>Professor</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBindings.map((b) => {
                    const profName = professors.find((p) => p.id === b.professor_user_id)?.name || b.professor_user_id;
                    return (
                      <TableRow key={b.id}>
                        <TableCell>
                          <span className="font-mono text-xs mr-2">{b.subjects?.code}</span>
                          {b.subjects?.name}
                        </TableCell>
                        <TableCell>{b.classes?.code} – {b.classes?.period}</TableCell>
                        <TableCell>{profName}</TableCell>
                        <TableCell>
                          <Badge variant={b.status === 'ATIVO' ? 'default' : 'secondary'}>
                            {b.status}
                          </Badge>
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right space-x-2">
                            {b.status === 'ATIVO' && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => openEditBinding(b)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => handleRemoveBinding(b.id)}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== Dialog: Criar/Editar Disciplina ===== */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Disciplina' : 'Nova Disciplina'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Código *</Label>
              <Input value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="MAT101" />
            </div>
            <div>
              <Label>Nome *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Cálculo I" />
            </div>
            <div>
              <Label>Carga Horária (h)</Label>
              <Input type="number" value={formWorkload} onChange={(e) => setFormWorkload(e.target.value)} />
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

      {/* ===== Dialog: Criar/Editar Vínculo ===== */}
      <Dialog open={bindDialogOpen} onOpenChange={setBindDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingBinding ? 'Editar Vínculo' : 'Novo Vínculo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Disciplina *</Label>
              <Select value={bindSubjectId} onValueChange={setBindSubjectId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {subjects.filter((s) => s.status === 'ATIVO').map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.code} – {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Turma *</Label>
              <Select value={bindClassId} onValueChange={setBindClassId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.code} – {c.period}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Professor *</Label>
              <Select value={bindProfessorId} onValueChange={setBindProfessorId}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {professors.length === 0 ? (
                    <SelectItem value="_none" disabled>Nenhum professor cadastrado</SelectItem>
                  ) : (
                    professors.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveBinding} disabled={bindSaving}>
              {bindSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingBinding ? 'Salvar' : 'Criar Vínculo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Disciplinas;
