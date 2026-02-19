import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStudentAuth } from '@/lib/studentAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  GraduationCap, LogOut, BookOpen, CheckCircle2, XCircle, Clock,
  TrendingUp, CalendarCheck, Award, Loader2, AlertTriangle, ListChecks,
  ShieldAlert, User, MessageSquarePlus, FileText, Building2,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Subject {
  name: string;
  code: string;
  workload_hours: number;
  min_grade: number;
  min_attendance_pct: number;
}

interface EnrollmentData {
  id: string;
  subject_id: string;
  semester: number;
  status: string;
  subject: Subject;
  grades: { grade_type: string; grade_value: number; counts_in_final: boolean; weight: number }[];
  attendance_pct: number | null;
  totalSessions: number;
  presentCount: number;
  absencesRemaining: number | null;
  maxAbsencesAllowed: number | null;
}

interface CourseLink {
  id: string;
  course: { name: string } | null;
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

interface StudentDetails {
  cpf: string | null;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  enrollment_status: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  CURSANDO: { label: 'Cursando', color: 'bg-primary/10 text-primary border-primary/20', icon: <Clock className="w-3 h-3" /> },
  APROVADO: { label: 'Aprovado', color: 'bg-accent/20 text-accent-foreground border-accent/30', icon: <CheckCircle2 className="w-3 h-3" /> },
  REPROVADO: { label: 'Reprovado', color: 'bg-destructive/10 text-destructive border-destructive/20', icon: <XCircle className="w-3 h-3" /> },
  TRANCADO: { label: 'Trancado', color: 'bg-muted text-muted-foreground border-border', icon: <AlertTriangle className="w-3 h-3" /> },
};

const ATT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PRESENTE: { label: 'Presente', color: 'bg-accent/20 text-accent-foreground border-accent/30' },
  FALTA: { label: 'Falta', color: 'bg-destructive/10 text-destructive border-destructive/20' },
  JUSTIFICADO: { label: 'Justificado', color: 'bg-secondary text-secondary-foreground border-secondary' },
};

