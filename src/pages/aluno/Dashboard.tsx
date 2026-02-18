import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudentAuth } from '@/lib/studentAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  GraduationCap, LogOut, BookOpen, CheckCircle2, XCircle, Clock,
  TrendingUp, CalendarCheck, Award, Loader2, AlertTriangle, ListChecks, ShieldAlert,
} from 'lucide-react';

interface EnrollmentData {
  id: string;
  subject_id: string;
  semester: number;
  status: string;
  subject: {
    name: string;
    code: string;
    workload_hours: number;
    min_grade: number;
    min_attendance_pct: number;
  };
  grades: { grade_type: string; grade_value: number; counts_in_final: boolean; weight: number }[];
  attendance_pct: number | null;
}

interface CourseLink {
  id: string;
  course: { name: string };
  matrix: { code: string } | null;
  enrollment_status: string;
  linked_at: string;
}

interface SessionDetail {
  session_id: string;
  subject_id: string;
  subject_name: string;
  subject_code: string;
  opened_at: string;
  final_status: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  CURSANDO: { label: 'Cursando', color: 'bg-primary/10 text-primary border-primary/20', icon: <Clock className="w-3 h-3" /> },
  APROVADO: { label: 'Aprovado', color: 'bg-accent/20 text-accent-foreground border-accent/30', icon: <CheckCircle2 className="w-3 h-3" /> },
  REPROVADO: { label: 'Reprovado', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: <XCircle className="w-3 h-3" /> },
  TRANCADO: { label: 'Trancado', color: 'bg-muted text-muted-foreground border-border', icon: <AlertTriangle className="w-3 h-3" /> },
};

const ATT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PRESENTE: { label: 'Presente', color: 'bg-accent/20 text-accent-foreground border-accent/30' },
  FALTA: { label: 'Falta', color: 'bg-destructive/10 text-destructive border-destructive/20' },
  JUSTIFICADO: { label: 'Justificado', color: 'bg-warning/10 text-warning-foreground border-warning/20' },
};

