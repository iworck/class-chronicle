import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  Loader2, Plus, GraduationCap, Trash2, Link2, CheckCircle2,
  BookOpen, ChevronDown, ChevronUp, Building2,
} from 'lucide-react';

interface CourseLinksTabProps {
  studentId: string;
  canManage: boolean;
}

interface Institution { id: string; name: string; }
interface Campus { id: string; name: string; institution_id: string; }
interface Unit { id: string; name: string; campus_id: string; }
interface Course { id: string; name: string; unit_id: string | null; }
interface AcademicMatrix { id: string; code: string; course_id: string; }

interface StudentCourseLink {
  id: string;
  student_id: string;
  institution_id: string | null;
  campus_id: string | null;
  unit_id: string | null;
  course_id: string;
  matrix_id: string | null;
  status: string;
  enrollment_status: string;
  linked_at: string;
}

interface MatrixSubject {
  subject_id: string;
  subject: { id: string; name: string; code: string; workload_hours: number };
}

interface SubjectEnrollment {
  id: string;
  subject_id: string;
  matrix_id: string;
  status: string;
}

const ENROLLMENT_STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  MATRICULADO: { label: 'Matriculado', variant: 'default' },
  TRANCADO: { label: 'Trancado', variant: 'secondary' },
  CANCELADO: { label: 'Cancelado', variant: 'destructive' },
  TRANSFERIDO: { label: 'Transferido', variant: 'outline' },
};

