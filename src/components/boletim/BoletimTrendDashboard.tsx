import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine, PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, Users, BarChart3 } from 'lucide-react';

interface TrendDashboardProps {
  enrollments: Array<{
    id: string;
    student_id: string;
    status: string;
    student: { id: string; name: string; enrollment: string };
  }>;
  grades: Array<{
    id: string;
    enrollment_id: string;
    grade_type: string;
    grade_value: number;
    grade_category: string;
    weight: number;
    counts_in_final: boolean;
    created_at?: string;
    updated_at?: string;
  }>;
  templateItems: Array<{
    id: string;
    name: string;
    counts_in_final: boolean;
    parent_item_id: string | null;
    order_index: number;
    weight: number;
  }>;
  getWeightedAverage: (enrollmentId: string) => number | null;
  getAttendancePct: (studentId: string) => number | null;
  getDisplayStatus: (enrollment: any) => string;
  minGrade: number;
  minAttendance: number;
}

const CHART_COLORS = {
  primary: 'hsl(var(--primary))',
  secondary: 'hsl(var(--secondary))',
  destructive: 'hsl(var(--destructive))',
  muted: 'hsl(var(--muted-foreground))',
  accent: 'hsl(var(--accent))',
  approved: '#22c55e',
  failed: '#ef4444',
  inProgress: '#3b82f6',
  locked: '#a1a1aa',
};

