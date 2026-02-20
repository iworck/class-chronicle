import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2, CalendarCheck, Search, Filter, Play, CheckCircle2, Clock,
  ClipboardList, Users, ChevronDown, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown,
  GraduationCap, Eye, Copy,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import AttendanceSessionWizard from '@/components/dashboard/AttendanceSessionWizard';
import ManualAttendanceModal from '@/components/dashboard/ManualAttendanceModal';

interface LessonEntry {
  id: string;
  class_subject_id: string;
  entry_date: string;
  title: string;
  lesson_number: number | null;
  entry_type: string;
  exam_type: string | null;
  objective: string | null;
  className: string;
  subjectName: string;
  classId: string;
  subjectId: string;
  // Session details
  sessionId: string | null;
  sessionStatus: string | null;
  sessionOpenedAt: string | null;
  sessionClosedAt: string | null;
  sessionEntryCodeHash: string | null;
  sessionCloseTokenHash: string | null;
  sessionPublicToken: string | null;
  professorName: string | null;
  // Computed
  lessonStatus: 'realizada' | 'hoje' | 'programada' | 'passada_sem_chamada';
}

const STATUS_CONFIG = {
  realizada: { label: 'Realizada', color: 'bg-success/10 text-success border-success/30', icon: CheckCircle2 },
  hoje: { label: 'Hoje', color: 'bg-primary/10 text-primary border-primary/30', icon: Play },
  programada: { label: 'Programada', color: 'bg-muted text-muted-foreground border-border', icon: Clock },
  passada_sem_chamada: { label: 'Sem chamada', color: 'bg-destructive/10 text-destructive border-destructive/30', icon: AlertCircle },
};

