import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Link } from 'react-router-dom';
import {
  BookOpen, Users, CheckCircle2, AlertTriangle, Clock, CalendarCheck,
  ChevronRight, Loader2, FileText, Play, XCircle, ChevronDown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AttendanceSessionWizard from '@/components/dashboard/AttendanceSessionWizard';
import ActiveSessionPanel from '@/components/dashboard/ActiveSessionPanel';
import ManualAttendanceModal from '@/components/dashboard/ManualAttendanceModal';
import AttendanceReviewPanel from '@/components/dashboard/AttendanceReviewPanel';

interface ProfessorStats {
  totalSubjects: number;
  totalStudents: number;
  attendancePct: number | null;
  absentPct: number | null;
  planNotStarted: number;
  planPending: number;
  planApproved: number;
  pendingEnrollmentSuggestions: number;
}

interface ScheduleItem {
  id: string;
  classSubjectId: string;
  className: string;
  subjectName: string;
  entryDate: string;
  title: string;
  lessonNumber: number | null;
  entryType: string;
  examType: string | null;
  hasSessions: boolean;
  sessionId?: string;
  sessionStatus?: string;
}

export default function ProfessorDashboard() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<ProfessorStats | null>(null);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedScheduleItem, setSelectedScheduleItem] = useState<ScheduleItem | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSessionId, setManualSessionId] = useState<string | null>(null);
  const [showAllSchedule, setShowAllSchedule] = useState(false);
  const [liveCode, setLiveCode] = useState<string | undefined>(undefined);
  const [liveSessionId, setLiveSessionId] = useState<string | undefined>(undefined);

  const loadDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: classSubjects } = await supabase
      .from('class_subjects')
      .select('id, class_id, subject_id, plan_status')
      .eq('professor_user_id', user.id)
      .eq('status', 'ATIVO');

    const csItems = classSubjects || [];
    const classIds = [...new Set(csItems.map(c => c.class_id))];
    const subjectIds = [...new Set(csItems.map(c => c.subject_id))];
    const csIds = csItems.map(c => c.id);

    const [studentsRes, sessionsRes, entriesRes, suggestionsRes] = await Promise.all([
      classIds.length > 0
        ? supabase.from('class_students').select('student_id').in('class_id', classIds).eq('status', 'ATIVO')
        : Promise.resolve({ data: [] }),
      csIds.length > 0
        ? supabase.from('attendance_sessions')
            .select('id, class_id, subject_id, status')
            .in('subject_id', subjectIds)
            .eq('professor_user_id', user.id)
        : Promise.resolve({ data: [] }),
      csIds.length > 0
        ? supabase.from('lesson_plan_entries')
            .select('id, class_subject_id, entry_date, title, lesson_number, entry_type, exam_type')
            .in('class_subject_id', csIds)
            .eq('entry_type', 'AULA')
            .order('entry_date')
        : Promise.resolve({ data: [] }),
      user
        ? supabase.from('enrollment_suggestions')
            .select('id')
            .eq('suggested_by_user_id', user.id)
            .eq('status', 'PENDENTE')
        : Promise.resolve({ data: [] }),
    ]);

    const students = studentsRes.data || [];
    const sessions = sessionsRes.data || [];
    const entries = entriesRes.data || [];
    const suggestions = suggestionsRes.data || [];

    const uniqueStudents = new Set(students.map((s: any) => s.student_id)).size;

    let attendancePct: number | null = null;
    let absentPct: number | null = null;
    const closedSessions = sessions.filter((s: any) => ['ENCERRADA', 'AUDITORIA_FINALIZADA'].includes(s.status));
    if (closedSessions.length > 0) {
      const sessionIds = closedSessions.map((s: any) => s.id);
      const { data: records } = await supabase
        .from('attendance_records')
        .select('final_status')
        .in('session_id', sessionIds);
      const recs = records || [];
      const total = recs.length;
      const present = recs.filter((r: any) => r.final_status === 'PRESENTE').length;
      if (total > 0) {
        attendancePct = Math.round((present / total) * 100);
        absentPct = 100 - attendancePct;
      }
    }

    const planNotStarted = csItems.filter(c => !c.plan_status || c.plan_status === 'NAO_INICIADO').length;
    const planPending = csItems.filter(c => c.plan_status === 'PENDENTE').length;
    const planApproved = csItems.filter(c => c.plan_status === 'APROVADO').length;

    setStats({
      totalSubjects: csItems.length,
      totalStudents: uniqueStudents,
      attendancePct,
      absentPct,
      planNotStarted,
      planPending,
      planApproved,
      pendingEnrollmentSuggestions: suggestions.length,
    });

    // Build schedule — today + next 3 days
    if (entries.length > 0 && csItems.length > 0) {
      const { data: classes } = classIds.length > 0
        ? await supabase.from('classes').select('id, code').in('id', classIds)
        : { data: [] };
      const { data: subjects } = subjectIds.length > 0
        ? await supabase.from('subjects').select('id, name').in('id', subjectIds)
        : { data: [] };

      const classMap = Object.fromEntries((classes || []).map((c: any) => [c.id, c.code]));
      const subjectMap = Object.fromEntries((subjects || []).map((s: any) => [s.id, s.name]));
      const csMap = Object.fromEntries(csItems.map(c => [c.id, c]));

      const sessionByCsId = new Map<string, { id: string; status: string }>();
      sessions.forEach((s: any) => {
        const cs = csItems.find(c => c.subject_id === s.subject_id && c.class_id === s.class_id);
        if (cs && !sessionByCsId.has(cs.id)) {
          sessionByCsId.set(cs.id, { id: s.id, status: s.status });
        }
      });

      const today = new Date().toISOString().split('T')[0];
      const limit = new Date();
      limit.setDate(limit.getDate() + 3);
      const limitStr = limit.toISOString().split('T')[0];

      const scheduleItems: ScheduleItem[] = (entries as any[])
        .filter(e => e.entry_date >= today && e.entry_date <= limitStr)
        .map(e => {
          const cs = csMap[e.class_subject_id];
          const session = sessionByCsId.get(e.class_subject_id);
          return {
            id: e.id,
            classSubjectId: e.class_subject_id,
            className: cs ? classMap[cs.class_id] || '—' : '—',
            subjectName: cs ? subjectMap[cs.subject_id] || '—' : '—',
            entryDate: e.entry_date,
            title: e.title,
            lessonNumber: e.lesson_number,
            entryType: e.entry_type,
            examType: e.exam_type,
            hasSessions: !!session,
            sessionId: session?.id,
            sessionStatus: session?.status,
          };
        });

      setSchedule(scheduleItems);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const displayedSchedule = showAllSchedule ? schedule : schedule.slice(0, 5);

  return (
    <div className="max-w-6xl mx-auto animate-fade-in space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground mb-1">
          Olá, {profile?.name?.split(' ')[0] || 'Professor'}!
        </h1>
        <p className="text-muted-foreground">Painel de controle — visão do professor</p>
      </div>

      {/* Sessão Ativa */}
      <ActiveSessionPanel
        professorUserId={user!.id}
        onSessionClosed={() => { setLiveCode(undefined); setLiveSessionId(undefined); loadDashboard(); }}
        liveCode={liveCode}
        liveSessionId={liveSessionId}
      />

      {/* Painel de Revisão de Presença + Fingerprints Duplicados */}
      <AttendanceReviewPanel />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label="Matérias Vinculadas" value={String(stats?.totalSubjects ?? 0)} sub="turmas ativas" color="primary" />
        <StatCard icon={Users} label="Alunos Vinculados" value={String(stats?.totalStudents ?? 0)} sub="em todas as turmas" color="info" />
        <StatCard
          icon={CheckCircle2}
          label="Frequência Média"
          value={stats?.attendancePct != null ? `${stats.attendancePct}%` : '—'}
          sub={stats?.absentPct != null ? `${stats.absentPct}% de faltas` : 'sem aulas fechadas'}
          color={stats?.attendancePct != null && stats.attendancePct >= 75 ? 'success' : 'warning'}
        />
        <StatCard
          icon={AlertTriangle}
          label="Solicitações Pendentes"
          value={String(stats?.pendingEnrollmentSuggestions ?? 0)}
          sub="sugestões de inclusão"
          color={stats?.pendingEnrollmentSuggestions ? 'destructive' : 'muted'}
        />
      </div>

      {/* Planos de Aula */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-card">
        <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" /> Status dos Planos de Aula
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <PlanStatusCard label="Não Iniciados" count={stats?.planNotStarted ?? 0} color="muted" icon={XCircle} />
          <PlanStatusCard label="Pendentes de Aprovação" count={stats?.planPending ?? 0} color="warning" icon={Clock} />
          <PlanStatusCard label="Aprovados" count={stats?.planApproved ?? 0} color="success" icon={CheckCircle2} />
        </div>
        <div className="mt-4 text-right">
          <Link to="/dashboard/minhas-turmas">
            <Button variant="outline" size="sm">
              Gerenciar Planos <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Ações Rápidas */}
      <div className="bg-card rounded-xl border border-border p-6 shadow-card">
        <h2 className="text-lg font-semibold text-foreground mb-4">Ações Rápidas</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <QuickLink icon={BookOpen} title="Minhas Turmas" desc="Planos de aula e critérios de notas" href="/dashboard/minhas-turmas" />
          <QuickLink icon={FileText} title="Boletim" desc="Lançar e consultar notas" href="/dashboard/boletim" />
          <QuickLink icon={CalendarCheck} title="Aulas" desc="Histórico e presença manual" href="/dashboard/aulas" />
        </div>
      </div>

      {/* Agenda de Aulas — hoje + até 3 dias seguintes */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <CalendarCheck className="w-5 h-5 text-primary" /> Agenda de Aulas
          </h2>
          <Link to="/dashboard/aulas">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1">
              Ver todas <ChevronRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>

        {schedule.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
            <CalendarCheck className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Nenhuma aula nos próximos 3 dias.</p>
            <Link to="/dashboard/minhas-turmas" className="mt-2">
              <Button size="sm" variant="outline">Cadastrar Plano de Aula</Button>
            </Link>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {displayedSchedule.map(item => {
                const isToday_ = item.entryDate === today;
                const hasOpenSession = item.sessionStatus === 'ABERTA';
                const hasClosedSession = item.sessionStatus && item.sessionStatus !== 'ABERTA';

                return (
                  <div
                    key={item.id}
                    className={cn(
                      'flex items-center gap-4 px-5 py-3 transition-colors',
                      isToday_ && 'bg-primary/5 border-l-4 border-l-primary',
                    )}
                  >
                    <div className="w-14 text-center shrink-0">
                      <p className="text-xs font-bold text-muted-foreground uppercase">
                        {format(new Date(item.entryDate + 'T12:00:00'), 'MMM', { locale: ptBR })}
                      </p>
                      <p className={cn('text-xl font-display font-bold', isToday_ ? 'text-primary' : 'text-foreground')}>
                        {format(new Date(item.entryDate + 'T12:00:00'), 'd')}
                      </p>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground text-sm truncate">
                          {item.lessonNumber ? `Aula ${item.lessonNumber} — ` : ''}{item.title}
                        </p>
                        {isToday_ && <Badge className="text-xs shrink-0">Hoje</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{item.className} · {item.subjectName}</p>
                    </div>

                    <div className="shrink-0 flex gap-2">
                      {isToday_ && !item.hasSessions && (
                        <Button size="sm" onClick={() => { setSelectedScheduleItem(item); setWizardOpen(true); }} className="text-xs h-7">
                          <Play className="w-3 h-3 mr-1" /> Abrir Chamada
                        </Button>
                      )}
                      {isToday_ && hasOpenSession && item.sessionId && (
                        <>
                          <Badge variant="outline" className="text-xs border-success text-success">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Aberta
                          </Badge>
                          <Button size="sm" variant="outline" className="text-xs h-7 border-primary text-primary"
                            onClick={() => { setManualSessionId(item.sessionId!); setManualOpen(true); }}>
                            Lançar Presença
                          </Button>
                        </>
                      )}
                      {isToday_ && hasClosedSession && (
                        <Badge variant="secondary" className="text-xs">
                          <CheckCircle2 className="w-3 h-3 mr-1" /> Realizada
                        </Badge>
                      )}
                      {!isToday_ && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Programada</Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {schedule.length > 5 && (
              <div className="flex justify-center p-3 border-t border-border">
                <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-muted-foreground" onClick={() => setShowAllSchedule(p => !p)}>
                  <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showAllSchedule && 'rotate-180')} />
                  {showAllSchedule ? 'Mostrar menos' : `Ver mais ${schedule.length - 5} aulas`}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Wizard */}
      {wizardOpen && selectedScheduleItem && (
        <AttendanceSessionWizard
          open={wizardOpen}
          onClose={() => { setWizardOpen(false); setSelectedScheduleItem(null); }}
          onSuccess={(code, sessionId) => {
            setWizardOpen(false);
            setSelectedScheduleItem(null);
            setLiveCode(code);
            setLiveSessionId(sessionId);
            loadDashboard();
          }}
          classSubjectId={selectedScheduleItem.classSubjectId}
          lessonTitle={selectedScheduleItem.title}
          lessonNumber={selectedScheduleItem.lessonNumber}
          professorUserId={user!.id}
        />
      )}

      {/* Manual Attendance */}
      {manualOpen && manualSessionId && (
        <ManualAttendanceModal
          sessionId={manualSessionId}
          onClose={() => { setManualOpen(false); setManualSessionId(null); loadDashboard(); }}
        />
      )}
    </div>
  );
}

// ---- Sub-components ----

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub: string;
  color: 'primary' | 'info' | 'success' | 'warning' | 'destructive' | 'muted';
}) {
  const iconBg: Record<string, string> = {
    primary: 'bg-primary/10 text-primary',
    info: 'bg-blue-500/10 text-blue-600',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    destructive: 'bg-destructive/10 text-destructive',
    muted: 'bg-muted text-muted-foreground',
  };
  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-card flex flex-col gap-3">
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', iconBg[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-foreground">{value}</p>
        <p className="text-xs font-medium text-foreground/80">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </div>
    </div>
  );
}

function PlanStatusCard({ label, count, color, icon: Icon }: {
  label: string; count: number;
  color: 'muted' | 'warning' | 'success';
  icon: React.ElementType;
}) {
  const colors = {
    muted: 'text-muted-foreground bg-muted/30',
    warning: 'text-warning bg-warning/10',
    success: 'text-success bg-success/10',
  };
  return (
    <div className={cn('rounded-lg p-4 flex flex-col gap-2', colors[color])}>
      <Icon className="w-5 h-5" />
      <p className="text-2xl font-display font-bold">{count}</p>
      <p className="text-xs font-medium">{label}</p>
    </div>
  );
}

function QuickLink({ icon: Icon, title, desc, href }: {
  icon: React.ElementType; title: string; desc: string; href: string;
}) {
  return (
    <Link to={href} className="flex items-start gap-3 p-4 rounded-xl bg-muted/50 hover:bg-muted transition-colors group">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:scale-110 transition-transform">
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground text-sm">{title}</p>
        <p className="text-xs text-muted-foreground truncate">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors mt-0.5" />
    </Link>
  );
}
