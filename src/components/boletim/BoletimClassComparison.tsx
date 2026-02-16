import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, BarChart3, TrendingUp, TrendingDown, Users, Medal } from 'lucide-react';

interface ClassComparisonProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ClassStats {
  classSubjectId: string;
  classCode: string;
  subjectName: string;
  professorName: string;
  totalStudents: number;
  avgGrade: number | null;
  avgAttendance: number | null;
  approvedCount: number;
  failedCount: number;
  atRiskCount: number;
  minGrade: number;
  minAttendance: number;
}

export function BoletimClassComparison({ open, onOpenChange }: ClassComparisonProps) {
  const { user, hasRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<ClassStats[]>([]);
  const [sortBy, setSortBy] = useState<'avg_desc' | 'avg_asc' | 'att_desc' | 'att_asc' | 'risk_desc'>('avg_desc');

  const isSuperAdmin = hasRole('super_admin');
  const isAdminRole = hasRole('admin');
  const isDiretor = hasRole('diretor');
  const isGerente = hasRole('gerente');
  const isCoordenador = hasRole('coordenador');

  useEffect(() => {
    if (open) loadComparison();
  }, [open]);

  async function loadComparison() {
    setLoading(true);
    try {
      // Get class_subjects with scoping
      let classSubjectQuery = supabase
        .from('class_subjects')
        .select('id, class_id, subject_id, professor_user_id, status, grades_closed, class:classes(id, code, course_id, status), subject:subjects(id, name, code, min_grade, min_attendance_pct)')
        .eq('status', 'ATIVO');

      // Apply role-based scoping
      if (isCoordenador && !isAdminRole && !isSuperAdmin) {
        const { data: coordCourses } = await supabase
          .from('courses').select('id').eq('coordinator_user_id', user!.id);
        const courseIds = (coordCourses || []).map(c => c.id);
        if (courseIds.length > 0) {
          const { data: classes } = await supabase.from('classes').select('id').in('course_id', courseIds);
          const classIds = (classes || []).map(c => c.id);
          if (classIds.length > 0) classSubjectQuery = classSubjectQuery.in('class_id', classIds);
          else { setStats([]); setLoading(false); return; }
        } else { setStats([]); setLoading(false); return; }
      } else if (isGerente && !isAdminRole && !isSuperAdmin) {
        const { data: userUnits } = await supabase.from('user_units').select('unit_id').eq('user_id', user!.id);
        const unitIds = (userUnits || []).map(u => u.unit_id);
        if (unitIds.length > 0) {
          const { data: unitCourses } = await supabase.from('courses').select('id').in('unit_id', unitIds);
          const courseIds = (unitCourses || []).map(c => c.id);
          if (courseIds.length > 0) {
            const { data: classes } = await supabase.from('classes').select('id').in('course_id', courseIds);
            const classIds = (classes || []).map(c => c.id);
            if (classIds.length > 0) classSubjectQuery = classSubjectQuery.in('class_id', classIds);
            else { setStats([]); setLoading(false); return; }
          } else { setStats([]); setLoading(false); return; }
        } else { setStats([]); setLoading(false); return; }
      } else if (isDiretor && !isAdminRole && !isSuperAdmin) {
        const { data: userCampuses } = await supabase.from('user_campuses').select('campus_id').eq('user_id', user!.id);
        const campusIds = (userCampuses || []).map(c => c.campus_id);
        if (campusIds.length > 0) {
          const { data: units } = await supabase.from('units').select('id').in('campus_id', campusIds);
          const unitIds = (units || []).map(u => u.id);
          if (unitIds.length > 0) {
            const { data: campusCourses } = await supabase.from('courses').select('id').in('unit_id', unitIds);
            const courseIds = (campusCourses || []).map(c => c.id);
            if (courseIds.length > 0) {
              const { data: classes } = await supabase.from('classes').select('id').in('course_id', courseIds);
              const classIds = (classes || []).map(c => c.id);
              if (classIds.length > 0) classSubjectQuery = classSubjectQuery.in('class_id', classIds);
              else { setStats([]); setLoading(false); return; }
            } else { setStats([]); setLoading(false); return; }
          } else { setStats([]); setLoading(false); return; }
        } else { setStats([]); setLoading(false); return; }
      }

      const { data: classSubjects } = await classSubjectQuery.order('class_id');
      if (!classSubjects || classSubjects.length === 0) {
        setStats([]);
        setLoading(false);
        return;
      }

      // Get professor names
      const profIds = [...new Set(classSubjects.map(cs => cs.professor_user_id))];
      const { data: profiles } = await supabase
        .from('profiles').select('id, name').in('id', profIds);
      const profMap = new Map((profiles || []).map(p => [p.id, p.name]));

      // Build stats for each class_subject
      const allStats: ClassStats[] = [];

      for (const cs of classSubjects) {
        const cls = cs.class as any;
        const subj = cs.subject as any;
        if (!cls || !subj) continue;

        const minGrade = Number(subj.min_grade ?? 7.0);
        const minAtt = Number(subj.min_attendance_pct ?? 75.0);

        // Get students in class
        const { data: classStudents } = await supabase
          .from('class_students').select('student_id')
          .eq('class_id', cs.class_id).eq('status', 'ATIVO');
        const studentIds = (classStudents || []).map(s => s.student_id);
        if (studentIds.length === 0) continue;

        // Get enrollments
        const { data: enrollments } = await supabase
          .from('student_subject_enrollments')
          .select('id, student_id, status')
          .eq('subject_id', cs.subject_id)
          .in('student_id', studentIds);
        if (!enrollments || enrollments.length === 0) continue;

        // Get grades
        const enrollIds = enrollments.map(e => e.id);
        const { data: grades } = await supabase
          .from('student_grades').select('enrollment_id, grade_value, counts_in_final, weight')
          .in('enrollment_id', enrollIds);

        // Get attendance
        const { data: sessions } = await supabase
          .from('attendance_sessions').select('id')
          .eq('class_id', cs.class_id).eq('subject_id', cs.subject_id)
          .in('status', ['ENCERRADA', 'AUDITORIA_FINALIZADA']);
        const sessionIds = (sessions || []).map(s => s.id);
        const totalSessions = sessionIds.length;

        let attendanceRecords: any[] = [];
        if (totalSessions > 0) {
          const { data: records } = await supabase
            .from('attendance_records').select('student_id, final_status')
            .in('session_id', sessionIds).in('student_id', studentIds);
          attendanceRecords = records || [];
        }

        // Calculate averages
        const studentAvgs: number[] = [];
        const studentAtts: number[] = [];
        let approved = 0, failed = 0, atRisk = 0;

        for (const enr of enrollments) {
          const studentGrades = (grades || []).filter(g => g.enrollment_id === enr.id && g.counts_in_final !== false);
          if (studentGrades.length > 0) {
            const totalWeight = studentGrades.reduce((a, g) => a + (g.weight || 1), 0);
            const weightedSum = studentGrades.reduce((a, g) => a + g.grade_value * (g.weight || 1), 0);
            const avg = totalWeight > 0 ? weightedSum / totalWeight : 0;
            studentAvgs.push(avg);

            if (enr.status === 'APROVADO') approved++;
            else if (enr.status === 'REPROVADO') failed++;
            if (avg < minGrade) atRisk++;
          }

          if (totalSessions > 0) {
            const present = attendanceRecords.filter(r => r.student_id === enr.student_id && r.final_status === 'PRESENTE').length;
            const pct = (present / totalSessions) * 100;
            studentAtts.push(pct);
            if (pct < minAtt && !studentAvgs.some(a => a < minGrade)) atRisk++;
          }
        }

        const classAvg = studentAvgs.length > 0 ? studentAvgs.reduce((a, b) => a + b, 0) / studentAvgs.length : null;
        const classAtt = studentAtts.length > 0 ? studentAtts.reduce((a, b) => a + b, 0) / studentAtts.length : null;

        allStats.push({
          classSubjectId: cs.id,
          classCode: cls.code,
          subjectName: subj.name,
          professorName: profMap.get(cs.professor_user_id) || '—',
          totalStudents: enrollments.length,
          avgGrade: classAvg,
          avgAttendance: classAtt,
          approvedCount: approved,
          failedCount: failed,
          atRiskCount: atRisk,
          minGrade,
          minAttendance: minAtt,
        });
      }

      setStats(allStats);
    } catch (err) {
      console.error('Error loading comparison:', err);
    }
    setLoading(false);
  }

  const sorted = useMemo(() => {
    const arr = [...stats];
    arr.sort((a, b) => {
      switch (sortBy) {
        case 'avg_desc': return (b.avgGrade ?? -1) - (a.avgGrade ?? -1);
        case 'avg_asc': return (a.avgGrade ?? 999) - (b.avgGrade ?? 999);
        case 'att_desc': return (b.avgAttendance ?? -1) - (a.avgAttendance ?? -1);
        case 'att_asc': return (a.avgAttendance ?? 999) - (b.avgAttendance ?? 999);
        case 'risk_desc': return b.atRiskCount - a.atRiskCount;
        default: return 0;
      }
    });
    return arr;
  }, [stats, sortBy]);

  const bestAvg = useMemo(() => {
    const withAvg = stats.filter(s => s.avgGrade !== null);
    return withAvg.length > 0 ? withAvg.reduce((best, s) => (s.avgGrade! > (best.avgGrade ?? 0) ? s : best)) : null;
  }, [stats]);

  const globalAvg = useMemo(() => {
    const avgs = stats.filter(s => s.avgGrade !== null).map(s => s.avgGrade!);
    return avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
  }, [stats]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            Comparativo entre Turmas
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : stats.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma turma com dados disponíveis para comparação.
          </p>
        ) : (
          <div className="space-y-6">
            {/* Global summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border p-3 bg-primary/5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Turmas</p>
                <p className="text-xl font-bold text-primary">{stats.length}</p>
              </div>
              <div className="rounded-lg border border-border p-3 bg-primary/5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Média Geral</p>
                <p className="text-xl font-bold text-primary">{globalAvg !== null ? globalAvg.toFixed(2) : '—'}</p>
              </div>
              <div className="rounded-lg border border-border p-3 bg-primary/5">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Alunos</p>
                <p className="text-xl font-bold text-primary">{stats.reduce((a, s) => a + s.totalStudents, 0)}</p>
              </div>
              {bestAvg && (
                <div className="rounded-lg border border-border p-3 bg-primary/5">
                  <div className="flex items-center gap-1 mb-1">
                    <Medal className="w-3 h-3 text-primary" />
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Melhor Turma</p>
                  </div>
                  <p className="text-sm font-bold text-primary truncate">{bestAvg.classCode}</p>
                  <p className="text-xs text-muted-foreground">{bestAvg.avgGrade?.toFixed(2)}</p>
                </div>
              )}
            </div>

            {/* Sort controls */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground self-center mr-1">Ordenar:</span>
              {[
                { key: 'avg_desc', label: '↓ Maior Média' },
                { key: 'avg_asc', label: '↑ Menor Média' },
                { key: 'att_desc', label: '↓ Maior Freq.' },
                { key: 'risk_desc', label: '↓ Mais em Risco' },
              ].map(opt => (
                <Button
                  key={opt.key}
                  variant={sortBy === opt.key ? 'default' : 'outline'}
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setSortBy(opt.key as any)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>

            {/* Ranking cards */}
            <div className="space-y-3">
              {sorted.map((s, idx) => {
                const isTop = bestAvg?.classSubjectId === s.classSubjectId;
                const gradeColor = s.avgGrade !== null
                  ? s.avgGrade >= s.minGrade ? 'text-primary' : 'text-destructive'
                  : 'text-muted-foreground';
                const attColor = s.avgAttendance !== null
                  ? s.avgAttendance >= s.minAttendance ? 'text-primary' : 'text-destructive'
                  : 'text-muted-foreground';
                const gradePct = s.avgGrade !== null ? Math.min((s.avgGrade / 10) * 100, 100) : 0;
                const attPct = s.avgAttendance ?? 0;

                return (
                  <div
                    key={s.classSubjectId}
                    className={`rounded-lg border p-4 transition-colors ${isTop ? 'border-primary/40 bg-primary/5' : 'border-border bg-card'}`}
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold shrink-0 ${idx === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-foreground">{s.classCode}</span>
                            {isTop && <Badge variant="default" className="text-xs gap-1"><Medal className="w-3 h-3" /> Top</Badge>}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{s.subjectName}</p>
                          <p className="text-xs text-muted-foreground">Prof. {s.professorName}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm shrink-0">
                        <div className="flex items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">{s.totalStudents}</span>
                        </div>
                        {s.atRiskCount > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {s.atRiskCount} em risco
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-4">
                      {/* Grade bar */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            {s.avgGrade !== null && s.avgGrade >= s.minGrade
                              ? <TrendingUp className="w-3 h-3 text-primary" />
                              : <TrendingDown className="w-3 h-3 text-destructive" />
                            }
                            Média
                          </span>
                          <span className={`text-sm font-bold ${gradeColor}`}>
                            {s.avgGrade !== null ? s.avgGrade.toFixed(2) : '—'}
                          </span>
                        </div>
                        <Progress value={gradePct} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-0.5">Mín: {s.minGrade.toFixed(1)}</p>
                      </div>

                      {/* Attendance bar */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Frequência</span>
                          <span className={`text-sm font-bold ${attColor}`}>
                            {s.avgAttendance !== null ? `${s.avgAttendance.toFixed(0)}%` : '—'}
                          </span>
                        </div>
                        <Progress value={attPct} className="h-2" />
                        <p className="text-xs text-muted-foreground mt-0.5">Mín: {s.minAttendance.toFixed(0)}%</p>
                      </div>
                    </div>

                    {/* Approved/Failed counts */}
                    {(s.approvedCount > 0 || s.failedCount > 0) && (
                      <div className="flex items-center gap-3 mt-3 text-xs">
                        {s.approvedCount > 0 && (
                          <span className="text-primary font-medium">✓ {s.approvedCount} aprovados</span>
                        )}
                        {s.failedCount > 0 && (
                          <span className="text-destructive font-medium">✗ {s.failedCount} reprovados</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