export default function Aulas() {
  const { user, effectiveUserId } = useAuth();
  const targetUserId = effectiveUserId ?? user?.id;
  const [loading, setLoading] = useState(true);
  const [lessons, setLessons] = useState<LessonEntry[]>([]);

  // Sort order
  const [sortAsc, setSortAsc] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [filterSubject, setFilterSubject] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;

  // Modals
  const [wizardOpen, setWizardOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [selectedLesson, setSelectedLesson] = useState<LessonEntry | null>(null);
  const [manualSessionId, setManualSessionId] = useState<string | null>(null);
  const [liveCode, setLiveCode] = useState<string | undefined>();
  const [liveSessionId, setLiveSessionId] = useState<string | undefined>();
  const [viewLesson, setViewLesson] = useState<LessonEntry | null>(null);

  // Active sessions (to block simultaneous opens)
  const [hasOpenSession, setHasOpenSession] = useState(false);

  const load = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);

    // 1. Load class_subjects for this professor
    const { data: classSubjects } = await supabase
      .from('class_subjects')
      .select('id, class_id, subject_id')
      .eq('professor_user_id', targetUserId)
      .eq('status', 'ATIVO');

    const csItems = classSubjects || [];
    const csIds = csItems.map(c => c.id);
    const classIds = [...new Set(csItems.map(c => c.class_id))];
    const subjectIds = [...new Set(csItems.map(c => c.subject_id))];

    if (csIds.length === 0) {
      setLessons([]);
      setLoading(false);
      return;
    }

    // 2. Parallel: lesson entries, classes, subjects, sessions
    const [entriesRes, classesRes, subjectsRes, sessionsRes, profileRes] = await Promise.all([
      supabase
        .from('lesson_plan_entries')
        .select('id, class_subject_id, entry_date, title, lesson_number, entry_type, exam_type, objective')
        .in('class_subject_id', csIds)
        .order('entry_date', { ascending: true }),
      supabase.from('classes').select('id, code').in('id', classIds),
      supabase.from('subjects').select('id, name').in('id', subjectIds),
      supabase
        .from('attendance_sessions')
        .select('id, class_id, subject_id, status, lesson_entry_id, opened_at, closed_at, entry_code_hash, close_token_hash, public_token')
        .eq('professor_user_id', targetUserId)
        .in('subject_id', subjectIds),
      supabase.from('profiles').select('id, name').eq('id', targetUserId).single(),
    ]);

    const classMap = Object.fromEntries((classesRes.data || []).map((c: any) => [c.id, c.code]));
    const subjectMap = Object.fromEntries((subjectsRes.data || []).map((s: any) => [s.id, s.name]));
    const csMap = Object.fromEntries(csItems.map(c => [c.id, c]));
    const sessions = sessionsRes.data || [];
    const professorName = profileRes.data?.name || null;

    // Check if professor has any currently open session
    const openSession = sessions.find((s: any) => s.status === 'ABERTA');
    setHasOpenSession(!!openSession);

    const today = new Date().toISOString().split('T')[0];

    const items: LessonEntry[] = (entriesRes.data || []).map((e: any) => {
      const cs = csMap[e.class_subject_id];
      // Match session by lesson_entry_id first, then fallback to class+subject (for legacy sessions)
      const session = sessions.find(
        (s: any) => s.lesson_entry_id === e.id
      ) || sessions.find(
        (s: any) => !s.lesson_entry_id && s.class_id === cs?.class_id && s.subject_id === cs?.subject_id
          && (s.status === 'ABERTA') // Only match legacy open sessions, not closed ones
      ) as any;

      const isToday = e.entry_date === today;
      const isPast = e.entry_date < today;
      const isExam = e.entry_type === 'AVALIACAO';
      const hasClosedSession = !!session && (session.status === 'ENCERRADA' || session.status === 'AUDITORIA_FINALIZADA');

      let lessonStatus: LessonEntry['lessonStatus'];

      // Exams in the future/today → always 'programada' (they're not classes with attendance)
      if (isExam && !isPast) {
        lessonStatus = 'programada';
      } else if (isExam && isPast && hasClosedSession) {
        lessonStatus = 'realizada';
      } else if (isExam && isPast) {
        lessonStatus = 'programada'; // past exam without session still "programada"
      } else if (hasClosedSession) {
        lessonStatus = 'realizada';
      } else if (isToday) {
        lessonStatus = 'hoje';
      } else if (isPast && !session) {
        lessonStatus = 'passada_sem_chamada';
      } else {
        lessonStatus = 'programada';
      }

      return {
        id: e.id,
        class_subject_id: e.class_subject_id,
        entry_date: e.entry_date,
        title: e.title,
        lesson_number: e.lesson_number,
        entry_type: e.entry_type,
        exam_type: e.exam_type,
        objective: e.objective,
        className: cs ? classMap[cs.class_id] || '—' : '—',
        subjectName: cs ? subjectMap[cs.subject_id] || '—' : '—',
        classId: cs?.class_id || '',
        subjectId: cs?.subject_id || '',
        sessionId: session?.id || null,
        sessionStatus: session?.status || null,
        sessionOpenedAt: session?.opened_at || null,
        sessionClosedAt: session?.closed_at || null,
        sessionEntryCodeHash: session?.entry_code_hash || null,
        sessionCloseTokenHash: session?.close_token_hash || null,
        sessionPublicToken: session?.public_token || null,
        professorName,
        lessonStatus,
      };
    });

    setLessons(items);
    setLoading(false);
  }, [targetUserId]);

  useEffect(() => { load(); }, [load]);

  // Derived subject list for filter
  const subjectOptions = useMemo(() => {
    const map = new Map<string, string>();
    lessons.forEach(l => { if (l.subjectName && l.subjectName !== '—') map.set(l.subjectName, l.subjectName); });
    return Array.from(map.keys()).sort();
  }, [lessons]);

  // Apply filters + sort
  const filtered = useMemo(() => {
    let result = [...lessons];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.title.toLowerCase().includes(q) ||
        l.className.toLowerCase().includes(q) ||
        l.subjectName.toLowerCase().includes(q)
      );
    }
    if (filterStatus !== 'all') {
      result = result.filter(l => l.lessonStatus === filterStatus);
    }
    if (filterSubject !== 'all') {
      result = result.filter(l => l.subjectName === filterSubject);
    }
    if (filterDateFrom) {
      result = result.filter(l => l.entry_date >= filterDateFrom);
    }
    if (filterDateTo) {
      result = result.filter(l => l.entry_date <= filterDateTo);
    }

    // Sort by date
    result.sort((a, b) => {
      const cmp = a.entry_date.localeCompare(b.entry_date);
      return sortAsc ? cmp : -cmp;
    });

    return result;
  }, [lessons, search, filterStatus, filterSubject, filterDateFrom, filterDateTo, sortAsc]);

  const paged = filtered.slice(0, (page + 1) * PAGE_SIZE);
  const hasMore = paged.length < filtered.length;

  // Stats
  const stats = useMemo(() => ({
    total: lessons.length,
    realizadas: lessons.filter(l => l.lessonStatus === 'realizada').length,
    hoje: lessons.filter(l => l.lessonStatus === 'hoje').length,
    semChamada: lessons.filter(l => l.lessonStatus === 'passada_sem_chamada').length,
  }), [lessons]);

  function openWizard(lesson: LessonEntry) {
    if (hasOpenSession) {
      toast({
        title: 'Sessão já aberta',
        description: 'Você já tem uma chamada aberta. Encerre a sessão atual antes de abrir uma nova.',
        variant: 'destructive',
      });
      return;
    }
    setSelectedLesson(lesson);
    setWizardOpen(true);
  }

  function openManual(sessionId: string) {
    setManualSessionId(sessionId);
    setManualOpen(true);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Aulas</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Histórico completo de aulas planejadas, realizadas e programadas</p>
      </div>

      {/* Active session alert */}
      {hasOpenSession && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/40 bg-primary/5">
          <GraduationCap className="w-5 h-5 text-primary shrink-0" />
          <p className="text-sm text-foreground">
            <strong>Chamada em andamento.</strong> Você tem uma sessão aberta. Encerre-a antes de abrir uma nova chamada.
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total de aulas', value: stats.total, color: 'text-foreground', bg: 'bg-muted/40' },
          { label: 'Realizadas', value: stats.realizadas, color: 'text-success', bg: 'bg-success/10' },
          { label: 'Hoje', value: stats.hoje, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Sem chamada', value: stats.semChamada, color: 'text-destructive', bg: 'bg-destructive/10' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl border border-border p-4', s.bg)}>
            <p className={cn('text-2xl font-display font-bold', s.color)}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="bg-card rounded-xl border border-border p-4 space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por conteúdo, turma ou disciplina..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              className="pl-9"
            />
          </div>
          {/* Sort toggle */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => { setSortAsc(p => !p); setPage(0); }}
            title={sortAsc ? 'Ordem crescente (mais antiga primeiro)' : 'Ordem decrescente (mais recente primeiro)'}
          >
            {sortAsc ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={() => setShowFilters(p => !p)} className={cn(showFilters && 'border-primary text-primary')}>
            <Filter className="w-4 h-4" />
          </Button>
        </div>

        {showFilters && (
          <div className="grid sm:grid-cols-4 gap-3 pt-1 border-t border-border">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Situação</p>
              <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(0); }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="realizada">Realizadas</SelectItem>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="programada">Programadas</SelectItem>
                  <SelectItem value="passada_sem_chamada">Sem chamada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Disciplina</p>
              <Select value={filterSubject} onValueChange={v => { setFilterSubject(v); setPage(0); }}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {subjectOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Data inicial</p>
              <Input type="date" value={filterDateFrom} onChange={e => { setFilterDateFrom(e.target.value); setPage(0); }} className="h-8 text-xs" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Data final</p>
              <Input type="date" value={filterDateTo} onChange={e => { setFilterDateTo(e.target.value); setPage(0); }} className="h-8 text-xs" />
            </div>
          </div>
        )}
      </div>

      {/* Lesson List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <CalendarCheck className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">Nenhuma aula encontrada com os filtros aplicados.</p>
          </div>
        ) : (
          <>
            {/* Column header */}
            <div className="flex items-center gap-4 px-5 py-2 bg-muted/40 border-b border-border text-xs font-semibold text-muted-foreground">
              <div className="w-14 text-center">
                <button
                  className="flex items-center gap-1 mx-auto hover:text-foreground transition-colors"
                  onClick={() => { setSortAsc(p => !p); setPage(0); }}
                >
                  Data <ArrowUpDown className="w-3 h-3" />
                </button>
              </div>
              <div className="flex-1">Conteúdo / Turma</div>
              <div className="w-28 text-center">Situação</div>
              <div className="w-36 text-right">Ação</div>
            </div>

            <div className="divide-y divide-border">
              {paged.map((lesson, idx) => {
                const cfg = STATUS_CONFIG[lesson.lessonStatus];
                const Icon = cfg.icon;
                const dateObj = parseISO(lesson.entry_date + 'T12:00:00');
                const isExam = lesson.entry_type === 'AVALIACAO';

                return (
                  <div key={lesson.id} className={cn(
                    'flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30',
                    lesson.lessonStatus === 'hoje' && 'bg-primary/5 border-l-4 border-l-primary',
                    lesson.lessonStatus === 'passada_sem_chamada' && 'bg-destructive/5',
                    isExam && 'bg-warning/5',
                  )}>
                    {/* Date */}
                    <div className="w-14 text-center shrink-0">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase">
                        {format(dateObj, 'MMM', { locale: ptBR })}
                      </p>
                      <p className={cn('text-xl font-display font-bold', lesson.lessonStatus === 'hoje' ? 'text-primary' : 'text-foreground')}>
                        {format(dateObj, 'd')}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(dateObj, 'EEE', { locale: ptBR })}
                      </p>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-foreground text-sm truncate">
                          {isExam
                            ? `📋 ${lesson.title}`
                            : lesson.lesson_number
                              ? `Aula ${lesson.lesson_number} — ${lesson.title}`
                              : lesson.title
                          }
                        </p>
                        <Badge variant="outline" className={cn('text-xs shrink-0 flex items-center gap-1', cfg.color)}>
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {lesson.className} · {lesson.subjectName}
                        {isExam && lesson.exam_type && (
                          <span className="ml-2 font-semibold text-warning">{lesson.exam_type.replace('_', ' ')}</span>
                        )}
                      </p>
                      {lesson.objective && !isExam && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{lesson.objective}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="shrink-0 flex gap-2">
                      {/* View details button */}
                      {lesson.sessionId && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setViewLesson(lesson)}>
                          <Eye className="w-3 h-3" /> Ver
                        </Button>
                      )}
                      {/* Only non-exam entries can open attendance */}
                      {!isExam && lesson.lessonStatus === 'hoje' && !lesson.sessionId && (
                        <Button
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => openWizard(lesson)}
                          disabled={hasOpenSession}
                        >
                          <Play className="w-3 h-3" /> Abrir Chamada
                        </Button>
                      )}
                      {!isExam && lesson.lessonStatus === 'hoje' && lesson.sessionId && (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-success text-success hover:bg-success/10" onClick={() => openManual(lesson.sessionId!)}>
                          <Users className="w-3 h-3" /> Lançar Presença
                        </Button>
                      )}
                      {!isExam && lesson.lessonStatus === 'passada_sem_chamada' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1 text-muted-foreground"
                          onClick={() => openWizard(lesson)}
                          disabled={hasOpenSession}
                        >
                          <ClipboardList className="w-3 h-3" /> Lançar Retroativo
                        </Button>
                      )}
                      {!isExam && lesson.lessonStatus === 'realizada' && lesson.sessionId && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => openManual(lesson.sessionId!)}>
                          <Users className="w-3 h-3" /> Ver / Editar Presença
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load more */}
            {hasMore && (
              <div className="flex justify-center p-4 border-t border-border">
                <Button variant="outline" size="sm" className="gap-2" onClick={() => setPage(p => p + 1)}>
                  <ChevronDown className="w-4 h-4" /> Carregar mais ({filtered.length - paged.length} restantes)
                </Button>
              </div>
            )}

            <div className="px-5 py-2.5 bg-muted/30 border-t border-border text-xs text-muted-foreground">
              Exibindo {paged.length} de {filtered.length} registros · Ordem {sortAsc ? 'crescente' : 'decrescente'} por data
            </div>
          </>
        )}
      </div>

      {/* Wizard de abertura de chamada */}
      {wizardOpen && selectedLesson && (
        <AttendanceSessionWizard
          open={wizardOpen}
          onClose={() => { setWizardOpen(false); setSelectedLesson(null); }}
          onSuccess={(code, sessionId) => {
            setWizardOpen(false);
            setSelectedLesson(null);
            setLiveCode(code);
            setLiveSessionId(sessionId);
            load();
          }}
          classSubjectId={selectedLesson.class_subject_id}
          lessonEntryId={selectedLesson.id}
          lessonTitle={selectedLesson.title}
          lessonNumber={selectedLesson.lesson_number}
          professorUserId={user!.id}
        />
      )}

      {/* Modal de presença manual */}
      {manualOpen && manualSessionId && (
        <ManualAttendanceModal
          sessionId={manualSessionId}
          onClose={() => { setManualOpen(false); setManualSessionId(null); load(); }}
        />
      )}

      {/* Modal de detalhes da aula */}
      <Dialog open={!!viewLesson} onOpenChange={(open) => { if (!open) setViewLesson(null); }}>
        <DialogContent className="max-w-lg">
          {viewLesson && (() => {
            const sessionId6 = viewLesson.sessionId ? viewLesson.sessionId.replace(/-/g, '').substring(0, 6).toUpperCase() : '—';
            const copyToClipboard = (text: string) => {
              navigator.clipboard.writeText(text);
              toast({ title: 'Copiado!', description: 'Valor copiado para a área de transferência.' });
            };

            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-lg">
                    {viewLesson.lesson_number ? `Aula ${viewLesson.lesson_number}` : 'Aula'} — {viewLesson.title}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  {/* Data da Aula */}
                  <div className="rounded-lg border border-border p-3 bg-muted/30 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Informações da Aula</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Data da Aula</p>
                        <p className="font-medium text-foreground">
                          {format(parseISO(viewLesson.entry_date + 'T12:00:00'), "dd/MM/yyyy (EEEE)", { locale: ptBR })}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Nº no Plano</p>
                        <p className="font-medium text-foreground">{viewLesson.lesson_number || '—'}</p>
                      </div>
                    </div>
                    {viewLesson.objective && (
                      <div>
                        <p className="text-xs text-muted-foreground">Objetivo</p>
                        <p className="text-sm text-foreground">{viewLesson.objective}</p>
                      </div>
                    )}
                  </div>

                  {/* Turma / Matéria / Professor */}
                  <div className="rounded-lg border border-border p-3 bg-muted/30 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Turma & Disciplina</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">ID da Turma</p>
                        <div className="flex items-center gap-1">
                          <p className="font-mono font-medium text-foreground">{viewLesson.className}</p>
                          <button onClick={() => copyToClipboard(viewLesson.className)} className="text-muted-foreground hover:text-foreground transition-colors">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Matéria</p>
                        <p className="font-medium text-foreground">{viewLesson.subjectName}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground">Professor</p>
                        <p className="font-medium text-foreground">{viewLesson.professorName || '—'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Sessão de Chamada */}
                  <div className="rounded-lg border border-border p-3 bg-muted/30 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sessão de Chamada</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Senha da Aula (ID)</p>
                        <div className="flex items-center gap-1">
                          <p className="font-mono font-bold text-primary text-base">{sessionId6}</p>
                          <button onClick={() => copyToClipboard(sessionId6)} className="text-muted-foreground hover:text-foreground transition-colors">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Status</p>
                        <Badge variant="outline" className={cn('text-xs',
                          viewLesson.sessionStatus === 'ABERTA' ? 'border-primary text-primary' :
                          viewLesson.sessionStatus === 'ENCERRADA' ? 'border-success text-success' :
                          'border-muted-foreground text-muted-foreground'
                        )}>
                          {viewLesson.sessionStatus || '—'}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Abertura</p>
                        <p className="font-medium text-foreground">
                          {viewLesson.sessionOpenedAt
                            ? format(new Date(viewLesson.sessionOpenedAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })
                            : '—'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Fechamento</p>
                        <p className="font-medium text-foreground">
                          {viewLesson.sessionClosedAt
                            ? format(new Date(viewLesson.sessionClosedAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })
                            : '—'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Hashes */}
                  <div className="rounded-lg border border-border p-3 bg-muted/30 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Hashes de Segurança</p>
                    <div className="space-y-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Hash de Abertura (entry_code)</p>
                        <div className="flex items-center gap-1">
                          <p className="font-mono text-xs text-foreground break-all">{viewLesson.sessionEntryCodeHash || '—'}</p>
                          {viewLesson.sessionEntryCodeHash && (
                            <button onClick={() => copyToClipboard(viewLesson.sessionEntryCodeHash!)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Hash de Fechamento (close_token)</p>
                        <div className="flex items-center gap-1">
                          <p className="font-mono text-xs text-foreground break-all">{viewLesson.sessionCloseTokenHash || '—'}</p>
                          {viewLesson.sessionCloseTokenHash && (
                            <button onClick={() => copyToClipboard(viewLesson.sessionCloseTokenHash!)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                              <Copy className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