export default function AlunoDashboard() {
  const navigate = useNavigate();
  const { user, student, loading: authLoading, signOut } = useStudentAuth();
  const [enrollments, setEnrollments] = useState<EnrollmentData[]>([]);
  const [courseLinks, setCourseLinks] = useState<CourseLink[]>([]);
  const [sessionDetails, setSessionDetails] = useState<SessionDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate('/aluno/login');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (student) fetchData();
  }, [student]);

  async function fetchData() {
    if (!student) return;
    setLoading(true);

    const { data: enrollData } = await supabase
      .from('student_subject_enrollments')
      .select('id, subject_id, semester, status, subject:subjects(name, code, workload_hours, min_grade, min_attendance_pct)')
      .eq('student_id', student.id)
      .order('semester');

    const subjectIds = (enrollData || []).map(e => e.subject_id);
    const enrollIds = (enrollData || []).map(e => e.id);

    const [gradesRes, sessionsRes, linksRes] = await Promise.all([
      supabase
        .from('student_grades')
        .select('enrollment_id, grade_type, grade_value, counts_in_final, weight')
        .in('enrollment_id', enrollIds.length ? enrollIds : ['none']),
      supabase
        .from('attendance_sessions')
        .select('id, subject_id, status, opened_at, subject:subjects(name, code)')
        .in('status', ['ENCERRADA', 'AUDITORIA_FINALIZADA'])
        .in('subject_id', subjectIds.length ? subjectIds : ['none'])
        .order('opened_at', { ascending: false }),
      supabase
        .from('student_course_links')
        .select('id, enrollment_status, linked_at, course:courses(name), matrix:academic_matrices(code)')
        .eq('student_id', student.id)
        .order('linked_at', { ascending: false }),
    ]);

    const attSessions = sessionsRes.data || [];
    const sessionIds = attSessions.map(s => s.id);

    const { data: attRecords } = await supabase
      .from('attendance_records')
      .select('session_id, final_status')
      .eq('student_id', student.id)
      .in('session_id', sessionIds.length ? sessionIds : ['none']);

    const enriched: EnrollmentData[] = (enrollData || []).map(e => {
      const subjectSessions = attSessions.filter(s => s.subject_id === e.subject_id);
      const subjectAttRecords = (attRecords || []).filter(r =>
        subjectSessions.some(s => s.id === r.session_id)
      );
      const presentCount = subjectAttRecords.filter(r => r.final_status === 'PRESENTE').length;
      const totalSessions = subjectSessions.length;
      const att_pct = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : null;
      return {
        ...e,
        subject: e.subject as any,
        grades: (gradesRes.data || []).filter(g => g.enrollment_id === e.id),
        attendance_pct: att_pct,
      };
    });

    setEnrollments(enriched);

    const details: SessionDetail[] = attSessions.map(s => {
      const rec = (attRecords || []).find(r => r.session_id === s.id);
      const subj = s.subject as any;
      return {
        session_id: s.id,
        subject_id: s.subject_id,
        subject_name: subj?.name || '—',
        subject_code: subj?.code || '—',
        opened_at: s.opened_at,
        final_status: rec ? rec.final_status : 'FALTA',
      };
    });

    setSessionDetails(details);
    setCourseLinks((linksRes.data as any) || []);
    setLoading(false);
  }

  function calcAverage(grades: EnrollmentData['grades']) {
    const finals = grades.filter(g => g.counts_in_final);
    if (!finals.length) return null;
    const totalWeight = finals.reduce((s, g) => s + g.weight, 0);
    if (!totalWeight) return null;
    return finals.reduce((s, g) => s + g.grade_value * g.weight, 0) / totalWeight;
  }

  const handleSignOut = async () => {
    await signOut();
    navigate('/aluno/login');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-bold mb-2">Conta não vinculada</h2>
          <p className="text-muted-foreground mb-4">Esta conta não está associada a nenhum aluno.</p>
          <Button onClick={handleSignOut}>Sair</Button>
        </div>
      </div>
    );
  }

  const cursando = enrollments.filter(e => e.status === 'CURSANDO');
  const aprovados = enrollments.filter(e => e.status === 'APROVADO');
  const reprovados = enrollments.filter(e => e.status === 'REPROVADO');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Portal do Aluno</p>
              <p className="text-sm font-semibold text-foreground leading-tight">{student.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="hidden sm:flex text-xs">
              Matrícula: {student.enrollment}
            </Badge>
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-border">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Cursando</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{cursando.length}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-accent-foreground" />
                <span className="text-xs text-muted-foreground">Aprovados</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{aprovados.length}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4 text-destructive" />
                <span className="text-xs text-muted-foreground">Reprovados</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{reprovados.length}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Award className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{enrollments.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main tabs */}
        <Tabs defaultValue="disciplinas">
          <TabsList className="w-full grid grid-cols-5 sm:w-auto sm:inline-flex">
            <TabsTrigger value="disciplinas" className="gap-1 text-xs sm:text-sm sm:gap-2">
              <BookOpen className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Disciplinas</span>
              <span className="sm:hidden">Disc.</span>
            </TabsTrigger>
            <TabsTrigger value="sessoes" className="gap-1 text-xs sm:text-sm sm:gap-2">
              <ListChecks className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Presenças</span>
              <span className="sm:hidden">Pres.</span>
            </TabsTrigger>
            <TabsTrigger value="frequencia" className="gap-1 text-xs sm:text-sm sm:gap-2">
              <CalendarCheck className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Frequência</span>
              <span className="sm:hidden">Freq.</span>
            </TabsTrigger>
            <TabsTrigger value="notas" className="gap-1 text-xs sm:text-sm sm:gap-2">
              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
              Notas
            </TabsTrigger>
            <TabsTrigger value="vinculos" className="gap-1 text-xs sm:text-sm sm:gap-2">
              <GraduationCap className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Cursos</span>
              <span className="sm:hidden">Curs.</span>
            </TabsTrigger>
          </TabsList>

          {/* DISCIPLINAS */}
          <TabsContent value="disciplinas" className="mt-4 space-y-3">
            {enrollments.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma disciplina encontrada.</CardContent></Card>
            ) : (
              enrollments.map(e => {
                const avg = calcAverage(e.grades);
                const st = STATUS_MAP[e.status] || STATUS_MAP.CURSANDO;

                // Risk indicator calculation
                const subjectSessions = sessionDetails.filter(s => s.subject_id === e.subject_id);
                const totalSessions = subjectSessions.length;
                const maxAbsencesAllowed = totalSessions > 0
                  ? Math.floor(totalSessions * (1 - e.subject.min_attendance_pct / 100))
                  : null;
                const absencesSoFar = totalSessions > 0
                  ? subjectSessions.filter(s => s.final_status === 'FALTA').length
                  : null;
                const absencesRemaining = (maxAbsencesAllowed !== null && absencesSoFar !== null)
                  ? Math.max(0, maxAbsencesAllowed - absencesSoFar)
                  : null;
                const isAttRisk = e.attendance_pct !== null && e.attendance_pct < e.subject.min_attendance_pct;

                return (
                  <Card key={e.id} className={`border-border ${isAttRisk ? 'border-destructive/40' : ''}`}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{e.subject.name}</p>
                          <p className="text-xs text-muted-foreground">{e.subject.code} · {e.subject.workload_hours}h · {e.semester}º semestre</p>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${st.color}`}>
                          {st.icon}{st.label}
                        </span>
                      </div>

                      {(avg !== null || e.attendance_pct !== null) && (
                        <div className="mt-3 grid grid-cols-2 gap-3">
                          {avg !== null && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Média</p>
                              <p className={`text-lg font-bold ${avg >= e.subject.min_grade ? 'text-primary' : 'text-destructive'}`}>
                                {avg.toFixed(1)}
                              </p>
                              <p className="text-xs text-muted-foreground">Mín: {e.subject.min_grade}</p>
                            </div>
                          )}
                          {e.attendance_pct !== null && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Frequência</p>
                              <p className={`text-lg font-bold ${e.attendance_pct >= e.subject.min_attendance_pct ? 'text-primary' : 'text-destructive'}`}>
                                {e.attendance_pct}%
                              </p>
                              <Progress value={e.attendance_pct} className="h-1.5 mt-1" />
                              <p className="text-xs text-muted-foreground">Mín: {e.subject.min_attendance_pct}%</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Risk indicator */}
                      {absencesRemaining !== null && totalSessions > 0 && (
                        <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                          absencesRemaining === 0
                            ? 'bg-destructive/10 text-destructive border border-destructive/20'
                            : absencesRemaining <= 2
                            ? 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20'
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}>
                          <ShieldAlert className="w-4 h-4 shrink-0" />
                          {absencesRemaining === 0 ? (
                            <span className="font-medium">Nenhuma falta restante — risco de reprovação por frequência!</span>
                          ) : (
                            <span>
                              Pode faltar mais <strong>{absencesRemaining} {absencesRemaining === 1 ? 'vez' : 'vezes'}</strong> sem ser reprovado por frequência.
                            </span>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* SESSÕES DE PRESENÇA DETALHADAS */}
          <TabsContent value="sessoes" className="mt-4 space-y-3">
            {sessionDetails.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma sessão de aula registrada ainda.</CardContent></Card>
            ) : (
              Array.from(new Set(sessionDetails.map(s => s.subject_id))).map(subjectId => {
                const subjectSessions = sessionDetails.filter(s => s.subject_id === subjectId);
                const subjectName = subjectSessions[0].subject_name;
                const subjectCode = subjectSessions[0].subject_code;
                const presentCount = subjectSessions.filter(s => s.final_status === 'PRESENTE').length;
                const total = subjectSessions.length;

                return (
                  <Card key={subjectId} className="border-border">
                    <CardHeader className="pb-2 pt-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-base">{subjectName}</CardTitle>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{subjectCode}</span>
                          <Badge variant="outline" className="text-xs">
                            {presentCount}/{total} presenças
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-1">
                      {subjectSessions.map(session => {
                        const dt = new Date(session.opened_at);
                        const dateStr = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                        const timeStr = dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                        const attInfo = ATT_STATUS_MAP[session.final_status] || ATT_STATUS_MAP.FALTA;
                        const isPresent = session.final_status === 'PRESENTE';
                        const isJustified = session.final_status === 'JUSTIFICADO';

                        return (
                          <div
                            key={session.session_id}
                            className="flex items-center justify-between py-2 border-b border-border last:border-0"
                          >
                            <div className="flex items-center gap-3">
                              {isPresent ? (
                                <CheckCircle2 className="w-4 h-4 shrink-0 text-primary" />
                              ) : isJustified ? (
                                <AlertTriangle className="w-4 h-4 shrink-0 text-warning-foreground" />
                              ) : (
                                <XCircle className="w-4 h-4 shrink-0 text-destructive" />
                              )}
                              <div>
                                <p className="text-sm font-medium text-foreground">{dateStr}</p>
                                <p className="text-xs text-muted-foreground">{timeStr}</p>
                              </div>
                            </div>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${attInfo.color}`}>
                              {attInfo.label}
                            </span>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* FREQUÊNCIA */}
          <TabsContent value="frequencia" className="mt-4 space-y-3">
            {enrollments.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum dado de frequência disponível.</CardContent></Card>
            ) : (
              enrollments.map(e => (
                <Card key={e.id} className="border-border">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium text-foreground">{e.subject.name}</p>
                        <p className="text-xs text-muted-foreground">{e.subject.code}</p>
                      </div>
                      {e.attendance_pct !== null ? (
                        <span className={`text-xl font-bold ${e.attendance_pct >= e.subject.min_attendance_pct ? 'text-primary' : 'text-destructive'}`}>
                          {e.attendance_pct}%
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </div>
                    {e.attendance_pct !== null && (
                      <div>
                        <Progress value={e.attendance_pct} className="h-2" />
                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                          <span>0%</span>
                          <span className={e.attendance_pct < e.subject.min_attendance_pct ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                            Mín: {e.subject.min_attendance_pct}%
                          </span>
                          <span>100%</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* NOTAS */}
          <TabsContent value="notas" className="mt-4 space-y-3">
            {enrollments.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma nota disponível.</CardContent></Card>
            ) : (
              enrollments.map(e => {
                const avg = calcAverage(e.grades);
                return (
                  <Card key={e.id} className="border-border">
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="text-base flex items-center justify-between">
                        <span>{e.subject.name}</span>
                        {avg !== null && (
                          <span className={`text-xl font-bold ${avg >= e.subject.min_grade ? 'text-primary' : 'text-destructive'}`}>
                            {avg.toFixed(1)}
                          </span>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {e.grades.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Notas não lançadas ainda.</p>
                      ) : (
                        <div className="space-y-1">
                          {e.grades.map((g, i) => (
                            <div key={i} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                              <div>
                                <span className="text-sm text-foreground">{g.grade_type}</span>
                                {!g.counts_in_final && (
                                  <span className="ml-2 text-xs text-muted-foreground">(não conta na final)</span>
                                )}
                              </div>
                              <span className="font-semibold text-foreground">{g.grade_value.toFixed(1)}</span>
                            </div>
                          ))}
                          {avg !== null && (
                            <div className="flex items-center justify-between pt-2 mt-1">
                              <span className="text-sm font-medium text-muted-foreground">Média Final</span>
                              <span className={`font-bold ${avg >= e.subject.min_grade ? 'text-primary' : 'text-destructive'}`}>
                                {avg.toFixed(1)} / {e.subject.min_grade}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* VÍNCULOS / CURSOS */}
          <TabsContent value="vinculos" className="mt-4 space-y-3">
            {courseLinks.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum curso vinculado.</CardContent></Card>
            ) : (
              courseLinks.map(link => (
                <Card key={link.id} className="border-border">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{link.course?.name || '—'}</p>
                        <p className="text-xs text-muted-foreground">
                          Matriz: {link.matrix?.code || '—'} · Vinculado em {new Date(link.linked_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <Badge variant={
                        link.enrollment_status === 'MATRICULADO' ? 'default' :
                        link.enrollment_status === 'TRANCADO' ? 'secondary' :
                        link.enrollment_status === 'CANCELADO' ? 'destructive' : 'outline'
                      }>
                        {link.enrollment_status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
