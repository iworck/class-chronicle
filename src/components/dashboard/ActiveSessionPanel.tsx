import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  Clock, Users, MapPin, XCircle, Copy, CheckCircle2,
  Loader2, Radio, BookOpen, AlertTriangle, RotateCcw, ListChecks,
  ExternalLink, QrCode, Check, Info, HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import ManualAttendanceModal from './ManualAttendanceModal';

interface ActiveSession {
  id: string;
  class_id: string;
  subject_id: string;
  opened_at: string;
  closed_at: string | null;
  require_geo: boolean;
  geo_lat: number | null;
  geo_lng: number | null;
  geo_radius_m: number | null;
  public_token: string;
  status: string;
}

interface Props {
  professorUserId: string;
  onSessionClosed: () => void;
  liveCode?: string;
  liveSessionId?: string;
}

export default function ActiveSessionPanel({ professorUserId, onSessionClosed, liveCode, liveSessionId }: Props) {
  const [openSessions, setOpenSessions] = useState<ActiveSession[]>([]);
  const [closedSessions, setClosedSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [presentCounts, setPresentCounts] = useState<Record<string, number>>({});
  const [totalCounts, setTotalCounts] = useState<Record<string, number>>({});
  const [subjectNames, setSubjectNames] = useState<Record<string, string>>({});
  const [classNames, setClassNames] = useState<Record<string, string>>({});
  const [elapsed, setElapsed] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const [reopening, setReopening] = useState<string | null>(null);
  const [manualSessionId, setManualSessionId] = useState<string | null>(null);
  const [closeDialogSessionId, setCloseDialogSessionId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSessions = useCallback(async () => {
    // Load ABERTA + sessions closed in last 24h
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data } = await supabase
      .from('attendance_sessions')
      .select('id, class_id, subject_id, opened_at, closed_at, require_geo, geo_lat, geo_lng, geo_radius_m, public_token, status')
      .eq('professor_user_id', professorUserId)
      .or(`status.eq.ABERTA,and(status.eq.ENCERRADA,closed_at.gte.${yesterday})`);

    const list = (data || []) as ActiveSession[];
    const open = list.filter(s => s.status === 'ABERTA');
    const closed = list.filter(s => s.status === 'ENCERRADA');
    setOpenSessions(open);
    setClosedSessions(closed);
    setLoading(false);

    if (list.length === 0) return;

    const subjectIds = [...new Set(list.map(s => s.subject_id))];
    const classIds = [...new Set(list.map(s => s.class_id))];
    const sessionIds = list.map(s => s.id);

    const [subjectsRes, classesRes, recordsRes] = await Promise.all([
      supabase.from('subjects').select('id, name').in('id', subjectIds),
      supabase.from('classes').select('id, code').in('id', classIds),
      supabase.from('attendance_records').select('session_id, final_status').in('session_id', sessionIds),
    ]);

    const sm: Record<string, string> = {};
    (subjectsRes.data || []).forEach((s: any) => { sm[s.id] = s.name; });
    setSubjectNames(sm);

    const cm: Record<string, string> = {};
    (classesRes.data || []).forEach((c: any) => { cm[c.id] = c.code; });
    setClassNames(cm);

    const records = recordsRes.data || [];
    const pCounts: Record<string, number> = {};
    const tCounts: Record<string, number> = {};
    records.forEach((r: any) => {
      tCounts[r.session_id] = (tCounts[r.session_id] || 0) + 1;
      if (r.final_status === 'PRESENTE') {
        pCounts[r.session_id] = (pCounts[r.session_id] || 0) + 1;
      }
    });
    setPresentCounts(pCounts);
    setTotalCounts(tCounts);

    const now = Date.now();
    const newElapsed: Record<string, number> = {};
    open.forEach(s => {
      newElapsed[s.id] = Math.floor((now - new Date(s.opened_at).getTime()) / 1000);
    });
    setElapsed(newElapsed);
  }, [professorUserId]);

  useEffect(() => {
    loadSessions();
    const poll = setInterval(loadSessions, 15000);
    return () => clearInterval(poll);
  }, [loadSessions]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(id => { next[id] = next[id] + 1; });
        return next;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  async function closeSession(sessionId: string): Promise<boolean> {
    setClosing(sessionId);

    const { error } = await supabase
      .from('attendance_sessions')
      .update({ status: 'ENCERRADA', closed_at: new Date().toISOString() })
      .eq('id', sessionId);
    setClosing(null);
    if (error) {
      toast({ title: 'Erro ao encerrar sessão', description: error.message, variant: 'destructive' });
      return false;
    } else {
      toast({ title: '✅ Chamada encerrada com sucesso' });
      setCloseDialogSessionId(null);
      onSessionClosed();
      loadSessions();
      return true;
    }
  }

  async function reopenSession(sessionId: string) {
    setReopening(sessionId);
    const { error } = await supabase
      .from('attendance_sessions')
      .update({ status: 'ABERTA', closed_at: null })
      .eq('id', sessionId);
    setReopening(null);
    if (error) {
      toast({ title: 'Erro ao reabrir sessão', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '🔓 Chamada reaberta com sucesso' });
      loadSessions();
    }
  }

  function copyCode(code: string, sessionId: string) {
    navigator.clipboard.writeText(code);
    setCopied(sessionId);
    setTimeout(() => setCopied(null), 2000);
  }

  function formatElapsed(secs: number) {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
  }

  if (loading) return null;
  if (openSessions.length === 0 && closedSessions.length === 0 && !liveCode) return null;

  return (
    <div className="space-y-4">
      {/* ── SESSÕES ABERTAS (ao vivo) ── */}
      {openSessions.map(session => {
        const present = presentCounts[session.id] || 0;
        const total = totalCounts[session.id] || 0;
        const elapsedSecs = elapsed[session.id] || 0;
        const isLive = session.id === liveSessionId;
        const displayCode = isLive && liveCode ? liveCode : null;

        return (
          <div
            key={session.id}
            className="rounded-2xl border-2 border-success bg-success/[0.03] p-6 shadow-md shadow-success/5 animate-fade-in relative overflow-hidden"
          >
            {/* Background glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-success/5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between mb-5 flex-wrap gap-2 relative z-10">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-success/20 text-success shadow-[0_0_15px_rgba(34,197,94,0.3)] border border-success/30">
                  <Radio className="w-7 h-7 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-black text-foreground text-lg tracking-tight uppercase">Aula Ativa</span>
                    <Badge variant="default" className="bg-success text-success-foreground hover:bg-success border-none text-[11px] font-black uppercase px-2 py-0.5 h-5 shadow-[0_0_10px_rgba(34,197,94,0.5)] animate-pulse">
                      AO VIVO
                    </Badge>
                  </div>
                  <p className="text-xs text-success font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Registros liberados
                  </p>
                </div>
              </div>
              <div className="bg-success/10 px-3 py-2 rounded-xl flex items-center gap-2 text-success font-mono font-black text-lg border-2 border-success/20 shadow-inner">
                <Clock className="w-5 h-5" />
                {formatElapsed(elapsedSecs)}
              </div>
            </div>

            {/* Turma / Disciplina */}
            <div className="flex items-start gap-3 mb-6 bg-muted/30 p-3 rounded-xl border border-border/50">
              <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center border border-border shadow-sm shrink-0">
                <BookOpen className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-foreground text-sm truncate uppercase tracking-tight">
                  {classNames[session.class_id] || 'Carregando...'}
                </p>
                <p className="text-xs text-muted-foreground truncate font-medium">
                  {subjectNames[session.subject_id] || 'Carregando...'}
                </p>
              </div>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <MetricChip label="Presentes" value={String(present)} color="success" />
              <MetricChip label="Total" value={String(total)} color="muted" />
              <MetricChip label="Ausentes" value={String(Math.max(0, total - present))} color={total - present > 0 ? 'warning' : 'muted'} />
            </div>

            {/* Badges config */}
            <div className="flex gap-2 flex-wrap mb-4">
              {session.require_geo && session.geo_lat ? (
                <Badge variant="secondary" className="text-xs">
                  <MapPin className="w-3 h-3 mr-1" /> Geo ativo · {session.geo_radius_m ?? 200}m
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">Sem geolocalização</Badge>
              )}
            </div>

            {/* Código ao vivo */}
            {displayCode && (
              <div className="rounded-2xl border-2 border-primary bg-primary/[0.03] p-6 text-center mb-6 relative group transition-all hover:bg-primary/[0.05]">
                <p className="text-[10px] text-primary mb-3 font-black uppercase tracking-[0.25em]">
                  Código de Autenticação
                </p>
                <p className="text-5xl font-mono font-black text-primary tracking-[0.2em] select-all mb-4">
                  {displayCode}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-background/80 backdrop-blur-sm border-primary/20 hover:border-primary/50 text-primary font-bold px-6 h-9 rounded-full shadow-sm"
                  onClick={() => copyCode(displayCode, session.id)}
                >
                  {copied === session.id
                    ? <><CheckCircle2 className="w-4 h-4 mr-2 text-success" />Copiado!</>
                    : <><Copy className="w-4 h-4 mr-2" />Copiar Código</>}
                </Button>
              </div>
            )}

            {/* Session ID */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/30 border border-border/50 mb-4 group transition-colors hover:bg-muted/50">
              <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">ID da Aula</span>
              <span className="text-xs font-mono font-bold text-foreground tracking-widest group-hover:text-primary transition-colors">
                {session.id.replace(/-/g, '').slice(0, 8).toUpperCase()}
              </span>
            </div>

            {/* Ações: lançar presença manual + encerrar */}
            <div className="grid grid-cols-2 gap-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      className="h-11 rounded-xl border-2 border-border hover:border-primary hover:bg-primary/[0.05] hover:text-primary font-black shadow-sm transition-all group"
                      onClick={() => setManualSessionId(session.id)}
                    >
                      <ListChecks className="w-5 h-5 mr-2 transition-transform group-hover:scale-110" /> Presença
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-bold">Lançar ou editar frequências manualmente</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      className="h-11 rounded-xl font-black shadow-lg shadow-destructive/20 transition-all hover:scale-[1.05] active:scale-[0.95] border-2 border-transparent hover:border-white/20"
                      disabled={closing === session.id}
                      onClick={() => setCloseDialogSessionId(session.id)}
                    >
                      {closing === session.id
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />...</>
                        : <><XCircle className="w-5 h-5 mr-2" /> Encerrar</>}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-bold">Finalizar chamada definitivamente</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        );
      })}

      {/* ── SESSÕES ENCERRADAS RECENTES (últimas 24h) ── */}
      {closedSessions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
            Chamadas Encerradas Recentemente
          </p>
          {closedSessions.map(session => {
            const present = presentCounts[session.id] || 0;
            const total = totalCounts[session.id] || 0;

            return (
              <div
                key={session.id}
                className="rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-foreground truncate">
                          {classNames[session.class_id] || '...'} · {subjectNames[session.subject_id] || '...'}
                        </span>
                        <Badge variant="secondary" className="text-xs shrink-0">Concluída</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-muted-foreground font-mono">
                          ID: {session.id.replace(/-/g, '').slice(0, 6).toUpperCase()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          <Users className="w-3 h-3 inline mr-0.5" />
                          {present}/{total} presentes
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setManualSessionId(session.id)}
                    >
                      <ListChecks className="w-3.5 h-3.5 mr-1" /> Ver / Editar
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={reopening === session.id}
                        >
                          {reopening === session.id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <><RotateCcw className="w-3.5 h-3.5 mr-1" /> Reabrir</>}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Reabrir chamada?</AlertDialogTitle>
                          <AlertDialogDescription>
                            A chamada voltará ao status <strong>Aberta</strong>, permitindo que alunos registrem presença e você faça ajustes. Você pode encerrá-la novamente quando quiser.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => reopenSession(session.id)}>
                            Sim, reabrir
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de presença manual */}
      {manualSessionId && (
        <ManualAttendanceModal
          sessionId={manualSessionId}
          onClose={() => { setManualSessionId(null); loadSessions(); }}
        />
      )}

      {/* ── DIALOG CONTROLADO PARA ENCERRAR ── */}
      {closeDialogSessionId && (() => {
        const session = openSessions.find(s => s.id === closeDialogSessionId);
        if (!session) return null;
        const present = presentCounts[session.id] || 0;
        const total = totalCounts[session.id] || 0;

        return (
          <AlertDialog open onOpenChange={(v) => { if (!v) setCloseDialogSessionId(null); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning" />
                  Encerrar chamada?
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div>
                    <p>Ao encerrar, os alunos não poderão mais registrar presença com o código.</p>
                    <p className="mt-2"><strong>{present} aluno(s)</strong> registraram presença de <strong>{total} registros</strong> no total.</p>
                    <p className="mt-2 text-xs">Caso tenha encerrado por engano, você pode <strong>reabrir</strong> a chamada logo após.</p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setCloseDialogSessionId(null)}>Cancelar</AlertDialogCancel>
                <Button
                  variant="destructive"
                  disabled={closing === session.id}
                  onClick={() => closeSession(session.id)}
                >
                  {closing === session.id
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Encerrando...</>
                    : 'Encerrar chamada'}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        );
      })()}
    </div>
  );
}

function MetricChip({ label, value, color }: { label: string; value: string; color: 'success' | 'warning' | 'muted' }) {
  const styles: Record<string, string> = {
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    muted: 'bg-muted/60 text-muted-foreground border-border',
  };

  return (
    <div className={cn('flex flex-col items-center justify-center p-3 rounded-2xl border transition-all hover:scale-[1.02]', styles[color])}>
      <span className="text-xl font-black tabular-nums">{value}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</span>
    </div>
  );
}
