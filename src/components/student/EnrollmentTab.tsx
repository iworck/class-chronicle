import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/hooks/use-toast';
import { Loader2, Plus, BookOpen, GraduationCap, Trash2, CheckCircle2 } from 'lucide-react';

interface EnrollmentTabProps {
  studentId: string;
  studentCourseId: string;
  canManage: boolean;
}

interface AcademicMatrix {
  id: string;
  code: string;
  course_id: string;
  status: string;
}

interface MatrixSubject {
  id: string;
  matrix_id: string;
  subject_id: string;
  semester: number;
  subject: {
    id: string;
    name: string;
    code: string;
    workload_hours: number;
  };
}

interface SubjectEnrollment {
  id: string;
  student_id: string;
  matrix_id: string;
  subject_id: string;
  semester: number;
  status: string;
  enrolled_at: string;
  subject?: {
    id: string;
    name: string;
    code: string;
    workload_hours: number;
  };
}

interface Course {
  id: string;
  name: string;
}

const ENROLLMENT_STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  CURSANDO: { label: 'Cursando', variant: 'default' },
  APROVADO: { label: 'Aprovado', variant: 'outline' },
  REPROVADO: { label: 'Reprovado', variant: 'destructive' },
  TRANCADO: { label: 'Trancado', variant: 'secondary' },
};