export function BoletimTrendDashboard({
  enrollments,
  grades,
  templateItems,
  getWeightedAverage,
  getAttendancePct,
  getDisplayStatus,
  minGrade,
  minAttendance,
}: TrendDashboardProps) {
  // 1. Grade distribution by assessment type (parent items / N1, N2, etc.)
  const gradeByAssessment = useMemo(() => {
    const parentItems = templateItems.filter(t => t.counts_in_final).sort((a, b) => a.order_index - b.order_index);
    if (parentItems.length === 0) {
      // Fallback: group by grade_type
      const types = [...new Set(grades.map(g => g.grade_type))].sort();
      return types.map(type => {
        const typeGrades = grades.filter(g => g.grade_type === type);
        const avg = typeGrades.length > 0 ? typeGrades.reduce((s, g) => s + g.grade_value, 0) / typeGrades.length : 0;
        const max = typeGrades.length > 0 ? Math.max(...typeGrades.map(g => g.grade_value)) : 0;
        const min = typeGrades.length > 0 ? Math.min(...typeGrades.map(g => g.grade_value)) : 0;
        return { name: type, média: +avg.toFixed(2), máxima: +max.toFixed(2), mínima: +min.toFixed(2) };
      });
    }

    return parentItems.map(parent => {
      // For each parent, find all child grades or direct grades
      const children = templateItems.filter(t => t.parent_item_id === parent.id);
      let studentValues: number[] = [];

      for (const enrollment of enrollments) {
        if (children.length > 0) {
          let sum = 0;
          let allFound = true;
          for (const child of children) {
            const g = grades.find(gr => gr.enrollment_id === enrollment.id && gr.grade_type.toUpperCase() === child.name.toUpperCase());
            if (!g) { allFound = false; break; }
            sum += g.grade_value * child.weight;
          }
          if (allFound) studentValues.push(sum);
        } else {
          const g = grades.find(gr => gr.enrollment_id === enrollment.id && gr.grade_type.toUpperCase() === parent.name.toUpperCase());
          if (g) studentValues.push(g.grade_value);
        }
      }

      const avg = studentValues.length > 0 ? studentValues.reduce((s, v) => s + v, 0) / studentValues.length : 0;
      const max = studentValues.length > 0 ? Math.max(...studentValues) : 0;
      const min = studentValues.length > 0 ? Math.min(...studentValues) : 0;

      return { name: parent.name, média: +avg.toFixed(2), máxima: +max.toFixed(2), mínima: +min.toFixed(2) };
    });
  }, [grades, templateItems, enrollments]);

  // 2. Student average distribution (histogram buckets)
  const avgDistribution = useMemo(() => {
    const buckets = [
      { range: '0-2', min: 0, max: 2, count: 0 },
      { range: '2-4', min: 2, max: 4, count: 0 },
      { range: '4-6', min: 4, max: 6, count: 0 },
      { range: '6-7', min: 6, max: 7, count: 0 },
      { range: '7-8', min: 7, max: 8, count: 0 },
      { range: '8-9', min: 8, max: 9, count: 0 },
      { range: '9-10', min: 9, max: 10.01, count: 0 },
    ];

    for (const e of enrollments) {
      const avg = getWeightedAverage(e.id);
      if (avg === null) continue;
      for (const bucket of buckets) {
        if (avg >= bucket.min && avg < bucket.max) {
          bucket.count++;
          break;
        }
      }
    }

    return buckets.map(b => ({ faixa: b.range, alunos: b.count }));
  }, [enrollments, getWeightedAverage]);

  // 3. Status pie chart
  const statusDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of enrollments) {
      const status = getDisplayStatus(e);
      counts[status] = (counts[status] || 0) + 1;
    }

    const statusLabels: Record<string, string> = {
      CURSANDO: 'Cursando',
      APROVADO: 'Aprovado',
      REPROVADO: 'Reprovado',
      TRANCADO: 'Trancado',
    };
    const statusColors: Record<string, string> = {
      CURSANDO: CHART_COLORS.inProgress,
      APROVADO: CHART_COLORS.approved,
      REPROVADO: CHART_COLORS.failed,
      TRANCADO: CHART_COLORS.locked,
    };

    return Object.entries(counts).map(([status, count]) => ({
      name: statusLabels[status] || status,
      value: count,
      color: statusColors[status] || CHART_COLORS.muted,
    }));
  }, [enrollments, getDisplayStatus]);

  // 4. Attendance vs Grade scatter data (as bar chart)
  const performanceComparison = useMemo(() => {
    return enrollments
      .map(e => {
        const avg = getWeightedAverage(e.id);
        const att = getAttendancePct(e.student_id);
        if (avg === null && att === null) return null;
        const name = e.student?.name?.split(' ').slice(0, 2).join(' ') || '—';
        return {
          aluno: name,
          média: avg !== null ? +avg.toFixed(2) : 0,
          frequência: att !== null ? +att.toFixed(1) : 0,
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.média - a.média)
      .slice(0, 20) as Array<{ aluno: string; média: number; frequência: number }>;
  }, [enrollments, getWeightedAverage, getAttendancePct]);

  // 5. Summary stats
  const summaryStats = useMemo(() => {
    const avgs = enrollments.map(e => getWeightedAverage(e.id)).filter(v => v !== null) as number[];
    const atts = enrollments.map(e => getAttendancePct(e.student_id)).filter(v => v !== null) as number[];
    
    const classAvg = avgs.length > 0 ? avgs.reduce((s, v) => s + v, 0) / avgs.length : null;
    const classAtt = atts.length > 0 ? atts.reduce((s, v) => s + v, 0) / atts.length : null;
    const aboveMinGrade = avgs.filter(v => v >= minGrade).length;
    const belowMinGrade = avgs.filter(v => v < minGrade).length;
    const aboveMinAtt = atts.filter(v => v >= minAttendance).length;
    const belowMinAtt = atts.filter(v => v < minAttendance).length;

    return { classAvg, classAtt, aboveMinGrade, belowMinGrade, aboveMinAtt, belowMinAtt, totalWithGrades: avgs.length, totalWithAtt: atts.length };
  }, [enrollments, getWeightedAverage, getAttendancePct, minGrade, minAttendance]);

  if (enrollments.length === 0 || grades.length === 0) {
    return (
      <Card className="mb-6">
        <CardContent className="py-8 text-center">
          <BarChart3 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Dados insuficientes para gerar o dashboard de tendências.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mb-6 space-y-4">
      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-full p-2 bg-primary/10">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Média da Turma</p>
              <p className="text-lg font-bold text-foreground">
                {summaryStats.classAvg !== null ? summaryStats.classAvg.toFixed(2).replace('.', ',') : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-full p-2 bg-primary/10">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Freq. Média</p>
              <p className="text-lg font-bold text-foreground">
                {summaryStats.classAtt !== null ? `${summaryStats.classAtt.toFixed(1).replace('.', ',')}%` : '—'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-full p-2 bg-green-500/10">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Acima da Média Mín.</p>
              <p className="text-lg font-bold text-foreground">{summaryStats.aboveMinGrade}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="rounded-full p-2 bg-red-500/10">
              <TrendingDown className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Abaixo da Média Mín.</p>
              <p className="text-lg font-bold text-foreground">{summaryStats.belowMinGrade}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="tendencia" className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1">
          <TabsTrigger value="tendencia">Tendência por Avaliação</TabsTrigger>
          <TabsTrigger value="distribuicao">Distribuição de Notas</TabsTrigger>
          <TabsTrigger value="status">Status da Turma</TabsTrigger>
          <TabsTrigger value="ranking">Ranking Individual</TabsTrigger>
        </TabsList>

        {/* Grade trend by assessment */}
        <TabsContent value="tendencia">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evolução de Notas por Avaliação</CardTitle>
            </CardHeader>
            <CardContent>
              {gradeByAssessment.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <LineChart data={gradeByAssessment}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis domain={[0, 10]} className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                    <Legend />
                    <ReferenceLine y={minGrade} stroke={CHART_COLORS.failed} strokeDasharray="5 5" label={{ value: `Mín: ${minGrade}`, position: 'right', fill: CHART_COLORS.failed, fontSize: 12 }} />
                    <Line type="monotone" dataKey="média" stroke={CHART_COLORS.inProgress} strokeWidth={2} dot={{ r: 5 }} activeDot={{ r: 7 }} />
                    <Line type="monotone" dataKey="máxima" stroke={CHART_COLORS.approved} strokeWidth={1} strokeDasharray="5 5" dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="mínima" stroke={CHART_COLORS.failed} strokeWidth={1} strokeDasharray="5 5" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma avaliação encontrada.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Grade distribution histogram */}
        <TabsContent value="distribuicao">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição de Médias Finais</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={avgDistribution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="faixa" className="text-xs" />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      color: 'hsl(var(--foreground))',
                    }}
                  />
                  <Bar dataKey="alunos" radius={[4, 4, 0, 0]}>
                    {avgDistribution.map((entry, index) => {
                      const midpoint = parseFloat(entry.faixa.split('-')[0]);
                      const color = midpoint >= minGrade ? CHART_COLORS.approved : midpoint >= minGrade - 1 ? '#f59e0b' : CHART_COLORS.failed;
                      return <Cell key={index} fill={color} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Status pie */}
        <TabsContent value="status">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Situação dos Alunos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row items-center gap-6">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={statusDistribution}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={50}
                      label={({ name, value }) => `${name}: ${value}`}
                      labelLine
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-col gap-2 min-w-[140px]">
                  {statusDistribution.map(s => (
                    <div key={s.name} className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-sm text-foreground">{s.name}: <strong>{s.value}</strong></span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Individual ranking */}
        <TabsContent value="ranking">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 20 — Média vs Frequência</CardTitle>
            </CardHeader>
            <CardContent>
              {performanceComparison.length > 0 ? (
                <ResponsiveContainer width="100%" height={Math.max(320, performanceComparison.length * 28)}>
                  <BarChart data={performanceComparison} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" domain={[0, 10]} className="text-xs" />
                    <YAxis dataKey="aluno" type="category" className="text-xs" width={80} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                      }}
                      formatter={(value: number, name: string) => {
                        if (name === 'frequência') return [`${value}%`, 'Frequência'];
                        return [value.toFixed(2), 'Média'];
                      }}
                    />
                    <Legend />
                    <ReferenceLine x={minGrade} stroke={CHART_COLORS.failed} strokeDasharray="5 5" />
                    <Bar dataKey="média" fill={CHART_COLORS.inProgress} radius={[0, 4, 4, 0]} barSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum dado de desempenho disponível.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
