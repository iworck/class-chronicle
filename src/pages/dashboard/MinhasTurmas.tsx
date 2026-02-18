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
  Loader2, Calendar, Eye, Users, UserPlus, Settings2, Save, Plus, Trash2, FileText, Search, BookOpen, GraduationCap, Edit, Lock,
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
  plan_status: string;
  ementa_override: string | null;
  bibliografia_basica: string | null;
  bibliografia_complementar: string | null;
  class: { id: string; code: string; period: string; course_id: string; status: string };
  subject: { id: string; name: string; code: string; min_grade: number; min_attendance_pct: number; lesson_plan: string | null };
  course?: { name: string };
  professor?: { name: string };
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
  objective: string | null;
  activities: string | null;
  resource: string | null;
  methodology: string | null;
  lesson_number: number | null;
  exam_type: string | null;
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

const EXAM_TYPES = [
  { value: 'AV1', label: 'AV1' },
  { value: 'AV2', label: 'AV2' },
  { value: '2_CHAMADA', label: '2ª Chamada' },
  { value: 'FINAL', label: 'Final' },
];

const EXAM_TYPE_LABELS: Record<string, string> = {
  AV1: 'AV1',
  AV2: 'AV2',
  '2_CHAMADA': '2ª Chamada',
  FINAL: 'Final',
};

