import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import {
  Loader2, Calendar, Eye, Users, UserPlus, Settings2, Save, Plus, Trash2, FileText, Search,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ClassSubjectRow {
  id: string;
  class_id: string;
  subject_id: string;
  professor_user_id: string;
  status: string;
  grades_closed: boolean;
  class: { id: string; code: string; period: string; course_id: string; status: string };
  subject: { id: string; name: string; code: string; min_grade: number; min_attendance_pct: number };
  course?: { name: string };
}

interface ClassStudentRow {
  id: string;
  student_id: string;
  status: string;
  student: { id: string; name: string; enrollment: string };
}

interface LessonPlanEntry {
  id?: string;
  entry_date: string;
  title: string;
  description: string;
  entry_type: 'AULA' | 'ATIVIDADE' | 'AVALIACAO';
}

interface TemplateItem {
  id?: string;
  name: string;
  category: string;
  weight: string;
  counts_in_final: boolean;
  parent_item_id: string | null;
  order_index: number;
}

const GRADE_CATEGORIES = [
  { value: 'prova', label: 'Prova' },
  { value: 'trabalho', label: 'Trabalho' },
  { value: 'media', label: 'Média' },
  { value: 'ponto_extra', label: 'Ponto Extra' },
];

const ENTRY_TYPE_LABELS: Record<string, string> = {
  AULA: 'Aula',
  ATIVIDADE: 'Atividade',
  AVALIACAO: 'Avaliação',
};

const ENTRY_TYPE_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  AULA: 'default',
  ATIVIDADE: 'secondary',
  AVALIACAO: 'outline',
};

