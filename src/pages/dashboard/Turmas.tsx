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
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Search, Pencil, Loader2, Calendar, Eye, Users, Trash2, UserPlus, UserMinus, Settings2, Save,
} from 'lucide-react';

interface Course {
  id: string;
  name: string;
  unit_id: string | null;
}

interface Subject {
  id: string;
  name: string;
  code: string;
  course_id: string | null;
}

interface Profile {
  id: string;
  name: string;
  email: string | null;
}

interface ClassRow {
  id: string;
  code: string;
  course_id: string;
  period: string;
  shift: string | null;
  status: 'ATIVO' | 'INATIVO';
  created_at: string;
}

interface ClassSubjectRow {
  id: string;
  class_id: string;
  subject_id: string;
  professor_user_id: string;
  status: string;
  subject?: { id: string; name: string; code: string };
  professor?: { id: string; name: string };
}

interface ClassStudentRow {
  id: string;
  class_id: string;
  student_id: string;
  status: string;
  start_date: string;
  student?: { id: string; name: string; enrollment: string };
}

interface Student {
  id: string;
  name: string;
  enrollment: string;
  course_id: string;
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

const Turmas = () => {
  const { hasRole } = useAuth();
  const canManage = hasRole('super_admin') || hasRole('admin') || hasRole('coordenador');

  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [professors, setProfessors] = useState<Profile[]>([]);
  const [filteredProfessors, setFilteredProfessors] = useState<Profile[]>([]);
  const [loadingProfessors, setLoadingProfessors] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ClassRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [formCode, setFormCode] = useState('');
  const [formPeriod, setFormPeriod] = useState('');
  const [formCourseId, setFormCourseId] = useState('');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formProfessorId, setFormProfessorId] = useState('');
  const [formStatus, setFormStatus] = useState<'ATIVO' | 'INATIVO'>('ATIVO');

