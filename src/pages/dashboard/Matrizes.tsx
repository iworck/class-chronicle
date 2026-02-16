import { useState, useEffect, useMemo } from 'react';
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
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Search, Pencil, Trash2, Loader2, BookOpen, X, GraduationCap,
} from 'lucide-react';

interface Matrix {
  id: string;
  code: string;
  instructions: string | null;
  course_id: string;
  status: 'ATIVO' | 'INATIVO';
  created_at: string;
}

interface MatrixSubject {
  id: string;
  matrix_id: string;
  subject_id: string;
  semester: number;
}

interface CourseOption { id: string; name: string; unit_id: string | null; }
interface UnitOption { id: string; name: string; campus_id: string; }
interface CampusOption { id: string; name: string; }
interface SubjectOption { id: string; name: string; code: string; course_id: string | null; }

const Matrizes = () => {
  const { hasRole, user } = useAuth();
  const canManage = hasRole('admin') || hasRole('super_admin') || hasRole('coordenador');
  const isCoordinator = hasRole('coordenador') && !hasRole('admin') && !hasRole('super_admin');

  const [matrices, setMatrices] = useState<Matrix[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [campuses, setCampuses] = useState<CampusOption[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Matrix | null>(null);
  const [formCode, setFormCode] = useState('');
  const [formInstructions, setFormInstructions] = useState('');
  const [formCourseId, setFormCourseId] = useState('');
  const [formStatus, setFormStatus] = useState<'ATIVO' | 'INATIVO'>('ATIVO');
  const [formCampusFilter, setFormCampusFilter] = useState('');
  const [formUnitFilter, setFormUnitFilter] = useState('');
  const [saving, setSaving] = useState(false);

  // Subject linking dialog
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedMatrix, setSelectedMatrix] = useState<Matrix | null>(null);
  const [matrixSubjects, setMatrixSubjects] = useState<MatrixSubject[]>([]);
  const [linkSubjectId, setLinkSubjectId] = useState('');
  const [linkSemester, setLinkSemester] = useState('1');
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [matRes, courseRes, unitRes, campusRes, subRes] = await Promise.all([
      supabase.from('academic_matrices').select('*').order('code'),
      supabase.from('courses').select('id, name, unit_id').eq('status', 'ATIVO').order('name'),
      supabase.from('units').select('id, name, campus_id').eq('status', 'ATIVO').order('name'),
      supabase.from('campuses').select('id, name').eq('status', 'ATIVO').order('name'),
      supabase.from('subjects').select('id, name, code, course_id').eq('status', 'ATIVO').order('name'),
    ]);

    if (matRes.error) {
      toast({ title: 'Erro ao carregar matrizes', description: matRes.error.message, variant: 'destructive' });
    } else {
      setMatrices((matRes.data || []) as Matrix[]);
    }
    setCourses((courseRes.data as CourseOption[]) || []);
    setUnits((unitRes.data as UnitOption[]) || []);
    setCampuses((campusRes.data as CampusOption[]) || []);
    setSubjects((subRes.data as SubjectOption[]) || []);
    setLoading(false);
  }

  // Cascading filters
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

  const courseMap = Object.fromEntries(courses.map(c => [c.id, c]));
  const unitMap = Object.fromEntries(units.map(u => [u.id, u]));
  const campusMap = Object.fromEntries(campuses.map(c => [c.id, c]));

  function getCourseContext(courseId: string) {
    const course = courseMap[courseId];
    if (!course) return { course: '—', unit: '—', campus: '—' };
    const unit = course.unit_id ? unitMap[course.unit_id] : null;
    const campus = unit ? campusMap[unit.campus_id] : null;
    return { course: course.name, unit: unit?.name || '—', campus: campus?.name || '—' };
  }

  function openCreate() {
    setEditing(null);
    setFormCode('');
    setFormInstructions('');
    setFormCourseId('');
    setFormStatus('ATIVO');
    setFormCampusFilter('');
    setFormUnitFilter('');
    setDialogOpen(true);
  }

  function openEdit(m: Matrix) {
    setEditing(m);
    setFormCode(m.code);
    setFormInstructions(m.instructions || '');
    setFormCourseId(m.course_id);
    setFormStatus(m.status);
    const course = courseMap[m.course_id];
    if (course?.unit_id && unitMap[course.unit_id]) {
      setFormCampusFilter(unitMap[course.unit_id].campus_id);
      setFormUnitFilter(course.unit_id);
    } else {
      setFormCampusFilter('');
      setFormUnitFilter('');
    }
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formCode.trim() || !formCourseId) {
      toast({ title: 'Preencha código e curso', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload = {
      code: formCode.trim().toUpperCase(),
      instructions: formInstructions.trim() || null,
      course_id: formCourseId,
      status: formStatus,
    };

    if (editing) {
      const { error } = await supabase.from('academic_matrices').update(payload).eq('id', editing.id);
      if (error) toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      else { toast({ title: 'Matriz atualizada com sucesso' }); setDialogOpen(false); fetchAll(); }
    } else {
      const { error } = await supabase.from('academic_matrices').insert(payload);
      if (error) toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' });
      else { toast({ title: 'Matriz criada com sucesso' }); setDialogOpen(false); fetchAll(); }
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from('academic_matrices').update({ status: 'INATIVO' }).eq('id', id);
    if (error) toast({ title: 'Erro ao inativar', description: error.message, variant: 'destructive' });
    else { toast({ title: 'Matriz inativada' }); fetchAll(); }
  }

  // Subject linking
  async function openLinkDialog(m: Matrix) {
    setSelectedMatrix(m);
    setLinkSubjectId('');
    setLinkSemester('1');
    setLinkDialogOpen(true);
    setLinkLoading(true);
    const { data, error } = await supabase.from('matrix_subjects').select('*').eq('matrix_id', m.id).order('semester');
    if (error) toast({ title: 'Erro ao carregar disciplinas', description: error.message, variant: 'destructive' });
    setMatrixSubjects((data || []) as MatrixSubject[]);
    setLinkLoading(false);
  }

  async function handleAddSubject() {
    if (!linkSubjectId || !selectedMatrix) {
      toast({ title: 'Selecione uma disciplina', variant: 'destructive' });
      return;
    }
    setLinkSaving(true);
    const { error } = await supabase.from('matrix_subjects').insert({
      matrix_id: selectedMatrix.id,
      subject_id: linkSubjectId,
      semester: parseInt(linkSemester) || 1,
    });
    if (error) toast({ title: 'Erro ao vincular', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Disciplina vinculada' });
      setLinkSubjectId('');
      // Refresh
      const { data } = await supabase.from('matrix_subjects').select('*').eq('matrix_id', selectedMatrix.id).order('semester');
      setMatrixSubjects((data || []) as MatrixSubject[]);
    }
    setLinkSaving(false);
  }

  async function handleRemoveSubject(id: string) {
    if (!selectedMatrix) return;
    const { error } = await supabase.from('matrix_subjects').delete().eq('id', id);
    if (error) toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Disciplina removida da matriz' });
      const { data } = await supabase.from('matrix_subjects').select('*').eq('matrix_id', selectedMatrix.id).order('semester');
      setMatrixSubjects((data || []) as MatrixSubject[]);
    }
  }

  const subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));

  // Available subjects = those belonging to the matrix's course and not already linked
  const availableSubjects = useMemo(() => {
    const linked = new Set(matrixSubjects.map(ms => ms.subject_id));
    const courseId = selectedMatrix?.course_id;
    return subjects.filter(s => !linked.has(s.id) && s.course_id === courseId);
  }, [subjects, matrixSubjects, selectedMatrix]);

  // Group linked subjects by semester
  const groupedBySemester = useMemo(() => {
    const map = new Map<number, MatrixSubject[]>();
    matrixSubjects.forEach(ms => {
      const list = map.get(ms.semester) || [];
      list.push(ms);
      map.set(ms.semester, list);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [matrixSubjects]);

  const filtered = matrices.filter(m =>
    m.code.toLowerCase().includes(search.toLowerCase()) ||
    getCourseContext(m.course_id).course.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = matrices.filter(m => m.status === 'ATIVO').length;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Matrizes Acadêmicas</h1>
        <p className="text-muted-foreground text-sm">Gerencie matrizes curriculares vinculadas a cursos, com disciplinas por semestre.</p>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="stats-card before:bg-primary">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-display font-bold text-foreground">{matrices.length}</p>
        </div>
        <div className="stats-card before:bg-success">
          <p className="text-sm text-muted-foreground">Ativas</p>
          <p className="text-2xl font-display font-bold text-foreground">{activeCount}</p>
        </div>
        <div className="stats-card before:bg-destructive">
          <p className="text-sm text-muted-foreground">Inativas</p>
          <p className="text-2xl font-display font-bold text-foreground">{matrices.length - activeCount}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-card">
        <div className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between border-b border-border">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por código ou curso..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          {canManage && (
            <Button onClick={openCreate} size="sm">
              <Plus className="w-4 h-4 mr-2" /> Nova Matriz
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">Nenhuma matriz encontrada.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead>Campus</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(m => {
                const ctx = getCourseContext(m.course_id);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-sm font-medium">{m.code}</TableCell>
                    <TableCell>{ctx.course}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ctx.unit}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ctx.campus}</TableCell>
                    <TableCell>
                      <Badge variant={m.status === 'ATIVO' ? 'default' : 'secondary'}>{m.status}</Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-right space-x-1">
                        <Button variant="ghost" size="icon" title="Disciplinas" onClick={() => openLinkDialog(m)}>
                          <BookOpen className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {m.status === 'ATIVO' && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Matriz' : 'Nova Matriz Acadêmica'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Código *</Label>
              <Input value={formCode} onChange={e => setFormCode(e.target.value)} placeholder="Ex: 2026001" />
            </div>
            <div>
              <Label>Instruções</Label>
              <Textarea value={formInstructions} onChange={e => setFormInstructions(e.target.value)} placeholder="Instruções ou observações da matriz..." rows={3} />
            </div>

            {/* Cascading course selection */}
            <div>
              <Label>Campus (filtro)</Label>
              <Select value={formCampusFilter} onValueChange={v => { setFormCampusFilter(v); setFormUnitFilter(''); setFormCourseId(''); }}>
                <SelectTrigger><SelectValue placeholder="Todos os campi" /></SelectTrigger>
                <SelectContent>
                  {campuses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unidade (filtro)</Label>
              <Select value={formUnitFilter} onValueChange={v => { setFormUnitFilter(v); setFormCourseId(''); }}>
                <SelectTrigger><SelectValue placeholder="Todas as unidades" /></SelectTrigger>
                <SelectContent>
                  {filteredUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Curso *</Label>
              <Select value={formCourseId} onValueChange={setFormCourseId}>
                <SelectTrigger><SelectValue placeholder="Selecione o curso" /></SelectTrigger>
                <SelectContent>
                  {filteredCourses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {editing && (
              <div>
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={v => setFormStatus(v as 'ATIVO' | 'INATIVO')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ATIVO">ATIVO</SelectItem>
                    <SelectItem value="INATIVO">INATIVO</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subject Linking Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              Disciplinas da Matriz {selectedMatrix?.code}
            </DialogTitle>
          </DialogHeader>

          {linkLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-6 py-2">
              {/* Add subject form */}
              {canManage && (
                <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-lg bg-muted/50 border border-border">
                  <div className="flex-1">
                    <Label className="text-xs">Disciplina</Label>
                    <Select value={linkSubjectId} onValueChange={setLinkSubjectId}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {availableSubjects.map(s => (
                          <SelectItem key={s.id} value={s.id}>
                            <span className="font-mono text-xs mr-2">{s.code}</span> {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24">
                    <Label className="text-xs">Semestre</Label>
                    <Input type="number" min="1" max="20" value={linkSemester} onChange={e => setLinkSemester(e.target.value)} />
                  </div>
                  <div className="flex items-end">
                    <Button size="sm" onClick={handleAddSubject} disabled={linkSaving}>
                      {linkSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4 mr-1" />}
                      Vincular
                    </Button>
                  </div>
                </div>
              )}

              {/* Grouped subjects */}
              {matrixSubjects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nenhuma disciplina vinculada a esta matriz.</div>
              ) : (
                groupedBySemester.map(([semester, items]) => (
                  <div key={semester}>
                    <h3 className="text-sm font-semibold text-foreground mb-2">{semester}º Semestre</h3>
                    <div className="space-y-1">
                      {items.map(ms => {
                        const sub = subjectMap[ms.subject_id];
                        return (
                          <div key={ms.id} className="flex items-center justify-between px-3 py-2 rounded-md bg-card border border-border">
                            <div>
                              <span className="font-mono text-xs text-muted-foreground mr-2">{sub?.code || '?'}</span>
                              <span className="text-sm">{sub?.name || 'Disciplina removida'}</span>
                            </div>
                            {canManage && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveSubject(ms.id)}>
                                <X className="w-3.5 h-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}

              {matrixSubjects.length > 0 && (
                <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                  Total: {matrixSubjects.length} disciplina(s) em {groupedBySemester.length} semestre(s)
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Matrizes;
