import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  Clock, Users, MapPin, XCircle, Copy, CheckCircle2,
  Loader2, Radio, BookOpen, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface ActiveSession {
  id: string;
  class_id: string;
  subject_id: string;
  opened_at: string;
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
  /** Código em texto plano, exibido apenas se o wizard acabou de abrir */
  liveCode?: string;
  liveSessionId?: string;
}

export default function ActiveSessionPanel({ professorUserId, onSessionClosed, liveCode, liveSessionId }: Props) {
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [presentCounts, setPresentCounts] = useState<Record<string, number>>({});
  const [totalCounts, setTotalCounts] = useState<Record<string, number>>({});
  const [subjectNames, setSubjectNames] = useState<Record<string, string>>({});
  const [classNames, setClassNames] = useState<Record<string, string>>({});
  const [elapsed, setElapsed] = useState<Record<string, number>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadSessions = useCallback(async () => {
    const { data } = await supabase
      .from('attendance_sessions')
      .select('id, class_id, subject_id, opened_at, require_geo, geo_lat, geo_lng, geo_radius_m, public_token, status')
      .eq('professor_user_id', professorUserId)
      .eq('status', 'ABERTA');

    const list = (data || []) as ActiveSession[];
    setSessions(list);
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

    // Initialize elapsed times
    const now = Date.now();
    const newElapsed: Record<string, number> = {};
    list.forEach(s => {
      newElapsed[s.id] = Math.floor((now - new Date(s.opened_at).getTime()) / 1000);
    });
    setElapsed(newElapsed);
  }, [professorUserId]);

  // Poll every 15s for new registrations
  useEffect(() => {
    loadSessions();
    const poll = setInterval(loadSessions, 15000);
    return () => clearInterval(poll);
  }, [loadSessions]);

  // Elapsed counter
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

  async function closeSession(sessionId: string) {
    setClosing(sessionId);
    const { error } = await supabase
      .from('attendance_sessions')
      .update({ status: 'ENCERRADA', closed_at: new Date().toISOString() })
      .eq('id', sessionId);
    setClosing(null);
    if (error) {
      toast({ title: 'Erro ao encerrar sessão', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Chamada encerrada com sucesso' });
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      onSessionClosed();
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
  if (sessions.length === 0 && !liveCode) return null;

  return (
    <div className="space-y-4">
      {sessions.map(session => {
        const present = presentCounts[session.id] || 0;
        const total = totalCounts[session.id] || 0;
        const elapsedSecs = elapsed[session.id] || 0;
        const isLive = session.id === liveSessionId;
        const displayCode = isLive && liveCode ? liveCode : null;

        return (
          <div
            key={session.id}
            className="rounded-xl border-2 border-success/40 bg-success/5 p-5 shadow-sm animate-fade-in"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-success" />
                </span>
                <span className="font-semibold text-foreground text-sm">Chamada em Andamento</span>
                <Badge variant="outline" className="border-success text-success text-xs">
                  <Radio className="w-3 h-3 mr-1" /> AO VIVO
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-mono tabular-nums">
                <Clock className="w-4 h-4" />
                {formatElapsed(elapsedSecs)}
              </div>
            </div>

            {/* Turma / Disciplina */}
            <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>
                <span className="font-medium text-foreground">{classNames[session.class_id] || '...'}</span>
                {' · '}
                {subjectNames[session.subject_id] || '...'}
              </span>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <MetricChip
                label="Presentes"
                value={String(present)}
                color="success"
              />
              <MetricChip
                label="Total registros"
                value={String(total)}
                color="muted"
              />
              <MetricChip
                label="Ausentes"
                value={String(Math.max(0, total - present))}
                color={total - present > 0 ? 'warning' : 'muted'}
              />
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

            {/* Código ao vivo (só exibido se veio do wizard nesta sessão) */}
            {displayCode && (
              <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 text-center mb-4">
                <p className="text-xs text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">
                  Código de Autenticação
                </p>
                <p className="text-4xl font-mono font-bold text-primary tracking-[0.25em] select-all">
                  {displayCode}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Informe este código aos alunos para registrar presença
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => copyCode(displayCode, session.id)}
                >
                  {copied === session.id
                    ? <><CheckCircle2 className="w-4 h-4 mr-2 text-success" />Copiado!</>
                    : <><Copy className="w-4 h-4 mr-2" />Copiar código</>}
                </Button>
              </div>
            )}

            {/* Session ID (compacto) */}
            <div className="rounded-lg bg-muted/40 border border-border px-3 py-2 text-xs font-mono text-muted-foreground truncate mb-4">
              ID: {session.id}
            </div>

            {/* Encerrar */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={closing === session.id}
                >
                  {closing === session.id
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Encerrando...</>
                    : <><XCircle className="w-4 h-4 mr-2" />Encerrar Chamada</>}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-warning" />
                    Encerrar chamada?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Ao encerrar, os alunos não poderão mais registrar presença com o código. Esta ação não pode ser desfeita automaticamente.
                    <br /><br />
                    <strong>{present} aluno(s)</strong> registraram presença de <strong>{total} registros</strong> no total.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive hover:bg-destructive/90"
                    onClick={() => closeSession(session.id)}
                  >
                    Encerrar chamada
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        );
      })}
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
    <div className={cn('rounded-lg border p-2.5 text-center', styles[color])}>
      <p className="text-lg font-display font-bold">{value}</p>
      <p className="text-xs font-medium leading-tight mt-0.5">{label}</p>
    </div>
  );
}