  // View dialog (students)
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewClass, setViewClass] = useState<ClassRow | null>(null);
  const [viewSubjects, setViewSubjects] = useState<ClassSubjectRow[]>([]);
  const [viewStudents, setViewStudents] = useState<ClassStudentRow[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  // Student linking
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [linkSaving, setLinkSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Grade template dialog
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateClassSubjectId, setTemplateClassSubjectId] = useState('');
  const [templateSubjectName, setTemplateSubjectName] = useState('');
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [deletedTemplateIds, setDeletedTemplateIds] = useState<string[]>([]);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [classRes, courseRes, subjectRes, profRes] = await Promise.all([
      supabase.from('classes').select('*').order('created_at', { ascending: false }),
      supabase.from('courses').select('id, name, unit_id').eq('status', 'ATIVO').order('name'),
      supabase.from('subjects').select('id, name, code, course_id').eq('status', 'ATIVO').order('name'),
      supabase.from('profiles').select('id, name, email').eq('status', 'ATIVO').order('name'),
    ]);
    setClasses((classRes.data as ClassRow[]) || []);
    setCourses((courseRes.data as Course[]) || []);
    setSubjects((subjectRes.data as Subject[]) || []);
    setProfessors((profRes.data as Profile[]) || []);
    setLoading(false);
  }

  const courseMap = useMemo(() => Object.fromEntries(courses.map(c => [c.id, c.name])), [courses]);

  // Filter subjects by selected course
  const filteredSubjects = useMemo(
    () => subjects.filter(s => !formCourseId || s.course_id === formCourseId),
    [subjects, formCourseId]
  );

  // Fetch professors filtered by course's unit/campus
  async function fetchProfessorsByCourse(courseId: string) {
    setLoadingProfessors(true);
    setFilteredProfessors([]);

    const course = courses.find(c => c.id === courseId);
    if (!course?.unit_id) {
      setFilteredProfessors(professors);
      setLoadingProfessors(false);
      return;
    }

    const { data: unitData } = await supabase
      .from('units')
      .select('campus_id')
      .eq('id', course.unit_id)
      .single();

    if (!unitData) {
      setFilteredProfessors(professors);
      setLoadingProfessors(false);
      return;
    }

    const { data: profRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'professor');

    const profUserIds = (profRoles || []).map(r => r.user_id);
    if (profUserIds.length === 0) {
      setFilteredProfessors([]);
      setLoadingProfessors(false);
      return;
    }

    const [unitUsers, campusUsers] = await Promise.all([
      supabase.from('user_units').select('user_id').eq('unit_id', course.unit_id),
      supabase.from('user_campuses').select('user_id').eq('campus_id', unitData.campus_id),
    ]);

    const linkedUserIds = new Set([
      ...(unitUsers.data || []).map(u => u.user_id),
      ...(campusUsers.data || []).map(u => u.user_id),
    ]);

    const validIds = profUserIds.filter(id => linkedUserIds.has(id));

    if (validIds.length === 0) {
      setFilteredProfessors([]);
      setLoadingProfessors(false);
      return;
    }

    const { data: profs } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', validIds)
      .eq('status', 'ATIVO')
      .order('name');

    setFilteredProfessors((profs as Profile[]) || []);
    setLoadingProfessors(false);
  }

  function openCreate() {
    setEditing(null);
    setFormCode(''); setFormPeriod(''); setFormCourseId('');
    setFormSubjectId(''); setFormProfessorId(''); setFormStatus('ATIVO');
    setDialogOpen(true);
  }

  async function openEdit(cls: ClassRow) {
    setEditing(cls);
    setFormCode(cls.code);
    setFormPeriod(cls.period);
    setFormCourseId(cls.course_id);
    setFormStatus(cls.status);
    fetchProfessorsByCourse(cls.course_id);

    const { data } = await supabase.from('class_subjects')
      .select('*')
      .eq('class_id', cls.id)
      .limit(1)
      .maybeSingle();
    if (data) {
      setFormSubjectId((data as any).subject_id);
      setFormProfessorId((data as any).professor_user_id);
    } else {
      setFormSubjectId('');
      setFormProfessorId('');
    }
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formCode.trim() || !formPeriod.trim() || !formCourseId || !formSubjectId || !formProfessorId) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const classPayload = {
      code: formCode.trim(),
      period: formPeriod.trim(),
      course_id: formCourseId,
      status: formStatus,
    };

    let classId = editing?.id;

    if (editing) {
      const { error } = await supabase.from('classes').update(classPayload).eq('id', editing.id);
      if (error) {
        toast({ title: 'Erro ao atualizar turma', description: error.message, variant: 'destructive' });
        setSaving(false);
        return;
      }
      const { data: existing } = await supabase.from('class_subjects')
        .select('id')
        .eq('class_id', editing.id)
        .limit(1)
        .maybeSingle();
      if (existing) {
        await supabase.from('class_subjects').update({
          subject_id: formSubjectId,
          professor_user_id: formProfessorId,
        }).eq('id', (existing as any).id);
      } else {
        await supabase.from('class_subjects').insert({
          class_id: editing.id,
          subject_id: formSubjectId,
          professor_user_id: formProfessorId,
        });
      }
    } else {
      const { data, error } = await supabase.from('classes').insert(classPayload).select('id').single();
      if (error) {
        toast({ title: 'Erro ao criar turma', description: error.message, variant: 'destructive' });
        setSaving(false);
        return;
      }
      classId = data.id;
      await supabase.from('class_subjects').insert({
        class_id: classId,
        subject_id: formSubjectId,
        professor_user_id: formProfessorId,
      });
    }

    toast({ title: editing ? 'Turma atualizada' : 'Turma criada com sucesso' });
    setDialogOpen(false);
    fetchAll();
    setSaving(false);
  }

  // View class details (subjects + students)
  async function openView(cls: ClassRow) {
    setViewClass(cls);
    setViewDialogOpen(true);
    setViewLoading(true);

    const [subRes, studRes] = await Promise.all([
      supabase.from('class_subjects')
        .select('*, subject:subjects(id, name, code)')
        .eq('class_id', cls.id),
      supabase.from('class_students')
        .select('*, student:students(id, name, enrollment)')
        .eq('class_id', cls.id)
        .order('start_date', { ascending: false }),
    ]);

    setViewSubjects((subRes.data as any[]) || []);
    setViewStudents((studRes.data as any[]) || []);
    setViewLoading(false);
  }

  // Link students
  async function openLinkDialog() {
    if (!viewClass) return;
    setLinkDialogOpen(true);
    setStudentSearch('');
    setSelectedStudentIds([]);

    const subjectId = viewSubjects.length > 0 ? viewSubjects[0].subject_id : null;

    if (!subjectId) {
      setAllStudents([]);
      return;
    }

    const { data: enrollments } = await supabase
      .from('student_subject_enrollments')
      .select('student_id')
      .eq('subject_id', subjectId)
      .eq('status', 'CURSANDO');

    if (!enrollments || enrollments.length === 0) {
      setAllStudents([]);
      return;
    }

    const studentIds = [...new Set(enrollments.map(e => e.student_id))];
    const { data } = await supabase
      .from('students')
      .select('id, name, enrollment, course_id')
      .in('id', studentIds)
      .eq('status', 'ATIVO')
      .order('name');
    setAllStudents((data as Student[]) || []);
  }

  const alreadyLinkedIds = useMemo(
    () => new Set(viewStudents.map(vs => vs.student_id)),
    [viewStudents]
  );

  const filteredLinkStudents = useMemo(() => {
    if (!studentSearch.trim()) return allStudents;
    const q = studentSearch.toLowerCase();
    return allStudents.filter(s =>
      s.name.toLowerCase().includes(q) || s.enrollment.toLowerCase().includes(q)
    );
  }, [allStudents, studentSearch]);

  function toggleStudent(id: string) {
    setSelectedStudentIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  }

  async function handleLinkStudents() {
    if (!viewClass || selectedStudentIds.length === 0) return;
    setLinkSaving(true);

    const rows = selectedStudentIds.map(studentId => ({
      class_id: viewClass.id,
      student_id: studentId,
    }));

    const { error } = await supabase.from('class_students').insert(rows);
    if (error) {
      toast({ title: 'Erro ao vincular alunos', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${selectedStudentIds.length} aluno(s) vinculado(s)` });
      setLinkDialogOpen(false);
      const { data } = await supabase.from('class_students')
        .select('*, student:students(id, name, enrollment)')
        .eq('class_id', viewClass.id)
        .order('start_date', { ascending: false });
      setViewStudents((data as any[]) || []);
    }
    setLinkSaving(false);
  }

  async function handleUnlinkStudent(linkId: string) {
    if (!viewClass) return;
    const { error } = await supabase.from('class_students').delete().eq('id', linkId);
    if (error) {
      toast({ title: 'Erro ao desvincular', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Aluno desvinculado' });
      const { data } = await supabase.from('class_students')
        .select('*, student:students(id, name, enrollment)')
        .eq('class_id', viewClass.id)
        .order('start_date', { ascending: false });
      setViewStudents((data as any[]) || []);
    }
  }

  async function handleDeactivate(id: string) {
    const { error } = await supabase.from('classes').update({ status: 'INATIVO' }).eq('id', id);
    if (error) {
      toast({ title: 'Erro ao inativar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Turma inativada' });
      fetchAll();
    }
  }

  // ---- Grade Template ----
  async function openTemplateDialog(classSubject: ClassSubjectRow) {
    setTemplateClassSubjectId(classSubject.id);
    setTemplateSubjectName(classSubject.subject?.name || 'Disciplina');
    setDeletedTemplateIds([]);
    setTemplateDialogOpen(true);
    setTemplateLoading(true);

    const { data } = await supabase
      .from('grade_template_items')
      .select('*')
      .eq('class_subject_id', classSubject.id)
      .order('order_index');

    if (data && data.length > 0) {
      setTemplateItems(data.map((d: any) => ({
        id: d.id,
        name: d.name,
        category: d.category,
        weight: String(d.weight),
        counts_in_final: d.counts_in_final,
        parent_item_id: d.parent_item_id,
        order_index: d.order_index,
      })));
    } else {
      setTemplateItems([
        { name: 'T1', category: 'trabalho', weight: '0.3', counts_in_final: false, parent_item_id: null, order_index: 0 },
        { name: 'P1', category: 'prova', weight: '0.7', counts_in_final: false, parent_item_id: null, order_index: 1 },
        { name: 'T2', category: 'trabalho', weight: '1', counts_in_final: false, parent_item_id: null, order_index: 2 },
        { name: 'N1', category: 'media', weight: '1', counts_in_final: true, parent_item_id: null, order_index: 3 },
      ]);
    }
    setTemplateLoading(false);
  }

  function addTemplateItem() {
    const nextIdx = templateItems.length;
    setTemplateItems(prev => [...prev, {
      name: '',
      category: 'prova',
      weight: '1',
      counts_in_final: true,
      parent_item_id: null,
      order_index: nextIdx,
    }]);
  }

  function removeTemplateItem(index: number) {
    const item = templateItems[index];
    if (item.id) {
      setDeletedTemplateIds(prev => [...prev, item.id!]);
    }
    // Also remove children pointing to this item
    const removedId = item.id;
    setTemplateItems(prev => {
      const updated = prev.filter((_, i) => i !== index);
      // Clear parent references to deleted item
      if (removedId) {
        return updated.map(t => t.parent_item_id === removedId ? { ...t, parent_item_id: null } : t);
      }
      return updated;
    });
  }

  function updateTemplateItem(index: number, field: keyof TemplateItem, value: any) {
    setTemplateItems(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  }

  // Get items that can be parents (those with counts_in_final=true, i.e. "final" items)
  function getParentCandidates(currentIndex: number) {
    return templateItems.filter((t, i) => i !== currentIndex && t.counts_in_final && t.name.trim() !== '');
  }

  async function handleSaveTemplate() {
    setTemplateSaving(true);

    try {
      // Delete removed items
      for (const id of deletedTemplateIds) {
        await supabase.from('grade_template_items').delete().eq('id', id);
      }

      // We need to save items in two passes for parent references
      // First pass: save all items (without parent refs for new items)
      const savedItems: { tempIndex: number; dbId: string }[] = [];

      for (let i = 0; i < templateItems.length; i++) {
        const item = templateItems[i];
        if (!item.name.trim()) continue;

        const numWeight = parseFloat(item.weight) || 1;

        const payload: any = {
          class_subject_id: templateClassSubjectId,
          name: item.name.trim().toUpperCase(),
          category: item.category,
          weight: numWeight,
          counts_in_final: item.counts_in_final,
          order_index: i,
          parent_item_id: null, // will be set in second pass
        };

        if (item.id) {
          // For existing items with existing parent_item_id (already a UUID), keep it
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

      // Second pass: update parent references for items that reference by index
      for (let i = 0; i < templateItems.length; i++) {
        const item = templateItems[i];
        if (!item.parent_item_id || item.id) continue; // skip if already has DB id (handled above)

        // Find the saved item for this index
        const saved = savedItems.find(s => s.tempIndex === i);
        if (!saved) continue;

        // Find parent by matching name
        const parentItem = templateItems.find(t => t.counts_in_final && t.name.trim().toUpperCase() === item.parent_item_id?.toUpperCase());
        if (parentItem) {
          const parentSaved = savedItems.find(s => s.tempIndex === templateItems.indexOf(parentItem));
          if (parentSaved) {
            await supabase.from('grade_template_items')
              .update({ parent_item_id: parentSaved.dbId })
              .eq('id', saved.dbId);
          }
        }
      }

      toast({ title: 'Modelo de notas salvo com sucesso!' });
      setTemplateDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Erro ao salvar modelo', description: err.message, variant: 'destructive' });
    }
    setTemplateSaving(false);
  }

  const filtered = classes.filter(c =>
    c.code.toLowerCase().includes(search.toLowerCase()) ||
    c.period.toLowerCase().includes(search.toLowerCase()) ||
    (courseMap[c.course_id] || '').toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = classes.filter(c => c.status === 'ATIVO').length;

  const [classSubjectsMap, setClassSubjectsMap] = useState<Record<string, { subjectName: string; professorName: string }>>({});

  useEffect(() => {
    if (classes.length === 0) return;
    loadClassSubjectsMap();
  }, [classes]);

  async function loadClassSubjectsMap() {
    const classIds = classes.map(c => c.id);
    const { data } = await supabase
      .from('class_subjects')
      .select('class_id, subject:subjects(name), professor_user_id')
      .in('class_id', classIds);

    if (!data) return;

    const profIds = [...new Set((data as any[]).map(d => d.professor_user_id).filter(Boolean))];
    const { data: profs } = await supabase.from('profiles').select('id, name').in('id', profIds);
    const profMap = Object.fromEntries((profs || []).map((p: any) => [p.id, p.name]));

    const map: Record<string, { subjectName: string; professorName: string }> = {};
    for (const d of data as any[]) {
      map[d.class_id] = {
        subjectName: d.subject?.name || '—',
        professorName: profMap[d.professor_user_id] || '—',
      };
    }
    setClassSubjectsMap(map);
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Turmas</h1>
        <p className="text-muted-foreground text-sm">Formação de turmas, vínculo de disciplinas, professores e alunos.</p>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="stats-card before:bg-primary">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-display font-bold text-foreground">{classes.length}</p>
        </div>
        <div className="stats-card before:bg-success">
          <p className="text-sm text-muted-foreground">Ativas</p>
          <p className="text-2xl font-display font-bold text-foreground">{activeCount}</p>
        </div>
        <div className="stats-card before:bg-destructive">
          <p className="text-sm text-muted-foreground">Inativas</p>
          <p className="text-2xl font-display font-bold text-foreground">{classes.length - activeCount}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-card">
        <div className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between border-b border-border">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, período ou curso..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          {canManage && (
            <Button onClick={openCreate} size="sm">
              <Plus className="w-4 h-4 mr-2" /> Nova Turma
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Calendar className="w-12 h-12 mb-4 opacity-30" />
            <p>Nenhuma turma encontrada.</p>
            {canManage && (
              <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" /> Criar primeira turma
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Turma</TableHead>
                <TableHead>Ano Letivo</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Disciplina</TableHead>
                <TableHead>Professor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(cls => (
                <TableRow key={cls.id}>
                  <TableCell className="font-medium">{cls.code}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{cls.period}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{courseMap[cls.course_id] || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{classSubjectsMap[cls.id]?.subjectName || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{classSubjectsMap[cls.id]?.professorName || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={cls.status === 'ATIVO' ? 'default' : 'secondary'}>{cls.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openView(cls)} title="Ver alunos">
                      <Eye className="w-4 h-4" />
                    </Button>
                    {canManage && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(cls)} title="Editar">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        {cls.status === 'ATIVO' && (
                          <Button variant="ghost" size="icon" onClick={() => handleDeactivate(cls.id)} title="Inativar">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Turma' : 'Nova Turma'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome da Turma *</Label>
              <Input value={formCode} onChange={e => setFormCode(e.target.value)} placeholder="Ex: Turma A - Noturno" />
            </div>

            <div>
              <Label>Ano Letivo *</Label>
              <Input value={formPeriod} onChange={e => setFormPeriod(e.target.value)} placeholder="Ex: 2026/1" />
            </div>

            <div>
              <Label>Curso *</Label>
              <Select value={formCourseId} onValueChange={v => { setFormCourseId(v); setFormSubjectId(''); setFormProfessorId(''); fetchProfessorsByCourse(v); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o curso" /></SelectTrigger>
                <SelectContent>
                  {courses.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Disciplina *</Label>
              <Select value={formSubjectId} onValueChange={setFormSubjectId} disabled={!formCourseId}>
                <SelectTrigger><SelectValue placeholder="Selecione a disciplina" /></SelectTrigger>
                <SelectContent>
                  {filteredSubjects.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Professor *</Label>
              <Select value={formProfessorId} onValueChange={setFormProfessorId} disabled={!formCourseId || loadingProfessors}>
                <SelectTrigger><SelectValue placeholder={loadingProfessors ? "Carregando..." : "Selecione o professor"} /></SelectTrigger>
                <SelectContent>
                  {filteredProfessors.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                  {filteredProfessors.length === 0 && !loadingProfessors && formCourseId && (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">Nenhum professor vinculado a este campus/unidade</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            {editing && (
              <div>
                <Label>Status</Label>
                <Select value={formStatus} onValueChange={v => setFormStatus(v as any)}>
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
              {editing ? 'Salvar' : 'Criar Turma'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog (Students) */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {viewClass?.code} — {viewClass?.period}
            </DialogTitle>
          </DialogHeader>

          {viewLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Class info */}
              <div className="p-4 bg-muted/30 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">Curso</span>
                  <span className="text-sm text-muted-foreground">{viewClass ? courseMap[viewClass.course_id] || '—' : '—'}</span>
                </div>
                {viewSubjects.map(vs => (
                  <div key={vs.id} className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Disciplina</span>
                    <span className="text-sm text-muted-foreground">{vs.subject?.name || '—'} ({vs.subject?.code})</span>
                  </div>
                ))}
                {viewSubjects.map(vs => {
                  const prof = professors.find(p => p.id === vs.professor_user_id);
                  return (
                    <div key={`prof-${vs.id}`} className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">Professor</span>
                      <span className="text-sm text-muted-foreground">{prof?.name || '—'}</span>
                    </div>
                  );
                })}
              </div>

              {/* Grade Template Section */}
              {viewSubjects.length > 0 && (canManage || hasRole('professor')) && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Settings2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Modelo de Notas</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openTemplateDialog(viewSubjects[0])}>
                      <Settings2 className="w-4 h-4 mr-2" /> Configurar Notas
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Configure os critérios de avaliação (tipos, pesos, composição) para padronizar o lançamento de notas de todos os alunos desta turma.
                  </p>
                </div>
              )}

              {/* Students section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      Alunos Vinculados ({viewStudents.length})
                    </span>
                  </div>
                  {canManage && (
                    <Button variant="outline" size="sm" onClick={openLinkDialog}>
                      <UserPlus className="w-4 h-4 mr-2" /> Vincular Alunos
                    </Button>
                  )}
                </div>

                {viewStudents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Nenhum aluno vinculado a esta turma.</p>
                ) : (
                  <div className="border border-border rounded-lg divide-y divide-border">
                    {viewStudents.map(vs => (
                      <div key={vs.id} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{vs.student?.name || '—'}</p>
                          <p className="text-xs text-muted-foreground">Matrícula: {vs.student?.enrollment || '—'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={vs.status === 'ATIVO' ? 'default' : 'secondary'}>{vs.status}</Badge>
                          {canManage && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleUnlinkStudent(vs.id)} title="Desvincular">
                              <UserMinus className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Link Students Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Vincular Alunos à Turma</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar aluno por nome ou matrícula..."
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Exibindo alunos matriculados na disciplina desta turma (status: CURSANDO)
            </p>

            {filteredLinkStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhum aluno encontrado.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {filteredLinkStudents.map(student => {
                  const alreadyLinked = alreadyLinkedIds.has(student.id);
                  const isSelected = selectedStudentIds.includes(student.id);
                  return (
                    <label
                      key={student.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        alreadyLinked
                          ? 'border-muted bg-muted/30 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/30'
                      }`}
                    >
                      <Checkbox
                        checked={isSelected || alreadyLinked}
                        disabled={alreadyLinked}
                        onCheckedChange={() => !alreadyLinked && toggleStudent(student.id)}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{student.name}</p>
                        <p className="text-xs text-muted-foreground">Matrícula: {student.enrollment}</p>
                      </div>
                      {alreadyLinked && (
                        <Badge variant="secondary" className="text-xs">Já vinculado</Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleLinkStudents} disabled={linkSaving || selectedStudentIds.length === 0}>
              {linkSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Vincular ({selectedStudentIds.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grade Template Dialog */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              Modelo de Notas — {templateSubjectName}
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
                  Configure os itens de avaliação. Itens com <strong>"Compõe Média"</strong> ativado contarão diretamente no cálculo da média final.
                  Itens com essa opção desativada servem como <strong>critérios de composição</strong> de outro item (ex: T1 e P1 compõem N1).
                  Selecione o <strong>"Item Pai"</strong> para indicar qual nota final o critério compõe.
                </p>
              </div>

              {/* Header */}
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
                    <Input
                      placeholder="Ex: T1, P1, N1"
                      value={item.name}
                      onChange={e => updateTemplateItem(idx, 'name', e.target.value)}
                      className="text-sm font-mono"
                    />
                    <Select value={item.category} onValueChange={v => updateTemplateItem(idx, 'category', v)}>
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GRADE_CATEGORIES.map(c => (
                          <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={item.weight}
                      onChange={e => updateTemplateItem(idx, 'weight', e.target.value)}
                      className="text-sm"
                    />
                    <div className="flex justify-center">
                      <Switch
                        checked={item.counts_in_final}
                        onCheckedChange={v => {
                          updateTemplateItem(idx, 'counts_in_final', v);
                          if (v) updateTemplateItem(idx, 'parent_item_id', null);
                        }}
                      />
                    </div>
                    <div>
                      {!item.counts_in_final ? (
                        <Select
                          value={item.parent_item_id || '_none'}
                          onValueChange={v => updateTemplateItem(idx, 'parent_item_id', v === '_none' ? null : v)}
                        >
                          <SelectTrigger className="text-xs">
                            <SelectValue placeholder="Nenhum" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="_none">Nenhum</SelectItem>
                            {parentCandidates.map((pc, pcIdx) => (
                              <SelectItem key={pc.id || `temp_${pcIdx}`} value={pc.id || pc.name.trim().toUpperCase()}>
                                {pc.name.trim().toUpperCase()}
                              </SelectItem>
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

              {/* Preview */}
              {templateItems.length > 0 && (
                <div className="p-3 rounded-md border border-border bg-muted/50">
                  <p className="text-xs font-semibold text-foreground mb-2">Resumo do Modelo:</p>
                  <div className="space-y-1">
                    {templateItems.filter(t => t.counts_in_final && t.name.trim()).map((finalItem, i) => {
                      const children = templateItems.filter(t => !t.counts_in_final && t.parent_item_id && (t.parent_item_id === finalItem.id || t.parent_item_id === finalItem.name.trim().toUpperCase()));
                      return (
                        <div key={i} className="text-xs text-foreground">
                          <strong>{finalItem.name.trim().toUpperCase()}</strong>
                          {' '}({GRADE_CATEGORIES.find(c => c.value === finalItem.category)?.label}, peso {finalItem.weight})
                          {children.length > 0 && (
                            <span className="text-muted-foreground">
                              {' = '}composição de {children.map(c => `${c.name.trim().toUpperCase()}(p${c.weight})`).join(' + ')}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {templateItems.filter(t => !t.counts_in_final && !t.parent_item_id && t.name.trim()).length > 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠ Itens sem "Item Pai" definido e que não compõem a média: {templateItems.filter(t => !t.counts_in_final && !t.parent_item_id && t.name.trim()).map(t => t.name.trim().toUpperCase()).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveTemplate} disabled={templateSaving}>
              {templateSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" />
              Salvar Modelo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Turmas;
