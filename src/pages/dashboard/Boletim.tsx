import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Loader2, FileText, Save, Pencil, CheckCircle2, XCircle, Info } from 'lucide-react';

interface ClassSubject {
  id: string;
  class_id: string;
  subject_id: string;
  professor_user_id: string;
  status: string;
  class: { id: string; code: string; course_id: string };
  subject: { id: string; name: string; code: string };
}

interface EnrollmentWithStudent {
  id: string;
  student_id: string;
  subject_id: string;
  matrix_id: string;
  semester: number;
  status: string;
  student: { id: string; name: string; enrollment: string };
}

interface Grade {
  id: string;
  enrollment_id: string;
  grade_type: string;
  grade_value: number;
  professor_user_id: string;
  observations: string | null;
}

const GRADE_TYPES = ['N1', 'N2', 'N3', 'N4'];

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  CURSANDO: { label: 'Cursando', variant: 'default' },
  APROVADO: { label: 'Aprovado', variant: 'outline' },
  REPROVADO: { label: 'Reprovado', variant: 'destructive' },
  TRANCADO: { label: 'Trancado', variant: 'secondary' },
};

const Boletim = () => {
  const { user, hasRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [selectedClassSubject, setSelectedClassSubject] = useState('');
  const [enrollments, setEnrollments] = useState<EnrollmentWithStudent[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, { total: number; present: number }>>({});
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);

  // Grade edit dialog
  const [editDialog, setEditDialog] = useState(false);
  const [editEnrollmentId, setEditEnrollmentId] = useState('');
  const [editStudentName, setEditStudentName] = useState('');
  const [editGrades, setEditGrades] = useState<Record<string, { value: string; observations: string }>>({});
  const [saving, setSaving] = useState(false);

  const isProfessor = hasRole('professor');
  const isAdmin = hasRole('admin') || hasRole('coordenador') || hasRole('super_admin');
  const canEdit = isProfessor || isAdmin;

  useEffect(() => {
    loadClassSubjects();
  }, [user]);

  async function loadClassSubjects() {
    setLoading(true);
    let query = supabase
      .from('class_subjects')
      .select('id, class_id, subject_id, professor_user_id, status, class:classes(id, code, course_id), subject:subjects(id, name, code)')
      .eq('status', 'ATIVO');

    if (isProfessor && !isAdmin) {
      query = query.eq('professor_user_id', user!.id);
    }

    const { data, error } = await query.order('class_id');
    if (error) {
      toast({ title: 'Erro ao carregar disciplinas', description: error.message, variant: 'destructive' });
    }
    setClassSubjects((data as any[]) || []);
    setLoading(false);
  }

  async function loadEnrollmentsAndGrades(classSubjectId: string) {
    setLoadingEnrollments(true);
    const cs = classSubjects.find(c => c.id === classSubjectId);
    if (!cs) return;

    // Get students enrolled in this class
    const { data: classStudents } = await supabase
      .from('class_students')
      .select('student_id')
      .eq('class_id', cs.class_id)
      .eq('status', 'ATIVO');

    const studentIds = (classStudents || []).map(s => s.student_id);

    if (studentIds.length === 0) {
      setEnrollments([]);
      setGrades([]);
      setAttendanceData({});
      setLoadingEnrollments(false);
      return;
    }

    // Get enrollments for this subject
    const { data: enrollData } = await supabase
      .from('student_subject_enrollments')
      .select('id, student_id, subject_id, matrix_id, semester, status, student:students(id, name, enrollment)')
      .eq('subject_id', cs.subject_id)
      .in('student_id', studentIds)
      .order('student_id');

    const enrollList = (enrollData as any[]) || [];
    setEnrollments(enrollList);

    // Get grades for these enrollments
    if (enrollList.length > 0) {
      const enrollIds = enrollList.map(e => e.id);
      const { data: gradeData } = await supabase
        .from('student_grades')
        .select('*')
        .in('enrollment_id', enrollIds);
      setGrades((gradeData as any[]) || []);
    } else {
      setGrades([]);
    }

    // Load attendance data for each student in this subject
    const attMap: Record<string, { total: number; present: number }> = {};
    
    // Get all closed sessions for this subject in this class
    const { data: sessions } = await supabase
      .from('attendance_sessions')
      .select('id')
      .eq('class_id', cs.class_id)
      .eq('subject_id', cs.subject_id)
      .in('status', ['ENCERRADA', 'AUDITORIA_FINALIZADA']);

    const sessionIds = (sessions || []).map(s => s.id);
    const totalSessions = sessionIds.length;

    if (totalSessions > 0) {
      // Get attendance records for all students in these sessions
      const { data: records } = await supabase
        .from('attendance_records')
        .select('student_id, final_status')
        .in('session_id', sessionIds)
        .in('student_id', studentIds);

      for (const sid of studentIds) {
        const studentRecords = (records || []).filter(r => r.student_id === sid);
        const presentCount = studentRecords.filter(r => r.final_status === 'PRESENTE').length;
        attMap[sid] = { total: totalSessions, present: presentCount };
      }
    } else {
      for (const sid of studentIds) {
        attMap[sid] = { total: 0, present: 0 };
      }
    }

    setAttendanceData(attMap);
    setLoadingEnrollments(false);
  }

  function handleClassSubjectChange(value: string) {
    setSelectedClassSubject(value);
    loadEnrollmentsAndGrades(value);
  }

  function getGrade(enrollmentId: string, gradeType: string): Grade | undefined {
    return grades.find(g => g.enrollment_id === enrollmentId && g.grade_type === gradeType);
  }

  function getAverage(enrollmentId: string): number | null {
    const studentGrades = grades.filter(g => g.enrollment_id === enrollmentId);
    if (studentGrades.length === 0) return null;
    const sum = studentGrades.reduce((acc, g) => acc + g.grade_value, 0);
    return sum / studentGrades.length;
  }

  function getAttendancePct(studentId: string): number | null {
    const att = attendanceData[studentId];
    if (!att || att.total === 0) return null;
    return (att.present / att.total) * 100;
  }

  function openEditDialog(enrollment: EnrollmentWithStudent) {
    setEditEnrollmentId(enrollment.id);
    setEditStudentName(enrollment.student?.name || '');
    const gradeMap: Record<string, { value: string; observations: string }> = {};
    for (const gt of GRADE_TYPES) {
      const existing = getGrade(enrollment.id, gt);
      gradeMap[gt] = {
        value: existing ? String(existing.grade_value) : '',
        observations: existing?.observations || '',
      };
    }
    setEditGrades(gradeMap);
    setEditDialog(true);
  }

  async function handleSaveGrades() {
    if (!user) return;
    setSaving(true);

    try {
      for (const gradeType of GRADE_TYPES) {
        const entry = editGrades[gradeType];
        const existing = getGrade(editEnrollmentId, gradeType);
        const value = entry.value.trim();

        if (value === '' && existing) {
          // Delete the grade
          await supabase.from('student_grades').delete().eq('id', existing.id);
        } else if (value !== '') {
          const numVal = parseFloat(value);
          if (isNaN(numVal) || numVal < 0 || numVal > 10) {
            toast({ title: `Nota ${gradeType} inválida (0-10)`, variant: 'destructive' });
            setSaving(false);
            return;
          }

          if (existing) {
            await supabase
              .from('student_grades')
              .update({
                grade_value: numVal,
                observations: entry.observations || null,
              })
              .eq('id', existing.id);
          } else {
            await supabase.from('student_grades').insert({
              enrollment_id: editEnrollmentId,
              grade_type: gradeType,
              grade_value: numVal,
              professor_user_id: user.id,
              observations: entry.observations || null,
            });
          }
        }
      }

      toast({ title: 'Notas salvas com sucesso! Status atualizado automaticamente.' });
      setEditDialog(false);
      // Reload grades
      loadEnrollmentsAndGrades(selectedClassSubject);
    } catch (err: any) {
      toast({ title: 'Erro ao salvar notas', description: err.message, variant: 'destructive' });
    }

    setSaving(false);
  }

  // Build display label for class_subjects select
  const classSubjectLabel = (cs: ClassSubject) =>
    `${(cs.class as any)?.code || '—'} — ${(cs.subject as any)?.name || '—'}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <FileText className="w-6 h-6 text-primary" />
          Boletim — Gestão de Notas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Registre notas para os alunos. O status é atualizado automaticamente com base nos critérios de aprovação.
        </p>
      </div>

      {/* Approval criteria banner */}
      <div className="mb-6 p-4 rounded-lg border border-primary/20 bg-primary/5">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-foreground mb-2">Critérios de Aprovação</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span className="text-sm text-foreground">
                  <strong>Nota mínima:</strong> A média das avaliações deve ser ≥ <strong>7,0</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-primary" />
                <span className="text-sm text-foreground">
                  <strong>Frequência mínima:</strong> O aluno deve ter pelo menos <strong>75%</strong> de presença
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              O aluno será <strong>aprovado</strong> somente se ambos os critérios forem atendidos simultaneamente. Caso contrário, será considerado <strong>reprovado</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Select class + subject */}
      <div className="mb-6 max-w-md">
        <Label>Turma / Disciplina</Label>
        <Select value={selectedClassSubject} onValueChange={handleClassSubjectChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a turma e disciplina" />
          </SelectTrigger>
          <SelectContent>
            {classSubjects.map(cs => (
              <SelectItem key={cs.id} value={cs.id}>
                {classSubjectLabel(cs)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {classSubjects.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhuma disciplina vinculada encontrada.</p>
        </div>
      )}

      {selectedClassSubject && loadingEnrollments && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {selectedClassSubject && !loadingEnrollments && enrollments.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">Nenhum aluno matriculado nesta disciplina.</p>
        </div>
      )}

      {selectedClassSubject && !loadingEnrollments && enrollments.length > 0 && (
        <div className="border border-border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Matrícula</TableHead>
                {GRADE_TYPES.map(gt => (
                  <TableHead key={gt} className="text-center w-20">{gt}</TableHead>
                ))}
                <TableHead className="text-center w-20">Média</TableHead>
                <TableHead className="text-center w-24">Frequência</TableHead>
                <TableHead className="text-center w-28">Status</TableHead>
                {canEdit && <TableHead className="text-center w-20">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.map(enrollment => {
                const avg = getAverage(enrollment.id);
                const attPct = getAttendancePct(enrollment.student_id);
                const attOk = attPct === null || attPct >= 75;
                const avgOk = avg === null || avg >= 7;
                return (
                  <TableRow key={enrollment.id}>
                    <TableCell className="font-medium">{enrollment.student?.name || '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{enrollment.student?.enrollment || '—'}</TableCell>
                    {GRADE_TYPES.map(gt => {
                      const grade = getGrade(enrollment.id, gt);
                      return (
                        <TableCell key={gt} className="text-center">
                          {grade ? (
                            <span className={grade.grade_value >= 7 ? 'text-primary font-medium' : grade.grade_value < 5 ? 'text-destructive font-medium' : 'text-foreground'}>
                              {grade.grade_value.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/40">—</span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center font-bold">
                      {avg !== null ? (
                        <span className={avgOk ? 'text-primary' : 'text-destructive'}>
                          {avg.toFixed(1)}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      {attPct !== null ? (
                        <div className="flex items-center justify-center gap-1">
                          {attOk ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-destructive" />
                          )}
                          <span className={`text-sm font-medium ${attOk ? 'text-primary' : 'text-destructive'}`}>
                            {attPct.toFixed(0)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40 text-sm">S/A</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={STATUS_MAP[enrollment.status]?.variant || 'default'}>
                        {STATUS_MAP[enrollment.status]?.label || enrollment.status}
                      </Badge>
                    </TableCell>
                    {canEdit && (
                      <TableCell className="text-center">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(enrollment)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit grades dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Notas — {editStudentName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {GRADE_TYPES.map(gt => (
              <div key={gt} className="space-y-1">
                <Label>{gt}</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    placeholder="0.0 - 10.0"
                    value={editGrades[gt]?.value || ''}
                    onChange={e =>
                      setEditGrades(prev => ({
                        ...prev,
                        [gt]: { ...prev[gt], value: e.target.value },
                      }))
                    }
                    className="w-28"
                  />
                  <Textarea
                    placeholder="Observações (opcional)"
                    value={editGrades[gt]?.observations || ''}
                    onChange={e =>
                      setEditGrades(prev => ({
                        ...prev,
                        [gt]: { ...prev[gt], observations: e.target.value },
                      }))
                    }
                    className="flex-1 min-h-[38px] h-[38px]"
                  />
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveGrades} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" />
              Salvar Notas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Boletim;
