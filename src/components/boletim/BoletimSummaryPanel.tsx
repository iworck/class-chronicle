import { Users, TrendingUp, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';

interface SummaryPanelProps {
  enrollments: { id: string; status: string; student_id: string }[];
  getWeightedAverage: (enrollmentId: string) => number | null;
  getAttendancePct: (studentId: string) => number | null;
  minGrade: number;
  minAttendance: number;
  gradesClosed: boolean;
  getDisplayStatus: (enrollment: any) => string;
}

export function BoletimSummaryPanel({
  enrollments,
  getWeightedAverage,
  getAttendancePct,
  minGrade,
  minAttendance,
  gradesClosed,
  getDisplayStatus,
}: SummaryPanelProps) {
  const total = enrollments.length;
  if (total === 0) return null;

  const statuses = enrollments.map(e => getDisplayStatus(e));
  const aprovados = statuses.filter(s => s === 'APROVADO').length;
  const reprovados = statuses.filter(s => s === 'REPROVADO').length;
  const cursando = statuses.filter(s => s === 'CURSANDO').length;

  // Calculate class average
  const avgs = enrollments
    .map(e => getWeightedAverage(e.id))
    .filter((a): a is number => a !== null);
  const classAvg = avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;

  // At-risk students: avg below min or attendance below min
  const atRisk = enrollments.filter(e => {
    const avg = getWeightedAverage(e.id);
    const att = getAttendancePct(e.student_id);
    const avgRisk = avg !== null && avg < minGrade;
    const attRisk = att !== null && att < minAttendance;
    return avgRisk || attRisk;
  });

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
      <StatCard
        icon={<Users className="w-4 h-4" />}
        label="Total Alunos"
        value={String(total)}
        detail={`${cursando} cursando`}
        color="text-primary"
        bgColor="bg-primary/10"
      />
      <StatCard
        icon={<CheckCircle2 className="w-4 h-4" />}
        label="Aprovados"
        value={gradesClosed ? String(aprovados) : '—'}
        detail={gradesClosed ? `${total > 0 ? ((aprovados / total) * 100).toFixed(0) : 0}%` : 'Boletim aberto'}
        color="text-emerald-600 dark:text-emerald-400"
        bgColor="bg-emerald-500/10"
      />
      <StatCard
        icon={<XCircle className="w-4 h-4" />}
        label="Reprovados"
        value={gradesClosed ? String(reprovados) : '—'}
        detail={gradesClosed ? `${total > 0 ? ((reprovados / total) * 100).toFixed(0) : 0}%` : 'Boletim aberto'}
        color="text-destructive"
        bgColor="bg-destructive/10"
      />
      <StatCard
        icon={<TrendingUp className="w-4 h-4" />}
        label="Média da Turma"
        value={classAvg !== null ? classAvg.toFixed(2) : '—'}
        detail={avgs.length > 0 ? `${avgs.length} alunos com nota` : 'Sem notas'}
        color="text-primary"
        bgColor="bg-primary/10"
      />
      <StatCard
        icon={<AlertTriangle className="w-4 h-4" />}
        label="Em Risco"
        value={String(atRisk.length)}
        detail={atRisk.length > 0 ? 'Nota ou frequência baixa' : 'Nenhum aluno'}
        color={atRisk.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}
        bgColor={atRisk.length > 0 ? 'bg-amber-500/10' : 'bg-muted/50'}
        pulse={atRisk.length > 0}
      />
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  detail,
  color,
  bgColor,
  pulse,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  color: string;
  bgColor: string;
  pulse?: boolean;
}) {
  return (
    <div className={`rounded-xl border border-border p-4 ${bgColor} ${pulse ? 'ring-2 ring-amber-500/30' : ''}`}>
      <div className={`flex items-center gap-2 mb-2 ${color}`}>
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{detail}</p>
    </div>
  );
}
