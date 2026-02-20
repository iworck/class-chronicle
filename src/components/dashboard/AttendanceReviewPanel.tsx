import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from '@/hooks/use-toast';
import {
  AlertTriangle, CheckCircle2, XCircle, Loader2,
  Fingerprint, MapPin, Camera, PenTool, ChevronDown, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';

interface ReviewRecord {
  id: string;
  session_id: string;
  student_id: string;
  final_status: string;
  needs_review: boolean;
  review_reason: string | null;
  device_fingerprint: string | null;
  registered_at: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  geo_ok: boolean | null;
  selfie_path: string | null;
  signature_path: string | null;
  ip_address: string | null;
  user_agent: string | null;
  studentName?: string;
  studentEnrollment?: string;
  className?: string;
  subjectName?: string;
}

interface DuplicateGroup {
  fingerprint: string;
  sessionId: string;
  records: ReviewRecord[];
  className?: string;
  subjectName?: string;
}

export default function AttendanceReviewPanel() {
  const { user } = useAuth();
  const [reviewRecords, setReviewRecords] = useState<ReviewRecord[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [justification, setJustification] = useState('');

  const loadData = useCallback(async () => {
    if (!user) return;

    // Get professor's sessions
    const { data: sessions } = await supabase
      .from('attendance_sessions')
      .select('id, class_id, subject_id')
      .eq('professor_user_id', user.id);

    if (!sessions || sessions.length === 0) {
      setLoading(false);
      return;
    }

    const sessionIds = sessions.map(s => s.id);
    const classIds = [...new Set(sessions.map(s => s.class_id))];
    const subjectIds = [...new Set(sessions.map(s => s.subject_id))];

    // Fetch all records for these sessions
    const { data: records } = await supabase
      .from('attendance_records')
      .select('id, session_id, student_id, final_status, needs_review, review_reason, device_fingerprint, registered_at, geo_lat, geo_lng, geo_ok, selfie_path, signature_path, ip_address, user_agent')
      .in('session_id', sessionIds);

    if (!records || records.length === 0) {
      setLoading(false);
      return;
    }

    // Fetch student, class, subject names
    const studentIds = [...new Set(records.map(r => r.student_id))];
    const [studentsRes, classesRes, subjectsRes] = await Promise.all([
      supabase.from('students').select('id, name, enrollment').in('id', studentIds),
      supabase.from('classes').select('id, code').in('id', classIds),
      supabase.from('subjects').select('id, name').in('id', subjectIds),
    ]);

    const studentMap = Object.fromEntries((studentsRes.data || []).map((s: any) => [s.id, s]));
    const classMap = Object.fromEntries((classesRes.data || []).map((c: any) => [c.id, c.code]));
    const subjectMap = Object.fromEntries((subjectsRes.data || []).map((s: any) => [s.id, s.name]));
    const sessionMap = Object.fromEntries(sessions.map(s => [s.id, s]));

    const enriched: ReviewRecord[] = records.map(r => {
      const session = sessionMap[r.session_id];
      const student = studentMap[r.student_id];
      return {
        ...r,
        studentName: student?.name || '—',
        studentEnrollment: student?.enrollment || '—',
        className: session ? classMap[session.class_id] || '—' : '—',
        subjectName: session ? subjectMap[session.subject_id] || '—' : '—',
      };
    });

    // Filter needs_review
    const pending = enriched.filter(r => r.needs_review);
    setReviewRecords(pending);

    // Detect duplicate fingerprints per session
    const fingerprintGroups = new Map<string, ReviewRecord[]>();
    enriched.forEach(r => {
      if (!r.device_fingerprint) return;
      const key = `${r.session_id}::${r.device_fingerprint}`;
      if (!fingerprintGroups.has(key)) fingerprintGroups.set(key, []);
      fingerprintGroups.get(key)!.push(r);
    });

    const dupeGroups: DuplicateGroup[] = [];
    fingerprintGroups.forEach((recs, key) => {
      if (recs.length > 1) {
        const [sessionId, fingerprint] = key.split('::');
        const session = sessionMap[sessionId];
        dupeGroups.push({
          fingerprint,
          sessionId,
          records: recs,
          className: session ? classMap[session.class_id] : undefined,
          subjectName: session ? subjectMap[session.subject_id] : undefined,
        });
      }
    });
    setDuplicates(dupeGroups);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  async function approveRecord(recordId: string) {
    setProcessing(recordId);
    const { error } = await supabase
      .from('attendance_records')
      .update({ final_status: 'PRESENTE', needs_review: false } as any)
      .eq('id', recordId);
    setProcessing(null);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ Presença aprovada' });
      loadData();
    }
  }

  async function denyRecord(recordId: string) {
    setProcessing(recordId);
    const { error } = await supabase
      .from('attendance_records')
      .update({ final_status: 'FALTA', needs_review: false } as any)
      .eq('id', recordId);
    setProcessing(null);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '❌ Presença indeferida' });
      setJustification('');
      loadData();
    }
  }

  if (loading) return null;
  if (reviewRecords.length === 0 && duplicates.length === 0) return null;

  const displayed = showAll ? reviewRecords : reviewRecords.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* ── ALERTAS DE FINGERPRINT DUPLICADO ── */}
      {duplicates.length > 0 && (
        <div className="rounded-xl border-2 border-destructive/40 bg-destructive/5 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Fingerprint className="w-5 h-5 text-destructive" />
            <h3 className="font-semibold text-foreground text-sm">
              Alertas de Dispositivo Duplicado
            </h3>
            <Badge variant="destructive" className="text-xs">{duplicates.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Os seguintes alunos registraram presença a partir do mesmo dispositivo na mesma aula.
          </p>
          <div className="space-y-3">
            {duplicates.map((group, idx) => (
              <div key={idx} className="rounded-lg border border-destructive/20 bg-card p-3">
                <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                  <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                  <span>{group.className} · {group.subjectName}</span>
                  <Badge variant="outline" className="text-xs border-destructive/30 text-destructive ml-auto">
                    {group.records.length} registros
                  </Badge>
                </div>
                <div className="space-y-1">
                  {group.records.map(r => (
                    <div key={r.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{r.studentName}</span>
                        <span className="text-xs text-muted-foreground">{r.studentEnrollment}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={r.final_status === 'PRESENTE' ? 'default' : 'secondary'} className="text-xs">
                          {r.final_status}
                        </Badge>
                        {r.selfie_path && <Camera className="w-3 h-3 text-muted-foreground" />}
                        {r.geo_ok && <MapPin className="w-3 h-3 text-success" />}
                        {r.geo_ok === false && <MapPin className="w-3 h-3 text-destructive" />}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-muted-foreground mt-2 font-mono truncate">
                  FP: {group.fingerprint.slice(0, 16)}...
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── REGISTROS PENDENTES DE REVISÃO ── */}
      {reviewRecords.length > 0 && (
        <div className="rounded-xl border-2 border-warning/40 bg-warning/5 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <h3 className="font-semibold text-foreground text-sm">
              Registros Pendentes de Revisão
            </h3>
            <Badge className="text-xs bg-warning text-warning-foreground">{reviewRecords.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Estes registros não puderam ser validados automaticamente e precisam da sua análise.
          </p>
          <div className="space-y-3">
            {displayed.map(record => (
              <div key={record.id} className="rounded-lg border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-foreground text-sm">{record.studentName}</p>
                    <p className="text-xs text-muted-foreground">
                      {record.studentEnrollment} · {record.className} · {record.subjectName}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs border-warning text-warning">
                    Pendente
                  </Badge>
                </div>

                {/* Motivos */}
                {record.review_reason && (
                  <div className="rounded-md bg-muted/50 px-3 py-2 mb-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Motivos:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {record.review_reason.split(';').map((reason, i) => (
                        <Badge key={i} variant="secondary" className="text-[10px]">
                          {reason.trim().includes('Selfie') && <Camera className="w-2.5 h-2.5 mr-0.5" />}
                          {reason.trim().includes('eolocalização') && <MapPin className="w-2.5 h-2.5 mr-0.5" />}
                          {reason.trim().includes('Assinatura') && <PenTool className="w-2.5 h-2.5 mr-0.5" />}
                          {reason.trim()}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Evidências disponíveis */}
                <div className="flex gap-2 flex-wrap mb-3">
                  {record.selfie_path ? (
                    <Badge variant="outline" className="text-xs text-success border-success/30">
                      <Camera className="w-3 h-3 mr-1" /> Selfie ✓
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
                      <Camera className="w-3 h-3 mr-1" /> Sem selfie
                    </Badge>
                  )}
                  {record.geo_ok === true ? (
                    <Badge variant="outline" className="text-xs text-success border-success/30">
                      <MapPin className="w-3 h-3 mr-1" /> Geo ✓
                    </Badge>
                  ) : record.geo_lat ? (
                    <Badge variant="outline" className="text-xs text-destructive border-destructive/30">
                      <MapPin className="w-3 h-3 mr-1" /> Fora da área
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3 mr-1" /> Sem geo
                    </Badge>
                  )}
                  {record.signature_path ? (
                    <Badge variant="outline" className="text-xs text-success border-success/30">
                      <PenTool className="w-3 h-3 mr-1" /> Assinatura ✓
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      <PenTool className="w-3 h-3 mr-1" /> Sem assinatura
                    </Badge>
                  )}
                  {record.device_fingerprint && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      <Fingerprint className="w-3 h-3 mr-1" /> {record.device_fingerprint.slice(0, 8)}...
                    </Badge>
                  )}
                </div>

                {/* Ações */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 text-xs"
                    disabled={processing === record.id}
                    onClick={() => approveRecord(record.id)}
                  >
                    {processing === record.id
                      ? <Loader2 className="w-3 h-3 animate-spin mr-1" />
                      : <CheckCircle2 className="w-3 h-3 mr-1" />}
                    Aprovar Presença
                  </Button>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 text-xs"
                        disabled={processing === record.id}
                      >
                        <XCircle className="w-3 h-3 mr-1" /> Indeferir
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Indeferir presença de {record.studentName}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          O registro ficará como <strong>FALTA</strong>. O aluno poderá solicitar revisão posterior via coordenação.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive hover:bg-destructive/90"
                          onClick={() => denyRecord(record.id)}
                        >
                          Confirmar indeferimento
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>

          {reviewRecords.length > 5 && (
            <div className="flex justify-center mt-3">
              <Button variant="ghost" size="sm" className="text-xs gap-1.5" onClick={() => setShowAll(p => !p)}>
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', showAll && 'rotate-180')} />
                {showAll ? 'Mostrar menos' : `Ver mais ${reviewRecords.length - 5} registros`}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
