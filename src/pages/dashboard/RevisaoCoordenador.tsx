import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import {
  Loader2, Search, UserPlus, CheckCircle2, XCircle, Clock, Eye, FileText, Calendar, BookOpen, GraduationCap,
} from 'lucide-react';
import { format } from 'date-fns';

interface EnrollmentSuggestion {
  id: string;
  class_id: string;
  student_enrollment: string;
  justification: string;
  status: string;
  created_at: string;
  suggested_by_user_id: string;
  decided_at: string | null;
  decided_by_user_id: string | null;
  class?: { code: string; course_id: string };
  professor?: { name: string };
  course?: { name: string };
}

interface ClassSubjectForReview {
  id: string;
  class_id: string;
  subject_id: string;
  professor_user_id: string;
  ementa_override: string | null;
  bibliografia_basica: string | null;
  bibliografia_complementar: string | null;
  class: { id: string; code: string; period: string; course_id: string };
  subject: { id: string; name: string; code: string; lesson_plan: string | null };
  professor?: { name: string };
  course?: { name: string };
}

interface LessonEntry {
  id: string;
  entry_date: string;
  title: string;
  entry_type: string;
  exam_type: string | null;
  lesson_number: number | null;
  objective: string | null;
  activities: string | null;
  resource: string | null;
  methodology: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ElementType }> = {
  PENDENTE: { label: 'Pendente', variant: 'outline', icon: Clock },
  APROVADO: { label: 'Aprovado', variant: 'default', icon: CheckCircle2 },
  REPROVADO: { label: 'Reprovado', variant: 'destructive', icon: XCircle },
};

const EXAM_TYPE_LABELS: Record<string, string> = {
  AV1: 'AV1', AV2: 'AV2', '2_CHAMADA': '2ª Chamada', FINAL: 'Final',
};