const MinhasTurmas = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [classSubjects, setClassSubjects] = useState<ClassSubjectRow[]>([]);
  const [search, setSearch] = useState('');

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCS, setSelectedCS] = useState<ClassSubjectRow | null>(null);
  const [students, setStudents] = useState<ClassStudentRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('plano');

  // Lesson plan
  const [lessonEntries, setLessonEntries] = useState<LessonPlanEntry[]>([]);
  const [lessonLoading, setLessonLoading] = useState(false);
  const [lessonFormOpen, setLessonFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LessonPlanEntry | null>(null);
  const [entryDate, setEntryDate] = useState('');
  const [entryTitle, setEntryTitle] = useState('');
  const [entryDescription, setEntryDescription] = useState('');
  const [entryType, setEntryType] = useState<'AULA' | 'ATIVIDADE' | 'AVALIACAO'>('AULA');
  const [entrySaving, setEntrySaving] = useState(false);

  // Enrollment suggestion
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestEnrollment, setSuggestEnrollment] = useState('');
  const [suggestJustification, setSuggestJustification] = useState('');
  const [suggestSaving, setSuggestSaving] = useState(false);

  // Grade template
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [deletedTemplateIds, setDeletedTemplateIds] = useState<string[]>([]);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);

  useEffect(() => {
    if (user) loadMyClasses();
  }, [user]);

  async function loadMyClasses() {
    setLoading(true);
    const { data, error } = await supabase
      .from('class_subjects')
      .select('id, class_id, subject_id, professor_user_id, status, grades_closed, class:classes(id, code, period, course_id, status), subject:subjects(id, name, code, min_grade, min_attendance_pct)')
      .eq('professor_user_id', user!.id)
      .eq('status', 'ATIVO')
      .order('class_id');

    if (error) {
      toast({ title: 'Erro ao carregar turmas', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const items = (data as any[]) || [];
    // Load course names
    const courseIds = [...new Set(items.map(i => i.class?.course_id).filter(Boolean))];
    if (courseIds.length > 0) {
      const { data: courses } = await supabase.from('courses').select('id, name').in('id', courseIds);
      const courseMap = Object.fromEntries((courses || []).map((c: any) => [c.id, c.name]));
      for (const item of items) {
        if (item.class?.course_id) {
          item.course = { name: courseMap[item.class.course_id] || '—' };
        }
      }
    }

    setClassSubjects(items);
    setLoading(false);
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return classSubjects;
    const q = search.toLowerCase();
    return classSubjects.filter(cs =>
      cs.class?.code?.toLowerCase().includes(q) ||
      cs.subject?.name?.toLowerCase().includes(q) ||
      cs.course?.name?.toLowerCase().includes(q)
    );
  }, [classSubjects, search]);

  // Open class detail
  async function openDetail(cs: ClassSubjectRow) {
    setSelectedCS(cs);
    setDetailOpen(true);
    setDetailLoading(true);
    setActiveTab('plano');

    const [studRes, lessonRes] = await Promise.all([
      supabase.from('class_students')
        .select('id, student_id, status, student:students(id, name, enrollment)')
        .eq('class_id', cs.class_id)
        .eq('status', 'ATIVO')
        .order('student_id'),
      supabase.from('lesson_plan_entries')
        .select('*')
        .eq('class_subject_id', cs.id)
        .order('entry_date'),
    ]);

    setStudents((studRes.data as any[]) || []);
    setLessonEntries((lessonRes.data as any[]) || []);
    setDetailLoading(false);
  }

  // ---- Lesson Plan CRUD ----
  function openNewEntry() {
    setEditingEntry(null);
    setEntryDate('');
    setEntryTitle('');
    setEntryDescription('');
    setEntryType('AULA');
    setLessonFormOpen(true);
  }

  function openEditEntry(entry: LessonPlanEntry) {
    setEditingEntry(entry);
    setEntryDate(entry.entry_date);
    setEntryTitle(entry.title);
    setEntryDescription(entry.description || '');
    setEntryType(entry.entry_type);
    setLessonFormOpen(true);
  }

  async function handleSaveEntry() {
    if (!entryDate || !entryTitle.trim() || !selectedCS) {
      toast({ title: 'Preencha data e título', variant: 'destructive' });
      return;
    }
    setEntrySaving(true);

    const payload = {
      class_subject_id: selectedCS.id,
      entry_date: entryDate,
      title: entryTitle.trim(),
      description: entryDescription.trim() || null,
      entry_type: entryType,
    };

    if (editingEntry?.id) {
      const { error } = await supabase.from('lesson_plan_entries').update(payload).eq('id', editingEntry.id);
      if (error) {
        toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
        setEntrySaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from('lesson_plan_entries').insert(payload);
      if (error) {
        toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' });
        setEntrySaving(false);
        return;
      }
    }

    toast({ title: editingEntry ? 'Entrada atualizada' : 'Entrada adicionada ao plano de aula' });
    setLessonFormOpen(false);

    // Refresh
    const { data } = await supabase.from('lesson_plan_entries')
      .select('*').eq('class_subject_id', selectedCS.id).order('entry_date');
    setLessonEntries((data as any[]) || []);
    setEntrySaving(false);
  }

  async function handleDeleteEntry(id: string) {
    if (!selectedCS) return;
    const { error } = await supabase.from('lesson_plan_entries').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Entrada removida' });
    setLessonEntries(prev => prev.filter(e => e.id !== id));
  }

  // ---- Enrollment Suggestion ----
  async function handleSuggest() {
    if (!suggestEnrollment.trim() || !suggestJustification.trim() || !selectedCS || !user) {
      toast({ title: 'Preencha matrícula e justificativa', variant: 'destructive' });
      return;
    }
    setSuggestSaving(true);

    const { error } = await supabase.from('enrollment_suggestions').insert({
      class_id: selectedCS.class_id,
      student_enrollment: suggestEnrollment.trim(),
      justification: suggestJustification.trim(),
      suggested_by_user_id: user.id,
    });

    if (error) {
      toast({ title: 'Erro ao enviar sugestão', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Sugestão enviada ao coordenador' });
      setSuggestOpen(false);
      setSuggestEnrollment('');
      setSuggestJustification('');
    }
    setSuggestSaving(false);
  }

  // ---- Grade Template (same logic as Turmas.tsx) ----
  async function openTemplateDialog() {
    if (!selectedCS) return;
    setDeletedTemplateIds([]);
    setTemplateOpen(true);
    setTemplateLoading(true);

    const { data } = await supabase
      .from('grade_template_items')
      .select('*')
      .eq('class_subject_id', selectedCS.id)
      .order('order_index');

    if (data && data.length > 0) {
      setTemplateItems(data.map((d: any) => ({
        id: d.id, name: d.name, category: d.category, weight: String(d.weight),
        counts_in_final: d.counts_in_final, parent_item_id: d.parent_item_id, order_index: d.order_index,
      })));
    } else {
      setTemplateItems([
        { name: 'T1', category: 'trabalho', weight: '0.3', counts_in_final: false, parent_item_id: null, order_index: 0 },
        { name: 'P1', category: 'prova', weight: '0.7', counts_in_final: false, parent_item_id: null, order_index: 1 },
        { name: 'N1', category: 'media', weight: '1', counts_in_final: true, parent_item_id: null, order_index: 2 },
      ]);
    }
    setTemplateLoading(false);
  }

  function addTemplateItem() {
    setTemplateItems(prev => [...prev, {
      name: '', category: 'prova', weight: '1', counts_in_final: true,
      parent_item_id: null, order_index: prev.length,
    }]);
  }

  function removeTemplateItem(index: number) {
    const item = templateItems[index];
    if (item.id) setDeletedTemplateIds(prev => [...prev, item.id!]);
    const removedId = item.id;
    setTemplateItems(prev => {
      const updated = prev.filter((_, i) => i !== index);
      if (removedId) return updated.map(t => t.parent_item_id === removedId ? { ...t, parent_item_id: null } : t);
      return updated;
    });
  }

  function updateTemplateItem(index: number, field: keyof TemplateItem, value: any) {
    setTemplateItems(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  }

  function getParentCandidates(currentIndex: number) {
    return templateItems.filter((t, i) => i !== currentIndex && t.counts_in_final && t.name.trim() !== '');
  }

  async function handleSaveTemplate() {
    if (!selectedCS) return;
    setTemplateSaving(true);
    try {
      for (const id of deletedTemplateIds) {
        await supabase.from('grade_template_items').delete().eq('id', id);
      }
      const savedItems: { tempIndex: number; dbId: string }[] = [];
      for (let i = 0; i < templateItems.length; i++) {
        const item = templateItems[i];
        if (!item.name.trim()) continue;
        const payload: any = {
          class_subject_id: selectedCS.id,
          name: item.name.trim().toUpperCase(),
          category: item.category,
          weight: parseFloat(item.weight) || 1,
          counts_in_final: item.counts_in_final,
          order_index: i,
          parent_item_id: null,
        };
        if (item.id) {
          if (item.parent_item_id && !item.parent_item_id.startsWith('temp_')) {
            payload.parent_item_id = item.parent_item_id;
          }
          await supabase.from('grade_template_items').update(payload).eq('id', item.id);
          savedItems.push({ tempIndex: i, dbId: item.id });
        } else {
          const { data, error } = await supabase.from('grade_template_items').insert(payload).select('id').single();
          if (error) throw error;
          savedItems.push({ tempIndex: i, dbId: data.id });
        }
      }
      // Second pass for parent references
      for (let i = 0; i < templateItems.length; i++) {
        const item = templateItems[i];
        if (!item.parent_item_id || item.id) continue;
        const saved = savedItems.find(s => s.tempIndex === i);
        if (!saved) continue;
        const parentItem = templateItems.find(t => t.counts_in_final && t.name.trim().toUpperCase() === item.parent_item_id?.toUpperCase());
        if (parentItem) {
          const parentSaved = savedItems.find(s => s.tempIndex === templateItems.indexOf(parentItem));
          if (parentSaved) {
            await supabase.from('grade_template_items').update({ parent_item_id: parentSaved.dbId }).eq('id', saved.dbId);
          }
        }
      }
      toast({ title: 'Modelo de notas salvo!' });
      setTemplateOpen(false);
    } catch (err: any) {
      toast({ title: 'Erro ao salvar modelo', description: err.message, variant: 'destructive' });
    }
    setTemplateSaving(false);
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Minhas Turmas</h1>
        <p className="text-muted-foreground text-sm">Visualize suas turmas, gerencie planos de aula e critérios de avaliação.</p>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="stats-card before:bg-primary">
          <p className="text-sm text-muted-foreground">Turmas Ativas</p>
          <p className="text-2xl font-display font-bold text-foreground">{classSubjects.length}</p>
        </div>
        <div className="stats-card before:bg-success">
          <p className="text-sm text-muted-foreground">Disciplinas</p>
          <p className="text-2xl font-display font-bold text-foreground">
            {new Set(classSubjects.map(cs => cs.subject_id)).size}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-card">
        <div className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between border-b border-border">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar turma ou disciplina..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Calendar className="w-12 h-12 mb-4 opacity-30" />
            <p>Nenhuma turma vinculada.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Turma</TableHead>
                <TableHead>Ano Letivo</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Disciplina</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(cs => (
                <TableRow key={cs.id}>
                  <TableCell className="font-medium">{cs.class?.code || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{cs.class?.period || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{cs.course?.name || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{cs.subject?.name || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={cs.class?.status === 'ATIVO' ? 'default' : 'secondary'}>{cs.class?.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openDetail(cs)} title="Ver detalhes">
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {selectedCS?.class?.code} — {selectedCS?.subject?.name}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full grid grid-cols-3">
                <TabsTrigger value="plano">
                  <FileText className="w-4 h-4 mr-2" /> Plano de Aula
                </TabsTrigger>
                <TabsTrigger value="notas">
                  <Settings2 className="w-4 h-4 mr-2" /> Critérios de Notas
                </TabsTrigger>
                <TabsTrigger value="alunos">
                  <Users className="w-4 h-4 mr-2" /> Alunos ({students.length})
                </TabsTrigger>
              </TabsList>

              {/* TAB: Lesson Plan */}
              <TabsContent value="plano" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Registre as datas das aulas, atividades e avaliações programadas.
                  </p>
                  <Button size="sm" onClick={openNewEntry}>
                    <Plus className="w-4 h-4 mr-2" /> Nova Entrada
                  </Button>
                </div>

                {lessonEntries.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Nenhuma entrada no plano de aula.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lessonEntries.map(entry => (
                      <div key={entry.id} className="p-3 rounded-lg border border-border bg-muted/20 flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={ENTRY_TYPE_COLORS[entry.entry_type]}>
                              {ENTRY_TYPE_LABELS[entry.entry_type]}
                            </Badge>
                            <span className="text-xs text-muted-foreground font-mono">
                              {format(new Date(entry.entry_date + 'T12:00:00'), 'dd/MM/yyyy')}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-foreground">{entry.title}</p>
                          {entry.description && (
                            <p className="text-xs text-muted-foreground mt-1">{entry.description}</p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditEntry(entry)} title="Editar">
                            <FileText className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteEntry(entry.id!)} title="Excluir">
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* TAB: Grade Template */}
              <TabsContent value="notas" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Configure os critérios de avaliação e composição das notas finais.
                  </p>
                  <Button size="sm" onClick={openTemplateDialog}>
                    <Settings2 className="w-4 h-4 mr-2" /> Configurar Modelo
                  </Button>
                </div>
                <div className="p-4 rounded-lg border border-border bg-muted/30">
                  <p className="text-xs text-muted-foreground">
                    Nota mínima: <strong>{selectedCS?.subject?.min_grade}</strong> | 
                    Frequência mínima: <strong>{selectedCS?.subject?.min_attendance_pct}%</strong>
                  </p>
                </div>
              </TabsContent>

              {/* TAB: Students */}
              <TabsContent value="alunos" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Alunos vinculados a esta turma. Para incluir um aluno, envie uma sugestão ao coordenador.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => setSuggestOpen(true)}>
                    <UserPlus className="w-4 h-4 mr-2" /> Sugerir Inclusão
                  </Button>
                </div>

                {students.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum aluno vinculado.</p>
                ) : (
                  <div className="border border-border rounded-lg divide-y divide-border">
                    {students.map(s => (
                      <div key={s.id} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{s.student?.name || '—'}</p>
                          <p className="text-xs text-muted-foreground">Matrícula: {s.student?.enrollment || '—'}</p>
                        </div>
                        <Badge variant={s.status === 'ATIVO' ? 'default' : 'secondary'}>{s.status}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Lesson Plan Entry Form */}
      <Dialog open={lessonFormOpen} onOpenChange={setLessonFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Editar Entrada' : 'Nova Entrada no Plano de Aula'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Data *</Label>
              <Input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
            </div>
            <div>
              <Label>Tipo *</Label>
              <Select value={entryType} onValueChange={v => setEntryType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AULA">Aula</SelectItem>
                  <SelectItem value="ATIVIDADE">Atividade</SelectItem>
                  <SelectItem value="AVALIACAO">Avaliação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Título *</Label>
              <Input value={entryTitle} onChange={e => setEntryTitle(e.target.value)} placeholder="Ex: Introdução à Álgebra Linear" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={entryDescription} onChange={e => setEntryDescription(e.target.value)} placeholder="Detalhes da aula ou atividade..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveEntry} disabled={entrySaving}>
              {entrySaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingEntry ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Enrollment Suggestion Dialog */}
      <Dialog open={suggestOpen} onOpenChange={setSuggestOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sugerir Inclusão de Aluno</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A sugestão será enviada ao coordenador para aprovação.
          </p>
          <div className="space-y-4">
            <div>
              <Label>Matrícula do Aluno *</Label>
              <Input value={suggestEnrollment} onChange={e => setSuggestEnrollment(e.target.value)} placeholder="Ex: 2024001234" />
            </div>
            <div>
              <Label>Justificativa *</Label>
              <Textarea value={suggestJustification} onChange={e => setSuggestJustification(e.target.value)} placeholder="Motivo da inclusão..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSuggest} disabled={suggestSaving}>
              {suggestSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enviar Sugestão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grade Template Dialog */}
      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Modelo de Notas — {selectedCS?.subject?.name}
            </DialogTitle>
          </DialogHeader>

          {templateLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 rounded-lg border border-primary/20 bg-primary/5">
                <p className="text-xs text-muted-foreground">
                  Configure os itens de avaliação. Itens com <strong>"Compõe Média"</strong> ativado contarão no cálculo da média final.
                  Itens com essa opção desativada servem como <strong>critérios de composição</strong> de outro item (ex: T1 e P1 compõem N1).
                </p>
              </div>

              <div className="grid grid-cols-[1fr_100px_70px_90px_120px_40px] gap-2 text-xs font-semibold text-muted-foreground px-1">
                <span>Nome</span>
                <span>Categoria</span>
                <span>Peso</span>
                <span className="text-center">Compõe Média</span>
                <span>Item Pai</span>
                <span></span>
              </div>

              {templateItems.map((item, idx) => {
                const parentCandidates = getParentCandidates(idx);
                return (
                  <div key={idx} className={`grid grid-cols-[1fr_100px_70px_90px_120px_40px] gap-2 items-center p-2 rounded-md ${item.counts_in_final ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30 border border-border'}`}>
                    <Input placeholder="Ex: T1, P1, N1" value={item.name} onChange={e => updateTemplateItem(idx, 'name', e.target.value)} className="text-sm font-mono" />
                    <Select value={item.category} onValueChange={v => updateTemplateItem(idx, 'category', v)}>
                      <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {GRADE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="number" min="0.1" step="0.1" value={item.weight} onChange={e => updateTemplateItem(idx, 'weight', e.target.value)} className="text-sm" />
                    <div className="flex justify-center">
                      <Switch checked={item.counts_in_final} onCheckedChange={v => { updateTemplateItem(idx, 'counts_in_final', v); if (v) updateTemplateItem(idx, 'parent_item_id', null); }} />
                    </div>
                    <div>
                      {!item.counts_in_final ? (
                        <Select value={item.parent_item_id || '_none'} onValueChange={v => updateTemplateItem(idx, 'parent_item_id', v === '_none' ? null : v)}>
                          <SelectTrigger className="text-xs"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Nenhum</SelectItem>
                            {parentCandidates.map((pc, pcIdx) => (
                              <SelectItem key={pc.id || `temp_${pcIdx}`} value={pc.id || pc.name.trim().toUpperCase()}>{pc.name.trim().toUpperCase()}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs text-muted-foreground italic px-2">—</span>
                      )}
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeTemplateItem(idx)} className="shrink-0">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}

              <Button variant="outline" size="sm" onClick={addTemplateItem}>
                <Plus className="w-4 h-4 mr-2" /> Adicionar Item
              </Button>

              {/* Preview formula */}
              {templateItems.length > 0 && (() => {
                const parentItems = templateItems.filter(t => t.counts_in_final && t.name.trim());
                const orphanItems = templateItems.filter(t => !t.counts_in_final && !t.parent_item_id && t.name.trim());
                return (
                  <div className="p-4 rounded-md border border-border bg-muted/50 space-y-3">
                    <p className="text-sm font-semibold text-foreground">📐 Fórmula de Cálculo:</p>
                    {parentItems.map((finalItem, i) => {
                      const children = templateItems.filter(t => !t.counts_in_final && t.parent_item_id && (t.parent_item_id === finalItem.id || t.parent_item_id === finalItem.name.trim().toUpperCase()));
                      return (
                        <div key={i} className="p-3 rounded-md bg-background border border-border space-y-1">
                          <p className="text-sm font-bold text-primary">{finalItem.name.trim().toUpperCase()}</p>
                          {children.length > 0 ? (
                            <>
                              {children.map((c, ci) => (
                                <p key={ci} className="text-xs text-muted-foreground font-mono pl-2">
                                  {c.name.trim().toUpperCase()} × peso {c.weight}
                                </p>
                              ))}
                              <p className="text-xs font-semibold text-foreground pl-2 pt-1 border-t border-border mt-1">
                                {finalItem.name.trim().toUpperCase()} = {children.map(c => c.name.trim().toUpperCase()).join(' + ')}
                              </p>
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground pl-2">Nota lançada diretamente (peso {finalItem.weight})</p>
                          )}
                        </div>
                      );
                    })}
                    {parentItems.length > 0 && (
                      <div className="p-3 rounded-md bg-primary/10 border border-primary/30">
                        <p className="text-sm font-bold text-foreground">
                          MÉDIA = ({parentItems.map(p => p.name.trim().toUpperCase()).join(' + ')}) / {parentItems.length}
                        </p>
                      </div>
                    )}
                    {orphanItems.length > 0 && (
                      <p className="text-xs text-amber-600">
                        ⚠ Itens sem pai e que não compõem a média: {orphanItems.map(t => t.name.trim().toUpperCase()).join(', ')}
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveTemplate} disabled={templateSaving}>
              {templateSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" /> Salvar Modelo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MinhasTurmas;