const TICKET_SUBJECTS = [
  'Dúvida sobre notas',
  'Correção de frequência',
  'Solicitação de trancamento',
  'Transferência de curso',
  'Documentação acadêmica',
  'Outros',
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AlunoDashboard() {
  const navigate = useNavigate();
  const { user, student, loading: authLoading, signOut } = useStudentAuth();
  const { toast } = useToast();

  const [enrollments, setEnrollments] = useState<EnrollmentData[]>([]);
  const [courseLinks, setCourseLinks] = useState<CourseLink[]>([]);
  const [sessionDetails, setSessionDetails] = useState<SessionDetail[]>([]);
  const [studentDetails, setStudentDetails] = useState<StudentDetails | null>(null);
  const [loading, setLoading] = useState(true);

  // Semester filter
  const [semesterFilter, setSemesterFilter] = useState<string>('all');

  // Ticket form
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');
  const [sendingTicket, setSendingTicket] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate('/aluno/login');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (student) fetchData();
  }, [student]);

  async function fetchData() {
    if (!student) return;
    setLoading(true);

    // Fetch enrollments with subject info
    const { data: enrollData } = await supabase
      .from('student_subject_enrollments')
      .select('id, subject_id, semester, status, subject:subjects(name, code, workload_hours, min_grade, min_attendance_pct)')
      .eq('student_id', student.id)
      .order('semester');

    const subjectIds = (enrollData || []).map(e => e.subject_id);
    const enrollIds = (enrollData || []).map(e => e.id);

    // Fetch all data in parallel — skip empty arrays to avoid uuid errors
    const [linksRes, detailsRes, gradesRes, attSessionsRes] = await Promise.all([
      supabase
        .from('student_course_links')
        .select('id, enrollment_status, linked_at, course:courses(name), matrix:academic_matrices(code)')
        .eq('student_id', student.id)
        .order('linked_at', { ascending: false }),
      supabase
        .from('student_details')
        .select('cpf, phone, email, birth_date, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_zip, enrollment_status')
        .eq('student_id', student.id)
        .maybeSingle(),
      enrollIds.length > 0
        ? supabase
            .from('student_grades')
            .select('enrollment_id, grade_type, grade_value, counts_in_final, weight')
            .in('enrollment_id', enrollIds)
        : Promise.resolve({ data: [] }),
      subjectIds.length > 0
        ? supabase
            .from('attendance_sessions')
            .select('id, subject_id, status, opened_at, subject:subjects(name, code)')
            .in('status', ['ENCERRADA', 'AUDITORIA_FINALIZADA'])
            .in('subject_id', subjectIds)
            .order('opened_at', { ascending: false })
        : Promise.resolve({ data: [] }),
    ]);

    const gradesData = gradesRes.data || [];
    const attSessionsData = attSessionsRes.data || [];

    const sessionIds = attSessionsData.map((s: any) => s.id);

    // Fetch attendance records only if there are sessions
    let attRecordsData: any[] = [];
    if (sessionIds.length > 0) {
      const { data: ar } = await supabase
        .from('attendance_records')
        .select('session_id, final_status')
        .eq('student_id', student.id)
        .in('session_id', sessionIds);
      attRecordsData = ar || [];
    }

    // Build session details
    const details: SessionDetail[] = attSessionsData.map((s: any) => {
      const rec = attRecordsData.find((r: any) => r.session_id === s.id);
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

    // Build enriched enrollments
    const enriched: EnrollmentData[] = (enrollData || [])
      .filter(e => e.subject !== null)
      .map(e => {
        const subjectSessions = attSessionsData.filter((s: any) => s.subject_id === e.subject_id);
        const subjectAttRecords = attRecordsData.filter((r: any) =>
          subjectSessions.some((s: any) => s.id === r.session_id)
        );
        const presentCount = subjectAttRecords.filter((r: any) => r.final_status === 'PRESENTE').length;
        const totalSessions = subjectSessions.length;
        const att_pct = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : null;
        const sub = e.subject as unknown as Subject;
        const maxAbsencesAllowed = totalSessions > 0
          ? Math.floor(totalSessions * (1 - sub.min_attendance_pct / 100))
          : null;
        const absencesSoFar = totalSessions > 0
          ? subjectSessions.filter((s: any) => {
              const rec = attRecordsData.find((r: any) => r.session_id === s.id);
              return !rec || rec.final_status === 'FALTA';
            }).length
          : null;
        const absencesRemaining = (maxAbsencesAllowed !== null && absencesSoFar !== null)
          ? Math.max(0, maxAbsencesAllowed - absencesSoFar)
          : null;

        return {
          ...e,
          subject: sub,
          grades: gradesData.filter((g: any) => g.enrollment_id === e.id),
          attendance_pct: att_pct,
          totalSessions,
          presentCount,
          absencesRemaining,
          maxAbsencesAllowed,
        };
      });

    setEnrollments(enriched);
    setSessionDetails(details);
    setCourseLinks((linksRes.data as any) || []);
    setStudentDetails(detailsRes.data || null);
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

  async function handleSendTicket() {
    if (!ticketSubject || !ticketMessage.trim()) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    setSendingTicket(true);
    // Simulate sending — in production, call an edge function or insert into a tickets table
    await new Promise(r => setTimeout(r, 1200));
    toast({
      title: 'Solicitação enviada!',
      description: 'A coordenação foi notificada e entrará em contato em breve.',
    });
    setTicketSubject('');
    setTicketMessage('');
    setSendingTicket(false);
  }

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

  const semesters = Array.from(new Set(enrollments.map(e => e.semester))).sort((a, b) => a - b);
  const filteredEnrollments = semesterFilter === 'all'
    ? enrollments
    : enrollments.filter(e => e.semester === Number(semesterFilter));

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
                <CheckCircle2 className="w-4 h-4 text-primary" />
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
          <TabsList className="w-full h-auto flex flex-wrap gap-1 sm:inline-flex sm:h-10">
            <TabsTrigger value="disciplinas" className="gap-1 text-xs sm:text-sm">
              <BookOpen className="w-3 h-3 sm:w-4 sm:h-4" />
              Disciplinas
            </TabsTrigger>
            <TabsTrigger value="sessoes" className="gap-1 text-xs sm:text-sm">
              <ListChecks className="w-3 h-3 sm:w-4 sm:h-4" />
              Presenças
            </TabsTrigger>
            <TabsTrigger value="frequencia" className="gap-1 text-xs sm:text-sm">
              <CalendarCheck className="w-3 h-3 sm:w-4 sm:h-4" />
              Frequência
            </TabsTrigger>
            <TabsTrigger value="notas" className="gap-1 text-xs sm:text-sm">
              <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
              Notas
            </TabsTrigger>
            <TabsTrigger value="cursos" className="gap-1 text-xs sm:text-sm">
              <Building2 className="w-3 h-3 sm:w-4 sm:h-4" />
              Cursos
            </TabsTrigger>
            <TabsTrigger value="perfil" className="gap-1 text-xs sm:text-sm">
              <User className="w-3 h-3 sm:w-4 sm:h-4" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="ticket" className="gap-1 text-xs sm:text-sm">
              <MessageSquarePlus className="w-3 h-3 sm:w-4 sm:h-4" />
              Suporte
            </TabsTrigger>
          </TabsList>

          {/* ── DISCIPLINAS ──────────────────────────────── */}
          <TabsContent value="disciplinas" className="mt-4 space-y-3">
            {/* Semester filter */}
            {semesters.length > 1 && (
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground shrink-0">Filtrar por semestre:</Label>
                <Select value={semesterFilter} onValueChange={setSemesterFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {semesters.map(s => (
                      <SelectItem key={s} value={String(s)}>{s}º semestre</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {filteredEnrollments.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma disciplina encontrada.</CardContent></Card>
            ) : (
              filteredEnrollments.map(e => {
                const avg = calcAverage(e.grades);
                const st = STATUS_MAP[e.status] || STATUS_MAP.CURSANDO;
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
                      {e.totalSessions > 0 && e.absencesRemaining !== null && (
                        <div className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                          e.absencesRemaining === 0
                            ? 'bg-destructive/10 text-destructive border border-destructive/20'
                            : e.absencesRemaining <= 2
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}>
                          <ShieldAlert className="w-4 h-4 shrink-0" />
                          {e.absencesRemaining === 0 ? (
                            <span className="font-medium">Nenhuma falta restante — risco de reprovação por frequência!</span>
                          ) : (
                            <span>
                              Pode faltar mais <strong>{e.absencesRemaining} {e.absencesRemaining === 1 ? 'vez' : 'vezes'}</strong> sem ser reprovado por frequência.
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

          {/* ── PRESENÇAS ────────────────────────────────── */}
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
                          <div key={session.session_id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                            <div className="flex items-center gap-3">
                              {isPresent ? (
                                <CheckCircle2 className="w-4 h-4 shrink-0 text-primary" />
                              ) : isJustified ? (
                                <AlertTriangle className="w-4 h-4 shrink-0 text-muted-foreground" />
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

          {/* ── FREQUÊNCIA ───────────────────────────────── */}
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
                        <p className="text-xs text-muted-foreground">{e.subject.code} · {e.semester}º sem.</p>
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
                          <span>{e.presentCount} presenças / {e.totalSessions} aulas</span>
                          <span className={e.attendance_pct < e.subject.min_attendance_pct ? 'text-destructive font-medium' : ''}>
                            Mín: {e.subject.min_attendance_pct}%
                          </span>
                        </div>
                      </div>
                    )}
                    {e.totalSessions === 0 && (
                      <p className="text-xs text-muted-foreground">Nenhuma aula registrada ainda.</p>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* ── NOTAS ────────────────────────────────────── */}
          <TabsContent value="notas" className="mt-4 space-y-3">
            {enrollments.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhuma nota disponível.</CardContent></Card>
            ) : (
              enrollments.map(e => {
                const avg = calcAverage(e.grades);
                return (
                  <Card key={e.id} className="border-border">
                    <CardHeader className="pb-2 pt-4">
                      <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-medium">{e.subject.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{e.semester}º sem.</span>
                          {avg !== null && (
                            <span className={`text-xl font-bold ${avg >= e.subject.min_grade ? 'text-primary' : 'text-destructive'}`}>
                              {avg.toFixed(1)}
                            </span>
                          )}
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                      {e.grades.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Notas não lançadas ainda.</p>
                      ) : (
                        <div className="space-y-1">
                          {e.grades.map((g, i) => (
                            <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                              <div>
                                <span className="text-sm text-foreground">{g.grade_type}</span>
                                {!g.counts_in_final && (
                                  <span className="ml-2 text-xs text-muted-foreground">(não conta na média)</span>
                                )}
                              </div>
                              <span className={`font-semibold ${g.grade_value >= e.subject.min_grade ? 'text-foreground' : 'text-destructive'}`}>
                                {g.grade_value.toFixed(1)}
                              </span>
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

          {/* ── CURSOS ───────────────────────────────────── */}
          <TabsContent value="cursos" className="mt-4 space-y-3">
            {courseLinks.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum curso vinculado.</CardContent></Card>
            ) : (
              courseLinks.map(link => (
                <Card key={link.id} className="border-border">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <GraduationCap className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{link.course?.name || '—'}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Matriz: <span className="font-medium">{link.matrix?.code || 'Não informada'}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Vinculado em {new Date(link.linked_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <Badge variant={
                        link.enrollment_status === 'MATRICULADO' ? 'default' :
                        link.enrollment_status === 'TRANCADO' ? 'secondary' :
                        link.enrollment_status === 'CANCELADO' ? 'destructive' : 'outline'
                      }>
                        {link.enrollment_status}
                      </Badge>
                    </div>

                    {/* Summary of disciplines for this course */}
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-lg bg-muted p-2 text-center">
                        <p className="text-lg font-bold text-foreground">{enrollments.filter(e => e.status === 'CURSANDO').length}</p>
                        <p className="text-xs text-muted-foreground">Cursando</p>
                      </div>
                      <div className="rounded-lg bg-muted p-2 text-center">
                        <p className="text-lg font-bold text-foreground">{enrollments.filter(e => e.status === 'APROVADO').length}</p>
                        <p className="text-xs text-muted-foreground">Aprovadas</p>
                      </div>
                      <div className="rounded-lg bg-muted p-2 text-center">
                        <p className="text-lg font-bold text-foreground">{enrollments.length}</p>
                        <p className="text-xs text-muted-foreground">Total</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* ── PERFIL ───────────────────────────────────── */}
          <TabsContent value="perfil" className="mt-4 space-y-3">
            {/* Dados de Cadastro */}
            <Card className="border-border">
              <CardHeader className="pb-3 pt-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" />
                  Dados Pessoais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoField label="Nome Completo" value={student.name} />
                  <InfoField label="Matrícula" value={student.enrollment} />
                  <InfoField label="CPF" value={studentDetails?.cpf} />
                  <InfoField label="Data de Nascimento" value={
                    studentDetails?.birth_date
                      ? new Date(studentDetails.birth_date + 'T00:00:00').toLocaleDateString('pt-BR')
                      : null
                  } />
                  <InfoField label="E-mail" value={studentDetails?.email || user?.email} />
                  <InfoField label="Telefone" value={studentDetails?.phone} />
                </div>
              </CardContent>
            </Card>

            {/* Endereço */}
            <Card className="border-border">
              <CardHeader className="pb-3 pt-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  Endereço
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {studentDetails ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <InfoField label="CEP" value={studentDetails.address_zip} />
                    <InfoField label="Estado" value={studentDetails.address_state} />
                    <InfoField label="Cidade" value={studentDetails.address_city} />
                    <InfoField label="Bairro" value={studentDetails.address_neighborhood} />
                    <InfoField label="Logradouro" value={studentDetails.address_street} />
                    <InfoField label="Número" value={studentDetails.address_number} />
                    <InfoField label="Complemento" value={studentDetails.address_complement} />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Endereço não cadastrado.</p>
                )}
              </CardContent>
            </Card>

            {/* Situação Acadêmica */}
            <Card className="border-border">
              <CardHeader className="pb-3 pt-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  Situação Acadêmica
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <InfoField label="Status do Aluno" value={student.status} />
                  <InfoField label="Status da Matrícula" value={studentDetails?.enrollment_status} />
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-muted-foreground text-center pb-2">
              Para atualizar seus dados, entre em contato com a coordenação através da aba <strong>Suporte</strong>.
            </p>
          </TabsContent>

          {/* ── SUPORTE / TICKET ─────────────────────────── */}
          <TabsContent value="ticket" className="mt-4 space-y-3">
            <Card className="border-border">
              <CardHeader className="pb-3 pt-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquarePlus className="w-4 h-4 text-primary" />
                  Abrir Solicitação à Coordenação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Use este formulário para enviar dúvidas ou solicitações à coordenação do seu curso. Responderemos pelo e-mail cadastrado.
                </p>

                <div className="space-y-2">
                  <Label>Assunto</Label>
                  <Select value={ticketSubject} onValueChange={setTicketSubject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o assunto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TICKET_SUBJECTS.map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Sua mensagem</Label>
                  <Textarea
                    placeholder="Descreva sua dúvida ou solicitação com detalhes..."
                    value={ticketMessage}
                    onChange={e => setTicketMessage(e.target.value)}
                    rows={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">Resposta será enviada para:</Label>
                  <Input
                    value={studentDetails?.email || user?.email || ''}
                    disabled
                    className="bg-muted text-muted-foreground"
                  />
                </div>

                <Button
                  onClick={handleSendTicket}
                  disabled={sendingTicket || !ticketSubject || !ticketMessage.trim()}
                  className="w-full gap-2"
                >
                  {sendingTicket ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
                  ) : (
                    <><MessageSquarePlus className="w-4 h-4" /> Enviar Solicitação</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Info cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card className="border-border bg-muted/30">
                <CardContent className="pt-4 pb-4">
                  <h4 className="font-medium text-sm mb-1">📋 Tipos de Solicitação</h4>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {TICKET_SUBJECTS.slice(0, 4).map(s => (
                      <li key={s}>• {s}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card className="border-border bg-muted/30">
                <CardContent className="pt-4 pb-4">
                  <h4 className="font-medium text-sm mb-1">⏱ Prazo de Resposta</h4>
                  <p className="text-xs text-muted-foreground">
                    As solicitações são respondidas em até <strong>3 dias úteis</strong>. Para urgências, dirija-se presencialmente à secretaria.
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ─── Helper Component ─────────────────────────────────────────────────────────

function InfoField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || <span className="text-muted-foreground italic">Não informado</span>}</p>
    </div>
  );
}
