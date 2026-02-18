import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Loader2, Save, ListOrdered, CheckCircle2, AlertCircle } from 'lucide-react';

interface TemplateItem {
  id: string;
  name: string;
  category: string;
  weight: number;
  counts_in_final: boolean;
  parent_item_id: string | null;
  order_index: number;
}

interface EnrollmentWithStudent {
  id: string;
  student_id: string;
  student: { id: string; name: string; enrollment: string };
}

interface BatchStudentRow {
  enrollmentId: string;
  studentName: string;
  studentEnrollment: string;
  gradeValue: string;
  existingGradeId?: string;
  saved?: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  classSubjectId: string;
  classSubjectLabel: string;
  enrollments: EnrollmentWithStudent[];
  templateItems: TemplateItem[];
  existingGrades: { id: string; enrollment_id: string; grade_type: string; grade_value: number }[];
  onSaved: () => void;
  gradesClosed: boolean;
}

const categoryLabel = (cat: string) => {
  const map: Record<string, string> = {
    prova: 'Prova',
    trabalho: 'Trabalho',
    media: 'Média',
    ponto_extra: 'Ponto Extra',
  };
  return map[cat] || cat;
};

export function BoletimBatchEntry({
  open,
  onClose,
  classSubjectId,
  classSubjectLabel,
  enrollments,
  templateItems,
  existingGrades,
  onSaved,
  gradesClosed,
}: Props) {
  const { user } = useAuth();
  const [selectedGradeType, setSelectedGradeType] = useState('');
  const [rows, setRows] = useState<BatchStudentRow[]>([]);
  const [saving, setSaving] = useState(false);

  // Leaf items = directly editable items (children or parents without children)
  const leafItems = templateItems.filter(t => {
    if (t.parent_item_id) return true; // child item → directly editable
    if (t.counts_in_final) {
      const hasChildren = templateItems.some(c => c.parent_item_id === t.id);
      return !hasChildren; // parent with no children → directly editable
    }
    return false;
  });

  // If no template, allow free-form grade type
  const hasTemplate = templateItems.length > 0;

  useEffect(() => {
    if (!open) return;
    // Reset selection when opening
    setSelectedGradeType(leafItems[0]?.name || '');
  }, [open]);

  useEffect(() => {
    if (!selectedGradeType) return;
    const newRows: BatchStudentRow[] = enrollments
      .slice()
      .sort((a, b) => a.student.name.localeCompare(b.student.name))
      .map(e => {
        const existing = existingGrades.find(
          g => g.enrollment_id === e.id && g.grade_type.toUpperCase() === selectedGradeType.toUpperCase()
        );
        return {
          enrollmentId: e.id,
          studentName: e.student.name,
          studentEnrollment: e.student.enrollment,
          gradeValue: existing ? String(existing.grade_value) : '',
          existingGradeId: existing?.id,
        };
      });
    setRows(newRows);
  }, [selectedGradeType, enrollments, existingGrades]);

  function updateRowValue(idx: number, value: string) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, gradeValue: value, saved: undefined } : r));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, idx: number) {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const next = document.getElementById(`batch-grade-${idx + 1}`);
      if (next) (next as HTMLInputElement).focus();
    }
  }

  const selectedTemplate = templateItems.find(t => t.name.toUpperCase() === selectedGradeType.toUpperCase());
  const weight = selectedTemplate?.weight ?? 1;
  const category = selectedTemplate?.category ?? 'prova';
  const countsInFinal = selectedTemplate?.counts_in_final ?? true;

  async function handleSaveAll() {
    if (!user || !selectedGradeType) return;
    setSaving(true);

    const rowsToSave = rows.filter(r => r.gradeValue.trim() !== '');
    let errorCount = 0;
    const updatedRows = [...rows];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.gradeValue.trim()) continue;

      const numVal = parseFloat(row.gradeValue);
      if (isNaN(numVal) || numVal < 0 || numVal > 10) {
        toast({ title: `Nota inválida para ${row.studentName} (0-10)`, variant: 'destructive' });
        errorCount++;
        continue;
      }

      const payload = {
        enrollment_id: row.enrollmentId,
        grade_type: selectedGradeType.trim().toUpperCase(),
        grade_category: category,
        grade_value: numVal,
        weight,
        counts_in_final: countsInFinal,
        professor_user_id: user.id,
        observations: null,
      };

      if (row.existingGradeId) {
        const { error } = await supabase
          .from('student_grades')
          .update(payload)
          .eq('id', row.existingGradeId);
        if (error) {
          errorCount++;
          console.error('Update error:', error);
        } else {
          updatedRows[i] = { ...row, saved: true };
        }
      } else {
        const { data, error } = await supabase
          .from('student_grades')
          .insert(payload)
          .select('id')
          .single();
        if (error) {
          errorCount++;
          console.error('Insert error:', error);
        } else {
          updatedRows[i] = { ...row, existingGradeId: data?.id, saved: true };
        }
      }
    }

    setRows(updatedRows);
    setSaving(false);

    if (errorCount === 0) {
      toast({
        title: `Notas "${selectedGradeType}" salvas!`,
        description: `${rowsToSave.length} nota(s) lançada(s) com sucesso.`,
      });
      onSaved();
    } else {
      toast({
        title: `${rowsToSave.length - errorCount} notas salvas, ${errorCount} erro(s)`,
        description: 'Verifique se o boletim está aberto e você tem permissão.',
        variant: 'destructive',
      });
    }
  }

  const filledCount = rows.filter(r => r.gradeValue.trim() !== '').length;
  const pendingCount = rows.length - filledCount;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ListOrdered className="w-5 h-5 text-primary" />
            Lançamento em Lote
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{classSubjectLabel}</p>
        </DialogHeader>

        {gradesClosed && (
          <div className="flex items-center gap-2 p-3 rounded-md border border-destructive/30 bg-destructive/5">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
            <p className="text-sm text-destructive">Boletim fechado — lançamento bloqueado.</p>
          </div>
        )}

        <div className="flex items-end gap-3 shrink-0">
          <div className="flex-1">
            <Label className="text-xs mb-1 block">Tipo de Nota</Label>
            {hasTemplate ? (
              <Select value={selectedGradeType} onValueChange={setSelectedGradeType} disabled={gradesClosed}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {leafItems.map(t => (
                    <SelectItem key={t.id} value={t.name}>
                      {t.name}
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({categoryLabel(t.category)}, p{t.weight})
                        {!t.counts_in_final && ' — critério'}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                placeholder="Ex: N1, T1, P1..."
                value={selectedGradeType}
                onChange={e => setSelectedGradeType(e.target.value.toUpperCase())}
                disabled={gradesClosed}
              />
            )}
          </div>
          {selectedGradeType && (
            <div className="flex gap-2 shrink-0">
              <Badge variant="outline" className="text-xs h-9 px-3">
                {filledCount}/{rows.length} preenchidas
              </Badge>
              {pendingCount > 0 && (
                <Badge variant="secondary" className="text-xs h-9 px-3">
                  {pendingCount} pendentes
                </Badge>
              )}
            </div>
          )}
        </div>

        {selectedGradeType && rows.length > 0 && (
          <div className="flex-1 overflow-y-auto -mx-6 px-6">
            <div className="sticky top-0 bg-background z-10 py-2 grid grid-cols-[40px_1fr_120px_90px_40px] gap-2 text-xs font-semibold text-muted-foreground border-b border-border pb-2 mb-1">
              <span className="text-center">#</span>
              <span>Aluno</span>
              <span>Matrícula</span>
              <span className="text-center">Nota (0-10)</span>
              <span></span>
            </div>

            <div className="space-y-1 py-1">
              {rows.map((row, idx) => (
                <div
                  key={row.enrollmentId}
                  className={`grid grid-cols-[40px_1fr_120px_90px_40px] gap-2 items-center px-1 py-1.5 rounded-md transition-colors ${
                    row.saved ? 'bg-primary/5' : 'hover:bg-muted/30'
                  }`}
                >
                  <span className="text-center text-xs text-muted-foreground font-mono">{idx + 1}</span>
                  <span className="text-sm font-medium truncate" title={row.studentName}>
                    {row.studentName}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">{row.studentEnrollment}</span>
                  <Input
                    id={`batch-grade-${idx}`}
                    type="number"
                    min="0"
                    max="10"
                    step="0.1"
                    placeholder="—"
                    value={row.gradeValue}
                    onChange={e => updateRowValue(idx, e.target.value)}
                    onKeyDown={e => handleKeyDown(e, idx)}
                    disabled={gradesClosed || saving}
                    className={`text-center h-8 text-sm ${
                      row.gradeValue && (parseFloat(row.gradeValue) < 0 || parseFloat(row.gradeValue) > 10)
                        ? 'border-destructive'
                        : ''
                    }`}
                  />
                  <div className="flex justify-center">
                    {row.saved ? (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    ) : row.existingGradeId ? (
                      <span className="text-xs text-muted-foreground/50">✎</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!selectedGradeType && (
          <div className="flex-1 flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">Selecione o tipo de nota para começar o lançamento.</p>
          </div>
        )}

        <DialogFooter className="shrink-0 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground mr-auto">
            Use <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Enter</kbd> ou{' '}
            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Tab</kbd> para avançar entre alunos
          </p>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={handleSaveAll}
            disabled={saving || !selectedGradeType || filledCount === 0 || gradesClosed}
          >
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar {filledCount > 0 ? `${filledCount} nota(s)` : 'Notas'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
