import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import {
  Loader2, CheckCircle2, XCircle, Clock, Save, ShieldCheck, Camera, FileSignature,
  ChevronDown, ChevronUp, MapPin, Smartphone, Globe,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AttendanceRecord {
  id: string;
  student_id: string;
  student_name: string;
  student_enrollment: string;
  final_status: 'PRESENTE' | 'FALTA' | 'JUSTIFICADO';
  source: string | null;
  registered_at: string | null;
  selfie_path: string | null;
  signature_path: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  geo_ok: boolean | null;
  ip_address: string | null;
  user_agent: string | null;
  device_fingerprint: string | null;
  needs_review: boolean;
  review_reason: string | null;
  protocol: string;
}

interface Props {
  sessionId: string;
  lessonTitle: string;
  lessonDate: string;
  className: string;
  subjectName: string;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PRESENTE: { label: 'Presente', color: 'bg-success/10 text-success border-success/30', icon: CheckCircle2 },
  FALTA: { label: 'Falta', color: 'bg-destructive/10 text-destructive border-destructive/30', icon: XCircle },
  JUSTIFICADO: { label: 'Justificado', color: 'bg-warning/10 text-warning border-warning/30', icon: Clock },
};

const SOURCE_LABELS: Record<string, string> = {
  AUTO_ALUNO: 'Automática (Aluno)',
  MANUAL_PROF: 'Manual (Professor)',
  MANUAL_COORD: 'Manual (Coordenador)',
};

export default function ReviewAttendanceModal({ sessionId, lessonTitle, lessonDate, className, subjectName, onClose }: Props) {
  const { user } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Record<string, 'PRESENTE' | 'FALTA' | 'JUSTIFICADO'>>({});
  const [justifications, setJustifications] = useState<Record<string, string>>({});
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [evidenceUrls, setEvidenceUrls] = useState<Record<string, { selfie?: string; signature?: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);

    // Load attendance records with student info
    const { data: sessionData } = await supabase
      .from('attendance_sessions')
      .select('class_id')
      .eq('id', sessionId)
      .single();

    if (!sessionData) { setLoading(false); return; }

    // Load all class students + their records
    const [studentsRes, recordsRes] = await Promise.all([
      supabase
        .from('class_students')
        .select('student_id, students(id, name, enrollment)')
        .eq('class_id', sessionData.class_id)
        .eq('status', 'ATIVO'),
      supabase
        .from('attendance_records')
        .select('id, student_id, final_status, source, registered_at, selfie_path, signature_path, geo_lat, geo_lng, geo_ok, ip_address, user_agent, device_fingerprint, needs_review, review_reason, protocol')
        .eq('session_id', sessionId),
    ]);

    const studentMap = new Map<string, { name: string; enrollment: string }>();
    (studentsRes.data || []).forEach((cs: any) => {
      if (cs.students) studentMap.set(cs.students.id, { name: cs.students.name, enrollment: cs.students.enrollment });
    });

    const recordList: AttendanceRecord[] = (recordsRes.data || []).map((r: any) => {
      const student = studentMap.get(r.student_id);
      return {
        ...r,
        student_name: student?.name || 'Aluno desconhecido',
        student_enrollment: student?.enrollment || '—',
      };
    });

    // Also add students without records (marked as FALTA implicitly)
    studentMap.forEach((info, studentId) => {
      if (!recordList.find(r => r.student_id === studentId)) {
        recordList.push({
          id: `no-record-${studentId}`,
          student_id: studentId,
          student_name: info.name,
          student_enrollment: info.enrollment,
          final_status: 'FALTA',
          source: null,
          registered_at: null,
          selfie_path: null,
          signature_path: null,
          geo_lat: null,
          geo_lng: null,
          geo_ok: null,
          ip_address: null,
          user_agent: null,
          device_fingerprint: null,
          needs_review: false,
          review_reason: null,
          protocol: '—',
        });
      }
    });

    recordList.sort((a, b) => a.student_name.localeCompare(b.student_name));
    setRecords(recordList);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  async function loadEvidence(record: AttendanceRecord) {
    if (evidenceUrls[record.id]) return;
    const urls: { selfie?: string; signature?: string } = {};

    if (record.selfie_path) {
      const { data } = await supabase.storage.from('attendance-evidence').createSignedUrl(record.selfie_path, 300);
      if (data?.signedUrl) urls.selfie = data.signedUrl;
    }
    if (record.signature_path) {
      const { data } = await supabase.storage.from('attendance-evidence').createSignedUrl(record.signature_path, 300);
      if (data?.signedUrl) urls.signature = data.signedUrl;
    }

    setEvidenceUrls(prev => ({ ...prev, [record.id]: urls }));
  }

  function toggleExpand(record: AttendanceRecord) {
    if (expandedId === record.id) {
      setExpandedId(null);
    } else {
      setExpandedId(record.id);
      if (record.selfie_path || record.signature_path) loadEvidence(record);
    }
  }

  function getEffectiveStatus(record: AttendanceRecord) {
    return changes[record.id] ?? record.final_status;
  }

  async function saveChanges() {
    if (!user) return;
    setSaving(true);

    const results: { error: any }[] = [];

    for (const [recordId, newStatus] of Object.entries(changes)) {
      const record = records.find(r => r.id === recordId);
      if (!record) continue;

      if (recordId.startsWith('no-record-')) {
        // Create new record
        const res = await supabase.from('attendance_records').insert({
          session_id: sessionId,
          student_id: record.student_id,
          final_status: newStatus,
          source: 'MANUAL_PROF' as const,
          registered_at: new Date().toISOString(),
        });
        results.push(res);
      } else {
        // Update existing
        const res = await supabase.from('attendance_records').update({ final_status: newStatus }).eq('id', recordId);
        results.push(res);

        // Log adjustment
        const justification = justifications[recordId] || 'Revisão pelo professor';
        await supabase.from('attendance_adjustments').insert({
          record_id: recordId,
          from_status: record.final_status,
          to_status: newStatus,
          changed_by_user_id: user.id,
          changed_by_role: 'professor' as const,
          justification,
        });
      }
    }

    setSaving(false);
    const errors = results.filter(r => r.error);
    if (errors.length > 0) {
      toast({ title: 'Erro ao salvar', description: errors[0].error.message, variant: 'destructive' });
    } else {
      toast({ title: `✅ ${Object.keys(changes).length} registro(s) atualizado(s)` });
      setChanges({});
      setJustifications({});
      await load();
    }
  }

  const hasChanges = Object.keys(changes).length > 0;
  const presentCount = records.filter(r => getEffectiveStatus(r) === 'PRESENTE').length;
  const faltaCount = records.filter(r => getEffectiveStatus(r) === 'FALTA').length;
  const justCount = records.filter(r => getEffectiveStatus(r) === 'JUSTIFICADO').length;

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Revisar Presença
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {lessonTitle} · {className} · {subjectName} · {format(new Date(lessonDate + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="flex flex-wrap gap-2 pb-3 border-b border-border">
              <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full font-medium">{presentCount} presentes</span>
              <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">{faltaCount} faltas</span>
              {justCount > 0 && <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full font-medium">{justCount} justificados</span>}
              <span className="ml-auto text-xs text-muted-foreground">{records.length} aluno(s)</span>
            </div>

            {/* Records */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {records.map(record => {
                const effectiveStatus = getEffectiveStatus(record);
                const isChanged = !!changes[record.id];
                const isExpanded = expandedId === record.id;
                const hasEvidence = record.selfie_path || record.signature_path;
                const sourceLabel = record.source ? (SOURCE_LABELS[record.source] || record.source) : 'Sem registro';

                return (
                  <div key={record.id} className={cn(
                    'rounded-lg border transition-colors',
                    isChanged ? 'border-primary/30 bg-primary/5' : 'border-border bg-card',
                    record.needs_review && 'border-warning/50 bg-warning/5',
                  )}>
                    {/* Main row */}
                    <div className="flex items-center gap-3 px-3 py-2.5">
                      <button onClick={() => toggleExpand(record)} className="text-muted-foreground hover:text-foreground transition-colors">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm text-foreground truncate">{record.student_name}</p>
                          {record.needs_review && (
                            <Badge variant="outline" className="text-[10px] border-warning text-warning">Revisar</Badge>
                          )}
                          {hasEvidence && <Camera className="w-3 h-3 text-muted-foreground" />}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          <span className="font-mono">{record.student_enrollment}</span>
                          <span className="mx-1">·</span>
                          <span>{sourceLabel}</span>
                        </p>
                      </div>

                      {/* Status buttons */}
                      <div className="flex gap-1 shrink-0">
                        {(['PRESENTE', 'FALTA', 'JUSTIFICADO'] as const).map(status => {
                          const cfg = STATUS_LABELS[status];
                          const Icon = cfg.icon;
                          const active = effectiveStatus === status;
                          return (
                            <button
                              key={status}
                              onClick={() => setChanges(prev => ({ ...prev, [record.id]: status }))}
                              className={cn(
                                'flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-all',
                                active ? cfg.color : 'border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/60'
                              )}
                            >
                              <Icon className="w-3 h-3" />
                              <span className="hidden sm:inline">{cfg.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-border/50 space-y-3">
                        {/* Registration details */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Protocolo</p>
                            <p className="font-mono text-foreground">{record.protocol}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Registrado em</p>
                            <p className="text-foreground">
                              {record.registered_at
                                ? format(new Date(record.registered_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })
                                : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Forma de Registro</p>
                            <p className="text-foreground font-medium">{sourceLabel}</p>
                          </div>
                          {record.geo_lat && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-muted-foreground" />
                              <div>
                                <p className="text-muted-foreground">Geolocalização</p>
                                <p className={cn('text-foreground', record.geo_ok ? 'text-success' : 'text-destructive')}>
                                  {record.geo_ok ? '✓ Dentro do raio' : '✗ Fora do raio'}
                                </p>
                              </div>
                            </div>
                          )}
                          {record.ip_address && (
                            <div className="flex items-center gap-1">
                              <Globe className="w-3 h-3 text-muted-foreground" />
                              <div>
                                <p className="text-muted-foreground">IP</p>
                                <p className="font-mono text-foreground">{record.ip_address}</p>
                              </div>
                            </div>
                          )}
                          {record.user_agent && (
                            <div className="flex items-center gap-1">
                              <Smartphone className="w-3 h-3 text-muted-foreground" />
                              <div>
                                <p className="text-muted-foreground">Dispositivo</p>
                                <p className="text-foreground truncate text-[11px]">{record.user_agent.substring(0, 60)}...</p>
                              </div>
                            </div>
                          )}
                        </div>

                        {record.review_reason && (
                          <div className="p-2 rounded bg-warning/10 border border-warning/30 text-xs">
                            <p className="font-semibold text-warning">Motivo para revisão:</p>
                            <p className="text-foreground">{record.review_reason}</p>
                          </div>
                        )}

                        {/* Evidence (selfie + signature) */}
                        {hasEvidence && (
                          <div className="flex gap-4 flex-wrap">
                            {record.selfie_path && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                  <Camera className="w-3 h-3" /> Selfie
                                </p>
                                {evidenceUrls[record.id]?.selfie ? (
                                  <img
                                    src={evidenceUrls[record.id].selfie}
                                    alt="Selfie do aluno"
                                    className="w-28 h-28 object-cover rounded-lg border border-border"
                                  />
                                ) : (
                                  <div className="w-28 h-28 rounded-lg border border-border bg-muted/30 flex items-center justify-center">
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                            )}
                            {record.signature_path && (
                              <div>
                                <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                                  <FileSignature className="w-3 h-3" /> Assinatura
                                </p>
                                {evidenceUrls[record.id]?.signature ? (
                                  <img
                                    src={evidenceUrls[record.id].signature}
                                    alt="Assinatura do aluno"
                                    className="w-40 h-20 object-contain rounded-lg border border-border bg-white"
                                  />
                                ) : (
                                  <div className="w-40 h-20 rounded-lg border border-border bg-muted/30 flex items-center justify-center">
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Justification for changes */}
                        {isChanged && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Justificativa da alteração</p>
                            <Textarea
                              value={justifications[record.id] || ''}
                              onChange={e => setJustifications(prev => ({ ...prev, [record.id]: e.target.value }))}
                              placeholder="Informe o motivo da alteração..."
                              className="h-16 text-xs"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center pt-3 border-t border-border gap-2">
              <Button variant="outline" onClick={onClose}>Fechar</Button>
              <Button onClick={saveChanges} disabled={saving || !hasChanges} className="gap-2">
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                  : <><Save className="w-4 h-4" /> Salvar Revisão {hasChanges ? `(${Object.keys(changes).length})` : ''}</>}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
