import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle, Clock, Users, Save } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Student {
  id: string;
  name: string;
  enrollment: string;
  recordId: string | null;
  status: 'PRESENTE' | 'FALTA' | 'JUSTIFICADO' | null;
}

interface SessionInfo {
  id: string;
  status: string;
  class_id: string;
  subject_id: string;
  opened_at: string;
}

interface Props {
  sessionId: string;
  onClose: () => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  PRESENTE: { label: 'Presente', color: 'bg-success/10 text-success border-success/30', icon: CheckCircle2 },
  FALTA: { label: 'Falta', color: 'bg-destructive/10 text-destructive border-destructive/30', icon: XCircle },
  JUSTIFICADO: { label: 'Justificado', color: 'bg-warning/10 text-warning border-warning/30', icon: Clock },
};

export default function ManualAttendanceModal({ sessionId, onClose }: Props) {
  const { user } = useAuth();
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Record<string, 'PRESENTE' | 'FALTA' | 'JUSTIFICADO'>>({});

  const load = useCallback(async () => {
    setLoading(true);

    // 1. Load session info
    const { data: sessionData } = await supabase
      .from('attendance_sessions')
      .select('id, status, class_id, subject_id, opened_at')
      .eq('id', sessionId)
      .single();

    if (!sessionData) { setLoading(false); return; }
    setSession(sessionData as SessionInfo);

    // 2. Load students in the class
    const { data: classStudentsData } = await supabase
      .from('class_students')
      .select('student_id, students(id, name, enrollment)')
      .eq('class_id', sessionData.class_id)
      .eq('status', 'ATIVO');

    const rawStudents = (classStudentsData || []).map((cs: any) => cs.students).filter(Boolean);

    // 3. Load existing attendance records for this session
    const { data: records } = await supabase
      .from('attendance_records')
      .select('id, student_id, final_status')
      .eq('session_id', sessionId);

    const recordMap: Record<string, { id: string; status: string }> = {};
    (records || []).forEach((r: any) => {
      recordMap[r.student_id] = { id: r.id, status: r.final_status };
    });

    const studentList: Student[] = rawStudents.map((s: any) => ({
      id: s.id,
      name: s.name,
      enrollment: s.enrollment,
      recordId: recordMap[s.id]?.id || null,
      status: (recordMap[s.id]?.status as any) || null,
    }));

    setStudents(studentList);
    setLoading(false);
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  function setStudentStatus(studentId: string, status: 'PRESENTE' | 'FALTA' | 'JUSTIFICADO') {
    setChanges(prev => ({ ...prev, [studentId]: status }));
  }

  function getEffectiveStatus(student: Student): 'PRESENTE' | 'FALTA' | 'JUSTIFICADO' | null {
    return changes[student.id] ?? student.status;
  }

  async function saveAll() {
    if (!user) return;
    setSaving(true);

    const results: { error: any }[] = [];

    for (const student of students) {
      const newStatus = changes[student.id];
      if (!newStatus) continue;

      if (student.recordId) {
        const res = await supabase
          .from('attendance_records')
          .update({ final_status: newStatus })
          .eq('id', student.recordId);
        results.push(res);
      } else {
        const res = await supabase
          .from('attendance_records')
          .insert({
            session_id: sessionId,
            student_id: student.id,
            final_status: newStatus,
            source: 'MANUAL_PROF' as const,
            registered_at: new Date().toISOString(),
          });
        results.push(res);
      }
    }
    const errors = results.filter(r => r.error);
    setSaving(false);

    if (errors.length > 0) {
      toast({ title: 'Erro ao salvar presenças', description: errors[0].error.message, variant: 'destructive' });
    } else {
      toast({ title: `✅ ${Object.keys(changes).length} presença(s) atualizada(s)` });
      setChanges({});
      await load(); // refresh
    }
  }

  const hasChanges = Object.keys(changes).length > 0;
  const presentCount = students.filter(s => getEffectiveStatus(s) === 'PRESENTE').length;
  const faultCount = students.filter(s => getEffectiveStatus(s) === 'FALTA').length;
  const justifiedCount = students.filter(s => getEffectiveStatus(s) === 'JUSTIFICADO').length;
  const unsetCount = students.filter(s => getEffectiveStatus(s) === null).length;

  return (
    <Dialog open onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Lançamento de Presença Manual
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Session info + summary */}
            <div className="flex flex-wrap gap-3 pb-3 border-b border-border">
              <Badge variant="outline" className={cn('text-xs', session?.status === 'ABERTA' ? 'border-success text-success' : 'border-muted-foreground text-muted-foreground')}>
                {session?.status === 'ABERTA' ? '● Aberta' : '● Encerrada'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                ID: <span className="font-mono font-bold text-foreground">{sessionId.replace(/-/g, '').slice(0, 6).toUpperCase()}</span>
              </span>
              <div className="flex gap-2 ml-auto flex-wrap">
                <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full font-medium">{presentCount} presentes</span>
                <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full font-medium">{faultCount} faltas</span>
                {justifiedCount > 0 && <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full font-medium">{justifiedCount} justificados</span>}
                {unsetCount > 0 && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-medium">{unsetCount} sem registro</span>}
              </div>
            </div>

            {/* Quick actions */}
            <div className="flex gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground self-center">Marcar todos como:</span>
              <Button size="sm" variant="outline" className="h-7 text-xs border-success text-success hover:bg-success/10"
                onClick={() => {
                  const all: Record<string, 'PRESENTE'> = {};
                  students.forEach(s => { all[s.id] = 'PRESENTE'; });
                  setChanges(all);
                }}>
                ✓ Todos Presentes
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs border-destructive text-destructive hover:bg-destructive/10"
                onClick={() => {
                  const all: Record<string, 'FALTA'> = {};
                  students.forEach(s => { all[s.id] = 'FALTA'; });
                  setChanges(all);
                }}>
                ✗ Todos Falta
              </Button>
            </div>

            {/* Student list */}
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
              {students.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Nenhum aluno vinculado a esta turma.
                </div>
              ) : (
                students.map(student => {
                  const effectiveStatus = getEffectiveStatus(student);
                  const isChanged = !!changes[student.id];

                  return (
                    <div
                      key={student.id}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors',
                        isChanged ? 'border-primary/30 bg-primary/3' : 'border-border bg-card'
                      )}
                    >
                      {/* Student info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{student.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{student.enrollment}</p>
                      </div>

                      {/* Status buttons */}
                      <div className="flex gap-1.5 shrink-0">
                        {(['PRESENTE', 'FALTA', 'JUSTIFICADO'] as const).map(status => {
                          const cfg = STATUS_LABELS[status];
                          const Icon = cfg.icon;
                          const active = effectiveStatus === status;
                          return (
                            <button
                              key={status}
                              onClick={() => setStudentStatus(student.id, status)}
                              className={cn(
                                'flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium transition-all',
                                active
                                  ? cfg.color
                                  : 'border-border text-muted-foreground hover:border-primary/40 hover:bg-muted/60'
                              )}
                            >
                              <Icon className="w-3 h-3" />
                              <span className="hidden sm:inline">{cfg.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center pt-3 border-t border-border gap-2">
              <Button variant="outline" onClick={onClose}>Fechar</Button>
              <Button
                onClick={saveAll}
                disabled={saving || !hasChanges}
                className="gap-2"
              >
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
                  : <><Save className="w-4 h-4" /> Salvar {hasChanges ? `(${Object.keys(changes).length})` : ''}</>}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