const EnrollmentTab = ({ studentId, studentCourseId, canManage }: EnrollmentTabProps) => {
  const [loading, setLoading] = useState(true);
  const [enrollments, setEnrollments] = useState<SubjectEnrollment[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [matrices, setMatrices] = useState<AcademicMatrix[]>([]);
  const [matrixSubjects, setMatrixSubjects] = useState<MatrixSubject[]>([]);

  // New enrollment form
  const [showForm, setShowForm] = useState(false);
  const [formCourseId, setFormCourseId] = useState(studentCourseId || '');
  const [formMatrixId, setFormMatrixId] = useState('');
  const [formSemester, setFormSemester] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [studentId]);

  async function loadData() {
    setLoading(true);
    const [enrollRes, courseRes, matrixRes] = await Promise.all([
      supabase
        .from('student_subject_enrollments')
        .select('*, subject:subjects(id, name, code, workload_hours)')
        .eq('student_id', studentId)
        .order('semester', { ascending: true }),
      supabase.from('courses').select('id, name').eq('status', 'ATIVO').order('name'),
      supabase.from('academic_matrices').select('*').eq('status', 'ATIVO').order('code'),
    ]);

    setEnrollments((enrollRes.data as any[]) || []);
    setCourses((courseRes.data as Course[]) || []);
    setMatrices((matrixRes.data as AcademicMatrix[]) || []);
    setLoading(false);
  }

  // Filter matrices by selected course
  const filteredMatrices = useMemo(
    () => matrices.filter(m => m.course_id === formCourseId),
    [matrices, formCourseId]
  );

  // Load matrix subjects when matrix changes
  useEffect(() => {
    if (formMatrixId) {
      loadMatrixSubjects(formMatrixId);
    } else {
      setMatrixSubjects([]);
    }
    setFormSemester('');
    setSelectedSubjects([]);
  }, [formMatrixId]);

  async function loadMatrixSubjects(matrixId: string) {
    const { data } = await supabase
      .from('matrix_subjects')
      .select('*, subject:subjects(id, name, code, workload_hours)')
      .eq('matrix_id', matrixId)
      .order('semester', { ascending: true });
    setMatrixSubjects((data as any[]) || []);
  }

  // Get unique semesters from matrix subjects
  const availableSemesters = useMemo(() => {
    const semesters = [...new Set(matrixSubjects.map(ms => ms.semester))];
    return semesters.sort((a, b) => a - b);
  }, [matrixSubjects]);

  // Filter subjects by selected semester
  const filteredSubjects = useMemo(() => {
    if (!formSemester) return [];
    return matrixSubjects.filter(ms => ms.semester === Number(formSemester));
  }, [matrixSubjects, formSemester]);

  // Subject IDs currently with status CURSANDO for this matrix (cannot re-enroll)
  const cursandoSubjectIds = useMemo(() => {
    return new Set(
      enrollments
        .filter(e => e.matrix_id === formMatrixId && e.status === 'CURSANDO')
        .map(e => e.subject_id)
    );
  }, [enrollments, formMatrixId]);

  function toggleSubject(subjectId: string) {
    setSelectedSubjects(prev =>
      prev.includes(subjectId)
        ? prev.filter(id => id !== subjectId)
        : [...prev, subjectId]
    );
  }

  function openForm() {
    setFormCourseId(studentCourseId || '');
    setFormMatrixId('');
    setFormSemester('');
    setSelectedSubjects([]);
    setShowForm(true);
  }

  async function handleSave() {
    if (!formMatrixId || !formSemester || selectedSubjects.length === 0) {
      toast({ title: 'Selecione matriz, semestre e pelo menos uma disciplina', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const rows = selectedSubjects.map(subjectId => ({
      student_id: studentId,
      matrix_id: formMatrixId,
      subject_id: subjectId,
      semester: Number(formSemester),
    }));

    const { error } = await supabase.from('student_subject_enrollments').insert(rows);
    if (error) {
      toast({ title: 'Erro ao matricular', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: `${selectedSubjects.length} disciplina(s) matriculada(s) com sucesso` });
      setShowForm(false);
      loadData();
    }
    setSaving(false);
  }

  async function handleStatusChange(enrollmentId: string, newStatus: string) {
    const { error } = await supabase
      .from('student_subject_enrollments')
      .update({ status: newStatus as any })
      .eq('id', enrollmentId);
    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Status atualizado' });
      loadData();
    }
  }

  async function handleDelete(enrollmentId: string) {
    const { error } = await supabase
      .from('student_subject_enrollments')
      .delete()
      .eq('id', enrollmentId);
    if (error) {
      toast({ title: 'Erro ao remover', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Matrícula removida' });
      loadData();
    }
  }

  // Group enrollments by matrix + semester
  const groupedEnrollments = useMemo(() => {
    const groups: Record<string, { matrixCode: string; semester: number; items: SubjectEnrollment[] }> = {};
    for (const e of enrollments) {
      const matrix = matrices.find(m => m.id === e.matrix_id);
      const key = `${e.matrix_id}_${e.semester}`;
      if (!groups[key]) {
        groups[key] = {
          matrixCode: matrix?.code || 'Matriz desconhecida',
          semester: e.semester,
          items: [],
        };
      }
      groups[key].items.push(e);
    }
    return Object.values(groups).sort((a, b) => a.semester - b.semester);
  }, [enrollments, matrices]);

  // Graduation progress
  const progressInfo = useMemo(() => {
    if (enrollments.length === 0) return null;
    const total = enrollments.length;
    const approved = enrollments.filter(e => e.status === 'APROVADO').length;
    const inProgress = enrollments.filter(e => e.status === 'CURSANDO').length;
    return { total, approved, inProgress, pct: Math.round((approved / total) * 100) };
  }, [enrollments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress summary */}
      {progressInfo && (
        <div className="p-4 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <GraduationCap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Progresso de Graduação</span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-foreground">{progressInfo.approved}</p>
              <p className="text-xs text-muted-foreground">Aprovadas</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{progressInfo.inProgress}</p>
              <p className="text-xs text-muted-foreground">Cursando</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{progressInfo.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </div>
          <div className="mt-3 w-full bg-muted rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${progressInfo.pct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1 text-center">{progressInfo.pct}% concluído</p>
        </div>
      )}

      {/* Add enrollment button */}
      {canManage && !showForm && (
        <Button variant="outline" size="sm" onClick={openForm}>
          <Plus className="w-4 h-4 mr-2" /> Nova Matrícula em Disciplinas
        </Button>
      )}

      {/* New enrollment form */}
      {showForm && (
        <div className="p-4 border border-border rounded-lg space-y-4 bg-muted/20">
          <p className="text-sm font-medium text-foreground">Matricular em Disciplinas</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Curso *</Label>
              <Select value={formCourseId} onValueChange={v => { setFormCourseId(v); setFormMatrixId(''); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o curso" /></SelectTrigger>
                <SelectContent>
                  {courses.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Matriz Curricular *</Label>
              <Select value={formMatrixId} onValueChange={setFormMatrixId} disabled={!formCourseId}>
                <SelectTrigger><SelectValue placeholder="Selecione a matriz" /></SelectTrigger>
                <SelectContent>
                  {filteredMatrices.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.code}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {formMatrixId && (
            <div>
              <Label>Semestre *</Label>
              <Select value={formSemester} onValueChange={setFormSemester}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Selecione o semestre" /></SelectTrigger>
                <SelectContent>
                  {availableSemesters.map(s => (
                    <SelectItem key={s} value={String(s)}>{s}º Semestre</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {formSemester && filteredSubjects.length > 0 && (
            <div>
              <Label className="mb-2 block">Disciplinas *</Label>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {filteredSubjects.map(ms => {
                  const isCursando = cursandoSubjectIds.has(ms.subject.id);
                  const isSelected = selectedSubjects.includes(ms.subject.id);
                  return (
                    <label
                      key={ms.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isCursando
                          ? 'border-muted bg-muted/30 opacity-60 cursor-not-allowed'
                          : isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/30'
                      }`}
                    >
                      <Checkbox
                        checked={isSelected || isCursando}
                        disabled={isCursando}
                        onCheckedChange={() => !isCursando && toggleSubject(ms.subject.id)}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">{ms.subject.name}</p>
                        <p className="text-xs text-muted-foreground">{ms.subject.code} · {ms.subject.workload_hours}h</p>
                      </div>
                      {isCursando && (
                        <Badge variant="secondary" className="text-xs">Cursando</Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {formSemester && filteredSubjects.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma disciplina cadastrada neste semestre da matriz.</p>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || selectedSubjects.length === 0}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Matricular ({selectedSubjects.length})
            </Button>
          </div>
        </div>
      )}

      {/* Existing enrollments grouped by matrix/semester */}
      {groupedEnrollments.length === 0 && !showForm ? (
        <div className="text-center py-8">
          <BookOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhuma matrícula em disciplinas registrada.</p>
        </div>
      ) : (
        groupedEnrollments.map(group => (
          <div key={`${group.matrixCode}_${group.semester}`} className="border border-border rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-muted/40 flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">
                Matriz {group.matrixCode} · {group.semester}º Semestre
              </span>
              <Badge variant="outline" className="text-xs">
                {group.items.filter(i => i.status === 'APROVADO').length}/{group.items.length} aprovadas
              </Badge>
            </div>
            <div className="divide-y divide-border">
              {group.items.map(enrollment => (
                <div key={enrollment.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {enrollment.status === 'APROVADO' && <CheckCircle2 className="w-4 h-4 text-primary" />}
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {enrollment.subject?.name || '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {enrollment.subject?.code} · {enrollment.subject?.workload_hours}h
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={ENROLLMENT_STATUS_MAP[enrollment.status]?.variant || 'default'}>
                      {ENROLLMENT_STATUS_MAP[enrollment.status]?.label || enrollment.status}
                    </Badge>
                    {canManage && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(enrollment.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default EnrollmentTab;