const RevisaoCoordenador = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('sugestoes');

  // --- Suggestions state ---
  const [suggestions, setSuggestions] = useState<EnrollmentSuggestion[]>([]);
  const [sugLoading, setSugLoading] = useState(true);
  const [sugSearch, setSugSearch] = useState('');
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [selectedSug, setSelectedSug] = useState<EnrollmentSuggestion | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [decisionSaving, setDecisionSaving] = useState(false);

  // --- Lesson plan review state ---
  const [classSubjects, setClassSubjects] = useState<ClassSubjectForReview[]>([]);
  const [planLoading, setPlanLoading] = useState(true);
  const [planSearch, setPlanSearch] = useState('');
  const [reviewOpen, setReviewOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ClassSubjectForReview | null>(null);
  const [planEntries, setPlanEntries] = useState<LessonEntry[]>([]);
  const [examEntries, setExamEntries] = useState<LessonEntry[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);

  useEffect(() => {
    if (user) {
      loadSuggestions();
      loadClassSubjects();
    }
  }, [user]);

  // ========== SUGGESTIONS ==========
  async function loadSuggestions() {
    setSugLoading(true);

    // Get courses coordinated by this user
    const { data: courses } = await supabase
      .from('courses')
      .select('id')
      .eq('coordinator_user_id', user!.id);

    if (!courses || courses.length === 0) {
      setSuggestions([]);
      setSugLoading(false);
      return;
    }

    const courseIds = courses.map(c => c.id);

    // Get classes for those courses
    const { data: classes } = await supabase
      .from('classes')
      .select('id, code, course_id')
      .in('course_id', courseIds);

    if (!classes || classes.length === 0) {
      setSuggestions([]);
      setSugLoading(false);
      return;
    }

    const classIds = classes.map(c => c.id);
    const classMap = Object.fromEntries(classes.map(c => [c.id, c]));

    // Get suggestions for those classes
    const { data: sugs, error } = await supabase
      .from('enrollment_suggestions')
      .select('*')
      .in('class_id', classIds)
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Erro ao carregar sugestões', description: error.message, variant: 'destructive' });
      setSugLoading(false);
      return;
    }

    const items = (sugs || []) as EnrollmentSuggestion[];

    // Load professor names
    const profIds = [...new Set(items.map(s => s.suggested_by_user_id))];
    const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', profIds);
    const profMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));

    // Load course names
    const { data: courseNames } = await supabase.from('courses').select('id, name').in('id', courseIds);
    const courseNameMap = Object.fromEntries((courseNames || []).map(c => [c.id, c.name]));

    for (const item of items) {
      const cls = classMap[item.class_id];
      item.class = cls ? { code: cls.code, course_id: cls.course_id } : undefined;
      item.professor = { name: profMap[item.suggested_by_user_id] || '—' };
      item.course = cls ? { name: courseNameMap[cls.course_id] || '—' } : undefined;
    }

    setSuggestions(items);
    setSugLoading(false);
  }

  const filteredSuggestions = useMemo(() => {
    if (!sugSearch.trim()) return suggestions;
    const q = sugSearch.toLowerCase();
    return suggestions.filter(s =>
      s.student_enrollment.toLowerCase().includes(q) ||
      s.professor?.name?.toLowerCase().includes(q) ||
      s.class?.code?.toLowerCase().includes(q) ||
      s.course?.name?.toLowerCase().includes(q)
    );
  }, [suggestions, sugSearch]);

  const pendingSuggestions = suggestions.filter(s => s.status === 'PENDENTE').length;

  function openDecision(sug: EnrollmentSuggestion) {
    setSelectedSug(sug);
    setDecisionNote('');
    setDecisionOpen(true);
  }

  async function handleDecision(status: 'APROVADO' | 'REPROVADO') {
    if (!selectedSug || !user) return;
    setDecisionSaving(true);

    const { error } = await supabase.from('enrollment_suggestions').update({
      status,
      decided_by_user_id: user.id,
      decided_at: new Date().toISOString(),
    }).eq('id', selectedSug.id);

    if (error) {
      toast({ title: 'Erro ao processar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: status === 'APROVADO' ? 'Sugestão aprovada' : 'Sugestão rejeitada' });
      setDecisionOpen(false);
      await loadSuggestions();
    }
    setDecisionSaving(false);
  }

  // ========== LESSON PLAN REVIEW ==========
  async function loadClassSubjects() {
    setPlanLoading(true);

    const { data: courses } = await supabase
      .from('courses')
      .select('id, name')
      .eq('coordinator_user_id', user!.id);

    if (!courses || courses.length === 0) {
      setClassSubjects([]);
      setPlanLoading(false);
      return;
    }

    const courseIds = courses.map(c => c.id);
    const courseNameMap = Object.fromEntries(courses.map(c => [c.id, c.name]));

    const { data: classes } = await supabase
      .from('classes')
      .select('id, code, period, course_id')
      .in('course_id', courseIds)
      .eq('status', 'ATIVO');

    if (!classes || classes.length === 0) {
      setClassSubjects([]);
      setPlanLoading(false);
      return;
    }

    const classIds = classes.map(c => c.id);
    const classMap = Object.fromEntries(classes.map(c => [c.id, c]));

    const { data: cs } = await supabase
      .from('class_subjects')
      .select('id, class_id, subject_id, professor_user_id, ementa_override, bibliografia_basica, bibliografia_complementar, subject:subjects(id, name, code, lesson_plan)')
      .in('class_id', classIds)
      .eq('status', 'ATIVO');

    const items = (cs || []) as any[];

    // Load professor names
    const profIds = [...new Set(items.map(i => i.professor_user_id))];
    if (profIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, name').in('id', profIds);
      const profMap = Object.fromEntries((profiles || []).map(p => [p.id, p.name]));
      for (const item of items) {
        item.professor = { name: profMap[item.professor_user_id] || '—' };
        const cls = classMap[item.class_id];
        if (cls) {
          item.class = cls;
          item.course = { name: courseNameMap[cls.course_id] || '—' };
        }
      }
    }

    setClassSubjects(items);
    setPlanLoading(false);
  }

  const filteredPlans = useMemo(() => {
    if (!planSearch.trim()) return classSubjects;
    const q = planSearch.toLowerCase();
    return classSubjects.filter(cs =>
      cs.subject?.name?.toLowerCase().includes(q) ||
      cs.class?.code?.toLowerCase().includes(q) ||
      cs.professor?.name?.toLowerCase().includes(q) ||
      cs.course?.name?.toLowerCase().includes(q)
    );
  }, [classSubjects, planSearch]);

  async function openReview(cs: ClassSubjectForReview) {
    setSelectedPlan(cs);
    setReviewOpen(true);
    setReviewLoading(true);

    const { data } = await supabase
      .from('lesson_plan_entries')
      .select('*')
      .eq('class_subject_id', cs.id)
      .order('entry_date');

    const entries = (data as any[]) || [];
    setPlanEntries(entries.filter(e => e.entry_type !== 'AVALIACAO'));
    setExamEntries(entries.filter(e => e.entry_type === 'AVALIACAO'));
    setReviewLoading(false);
  }

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Revisão do Coordenador</h1>
        <p className="text-muted-foreground text-sm">Aprove sugestões de inclusão de alunos e revise planos de aula dos professores.</p>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="stats-card before:bg-warning">
          <p className="text-sm text-muted-foreground">Sugestões Pendentes</p>
          <p className="text-2xl font-display font-bold text-foreground">{pendingSuggestions}</p>
        </div>
        <div className="stats-card before:bg-primary">
          <p className="text-sm text-muted-foreground">Total Sugestões</p>
          <p className="text-2xl font-display font-bold text-foreground">{suggestions.length}</p>
        </div>
        <div className="stats-card before:bg-success">
          <p className="text-sm text-muted-foreground">Planos de Aula</p>
          <p className="text-2xl font-display font-bold text-foreground">{classSubjects.length}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full grid grid-cols-2 mb-4">
          <TabsTrigger value="sugestoes">
            <UserPlus className="w-4 h-4 mr-2" /> Sugestões de Inclusão
            {pendingSuggestions > 0 && (
              <Badge variant="destructive" className="ml-2 text-xs">{pendingSuggestions}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="planos">
            <FileText className="w-4 h-4 mr-2" /> Planos de Aula
          </TabsTrigger>
        </TabsList>

        {/* ======== TAB: SUGESTÕES ======== */}
        <TabsContent value="sugestoes">
          <div className="bg-card rounded-xl border border-border shadow-card">
            <div className="p-4 border-b border-border">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar por matrícula, professor..." value={sugSearch} onChange={e => setSugSearch(e.target.value)} className="pl-9" />
              </div>
            </div>

            {sugLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredSuggestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <UserPlus className="w-12 h-12 mb-4 opacity-30" />
                <p>Nenhuma sugestão encontrada.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Professor</TableHead>
                    <TableHead>Turma</TableHead>
                    <TableHead>Curso</TableHead>
                    <TableHead>Matrícula Aluno</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuggestions.map(sug => {
                    const cfg = STATUS_CONFIG[sug.status] || STATUS_CONFIG.PENDENTE;
                    const StatusIcon = cfg.icon;
                    return (
                      <TableRow key={sug.id}>
                        <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                          {format(new Date(sug.created_at), 'dd/MM/yyyy HH:mm')}
                        </TableCell>
                        <TableCell className="text-sm">{sug.professor?.name || '—'}</TableCell>
                        <TableCell className="text-sm font-medium">{sug.class?.code || '—'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{sug.course?.name || '—'}</TableCell>
                        <TableCell className="font-mono text-sm">{sug.student_enrollment}</TableCell>
                        <TableCell>
                          <Badge variant={cfg.variant} className="gap-1">
                            <StatusIcon className="w-3 h-3" />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {sug.status === 'PENDENTE' ? (
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDecision(sug)} title="Analisar">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>

        {/* ======== TAB: PLANOS DE AULA ======== */}
        <TabsContent value="planos">
          <div className="bg-card rounded-xl border border-border shadow-card">
            <div className="p-4 border-b border-border">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Buscar disciplina, professor..." value={planSearch} onChange={e => setPlanSearch(e.target.value)} className="pl-9" />
              </div>
            </div>

            {planLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredPlans.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <FileText className="w-12 h-12 mb-4 opacity-30" />
                <p>Nenhum plano de aula encontrado.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Turma</TableHead>
                    <TableHead>Disciplina</TableHead>
                    <TableHead>Curso</TableHead>
                    <TableHead>Professor</TableHead>
                    <TableHead>Ementa</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlans.map(cs => (
                    <TableRow key={cs.id}>
                      <TableCell className="font-medium">{cs.class?.code || '—'}</TableCell>
                      <TableCell className="text-sm">{cs.subject?.name || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{cs.course?.name || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{cs.professor?.name || '—'}</TableCell>
                      <TableCell>
                        <Badge variant={cs.ementa_override || cs.bibliografia_basica ? 'default' : 'secondary'}>
                          {cs.ementa_override || cs.bibliografia_basica ? 'Preenchido' : 'Pendente'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openReview(cs)} title="Revisar plano">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ============ DECISION DIALOG ============ */}
      <Dialog open={decisionOpen} onOpenChange={setDecisionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Analisar Sugestão de Inclusão</DialogTitle>
          </DialogHeader>

          {selectedSug && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-border bg-muted/30 space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Professor</p>
                    <p className="font-medium text-foreground">{selectedSug.professor?.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Turma</p>
                    <p className="font-medium text-foreground">{selectedSug.class?.code}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Matrícula do Aluno</p>
                    <p className="font-medium font-mono text-foreground">{selectedSug.student_enrollment}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Data</p>
                    <p className="font-medium text-foreground">{format(new Date(selectedSug.created_at), 'dd/MM/yyyy')}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Justificativa do Professor</p>
                  <p className="text-sm text-foreground mt-1 p-2 bg-background rounded border border-border">{selectedSug.justification}</p>
                </div>
              </div>

              <div>
                <Label>Observação (opcional)</Label>
                <Textarea value={decisionNote} onChange={e => setDecisionNote(e.target.value)} placeholder="Nota sobre a decisão..." rows={2} />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button variant="destructive" onClick={() => handleDecision('REPROVADO')} disabled={decisionSaving}>
              {decisionSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <XCircle className="w-4 h-4 mr-2" /> Rejeitar
            </Button>
            <Button onClick={() => handleDecision('APROVADO')} disabled={decisionSaving}>
              {decisionSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <CheckCircle2 className="w-4 h-4 mr-2" /> Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ PLAN REVIEW DIALOG ============ */}
      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              Revisão do Plano de Ensino
            </DialogTitle>
          </DialogHeader>

          {reviewLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : selectedPlan && (
            <div className="space-y-6">
              {/* Header info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-lg border border-border bg-muted/30">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Curso</p>
                  <p className="text-sm font-semibold text-foreground">{selectedPlan.course?.name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Turma</p>
                  <p className="text-sm font-semibold text-foreground">{selectedPlan.class?.code || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Disciplina</p>
                  <p className="text-sm font-semibold text-foreground">{selectedPlan.subject?.name || '—'} ({selectedPlan.subject?.code})</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Professor</p>
                  <p className="text-sm font-semibold text-foreground">{selectedPlan.professor?.name || '—'}</p>
                </div>
              </div>

              {/* Datas das Provas */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" /> Datas das Provas
                </h3>
                {examEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic p-3 border border-border rounded-lg bg-muted/20">Nenhuma data de prova cadastrada pelo professor.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {examEntries.map(e => (
                        <TableRow key={e.id}>
                          <TableCell><Badge variant="outline">{EXAM_TYPE_LABELS[e.exam_type || ''] || e.title}</Badge></TableCell>
                          <TableCell className="font-mono text-sm">{format(new Date(e.entry_date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Ementa */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" /> Ementa
                </h3>
                <div className="p-3 border border-border rounded-lg bg-muted/20 text-sm whitespace-pre-wrap">
                  {selectedPlan.ementa_override || selectedPlan.subject?.lesson_plan || <span className="text-muted-foreground italic">Não preenchida.</span>}
                </div>
              </div>

              {/* Bibliografias */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Bibliografia Básica</h3>
                  <div className="p-3 border border-border rounded-lg bg-muted/20 text-sm whitespace-pre-wrap min-h-[60px]">
                    {selectedPlan.bibliografia_basica || <span className="text-muted-foreground italic">Não preenchida.</span>}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Bibliografia Complementar</h3>
                  <div className="p-3 border border-border rounded-lg bg-muted/20 text-sm whitespace-pre-wrap min-h-[60px]">
                    {selectedPlan.bibliografia_complementar || <span className="text-muted-foreground italic">Não preenchida.</span>}
                  </div>
                </div>
              </div>

              {/* Plano de Aula */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" /> Plano de Aula
                </h3>
                {planEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground italic p-3 border border-border rounded-lg bg-muted/20">Nenhuma aula cadastrada pelo professor.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Aula Nº</TableHead>
                          <TableHead className="w-24">Dia</TableHead>
                          <TableHead>Conteúdo</TableHead>
                          <TableHead>Objetivo</TableHead>
                          <TableHead>Atividades</TableHead>
                          <TableHead>Recurso</TableHead>
                          <TableHead>Metodologia</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {planEntries.map(entry => (
                          <TableRow key={entry.id}>
                            <TableCell className="font-mono font-bold text-center">{entry.lesson_number || '—'}</TableCell>
                            <TableCell className="font-mono text-xs whitespace-nowrap">
                              {format(new Date(entry.entry_date + 'T12:00:00'), 'dd/MM/yyyy')}
                            </TableCell>
                            <TableCell className="text-xs">{entry.title || '—'}</TableCell>
                            <TableCell className="text-xs">{entry.objective || '—'}</TableCell>
                            <TableCell className="text-xs">{entry.activities || '—'}</TableCell>
                            <TableCell className="text-xs">{entry.resource || '—'}</TableCell>
                            <TableCell className="text-xs">{entry.methodology || '—'}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RevisaoCoordenador;