const MinhasTurmas = () => {
  const { user, effectiveUserId, impersonatedUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [classSubjects, setClassSubjects] = useState<ClassSubjectRow[]>([]);
  const [search, setSearch] = useState('');

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCS, setSelectedCS] = useState<ClassSubjectRow | null>(null);
  const [students, setStudents] = useState<ClassStudentRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('plano');

  // Lesson plan entries (AULA rows)
  const [lessonEntries, setLessonEntries] = useState<LessonPlanEntry[]>([]);
  const [lessonFormOpen, setLessonFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LessonPlanEntry | null>(null);
  const [entryDate, setEntryDate] = useState('');
  const [entryTitle, setEntryTitle] = useState('');
  const [entryObjective, setEntryObjective] = useState('');
  const [entryActivities, setEntryActivities] = useState('');
  const [entryResource, setEntryResource] = useState('');
  const [entryMethodology, setEntryMethodology] = useState('');
  const [entryLessonNumber, setEntryLessonNumber] = useState('');
  const [entrySaving, setEntrySaving] = useState(false);

  // Exam dates
  const [examEntries, setExamEntries] = useState<LessonPlanEntry[]>([]);
  const [examFormOpen, setExamFormOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<LessonPlanEntry | null>(null);
  const [examDate, setExamDate] = useState('');
  const [examType, setExamType] = useState('AV1');
  const [examSaving, setExamSaving] = useState(false);

  // Ementa & bibliografias
  const [ementa, setEmenta] = useState('');
  const [biblioBasica, setBiblioBasica] = useState('');
  const [biblioComplementar, setBiblioComplementar] = useState('');
  const [ementaSaving, setEmentaSaving] = useState(false);

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

  // Use effectiveUserId so emulation works
  const targetUserId = effectiveUserId ?? user?.id;

  useEffect(() => {
    if (targetUserId) loadMyClasses();
  }, [targetUserId]);

  async function loadMyClasses() {
    if (!targetUserId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('class_subjects')
      .select('id, class_id, subject_id, professor_user_id, status, grades_closed, plan_status, ementa_override, bibliografia_basica, bibliografia_complementar, class:classes(id, code, period, course_id, status), subject:subjects(id, name, code, min_grade, min_attendance_pct, lesson_plan)')
      .eq('professor_user_id', targetUserId)
      .eq('status', 'ATIVO')
      .order('class_id');

    if (error) {
      toast({ title: 'Erro ao carregar turmas', description: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    const items = (data as any[]) || [];
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

    // Load professor name
    const { data: profile } = await supabase.from('profiles').select('name').eq('id', targetUserId).single();
    for (const item of items) {
      item.professor = { name: profile?.name || '—' };
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

  async function openDetail(cs: ClassSubjectRow) {
    setSelectedCS(cs);
    setDetailOpen(true);
    setDetailLoading(true);
    setActiveTab('plano');

    // Load ementa and bibliografias
    setEmenta(cs.ementa_override || cs.subject?.lesson_plan || '');
    setBiblioBasica(cs.bibliografia_basica || '');
    setBiblioComplementar(cs.bibliografia_complementar || '');

    const [studRes, lessonRes] = await Promise.all([
      supabase.from('class_students')
        .select('id, student_id, status, student:students(id, name, enrollment)')
        .eq('class_id', cs.class_id)
        .eq('status', 'ATIVO')
        .order('student_id'),
      supabase.from('lesson_plan_entries')
        .select('*')
        .eq('class_subject_id', cs.id)
        .order('entry_date', { ascending: true }),
    ]);

    const allEntries = (lessonRes.data as any[]) || [];
    setLessonEntries(allEntries.filter((e: any) => e.entry_type !== 'AVALIACAO'));
    setExamEntries(allEntries.filter((e: any) => e.entry_type === 'AVALIACAO'));
    setStudents((studRes.data as any[]) || []);
    setDetailLoading(false);
  }

  // ---- Lesson Plan CRUD ----
  function openNewLesson() {
    setEditingEntry(null);
    setEntryDate('');
    setEntryTitle('');
    setEntryObjective('');
    setEntryActivities('');
    setEntryResource('');
    setEntryMethodology('');
    const nextNumber = lessonEntries.length > 0 ? Math.max(...lessonEntries.map(e => e.lesson_number || 0)) + 1 : 1;
    setEntryLessonNumber(String(nextNumber));
    setLessonFormOpen(true);
  }

  function openEditLesson(entry: LessonPlanEntry) {
    setEditingEntry(entry);
    setEntryDate(entry.entry_date);
    setEntryTitle(entry.title || '');
    setEntryObjective(entry.objective || '');
    setEntryActivities(entry.activities || '');
    setEntryResource(entry.resource || '');
    setEntryMethodology(entry.methodology || '');
    setEntryLessonNumber(String(entry.lesson_number || ''));
    setLessonFormOpen(true);
  }

  async function handleSaveLesson() {
    if (!entryDate || !entryTitle.trim() || !selectedCS) {
      toast({ title: 'Preencha data e conteúdo', variant: 'destructive' });
      return;
    }
    setEntrySaving(true);

    const payload = {
      class_subject_id: selectedCS.id,
      entry_date: entryDate,
      title: entryTitle.trim(),
      description: null as string | null,
      entry_type: 'AULA' as const,
      objective: entryObjective.trim() || null,
      activities: entryActivities.trim() || null,
      resource: entryResource.trim() || null,
      methodology: entryMethodology.trim() || null,
      lesson_number: parseInt(entryLessonNumber) || null,
      exam_type: null as string | null,
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

    toast({ title: editingEntry ? 'Aula atualizada' : 'Aula adicionada ao plano' });
    setLessonFormOpen(false);
    await refreshEntries();
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
    await refreshEntries();
  }

  async function refreshEntries() {
    if (!selectedCS) return;
    const { data } = await supabase.from('lesson_plan_entries')
      .select('*').eq('class_subject_id', selectedCS.id).order('entry_date');
    const allEntries = (data as any[]) || [];
    setLessonEntries(allEntries.filter((e: any) => e.entry_type !== 'AVALIACAO'));
    setExamEntries(allEntries.filter((e: any) => e.entry_type === 'AVALIACAO'));
  }

  // ---- Exam Dates ----
  function openNewExam() {
    setEditingExam(null);
    setExamDate('');
    setExamType('AV1');
    setExamFormOpen(true);
  }

  function openEditExam(entry: LessonPlanEntry) {
    setEditingExam(entry);
    setExamDate(entry.entry_date);
    setExamType(entry.exam_type || 'AV1');
    setExamFormOpen(true);
  }

  async function handleSaveExam() {
    if (!examDate || !selectedCS) {
      toast({ title: 'Preencha a data', variant: 'destructive' });
      return;
    }
    setExamSaving(true);

    const payload = {
      class_subject_id: selectedCS.id,
      entry_date: examDate,
      title: EXAM_TYPE_LABELS[examType] || examType,
      entry_type: 'AVALIACAO' as const,
      exam_type: examType,
      description: null as string | null,
      objective: null as string | null,
      activities: null as string | null,
      resource: null as string | null,
      methodology: null as string | null,
      lesson_number: null as number | null,
    };

    if (editingExam?.id) {
      const { error } = await supabase.from('lesson_plan_entries').update(payload).eq('id', editingExam.id);
      if (error) {
        toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
        setExamSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from('lesson_plan_entries').insert(payload);
      if (error) {
        toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' });
        setExamSaving(false);
        return;
      }
    }

    toast({ title: editingExam ? 'Prova atualizada' : 'Data de prova adicionada' });
    setExamFormOpen(false);
    await refreshEntries();
    setExamSaving(false);
  }

  // ---- Save Ementa & Bibliografias ----
  async function handleSaveEmenta() {
    if (!selectedCS) return;
    setEmentaSaving(true);
    const { error } = await supabase.from('class_subjects').update({
      ementa_override: ementa.trim() || null,
      bibliografia_basica: biblioBasica.trim() || null,
      bibliografia_complementar: biblioComplementar.trim() || null,
    }).eq('id', selectedCS.id);

    if (error) {
      toast({ title: 'Erro ao salvar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Ementa e bibliografias salvas!' });
      // Update local state for selected CS
      const updatedEmenta = ementa.trim() || null;
      const updatedBibBasica = biblioBasica.trim() || null;
      const updatedBibComplementar = biblioComplementar.trim() || null;
      setSelectedCS(prev => prev ? { ...prev, ementa_override: updatedEmenta, bibliografia_basica: updatedBibBasica, bibliografia_complementar: updatedBibComplementar } : null);
      // Also update the main classSubjects list so reopening shows fresh data
      setClassSubjects(prev => prev.map(cs => cs.id === selectedCS.id ? { ...cs, ementa_override: updatedEmenta, bibliografia_basica: updatedBibBasica, bibliografia_complementar: updatedBibComplementar } : cs));
    }
    setEmentaSaving(false);
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

  // ---- Grade Template ----
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

      {/* ============ DETAIL DIALOG ============ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              Plano de Ensino
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* HEADER INFO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-lg border border-border bg-muted/30">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Curso</p>
                  <p className="text-sm font-semibold text-foreground">{selectedCS?.course?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Turma</p>
                  <p className="text-sm font-semibold text-foreground">{selectedCS?.class?.code || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Matéria / Disciplina</p>
                  <p className="text-sm font-semibold text-foreground">{selectedCS?.subject?.name || '—'} ({selectedCS?.subject?.code})</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Professor</p>
                  <p className="text-sm font-semibold text-foreground">{selectedCS?.professor?.name || '—'}</p>
                </div>
              </div>

              {/* Plan locked banner */}
              {selectedCS?.plan_status === 'APROVADO' && (
                <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 flex items-center gap-3">
                  <Lock className="w-5 h-5 text-primary shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Plano aprovado pelo coordenador — Edições bloqueadas</p>
                    <p className="text-xs text-muted-foreground">Para alterar, solicite ao coordenador que desbloqueie o plano.</p>
                  </div>
                </div>
              )}

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="w-full grid grid-cols-5">
                  <TabsTrigger value="provas" className="text-xs">
                    <Calendar className="w-3.5 h-3.5 mr-1" /> Provas
                  </TabsTrigger>
                  <TabsTrigger value="ementa" className="text-xs">
                    <BookOpen className="w-3.5 h-3.5 mr-1" /> Ementa
                  </TabsTrigger>
                  <TabsTrigger value="plano" className="text-xs">
                    <FileText className="w-3.5 h-3.5 mr-1" /> Plano de Aula
                  </TabsTrigger>
                  <TabsTrigger value="notas" className="text-xs">
                    <Settings2 className="w-3.5 h-3.5 mr-1" /> Notas
                  </TabsTrigger>
                  <TabsTrigger value="alunos" className="text-xs">
                    <Users className="w-3.5 h-3.5 mr-1" /> Alunos
                  </TabsTrigger>
                </TabsList>

                {/* TAB: DATAS DAS PROVAS */}
                <TabsContent value="provas" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Datas das provas e avaliações programadas.</p>
                    <Button size="sm" onClick={openNewExam} disabled={selectedCS?.plan_status === 'APROVADO'}>
                      <Plus className="w-4 h-4 mr-2" /> Nova Prova
                    </Button>
                  </div>

                  {examEntries.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Calendar className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Nenhuma data de prova cadastrada.</p>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {examEntries.map(exam => (
                          <TableRow key={exam.id}>
                            <TableCell>
                              <Badge variant="outline">{EXAM_TYPE_LABELS[exam.exam_type || ''] || exam.title}</Badge>
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {format(new Date(exam.entry_date + 'T12:00:00'), 'dd/MM/yyyy')}
                            </TableCell>
                            <TableCell className="text-right">
                              {selectedCS?.plan_status !== 'APROVADO' && (
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditExam(exam)}>
                                  <Edit className="w-3.5 h-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteEntry(exam.id!)}>
                                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                </Button>
                              </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </TabsContent>

                {/* TAB: EMENTA & BIBLIOGRAFIAS */}
                <TabsContent value="ementa" className="space-y-4 mt-4">
                  <div className="space-y-4">
                    <div>
                      <Label className="text-sm font-semibold">Ementa</Label>
                      <p className="text-xs text-muted-foreground mb-1">Carregada da ementa da disciplina. Pode ser alterada pelo professor.</p>
                      <Textarea value={ementa} onChange={e => setEmenta(e.target.value)} rows={5} placeholder="Ementa da disciplina..." disabled={selectedCS?.plan_status === 'APROVADO'} />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold">Bibliografia Básica</Label>
                      <Textarea value={biblioBasica} onChange={e => setBiblioBasica(e.target.value)} rows={4} placeholder="Insira a bibliografia básica..." disabled={selectedCS?.plan_status === 'APROVADO'} />
                    </div>
                    <div>
                      <Label className="text-sm font-semibold">Bibliografia Complementar</Label>
                      <Textarea value={biblioComplementar} onChange={e => setBiblioComplementar(e.target.value)} rows={4} placeholder="Insira a bibliografia complementar..." disabled={selectedCS?.plan_status === 'APROVADO'} />
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={handleSaveEmenta} disabled={ementaSaving || selectedCS?.plan_status === 'APROVADO'}>
                        {ementaSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        <Save className="w-4 h-4 mr-2" /> Salvar
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* TAB: PLANO DE AULA (cronograma unificado: aulas + provas ordenadas por data) */}
                <TabsContent value="plano" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Cronograma detalhado — aulas e provas organizados por data crescente.</p>
                    <Button size="sm" onClick={openNewLesson} disabled={selectedCS?.plan_status === 'APROVADO'}>
                      <Plus className="w-4 h-4 mr-2" /> Nova Aula
                    </Button>
                  </div>

                  {(() => {
                    // Merge aulas + provas, sort by date ascending, auto-number
                    const all = [
                      ...lessonEntries.map(e => ({ ...e, isExam: false })),
                      ...examEntries.map(e => ({ ...e, isExam: true })),
                    ].sort((a, b) => a.entry_date.localeCompare(b.entry_date));

                    if (all.length === 0) {
                      return (
                        <div className="text-center py-8 text-muted-foreground">
                          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                          <p className="text-sm">Nenhuma aula ou prova cadastrada no plano.</p>
                        </div>
                      );
                    }

                    // Auto sequential numbering (exam rows count as entries)
                    let counter = 0;
                    return (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12 text-center">Nº</TableHead>
                              <TableHead className="w-24">Dia</TableHead>
                              <TableHead className="w-24">Tipo</TableHead>
                              <TableHead>Conteúdo / Prova</TableHead>
                              <TableHead>Objetivo</TableHead>
                              <TableHead>Atividades</TableHead>
                              <TableHead>Recurso</TableHead>
                              <TableHead>Metodologia</TableHead>
                              <TableHead className="w-20 text-right">Ações</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {all.map(entry => {
                              counter += 1;
                              const num = counter;
                              return (
                                <TableRow
                                  key={entry.id}
                                  className={entry.isExam ? 'bg-warning/5 border-l-2 border-l-warning/60' : ''}
                                >
                                  <TableCell className="font-mono font-bold text-center text-muted-foreground">
                                    {num}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs whitespace-nowrap">
                                    {format(new Date(entry.entry_date + 'T12:00:00'), 'dd/MM/yyyy')}
                                  </TableCell>
                                  <TableCell>
                                    {entry.isExam ? (
                                      <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/40">
                                        📋 {entry.exam_type?.replace('_', ' ') || 'Prova'}
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs">
                                        Aula {entry.lesson_number || num}
                                      </Badge>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs font-medium">{entry.title || '—'}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{entry.isExam ? '—' : (entry.objective || '—')}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{entry.isExam ? '—' : (entry.activities || '—')}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{entry.isExam ? '—' : (entry.resource || '—')}</TableCell>
                                  <TableCell className="text-xs text-muted-foreground">{entry.isExam ? '—' : (entry.methodology || '—')}</TableCell>
                                  <TableCell className="text-right">
                                    {selectedCS?.plan_status !== 'APROVADO' && (
                                      <div className="flex justify-end gap-1">
                                        <Button
                                          variant="ghost" size="icon" className="h-7 w-7"
                                          onClick={() => entry.isExam ? openEditExam(entry as any) : openEditLesson(entry as any)}
                                        >
                                          <Edit className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button
                                          variant="ghost" size="icon" className="h-7 w-7"
                                          onClick={() => handleDeleteEntry(entry.id!)}
                                        >
                                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                                        </Button>
                                      </div>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                        <div className="px-4 py-2 bg-muted/30 border-t border-border text-xs text-muted-foreground">
                          {all.filter(e => !e.isExam).length} aula(s) · {all.filter(e => e.isExam).length} prova(s) · {all.length} registros no total
                        </div>
                      </div>
                    );
                  })()}
                </TabsContent>

                {/* TAB: Grade Template */}
                <TabsContent value="notas" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Configure os critérios de avaliação e composição das notas finais.
                    </p>
                    <Button size="sm" onClick={openTemplateDialog} disabled={selectedCS?.plan_status === 'APROVADO'}>
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
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ============ LESSON ENTRY FORM ============ */}
      <Dialog open={lessonFormOpen} onOpenChange={setLessonFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEntry ? 'Editar Aula' : 'Nova Aula no Plano'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Aula Nº</Label>
                <Input type="number" min="1" value={entryLessonNumber} onChange={e => setEntryLessonNumber(e.target.value)} />
              </div>
              <div>
                <Label>Dia *</Label>
                <Input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Conteúdo *</Label>
              <Input value={entryTitle} onChange={e => setEntryTitle(e.target.value)} placeholder="Ex: Introdução à Álgebra Linear" />
            </div>
            <div>
              <Label>Objetivo</Label>
              <Textarea value={entryObjective} onChange={e => setEntryObjective(e.target.value)} placeholder="Objetivo da aula..." rows={2} />
            </div>
            <div>
              <Label>Atividades</Label>
              <Input value={entryActivities} onChange={e => setEntryActivities(e.target.value)} placeholder="Ex: Exercícios práticos" />
            </div>
            <div>
              <Label>Recurso</Label>
              <Input value={entryResource} onChange={e => setEntryResource(e.target.value)} placeholder="Ex: Projetor, Quadro" />
            </div>
            <div>
              <Label>Metodologia</Label>
              <Input value={entryMethodology} onChange={e => setEntryMethodology(e.target.value)} placeholder="Ex: Aula expositiva dialogada" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveLesson} disabled={entrySaving}>
              {entrySaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingEntry ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ EXAM DATE FORM ============ */}
      <Dialog open={examFormOpen} onOpenChange={setExamFormOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingExam ? 'Editar Data de Prova' : 'Nova Data de Prova'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo *</Label>
              <Select value={examType} onValueChange={setExamType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXAM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data *</Label>
              <Input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSaveExam} disabled={examSaving}>
              {examSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingExam ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ ENROLLMENT SUGGESTION ============ */}
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

      {/* ============ GRADE TEMPLATE DIALOG ============ */}
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
                      <p className="text-xs text-warning">
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