const CourseLinksTab = ({ studentId, canManage }: CourseLinksTabProps) => {
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<StudentCourseLink[]>([]);
  const [enrollments, setEnrollments] = useState<SubjectEnrollment[]>([]);

  // Hierarquia
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [matrices, setMatrices] = useState<AcademicMatrix[]>([]);

  // Form
  const [showForm, setShowForm] = useState(false);
  const [formInstitutionId, setFormInstitutionId] = useState('');
  const [formCampusId, setFormCampusId] = useState('');
  const [formUnitId, setFormUnitId] = useState('');
  const [formCourseId, setFormCourseId] = useState('');
  const [formMatrixId, setFormMatrixId] = useState('');
  const [saving, setSaving] = useState(false);

  // Expandir progresso por vínculo
  const [expandedLinkId, setExpandedLinkId] = useState<string | null>(null);
  const [matrixSubjectsMap, setMatrixSubjectsMap] = useState<Record<string, MatrixSubject[]>>({});
  const [loadingMatrix, setLoadingMatrix] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, [studentId]);

  async function loadAll() {
    setLoading(true);
    const [linksRes, enrollRes, instRes, campRes, unitRes, courseRes, matRes] = await Promise.all([
      supabase.from('student_course_links').select('*').eq('student_id', studentId).order('linked_at'),
      supabase.from('student_subject_enrollments').select('id, subject_id, matrix_id, status').eq('student_id', studentId),
      supabase.from('institutions').select('id, name').order('name'),
      supabase.from('campuses').select('id, name, institution_id').order('name'),
      supabase.from('units').select('id, name, campus_id').order('name'),
      supabase.from('courses').select('id, name, unit_id').eq('status', 'ATIVO').order('name'),
      supabase.from('academic_matrices').select('id, code, course_id').eq('status', 'ATIVO').order('code'),
    ]);

    setLinks((linksRes.data as StudentCourseLink[]) || []);
    setEnrollments((enrollRes.data as SubjectEnrollment[]) || []);
    setInstitutions((instRes.data as Institution[]) || []);
    setCampuses((campRes.data as Campus[]) || []);
    setUnits((unitRes.data as Unit[]) || []);
    setCourses((courseRes.data as Course[]) || []);
    setMatrices((matRes.data as AcademicMatrix[]) || []);
    setLoading(false);
  }

  async function loadMatrixProgress(matrixId: string) {
    if (matrixSubjectsMap[matrixId]) return;
    setLoadingMatrix(matrixId);
    const { data } = await supabase
      .from('matrix_subjects')
      .select('subject_id, subject:subjects(id, name, code, workload_hours)')
      .eq('matrix_id', matrixId);
    setMatrixSubjectsMap(prev => ({ ...prev, [matrixId]: (data as any[]) || [] }));
    setLoadingMatrix(null);
  }

  // Cascata filtros
  const filteredCampuses = useMemo(
    () => formInstitutionId ? campuses.filter(c => c.institution_id === formInstitutionId) : campuses,
    [campuses, formInstitutionId]
  );
  const filteredUnits = useMemo(
    () => formCampusId ? units.filter(u => u.campus_id === formCampusId) : units,
    [units, formCampusId]
  );
  const filteredCourses = useMemo(
    () => formUnitId ? courses.filter(c => c.unit_id === formUnitId) : courses,
    [courses, formUnitId]
  );
  const filteredMatrices = useMemo(
    () => formCourseId ? matrices.filter(m => m.course_id === formCourseId) : [],
    [matrices, formCourseId]
  );

  function resetForm() {
    setFormInstitutionId('');
    setFormCampusId('');
    setFormUnitId('');
    setFormCourseId('');
    setFormMatrixId('');
  }

  async function handleSave() {
    if (!formCourseId) {
      toast({ title: 'Selecione pelo menos um Curso', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const payload: any = {
      student_id: studentId,
      course_id: formCourseId,
      institution_id: formInstitutionId || null,
      campus_id: formCampusId || null,
      unit_id: formUnitId || null,
      matrix_id: formMatrixId || null,
    };
    const { error } = await supabase.from('student_course_links').insert(payload);
    if (error) {
      toast({ title: 'Erro ao criar vínculo', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Vínculo criado com sucesso' });
      setShowForm(false);
      resetForm();
      loadAll();
    }
    setSaving(false);
  }

  async function handleRemoveLink(linkId: string) {
    const { error } = await supabase.from('student_course_links').delete().eq('id', linkId);
    if (error) {
      toast({ title: 'Erro ao remover vínculo', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Vínculo removido' });
      loadAll();
    }
  }

  async function handleStatusChange(linkId: string, field: 'status' | 'enrollment_status', value: string) {
    const { error } = await supabase.from('student_course_links').update({ [field]: value } as any).eq('id', linkId);
    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Atualizado' });
      loadAll();
    }
  }

  // Helpers de nome
  const getName = (arr: { id: string; name: string }[], id: string | null) =>
    id ? arr.find(i => i.id === id)?.name || '—' : '—';

  // Progresso por matriz
  function getMatrixProgress(matrixId: string) {
    const subjects = matrixSubjectsMap[matrixId] || [];
    const total = subjects.length;
    if (total === 0) return null;
    const approved = enrollments.filter(e => e.matrix_id === matrixId && e.status === 'APROVADO').length;
    const cursando = enrollments.filter(e => e.matrix_id === matrixId && e.status === 'CURSANDO').length;
    const pct = Math.round((approved / total) * 100);
    return { total, approved, cursando, pct, subjects };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Botão novo vínculo */}
      {canManage && !showForm && (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" /> Novo Vínculo
        </Button>
      )}

      {/* Formulário */}
      {showForm && (
        <div className="p-4 border border-border rounded-lg space-y-4 bg-muted/20">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Adicionar Vínculo Acadêmico
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Instituição</Label>
              <Select value={formInstitutionId} onValueChange={v => { setFormInstitutionId(v); setFormCampusId(''); setFormUnitId(''); setFormCourseId(''); setFormMatrixId(''); }}>
                <SelectTrigger><SelectValue placeholder="Selecione a instituição" /></SelectTrigger>
                <SelectContent>
                  {institutions.map(i => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Campus</Label>
              <Select value={formCampusId} onValueChange={v => { setFormCampusId(v); setFormUnitId(''); setFormCourseId(''); setFormMatrixId(''); }} disabled={!formInstitutionId}>
                <SelectTrigger><SelectValue placeholder="Selecione o campus" /></SelectTrigger>
                <SelectContent>
                  {filteredCampuses.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Unidade</Label>
              <Select value={formUnitId} onValueChange={v => { setFormUnitId(v); setFormCourseId(''); setFormMatrixId(''); }} disabled={!formCampusId}>
                <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                <SelectContent>
                  {filteredUnits.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Curso *</Label>
              <Select value={formCourseId} onValueChange={v => { setFormCourseId(v); setFormMatrixId(''); }} disabled={!formUnitId && filteredCourses.length === 0}>
                <SelectTrigger><SelectValue placeholder="Selecione o curso" /></SelectTrigger>
                <SelectContent>
                  {(formUnitId ? filteredCourses : courses).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Matriz Curricular</Label>
              <Select value={formMatrixId} onValueChange={setFormMatrixId} disabled={!formCourseId || filteredMatrices.length === 0}>
                <SelectTrigger><SelectValue placeholder={filteredMatrices.length === 0 && formCourseId ? 'Nenhuma matriz disponível' : 'Selecione a matriz'} /></SelectTrigger>
                <SelectContent>
                  {filteredMatrices.map(m => <SelectItem key={m.id} value={m.id}>{m.code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setShowForm(false); resetForm(); }}>Cancelar</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !formCourseId}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Salvar Vínculo
            </Button>
          </div>
        </div>
      )}

      {/* Lista de vínculos */}
      {links.length === 0 && !showForm ? (
        <div className="text-center py-10">
          <Building2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhum vínculo acadêmico registrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map(link => {
            const isExpanded = expandedLinkId === link.id;
            const progress = link.matrix_id ? getMatrixProgress(link.matrix_id) : null;

            return (
              <div key={link.id} className="border border-border rounded-lg overflow-hidden">
                {/* Header do vínculo */}
                <div className="px-4 py-3 bg-muted/30 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <GraduationCap className="w-4 h-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {getName(courses, link.course_id)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[
                          getName(institutions, link.institution_id),
                          getName(campuses, link.campus_id),
                          getName(units, link.unit_id),
                        ].filter(n => n !== '—').join(' · ') || 'Sem localização definida'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={ENROLLMENT_STATUS_MAP[link.enrollment_status]?.variant || 'default'} className="text-xs">
                      {ENROLLMENT_STATUS_MAP[link.enrollment_status]?.label || link.enrollment_status}
                    </Badge>
                    <Badge variant={link.status === 'ATIVO' ? 'outline' : 'secondary'} className="text-xs">
                      {link.status}
                    </Badge>
                    {link.matrix_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={async () => {
                          if (!isExpanded && link.matrix_id) await loadMatrixProgress(link.matrix_id);
                          setExpandedLinkId(isExpanded ? null : link.id);
                        }}
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                    )}
                    {canManage && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleRemoveLink(link.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>

                {/* Detalhes */}
                <div className="px-4 py-3 grid grid-cols-2 gap-3 text-xs border-t border-border">
                  <div>
                    <span className="text-muted-foreground">Matriz: </span>
                    <span className="font-medium text-foreground">
                      {link.matrix_id
                        ? matrices.find(m => m.id === link.matrix_id)?.code || '—'
                        : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Vínculo desde: </span>
                    <span className="font-medium text-foreground">
                      {new Date(link.linked_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  {canManage && (
                    <>
                      <div>
                        <Label className="text-xs mb-1 block">Status Geral</Label>
                        <Select value={link.status} onValueChange={v => handleStatusChange(link.id, 'status', v)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ATIVO">Ativo</SelectItem>
                            <SelectItem value="INATIVO">Inativo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs mb-1 block">Status de Matrícula</Label>
                        <Select value={link.enrollment_status} onValueChange={v => handleStatusChange(link.id, 'enrollment_status', v)}>
                          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="MATRICULADO">Matriculado</SelectItem>
                            <SelectItem value="TRANCADO">Trancado</SelectItem>
                            <SelectItem value="CANCELADO">Cancelado</SelectItem>
                            <SelectItem value="TRANSFERIDO">Transferido</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>

                {/* Progresso de matriz (expansível) */}
                {isExpanded && link.matrix_id && (
                  <div className="border-t border-border px-4 py-3 bg-background space-y-3">
                    {loadingMatrix === link.matrix_id ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      </div>
                    ) : progress ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground flex items-center gap-1">
                            <BookOpen className="w-4 h-4" /> Progresso de Graduação
                          </span>
                          <span className="text-sm font-bold text-primary">{progress.pct}%</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress.pct}%` }} />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="p-2 bg-muted/30 rounded">
                            <p className="text-base font-bold text-primary">{progress.approved}</p>
                            <p className="text-xs text-muted-foreground">Aprovadas</p>
                          </div>
                          <div className="p-2 bg-muted/30 rounded">
                            <p className="text-base font-bold text-foreground">{progress.cursando}</p>
                            <p className="text-xs text-muted-foreground">Cursando</p>
                          </div>
                          <div className="p-2 bg-muted/30 rounded">
                            <p className="text-base font-bold text-foreground">{progress.total}</p>
                            <p className="text-xs text-muted-foreground">Total na Matriz</p>
                          </div>
                        </div>

                        {/* Lista de disciplinas da matriz */}
                        <div className="space-y-1 max-h-52 overflow-y-auto">
                          {progress.subjects.map(ms => {
                            const enrollment = enrollments.find(e => e.subject_id === ms.subject_id && e.matrix_id === link.matrix_id);
                            return (
                              <div key={ms.subject_id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/30">
                                <div className="flex items-center gap-2">
                                  {enrollment?.status === 'APROVADO' ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                                  ) : (
                                    <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
                                  )}
                                  <span className="text-xs text-foreground">{ms.subject.name}</span>
                                </div>
                                {enrollment ? (
                                  <Badge variant={enrollment.status === 'APROVADO' ? 'default' : enrollment.status === 'REPROVADO' ? 'destructive' : 'secondary'} className="text-[10px] h-4 px-1.5">
                                    {enrollment.status === 'CURSANDO' ? 'Cursando' : enrollment.status === 'APROVADO' ? 'Aprovado' : enrollment.status === 'REPROVADO' ? 'Reprovado' : enrollment.status}
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">Não matriculado</Badge>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground text-center py-3">Sem disciplinas na matriz.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CourseLinksTab;
