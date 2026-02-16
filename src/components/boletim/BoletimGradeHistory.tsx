import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, History } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface GradeHistoryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollmentIds: string[];
  studentName?: string;
}

interface LogEntry {
  id: string;
  enrollment_id: string;
  grade_type: string;
  old_value: number | null;
  new_value: number;
  action: string;
  changed_by_user_id: string;
  changed_at: string;
  changed_by_name?: string;
}

export function BoletimGradeHistory({ open, onOpenChange, enrollmentIds, studentName }: GradeHistoryProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && enrollmentIds.length > 0) {
      loadLogs();
    }
  }, [open, enrollmentIds]);

  async function loadLogs() {
    setLoading(true);
    const { data } = await supabase
      .from('grade_change_logs')
      .select('*')
      .in('enrollment_id', enrollmentIds)
      .order('changed_at', { ascending: false })
      .limit(100);

    const entries = (data as LogEntry[]) || [];

    // Load user names
    const userIds = [...new Set(entries.map(e => e.changed_by_user_id))];
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', userIds);

      const nameMap = new Map((profiles || []).map(p => [p.id, p.name]));
      for (const entry of entries) {
        entry.changed_by_name = nameMap.get(entry.changed_by_user_id) || 'Desconhecido';
      }
    }

    setLogs(entries);
    setLoading(false);
  }

  const actionLabel: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
    INSERT: { label: 'Lançamento', variant: 'default' },
    UPDATE: { label: 'Alteração', variant: 'secondary' },
    DELETE: { label: 'Exclusão', variant: 'destructive' },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Histórico de Alterações {studentName ? `— ${studentName}` : '— Turma'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma alteração registrada.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead className="text-center">Anterior</TableHead>
                <TableHead className="text-center">Novo</TableHead>
                <TableHead>Responsável</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map(log => {
                const act = actionLabel[log.action] || { label: log.action, variant: 'default' as const };
                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(new Date(log.changed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-mono font-medium">{log.grade_type}</TableCell>
                    <TableCell>
                      <Badge variant={act.variant} className="text-xs">
                        {act.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {log.old_value !== null ? Number(log.old_value).toFixed(1) : '—'}
                    </TableCell>
                    <TableCell className="text-center font-medium">
                      {log.action === 'DELETE' ? (
                        <span className="text-destructive line-through">{Number(log.new_value).toFixed(1)}</span>
                      ) : (
                        Number(log.new_value).toFixed(1)
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{log.changed_by_name || '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
