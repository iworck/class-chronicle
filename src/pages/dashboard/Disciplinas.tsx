import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  Plus, Search, Pencil, Trash2, BookOpen, Link2, Loader2, Upload, FileText, X,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Subject = Tables<'subjects'>;
type ClassSubject = Tables<'class_subjects'> & {
  classes?: { code: string; period: string } | null;
  subjects?: { name: string; code: string } | null;
};

interface CourseOption {
  id: string;
  name: string;
  unit_id: string | null;
}

interface UnitOption {
  id: string;
  name: string;
  campus_id: string;
}

interface CampusOption {
  id: string;
  name: string;
}

const Disciplinas = () => {
  const { hasRole } = useAuth();
  const canManage = hasRole('admin') || hasRole('diretor') || hasRole('gerente') || hasRole('coordenador');

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [campuses, setCampuses] = useState<CampusOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formWorkload, setFormWorkload] = useState('0');
  const [formStatus, setFormStatus] = useState<'ATIVO' | 'INATIVO'>('ATIVO');
  const [formLessonPlan, setFormLessonPlan] = useState('');
  const [formPdfUrl, setFormPdfUrl] = useState('');
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [formCourseId, setFormCourseId] = useState('');
  const [formCampusFilter, setFormCampusFilter] = useState('');
  const [formUnitFilter, setFormUnitFilter] = useState('');
  const [saving, setSaving] = useState(false);

  // Vínculo state
  const [bindings, setBindings] = useState<ClassSubject[]>([]);
  const [bindingsLoading, setBindingsLoading] = useState(true);
  const [bindDialogOpen, setBindDialogOpen] = useState(false);
  const [classes, setClasses] = useState<{ id: string; code: string; period: string }[]>([]);
  const [professors, setProfessors] = useState<{ id: string; name: string }[]>([]);
  const [bindSubjectId, setBindSubjectId] = useState('');
  const [bindClassId, setBindClassId] = useState('');
  const [bindProfessorId, setBindProfessorId] = useState('');
  const [bindSaving, setBindSaving] = useState(false);

  const canManageBindings = hasRole('admin') || hasRole('coordenador');

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    setBindingsLoading(true);
    const [subjectRes, courseRes, unitRes, campusRes, bindingRes, classRes] = await Promise.all([
      supabase.from('subjects').select('*').order('name'),
      supabase.from('courses').select('id, name, unit_id').eq('status', 'ATIVO').order('name'),
      supabase.from('units').select('id, name, campus_id').eq('status', 'ATIVO').order('name'),
      supabase.from('campuses').select('id, name').eq('status', 'ATIVO').order('name'),
      supabase.from('class_subjects').select('*, classes(code, period), subjects(name, code)').order('class_id'),
      supabase.from('classes').select('id, code, period').eq('status', 'ATIVO').order('code'),
    ]);

    if (subjectRes.error) {
      toast({ title: 'Erro ao carregar disciplinas', description: subjectRes.error.message, variant: 'destructive' });
    } else {
      setSubjects(subjectRes.data || []);
    }

    setCourses((courseRes.data as CourseOption[]) || []);
    setUnits((unitRes.data as UnitOption[]) || []);
    setCampuses((campusRes.data as CampusOption[]) || []);
    setBindings((bindingRes.data as ClassSubject[]) || []);
    setClasses(classRes.data || []);
    setLoading(false);
    setBindingsLoading(false);

    // Fetch professors
    const { data: roleData } = await supabase.from('user_roles').select('user_id').eq('role', 'professor');
    if (roleData && roleData.length > 0) {
      const ids = roleData.map((r) => r.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', ids).order('name');
      setProfessors(profiles || []);
    }
  }

  // Cascading filter logic
  const filteredUnits = useMemo(() => {
    if (!formCampusFilter) return units;
    return units.filter(u => u.campus_id === formCampusFilter);
  }, [units, formCampusFilter]);

  const filteredCourses = useMemo(() => {
    if (!formUnitFilter) {
      if (!formCampusFilter) return courses;
      const unitIds = new Set(filteredUnits.map(u => u.id));
      return courses.filter(c => c.unit_id && unitIds.has(c.unit_id));
    }
    return courses.filter(c => c.unit_id === formUnitFilter);
  }, [courses, formUnitFilter, formCampusFilter, filteredUnits]);

  // Maps for display
  const courseMap = Object.fromEntries(courses.map(c => [c.id, c]));
  const unitMap = Object.fromEntries(units.map(u => [u.id, u]));
  const campusMap = Object.fromEntries(campuses.map(c => [c.id, c]));

  function getCourseContext(courseId: string | null) {
    if (!courseId) return { course: '—', unit: '—', campus: '—' };
    const course = courseMap[courseId];
    if (!course) return { course: '—', unit: '—', campus: '—' };
    const unit = course.unit_id ? unitMap[course.unit_id] : null;
    const campus = unit ? campusMap[unit.campus_id] : null;
    return {
      course: course.name,
      unit: unit?.name || '—',
      campus: campus?.name || '—',
    };
  }

  function openCreate() {
    setEditing(null);
    setFormName('');
    setFormCode('');
    setFormWorkload('0');
    setFormStatus('ATIVO');
    setFormCourseId('');
    setFormCampusFilter('');
    setFormUnitFilter('');
    setFormLessonPlan('');
    setFormPdfUrl('');
    setDialogOpen(true);
  }

  function openEdit(s: Subject) {
    setEditing(s);
    setFormName(s.name);
    setFormCode(s.code);
    setFormWorkload(String(s.workload_hours));
    setFormStatus(s.status);
    setFormLessonPlan((s as any).lesson_plan || '');
    setFormPdfUrl('');
    const cid = (s as any).course_id || '';
    setFormCourseId(cid);
    // Set filters based on existing course
    if (cid && courseMap[cid]) {
      const course = courseMap[cid];
      if (course.unit_id && unitMap[course.unit_id]) {
        const unit = unitMap[course.unit_id];
        setFormCampusFilter(unit.campus_id);
        setFormUnitFilter(course.unit_id);
      } else {
        setFormCampusFilter('');
        setFormUnitFilter('');
      }
    } else {
      setFormCampusFilter('');
      setFormUnitFilter('');
    }
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formCode.trim()) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload: any = {
      name: formName.trim(),
      code: formCode.trim().toUpperCase(),
      workload_hours: parseInt(formWorkload) || 0,
      status: formStatus,
      course_id: formCourseId || null,
      lesson_plan: formLessonPlan.trim() || null,
    };

    if (editing) {
      const { error } = await supabase.from('subjects').update(payload).eq('id', editing.id);
      if (error) {
        toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Disciplina atualizada com sucesso' });
        setDialogOpen(false);
        fetchAll();
      }
    } else {
      const { error } = await supabase.from('subjects').insert(payload);
      if (error) {
        toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' });
      } else {
        toast({ title: 'Disciplina criada com sucesso' });
        setDialogOpen(false);
        fetchAll();
      }
    }
    setSaving(false);
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      toast({ title: 'Apenas arquivos PDF são permitidos', variant: 'destructive' });
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande (máx. 20MB)', variant: 'destructive' });
      return;
    }
    setUploadingPdf(true);
    const fileName = `${Date.now()}_${file.name}`;
    const { error } = await supabase.storage.from('lesson-plans').upload(fileName, file);
    if (error) {
      toast({ title: 'Erro no upload', description: error.message, variant: 'destructive' });
    } else {
      const { data: urlData } = supabase.storage.from('lesson-plans').getPublicUrl(fileName);
      setFormPdfUrl(urlData.publicUrl);
      toast({ title: 'PDF enviado com sucesso' });
    }
    setUploadingPdf(false);
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('subjects').update({ status: 'INATIVO' }).eq('id', id);
    if (error) {
      toast({ title: 'Erro ao inativar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Disciplina inativada' });
      fetchAll();
    }
  }

  async function handleSaveBinding() {
    if (!bindSubjectId || !bindClassId || !bindProfessorId) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    setBindSaving(true);
    const { error } = await supabase.from('class_subjects').insert({
      subject_id: bindSubjectId,
      class_id: bindClassId,
      professor_user_id: bindProfessorId,
    });
    if (error) {
      toast({ title: 'Erro ao criar vínculo', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Vínculo criado com sucesso' });
      setBindDialogOpen(false);
      setBindSubjectId('');
      setBindClassId('');
      setBindProfessorId('');
      fetchAll();
    }
    setBindSaving(false);
  }

  async function handleRemoveBinding(id: string) {
    const { error } = await supabase.from('class_subjects').update({ status: 'INATIVO' }).eq('id', id);
    if (error) {
      toast({ title: 'Erro ao remover vínculo', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Vínculo removido' });
      fetchAll();
    }
  }

  const filtered = subjects.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()) ||
      getCourseContext((s as any).course_id).course.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = subjects.filter((s) => s.status === 'ATIVO').length;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Disciplinas</h1>
        <p className="text-muted-foreground text-sm">Gerencie disciplinas vinculadas a cursos, com identificação de campus e unidade.</p>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="stats-card before:bg-primary">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-display font-bold text-foreground">{subjects.length}</p>
        </div>
        <div className="stats-card before:bg-success">
          <p className="text-sm text-muted-foreground">Ativas</p>
          <p className="text-2xl font-display font-bold text-foreground">{activeCount}</p>
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
                  placeholder="Buscar por nome, código ou curso..."
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
                    <TableHead>Curso</TableHead>
                    <TableHead>Unidade</TableHead>
                    <TableHead>Campus</TableHead>
                    <TableHead>Carga Horária</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => {
                    const ctx = getCourseContext((s as any).course_id);
                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-mono text-sm">{s.code}</TableCell>
                        <TableCell className="font-medium">{s.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{ctx.course}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{ctx.unit}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{ctx.campus}</TableCell>
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
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ===== TAB VÍNCULOS ===== */}
        <TabsContent value="vinculos">
          <div className="bg-card rounded-xl border border-border shadow-card">
            <div className="p-4 flex items-center justify-between border-b border-border">
              <p className="font-medium text-foreground">Vínculos Disciplina → Turma → Professor</p>
              {canManageBindings && (
                <Button onClick={() => setBindDialogOpen(true)} size="sm">
                  <Plus className="w-4 h-4 mr-2" /> Novo Vínculo
                </Button>
              )}
            </div>

            {bindingsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : bindings.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                Nenhum vínculo cadastrado.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Disciplina</TableHead>
                    <TableHead>Turma</TableHead>
                    <TableHead>Professor</TableHead>
                    <TableHead>Status</TableHead>
                    {canManageBindings && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bindings.map((b) => {
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
                        {canManageBindings && (
                          <TableCell className="text-right">
                            {b.status === 'ATIVO' && (
                              <Button variant="ghost" size="icon" onClick={() => handleRemoveBinding(b.id)}>
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
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ===== Dialog: Criar/Editar Disciplina ===== */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Disciplina' : 'Nova Disciplina'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Código *</Label>
                <Input value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="MAT101" />
              </div>
              <div>
                <Label>Carga Horária (h)</Label>
                <Input type="number" value={formWorkload} onChange={(e) => setFormWorkload(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Cálculo I" />
            </div>

            {/* Cascading: Campus → Unidade → Curso */}
            <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
              <p className="text-sm font-medium text-foreground">Vínculo ao Curso</p>
              <div>
                <Label className="text-xs">Campus (filtro)</Label>
                <Select
                  value={formCampusFilter || "all"}
                  onValueChange={(v) => {
                    setFormCampusFilter(v === "all" ? "" : v);
                    setFormUnitFilter('');
                    setFormCourseId('');
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Todos os campi" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os campi</SelectItem>
                    {campuses.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Unidade (filtro)</Label>
                <Select
                  value={formUnitFilter || "all"}
                  onValueChange={(v) => {
                    setFormUnitFilter(v === "all" ? "" : v);
                    setFormCourseId('');
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="Todas as unidades" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as unidades</SelectItem>
                    {filteredUnits.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Curso *</Label>
                <Select
                  value={formCourseId || "none"}
                  onValueChange={(v) => setFormCourseId(v === "none" ? "" : v)}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o curso" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {filteredCourses.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Use os filtros de Campus e Unidade para localizar o curso desejado.
                </p>
              </div>
            </div>

            {/* Plano de Aulas */}
            <div className="rounded-lg border border-border p-4 space-y-3 bg-muted/30">
              <p className="text-sm font-medium text-foreground">Plano de Aplicação das Aulas</p>
              <div>
                <Label className="text-xs">Conteúdo proposto, metodologia e observações</Label>
                <Textarea
                  value={formLessonPlan}
                  onChange={(e) => setFormLessonPlan(e.target.value)}
                  placeholder="Descreva o conteúdo programático, metodologia de ensino, recursos didáticos, critérios de avaliação e outras informações relevantes..."
                  rows={5}
                />
              </div>
              <div>
                <Label className="text-xs">Anexo PDF (opcional)</Label>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={handlePdfUpload}
                  className="hidden"
                />
                <div className="flex items-center gap-2 mt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={uploadingPdf}
                  >
                    {uploadingPdf ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                    {uploadingPdf ? 'Enviando...' : 'Enviar PDF'}
                  </Button>
                  {formPdfUrl && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <FileText className="w-4 h-4 text-primary" />
                      <a href={formPdfUrl} target="_blank" rel="noopener noreferrer" className="underline text-primary hover:text-primary/80">
                        Ver PDF
                      </a>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setFormPdfUrl('')}>
                        <X className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Envie o plano de aulas em PDF (máx. 20MB).
                </p>
              </div>
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

      {/* ===== Dialog: Novo Vínculo ===== */}
      <Dialog open={bindDialogOpen} onOpenChange={setBindDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Vínculo</DialogTitle>
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
              Criar Vínculo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Disciplinas;
