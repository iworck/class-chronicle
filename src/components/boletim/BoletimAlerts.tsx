import { AlertTriangle, TrendingDown, UserX } from 'lucide-react';

interface AlertsProps {
  atRiskStudents: {
    name: string;
    enrollment: string;
    avgRisk: boolean;
    attRisk: boolean;
    avg: number | null;
    attPct: number | null;
  }[];
  minGrade: number;
  minAttendance: number;
}

export function BoletimAlerts({ atRiskStudents, minGrade, minAttendance }: AlertsProps) {
  if (atRiskStudents.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
        <h3 className="text-sm font-bold text-amber-700 dark:text-amber-300">
          ⚠️ Alunos em Situação de Risco ({atRiskStudents.length})
        </h3>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {atRiskStudents.map((s, i) => (
          <div
            key={i}
            className="flex items-start gap-2 p-2 rounded-md bg-amber-500/10 border border-amber-500/20"
          >
            <UserX className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
              <p className="text-xs text-muted-foreground">{s.enrollment}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {s.avgRisk && (
                  <span className="inline-flex items-center gap-1 text-xs text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                    <TrendingDown className="w-3 h-3" />
                    Média {s.avg !== null ? s.avg.toFixed(2) : '—'} {'<'} {minGrade.toFixed(1)}
                  </span>
                )}
                {s.attRisk && (
                  <span className="inline-flex items-center gap-1 text-xs text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                    <UserX className="w-3 h-3" />
                    Freq. {s.attPct !== null ? s.attPct.toFixed(0) : '—'}% {'<'} {minAttendance.toFixed(0)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
