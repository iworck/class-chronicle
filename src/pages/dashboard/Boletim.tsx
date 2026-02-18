import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from '@/hooks/use-toast';
import { Loader2, FileText, Save, Pencil, CheckCircle2, XCircle, Info, Plus, Trash2, Eye, Lock, History, Shield, GraduationCap, Building2, Users2, BarChart3, Bell, ListOrdered } from 'lucide-react';
import { BoletimSummaryPanel } from '@/components/boletim/BoletimSummaryPanel';
import { BoletimFilters } from '@/components/boletim/BoletimFilters';
import { BoletimAlerts } from '@/components/boletim/BoletimAlerts';
import { BoletimGradeHistory } from '@/components/boletim/BoletimGradeHistory';
import { BoletimPdfExport } from '@/components/boletim/BoletimPdfExport';
import { BoletimClassComparison } from '@/components/boletim/BoletimClassComparison';
import { BoletimTrendDashboard } from '@/components/boletim/BoletimTrendDashboard';
import { BoletimBatchEntry } from '@/components/boletim/BoletimBatchEntry';

interface ClassSubject {
  id: string;
  class_id: string;
  subject_id: string;
  professor_user_id: string;
  status: string;
  class: { id: string; code: string; course_id: string; status: string };
  subject: { id: string; name: string; code: string; min_grade: number; min_attendance_pct: number };
}

interface EnrollmentWithStudent {
  id: string;
  student_id: string;
  subject_id: string;
  matrix_id: string;
  semester: number;
  status: string;
  student: { id: string; name: string; enrollment: string };
}

interface Grade {
  id: string;
  enrollment_id: string;
  grade_type: string;
  grade_value: number;
  grade_category: string;
  weight: number;
  counts_in_final: boolean;
  professor_user_id: string;
  observations: string | null;
}

interface TemplateItem {
  id: string;
  name: string;
  category: string;
  weight: number;
  counts_in_final: boolean;
  parent_item_id: string | null;
  order_index: number;
}

const GRADE_CATEGORIES = [
  { value: 'prova', label: 'Prova' },
  { value: 'trabalho', label: 'Trabalho' },
  { value: 'media', label: 'Média' },
  { value: 'ponto_extra', label: 'Ponto Extra' },
];

const categoryLabel = (cat: string) => GRADE_CATEGORIES.find(c => c.value === cat)?.label || cat;

const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  CURSANDO: { label: 'Cursando', variant: 'default' },
  APROVADO: { label: 'Aprovado', variant: 'outline' },
  REPROVADO: { label: 'Reprovado', variant: 'destructive' },
  TRANCADO: { label: 'Trancado', variant: 'secondary' },
};

interface EditGradeRow {
  id?: string;
  grade_type: string;
  grade_category: string;
  grade_value: string;
  weight: string;
  counts_in_final: boolean;
  observations: string;
}

const Boletim = () => {
  const { user, hasRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [classSubjects, setClassSubjects] = useState<ClassSubject[]>([]);
  const [selectedClassSubject, setSelectedClassSubject] = useState('');
  const [enrollments, setEnrollments] = useState<EnrollmentWithStudent[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, { total: number; present: number }>>({});
  const [loadingEnrollments, setLoadingEnrollments] = useState(false);
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [gradesClosed, setGradesClosed] = useState(false);
  const [togglingClosed, setTogglingClosed] = useState(false);

  // Grade edit dialog
  const [editDialog, setEditDialog] = useState(false);
  const [editEnrollmentId, setEditEnrollmentId] = useState('');
  const [editStudentName, setEditStudentName] = useState('');
  const [editRows, setEditRows] = useState<EditGradeRow[]>([]);
  const [deletedGradeIds, setDeletedGradeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // View grades dialog (read-only)
  const [viewDialog, setViewDialog] = useState(false);
  const [viewStudentName, setViewStudentName] = useState('');
  const [viewGrades, setViewGrades] = useState<Grade[]>([]);
  const [viewAvg, setViewAvg] = useState<number | null>(null);

  // History dialog
  const [historyDialog, setHistoryDialog] = useState(false);
  const [historyEnrollmentIds, setHistoryEnrollmentIds] = useState<string[]>([]);
  const [historyStudentName, setHistoryStudentName] = useState<string | undefined>();

  // Comparison dialog
  const [comparisonDialog, setComparisonDialog] = useState(false);

  // Batch entry dialog
  const [batchDialog, setBatchDialog] = useState(false);

  // Notification state
  const [sendingNotification, setSendingNotification] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [sortBy, setSortBy] = useState('name_asc');

  const isProfessor = hasRole('professor');
  const isDiretor = hasRole('diretor');
  const isGerente = hasRole('gerente');
  const isCoordenador = hasRole('coordenador');
  const isSuperAdmin = hasRole('super_admin');
  const isAdminRole = hasRole('admin');
  const isAdmin = isAdminRole || isCoordenador || isSuperAdmin || isDiretor || isGerente;
  const canEditRole = isProfessor || isAdmin;
  const canCloseBoletim = isAdmin && !isProfessor; // Only management can close
  const canViewHistory = isAdmin; // Management roles can view audit logs
  const canViewAlerts = isAdmin || isProfessor; // All roles see alerts for their scope

  // Determine display role for UI
  const displayRole = isSuperAdmin ? 'Super Admin' : isAdminRole ? 'Administrador' : isDiretor ? 'Diretor' : isGerente ? 'Gerente' : isCoordenador ? 'Coordenador' : isProfessor ? 'Professor' : 'Usuário';
  const roleIcon = isSuperAdmin || isAdminRole ? <Shield className="w-4 h-4" /> : isDiretor ? <Building2 className="w-4 h-4" /> : isGerente ? <Users2 className="w-4 h-4" /> : isCoordenador ? <GraduationCap className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />;

  useEffect(() => {
    loadClassSubjects();
  }, [user]);

  async function loadClassSubjects() {
    setLoading(true);
    let query = supabase
      .from('class_subjects')
      .select('id, class_id, subject_id, professor_user_id, status, class:classes(id, code, course_id, status), subject:subjects(id, name, code, min_grade, min_attendance_pct)')
      .eq('status', 'ATIVO');

    if (isProfessor && !isAdmin) {
      // Professor: only their own class_subjects
      query = query.eq('professor_user_id', user!.id);
    } else if (isCoordenador && !isAdminRole && !isSuperAdmin) {
      // Coordenador: class_subjects for courses they coordinate
      const { data: coordCourses } = await supabase
        .from('courses')
        .select('id')
        .eq('coordinator_user_id', user!.id);
      const courseIds = (coordCourses || []).map(c => c.id);
      if (courseIds.length > 0) {
        const { data: classes } = await supabase
          .from('classes')
          .select('id')
          .in('course_id', courseIds);
        const classIds = (classes || []).map(c => c.id);
        if (classIds.length > 0) {
          query = query.in('class_id', classIds);
        } else {
          setClassSubjects([]);
          setLoading(false);
          return;
        }
      } else {
        setClassSubjects([]);
        setLoading(false);
        return;
      }
    } else if (isGerente && !isAdminRole && !isSuperAdmin) {
      // Gerente: class_subjects for courses in their units
      const { data: userUnits } = await supabase
        .from('user_units')
        .select('unit_id')
        .eq('user_id', user!.id);
      const unitIds = (userUnits || []).map(u => u.unit_id);
      if (unitIds.length > 0) {
        const { data: unitCourses } = await supabase
          .from('courses')
          .select('id')
          .in('unit_id', unitIds);
        const courseIds = (unitCourses || []).map(c => c.id);
        if (courseIds.length > 0) {
          const { data: classes } = await supabase
            .from('classes')
            .select('id')
            .in('course_id', courseIds);
          const classIds = (classes || []).map(c => c.id);
          if (classIds.length > 0) {
            query = query.in('class_id', classIds);
          } else {
            setClassSubjects([]);
            setLoading(false);
            return;
          }
        } else {
          setClassSubjects([]);
          setLoading(false);
          return;
        }
      } else {
        setClassSubjects([]);
        setLoading(false);
        return;
      }
    } else if (isDiretor && !isAdminRole && !isSuperAdmin) {
      // Diretor: class_subjects for courses in their campus
      // Check both user_campuses table AND campuses.director_user_id
      const { data: userCampuses } = await supabase
        .from('user_campuses')
        .select('campus_id')
        .eq('user_id', user!.id);
      const { data: directedCampuses } = await supabase
        .from('campuses')
        .select('id')
        .eq('director_user_id', user!.id);
      
      const campusIdSet = new Set([
        ...(userCampuses || []).map(c => c.campus_id),
        ...(directedCampuses || []).map(c => c.id),
      ]);
      const campusIds = [...campusIdSet];

      if (campusIds.length > 0) {
        const { data: units } = await supabase
          .from('units')
          .select('id')
          .in('campus_id', campusIds);
        const unitIds = (units || []).map(u => u.id);
        if (unitIds.length > 0) {
          const { data: campusCourses } = await supabase
            .from('courses')
            .select('id')
            .in('unit_id', unitIds);
          // Also include courses with director_user_id = current user
          const { data: directedCourses } = await supabase
            .from('courses')
            .select('id')
            .eq('director_user_id', user!.id);
          
          const courseIdSet = new Set([
            ...(campusCourses || []).map(c => c.id),
            ...(directedCourses || []).map(c => c.id),
          ]);
          const courseIds = [...courseIdSet];

          if (courseIds.length > 0) {
            const { data: classes } = await supabase
              .from('classes')
              .select('id')
              .in('course_id', courseIds);
            const classIds = (classes || []).map(c => c.id);
            if (classIds.length > 0) {
              query = query.in('class_id', classIds);
            } else {
              setClassSubjects([]);
              setLoading(false);
              return;
            }
          } else {
            setClassSubjects([]);
            setLoading(false);
            return;
          }
        } else {
          // No units but maybe director has direct courses
          const { data: directedCourses } = await supabase
            .from('courses')
            .select('id')
            .eq('director_user_id', user!.id);
          const courseIds = (directedCourses || []).map(c => c.id);
          if (courseIds.length > 0) {
            const { data: classes } = await supabase
              .from('classes')
              .select('id')
              .in('course_id', courseIds);
            const classIds = (classes || []).map(c => c.id);
            if (classIds.length > 0) {
              query = query.in('class_id', classIds);
            } else {
              setClassSubjects([]);
              setLoading(false);
              return;
            }
          } else {
            setClassSubjects([]);
            setLoading(false);
            return;
          }
        }
      } else {
        // No campus assigned, check direct course ownership
        const { data: directedCourses } = await supabase
          .from('courses')
          .select('id')
          .eq('director_user_id', user!.id);
        const courseIds = (directedCourses || []).map(c => c.id);
        if (courseIds.length > 0) {
          const { data: classes } = await supabase
            .from('classes')
            .select('id')
            .in('course_id', courseIds);
          const classIds = (classes || []).map(c => c.id);
          if (classIds.length > 0) {
            query = query.in('class_id', classIds);
          } else {
            setClassSubjects([]);
            setLoading(false);
            return;
          }
        } else {
          setClassSubjects([]);
          setLoading(false);
          return;
        }
      }
    }
    // Admin/Super Admin: no filter, see everything

    const { data, error } = await query.order('class_id');
    if (error) {
      toast({ title: 'Erro ao carregar disciplinas', description: error.message, variant: 'destructive' });
    }
    setClassSubjects((data as any[]) || []);
    setLoading(false);
  }

  async function loadEnrollmentsAndGrades(classSubjectId: string) {
    setLoadingEnrollments(true);
    const cs = classSubjects.find(c => c.id === classSubjectId);
    if (!cs) return;

    const { data: csData } = await supabase
      .from('class_subjects')
      .select('grades_closed')
      .eq('id', classSubjectId)
      .single();
    setGradesClosed(csData?.grades_closed ?? false);

    const { data: tplData } = await supabase
      .from('grade_template_items')
      .select('*')
      .eq('class_subject_id', classSubjectId)
      .order('order_index');
    setTemplateItems((tplData as TemplateItem[]) || []);

    const { data: classStudents } = await supabase
      .from('class_students')
      .select('student_id')
      .eq('class_id', cs.class_id)
      .eq('status', 'ATIVO');

    const studentIds = (classStudents || []).map(s => s.student_id);

    if (studentIds.length === 0) {
      setEnrollments([]);
      setGrades([]);
      setAttendanceData({});
      setLoadingEnrollments(false);
      return;
    }

    const { data: enrollData } = await supabase
      .from('student_subject_enrollments')
      .select('id, student_id, subject_id, matrix_id, semester, status, student:students(id, name, enrollment)')
      .eq('subject_id', cs.subject_id)
      .in('student_id', studentIds)
      .order('student_id');

    const enrollList = (enrollData as any[]) || [];
    setEnrollments(enrollList);

    if (enrollList.length > 0) {
      const enrollIds = enrollList.map(e => e.id);
      const { data: gradeData } = await supabase
        .from('student_grades')
        .select('*')
        .in('enrollment_id', enrollIds);
      setGrades((gradeData as any[]) || []);
    } else {
      setGrades([]);
    }

    const attMap: Record<string, { total: number; present: number }> = {};
    const { data: sessions } = await supabase
      .from('attendance_sessions')
      .select('id')
      .eq('class_id', cs.class_id)
      .eq('subject_id', cs.subject_id)
      .in('status', ['ENCERRADA', 'AUDITORIA_FINALIZADA']);

    const sessionIds = (sessions || []).map(s => s.id);
    const totalSessions = sessionIds.length;

    if (totalSessions > 0) {
      const { data: records } = await supabase
        .from('attendance_records')
        .select('student_id, final_status')
        .in('session_id', sessionIds)
        .in('student_id', studentIds);

      for (const sid of studentIds) {
        const studentRecords = (records || []).filter(r => r.student_id === sid);
        const presentCount = studentRecords.filter(r => r.final_status === 'PRESENTE').length;
        attMap[sid] = { total: totalSessions, present: presentCount };
      }
    } else {
      for (const sid of studentIds) {
        attMap[sid] = { total: 0, present: 0 };
      }
    }

    setAttendanceData(attMap);
    setLoadingEnrollments(false);
  }

  function handleClassSubjectChange(value: string) {
    setSelectedClassSubject(value);
    setSearchTerm('');
    setStatusFilter('TODOS');
    setSortBy('name_asc');
    loadEnrollmentsAndGrades(value);
  }

  async function handleToggleGradesClosed(closed: boolean) {
    if (!selectedClassSubject) return;
    setTogglingClosed(true);
    
    const { error } = await supabase
      .from('class_subjects')
      .update({ grades_closed: closed } as any)
      .eq('id', selectedClassSubject);

    if (error) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      setTogglingClosed(false);
      return;
    }

    setGradesClosed(closed);

    if (closed) {
      const enrollIds = enrollments.map(e => e.id);
      for (const eid of enrollIds) {
        const studentGrades = grades.filter(g => g.enrollment_id === eid);
        if (studentGrades.length > 0) {
          await supabase
            .from('student_grades')
            .update({ updated_at: new Date().toISOString() } as any)
            .eq('id', studentGrades[0].id);
        }
      }
    } else {
      const enrollIds = enrollments.filter(e => e.status !== 'TRANCADO').map(e => e.id);
      if (enrollIds.length > 0) {
        await supabase
          .from('student_subject_enrollments')
          .update({ status: 'CURSANDO', updated_at: new Date().toISOString() })
          .in('id', enrollIds);
      }
    }

    await loadEnrollmentsAndGrades(selectedClassSubject);
    toast({
      title: closed ? 'Boletim fechado' : 'Boletim reaberto',
      description: closed
        ? 'Os status dos alunos foram calculados com base nas notas e frequência.'
        : 'Todos os alunos voltaram ao status CURSANDO.',
    });
    setTogglingClosed(false);
  }

  function getStudentGrades(enrollmentId: string): Grade[] {
    return grades.filter(g => g.enrollment_id === enrollmentId);
  }

  function calculateNValue(parentGradeType: string, enrollmentId: string): number | null {
    const parentTemplate = templateItems.find(t => t.counts_in_final && t.name === parentGradeType);
    if (!parentTemplate) return null;

    const children = templateItems.filter(t => !t.counts_in_final && t.parent_item_id && (t.parent_item_id === parentTemplate.id));
    if (children.length === 0) {
      const directGrade = grades.find(g => g.enrollment_id === enrollmentId && g.grade_type === parentGradeType);
      return directGrade ? directGrade.grade_value : null;
    }

    let sum = 0;
    let allFound = true;
    for (const child of children) {
      const childGrade = grades.find(g => g.enrollment_id === enrollmentId && g.grade_type === child.name);
      if (!childGrade) { allFound = false; continue; }
      sum += childGrade.grade_value * child.weight;
    }
    return allFound ? sum : null;
  }

  function areAllGradesEntered(enrollmentId: string): boolean {
    if (templateItems.length === 0) return false;

    const leafItems = templateItems.filter(t => {
      if (t.parent_item_id) return true;
      if (t.counts_in_final) {
        const hasChildren = templateItems.some(c => c.parent_item_id === t.id);
        return !hasChildren;
      }
      return false;
    });

    if (leafItems.length === 0) return false;

    const studentGrades = grades.filter(g => g.enrollment_id === enrollmentId);
    for (const leaf of leafItems) {
      const found = studentGrades.find(g => g.grade_type.toUpperCase() === leaf.name.toUpperCase());
      if (!found) return false;
    }
    return true;
  }

  function getWeightedAverage(enrollmentId: string): number | null {
    const parentItems = templateItems.filter(t => t.counts_in_final);

    if (parentItems.length === 0) {
      const studentGrades = grades.filter(g => g.enrollment_id === enrollmentId && g.counts_in_final !== false);
      if (studentGrades.length === 0) return null;
      const totalWeight = studentGrades.reduce((acc, g) => acc + (g.weight || 1), 0);
      if (totalWeight === 0) return null;
      const weightedSum = studentGrades.reduce((acc, g) => acc + g.grade_value * (g.weight || 1), 0);
      return weightedSum / totalWeight;
    }

    if (!areAllGradesEntered(enrollmentId)) return null;

    const nValues: number[] = [];
    for (const parent of parentItems) {
      const val = calculateNValue(parent.name, enrollmentId);
      if (val !== null) nValues.push(val);
    }
    if (nValues.length === 0) return null;
    return nValues.reduce((a, b) => a + b, 0) / nValues.length;
  }

  function getDisplayStatus(enrollment: EnrollmentWithStudent): string {
    if (enrollment.status === 'TRANCADO') return 'TRANCADO';
    if (!gradesClosed) return 'CURSANDO';
    const studentGrades = getStudentGrades(enrollment.id);
    if (studentGrades.length > 0 && templateItems.length > 0 && !areAllGradesEntered(enrollment.id)) {
      return 'CURSANDO';
    }
    if (studentGrades.length === 0) return 'CURSANDO';
    return enrollment.status;
  }

  function getAttendancePct(studentId: string): number | null {
    const att = attendanceData[studentId];
    if (!att || att.total === 0) return null;
    return (att.present / att.total) * 100;
  }

  // Compute at-risk students
  const currentCs = classSubjects.find(c => c.id === selectedClassSubject);
  const minGrade = Number((currentCs?.subject as any)?.min_grade ?? 7.0);
  const minAtt = Number((currentCs?.subject as any)?.min_attendance_pct ?? 75.0);

  const atRiskStudents = useMemo(() => {
    if (!selectedClassSubject || enrollments.length === 0) return [];
    return enrollments
      .map(e => {
        const avg = getWeightedAverage(e.id);
        const attPct = getAttendancePct(e.student_id);
        const avgRisk = avg !== null && avg < minGrade;
        const attRisk = attPct !== null && attPct < minAtt;
        if (!avgRisk && !attRisk) return null;
        return {
          name: e.student?.name || '—',
          enrollment: e.student?.enrollment || '—',
          avgRisk,
          attRisk,
          avg,
          attPct,
        };
      })
      .filter(Boolean) as any[];
  }, [enrollments, grades, attendanceData, selectedClassSubject, templateItems]);

  // Filtered and sorted enrollments
  const filteredEnrollments = useMemo(() => {
    let result = [...enrollments];

    // Search
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(e =>
        (e.student?.name || '').toLowerCase().includes(term) ||
        (e.student?.enrollment || '').toLowerCase().includes(term)
      );
    }

    // Status filter
    if (statusFilter !== 'TODOS') {
      if (statusFilter === 'EM_RISCO') {
        const riskNames = new Set(atRiskStudents.map(s => s.name));
        result = result.filter(e => riskNames.has(e.student?.name || ''));
      } else {
        result = result.filter(e => getDisplayStatus(e) === statusFilter);
      }
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':
          return (a.student?.name || '').localeCompare(b.student?.name || '');
        case 'name_desc':
          return (b.student?.name || '').localeCompare(a.student?.name || '');
        case 'avg_desc': {
          const aa = getWeightedAverage(a.id) ?? -1;
          const bb = getWeightedAverage(b.id) ?? -1;
          return bb - aa;
        }
        case 'avg_asc': {
          const aa = getWeightedAverage(a.id) ?? 999;
          const bb = getWeightedAverage(b.id) ?? 999;
          return aa - bb;
        }
        case 'att_desc': {
          const aa = getAttendancePct(a.student_id) ?? -1;
          const bb = getAttendancePct(b.student_id) ?? -1;
          return bb - aa;
        }
        case 'att_asc': {
          const aa = getAttendancePct(a.student_id) ?? 999;
          const bb = getAttendancePct(b.student_id) ?? 999;
          return aa - bb;
        }
        default:
          return 0;
      }
    });

    return result;
  }, [enrollments, searchTerm, statusFilter, sortBy, grades, attendanceData, templateItems, gradesClosed]);

  function openEditDialog(enrollment: EnrollmentWithStudent) {
    setEditEnrollmentId(enrollment.id);
    setEditStudentName(enrollment.student?.name || '');

    const existingGrades = getStudentGrades(enrollment.id);

    if (templateItems.length > 0) {
      // Only show leaf items (directly editable): children OR parents with no children
      const leafItems = templateItems.filter(t => {
        if (t.parent_item_id) return true; // child → directly editable
        if (t.counts_in_final) {
          const hasChildren = templateItems.some(c => c.parent_item_id === t.id);
          return !hasChildren; // parent with no children → directly editable
        }
        return false;
      });

      const rows: EditGradeRow[] = leafItems.map(t => {
        const existing = existingGrades.find(g => g.grade_type.toUpperCase() === t.name.toUpperCase());
        if (existing) {
          return {
            id: existing.id,
            grade_type: t.name, // Always use template name (canonical casing)
            grade_category: t.category, // Always use template category
            grade_value: String(existing.grade_value),
            weight: String(t.weight), // Always use template weight
            counts_in_final: t.counts_in_final, // Always use template flag
            observations: existing.observations || '',
          };
        }
        return {
          grade_type: t.name,
          grade_category: t.category,
          grade_value: '',
          weight: String(t.weight),
          counts_in_final: t.counts_in_final,
          observations: '',
        };
      });

      // Detect orphan grades (exist in DB but not in template) and auto-mark for deletion
      const leafNames = new Set(leafItems.map(t => t.name.toUpperCase()));
      const orphans = existingGrades.filter(g => !leafNames.has(g.grade_type.toUpperCase()));
      const orphanIds = orphans.filter(g => g.id).map(g => g.id);
      setDeletedGradeIds(orphanIds);
      setEditRows(rows);
    } else if (existingGrades.length > 0) {
      setDeletedGradeIds([]);
      setEditRows(existingGrades.map(g => ({
        id: g.id,
        grade_type: g.grade_type,
        grade_category: g.grade_category || 'prova',
        grade_value: String(g.grade_value),
        weight: String(g.weight || 1),
        counts_in_final: g.counts_in_final !== false,
        observations: g.observations || '',
      })));
    } else {
      setDeletedGradeIds([]);
      setEditRows([{ grade_type: 'N1', grade_category: 'prova', grade_value: '', weight: '1', counts_in_final: true, observations: '' }]);
    }
    setEditDialog(true);
  }

  function addGradeRow() {
    const nextNum = editRows.length + 1;
    setEditRows(prev => [...prev, {
      grade_type: `N${nextNum}`,
      grade_category: 'prova',
      grade_value: '',
      weight: '1',
      counts_in_final: true,
      observations: '',
    }]);
  }

  function removeGradeRow(index: number) {
    const row = editRows[index];
    if (row.id) {
      setDeletedGradeIds(prev => [...prev, row.id!]);
    }
    setEditRows(prev => prev.filter((_, i) => i !== index));
  }

  function updateGradeRow(index: number, field: keyof EditGradeRow, value: any) {
    setEditRows(prev => prev.map((r, i) => i === index ? { ...r, [field]: value } : r));
  }

  async function handleSaveGrades() {
    if (!user) return;
    setSaving(true);

    try {
      for (const id of deletedGradeIds) {
        const { error: delError } = await supabase.from('student_grades').delete().eq('id', id);
        if (delError) {
          toast({ title: 'Erro ao excluir nota', description: delError.message, variant: 'destructive' });
          setSaving(false);
          return;
        }
      }

      const rowsToSave = editRows.filter(r => r.grade_value.trim() !== '');

      for (const row of rowsToSave) {
        const numVal = parseFloat(row.grade_value);
        if (isNaN(numVal) || numVal < 0 || numVal > 10) {
          toast({ title: `Nota "${row.grade_type}" inválida (0-10)`, variant: 'destructive' });
          setSaving(false);
          return;
        }

        const numWeight = parseFloat(row.weight) || 1;
        if (numWeight <= 0) {
          toast({ title: `Peso de "${row.grade_type}" deve ser maior que 0`, variant: 'destructive' });
          setSaving(false);
          return;
        }

        const payload = {
          enrollment_id: editEnrollmentId,
          grade_type: row.grade_type.trim().toUpperCase(),
          grade_category: row.grade_category,
          grade_value: numVal,
          weight: numWeight,
          counts_in_final: row.counts_in_final,
          professor_user_id: user.id,
          observations: row.observations || null,
        };

        if (row.id) {
          const { data: updData, error: updError } = await supabase
            .from('student_grades')
            .update(payload)
            .eq('id', row.id)
            .select();
          
          if (updError) {
            toast({ title: `Erro ao atualizar "${row.grade_type}"`, description: updError.message, variant: 'destructive' });
            setSaving(false);
            return;
          }

          if (!updData || updData.length === 0) {
            toast({ 
              title: `Não foi possível atualizar "${row.grade_type}"`, 
              description: 'Verifique se você tem permissão para editar esta nota.', 
              variant: 'destructive' 
            });
            setSaving(false);
            return;
          }
        } else {
          const { data: insData, error: insError } = await supabase
            .from('student_grades')
            .insert(payload)
            .select();
          
          if (insError) {
            toast({ title: `Erro ao inserir "${row.grade_type}"`, description: insError.message, variant: 'destructive' });
            setSaving(false);
            return;
          }

          if (!insData || insData.length === 0) {
            toast({ 
              title: `Não foi possível inserir "${row.grade_type}"`, 
              description: 'Verifique se você tem permissão para lançar notas.', 
              variant: 'destructive' 
            });
            setSaving(false);
            return;
          }
        }
      }

      await loadEnrollmentsAndGrades(selectedClassSubject);

      toast({
        title: 'Notas salvas com sucesso!',
        description: 'A média e o status foram recalculados automaticamente.',
      });
      setEditDialog(false);
    } catch (err: any) {
      toast({ title: 'Erro ao salvar notas', description: err.message, variant: 'destructive' });
    }

    setSaving(false);
  }

  const classSubjectLabel = (cs: ClassSubject) =>
    `${(cs.class as any)?.code || '—'} — ${(cs.subject as any)?.name || '—'}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary" />
            Boletim — Gestão de Notas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isProfessor && !isAdmin
              ? 'Registre e acompanhe as notas dos seus alunos.'
              : 'Gerencie notas, acompanhe desempenho e audite alterações.'}
          </p>
          {/* Role indicator */}
          <div className="mt-2 flex items-center gap-2">
            <Badge variant="outline" className="text-xs gap-1">
              {roleIcon}
              {displayRole}
            </Badge>
            {isProfessor && !isAdmin && (
              <span className="text-xs text-muted-foreground">Visualização: suas disciplinas</span>
            )}
            {isCoordenador && !isAdminRole && !isSuperAdmin && (
              <span className="text-xs text-muted-foreground">Visualização: cursos coordenados</span>
            )}
            {isGerente && !isAdminRole && !isSuperAdmin && (
              <span className="text-xs text-muted-foreground">Visualização: unidades gerenciadas</span>
            )}
            {isDiretor && !isAdminRole && !isSuperAdmin && !isGerente && !isCoordenador && (
              <span className="text-xs text-muted-foreground">Visualização: campus vinculado</span>
            )}
            {(isAdminRole || isSuperAdmin) && (
              <span className="text-xs text-muted-foreground">Visualização: todas as disciplinas</span>
            )}
          </div>
        </div>
        {/* Action buttons row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Comparison button — management roles only */}
          {isAdmin && classSubjects.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setComparisonDialog(true)}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Comparativo
            </Button>
          )}
          {selectedClassSubject && !loadingEnrollments && enrollments.length > 0 && (
            <>
              {/* Notify at-risk — management roles only */}
              {isAdmin && atRiskStudents.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                  disabled={sendingNotification}
                  onClick={async () => {
                    setSendingNotification(true);
                    try {
                      const { data, error } = await supabase.functions.invoke('notify-at-risk', {
                        body: { class_subject_id: selectedClassSubject, channels: ['email', 'whatsapp'] },
                      });
                      if (error) throw error;
                      toast({
                        title: `Notificação enviada`,
                        description: `${data.at_risk_count} aluno(s) em risco. ${data.sent} notificação(ões) enviada(s).`,
                      });
                    } catch (err: any) {
                      toast({ title: 'Erro ao notificar', description: err.message, variant: 'destructive' });
                    }
                    setSendingNotification(false);
                  }}
                >
                  {sendingNotification ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bell className="w-4 h-4 mr-2" />}
                  Notificar Risco ({atRiskStudents.length})
                </Button>
              )}
              {canViewHistory && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setHistoryEnrollmentIds(enrollments.map(e => e.id));
                    setHistoryStudentName(undefined);
                    setHistoryDialog(true);
                  }}
                >
                  <History className="w-4 h-4 mr-2" />
                  Histórico
                </Button>
              )}
              {/* Batch grade entry — professor + admin when boletim open */}
              {canEditRole && !gradesClosed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setBatchDialog(true)}
                  className="border-primary/30 text-primary hover:bg-primary/10"
                >
                  <ListOrdered className="w-4 h-4 mr-2" />
                  Lançar em Lote
                </Button>
              )}
              <BoletimPdfExport
                subjectName={(currentCs?.subject as any)?.name || ''}
                classCode={(currentCs?.class as any)?.code || ''}
                minGrade={minGrade}
                minAttendance={minAtt}
                students={enrollments.map(e => ({
                  name: e.student?.name || '',
                  enrollment: e.student?.enrollment || '',
                  avg: getWeightedAverage(e.id),
                  attPct: getAttendancePct(e.student_id),
                  status: getDisplayStatus(e),
                  grades: getStudentGrades(e.id).map(g => ({ type: g.grade_type, value: g.grade_value })),
                }))}
                templateItems={templateItems.map(t => ({ name: t.name, counts_in_final: t.counts_in_final }))}
              />
            </>
          )}
        </div>
      </div>

      {/* Select class + subject */}
      <div className="mb-6 max-w-md">
        <Label>Turma / Disciplina</Label>
        <Select value={selectedClassSubject} onValueChange={handleClassSubjectChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a turma e disciplina" />
          </SelectTrigger>
          <SelectContent>
            {classSubjects.map(cs => (
              <SelectItem key={cs.id} value={cs.id}>
                {classSubjectLabel(cs)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Approval criteria banner */}
      {selectedClassSubject && (() => {
        return (
          <div className="mb-6 p-4 rounded-lg border border-primary/20 bg-primary/5">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground mb-2">Critérios de Aprovação — {(currentCs?.subject as any)?.name}</p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span className="text-sm text-foreground">
                      <strong>Nota mínima:</strong> Média ponderada ≥ <strong>{minGrade.toFixed(1).replace('.', ',')}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span className="text-sm text-foreground">
                      <strong>Frequência mínima:</strong> ≥ <strong>{minAtt.toFixed(0)}%</strong> de presença
                    </span>
                  </div>
                </div>
                {templateItems.length > 0 && (
                  <div className="mt-2 p-2 rounded bg-muted/50 border border-border">
                    <p className="text-xs font-semibold text-foreground mb-1">Modelo de notas configurado:</p>
                    <div className="flex flex-wrap gap-1">
                      {templateItems.map(t => (
                        <Badge key={t.id} variant={t.counts_in_final ? 'default' : 'secondary'} className="text-xs">
                          {t.name} ({categoryLabel(t.category)}, p{t.weight})
                          {!t.counts_in_final && ' — critério'}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {templateItems.length > 0 && (() => {
                  const parentItems = templateItems.filter(t => t.counts_in_final);
                  return parentItems.length > 0 ? (
                    <p className="text-xs text-muted-foreground mt-2">
                      <strong>Fórmula:</strong> MÉDIA = ({parentItems.map(p => p.name).join(' + ')}) / {parentItems.length}.
                      {' '}Cada nota é calculada pela soma dos seus componentes (valor × peso).
                    </p>
                  ) : null;
                })()}
                {templateItems.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Apenas notas marcadas como "Compõe Média" entram no cálculo da média ponderada final.
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Fechar Boletim toggle */}
      {selectedClassSubject && !loadingEnrollments && enrollments.length > 0 && canCloseBoletim && (() => {
        const isClassOpen = (currentCs?.class as any)?.status === 'ATIVO';
        if (!isClassOpen) return null;
        return (
          <div className="mb-4 p-4 rounded-lg border border-border bg-muted/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Lock className="w-5 h-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold text-foreground">Fechar Boletim</p>
                <p className="text-xs text-muted-foreground">
                  {gradesClosed
                    ? 'Boletim fechado — status dos alunos calculado automaticamente.'
                    : 'Enquanto aberto, todos os alunos permanecem como CURSANDO.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {togglingClosed && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              <Switch
                checked={gradesClosed}
                onCheckedChange={handleToggleGradesClosed}
                disabled={togglingClosed}
              />
            </div>
          </div>
        );
      })()}

      {classSubjects.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">Nenhuma disciplina vinculada encontrada.</p>
        </div>
      )}

      {selectedClassSubject && loadingEnrollments && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {selectedClassSubject && !loadingEnrollments && enrollments.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">Nenhum aluno matriculado nesta disciplina.</p>
        </div>
      )}

      {selectedClassSubject && !loadingEnrollments && enrollments.length > 0 && (() => {
        const classStatus = (currentCs?.class as any)?.status;
        const isClassOpen = classStatus === 'ATIVO';
        const canEdit = canEditRole && isClassOpen;

        return (
          <>
            {/* Summary Panel */}
            <BoletimSummaryPanel
              enrollments={enrollments}
              getWeightedAverage={getWeightedAverage}
              getAttendancePct={getAttendancePct}
              minGrade={minGrade}
              minAttendance={minAtt}
              gradesClosed={gradesClosed}
              getDisplayStatus={getDisplayStatus}
            />

            {/* Trend Dashboard */}
            <BoletimTrendDashboard
              enrollments={enrollments}
              grades={grades}
              templateItems={templateItems}
              getWeightedAverage={getWeightedAverage}
              getAttendancePct={getAttendancePct}
              getDisplayStatus={getDisplayStatus}
              minGrade={minGrade}
              minAttendance={minAtt}
            />

            {/* Alerts */}
            <BoletimAlerts
              atRiskStudents={atRiskStudents}
              minGrade={minGrade}
              minAttendance={minAtt}
            />

            {/* Filters */}
            <BoletimFilters
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              statusFilter={statusFilter}
              onStatusFilterChange={setStatusFilter}
              sortBy={sortBy}
              onSortByChange={setSortBy}
            />

            {!isClassOpen && (
              <div className="mb-4 p-3 rounded-lg border border-destructive/30 bg-destructive/5 flex items-center gap-2">
                <Lock className="w-4 h-4 text-destructive shrink-0" />
                <p className="text-sm text-destructive font-medium">
                  Turma fechada — edição de notas bloqueada.
                </p>
              </div>
            )}

            {filteredEnrollments.length === 0 ? (
              <div className="text-center py-8 border border-border rounded-lg">
                <p className="text-sm text-muted-foreground">Nenhum aluno encontrado com os filtros aplicados.</p>
              </div>
            ) : (
              <div className="border border-border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Aluno</TableHead>
                      <TableHead>Matrícula</TableHead>
                      <TableHead className="text-center w-24">Média</TableHead>
                      <TableHead className="text-center w-24">Frequência</TableHead>
                      <TableHead className="text-center w-28">Status</TableHead>
                      <TableHead className="text-center w-28">Progresso</TableHead>
                      <TableHead className="text-center w-28">Notas</TableHead>
                      {canEdit && <TableHead className="text-center w-20">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEnrollments.map(enrollment => {
                      const avg = getWeightedAverage(enrollment.id);
                      const attPct = getAttendancePct(enrollment.student_id);
                      const attOk = attPct === null || attPct >= minAtt;
                      const avgOk = avg === null || avg >= minGrade;
                      const studentGrades = getStudentGrades(enrollment.id);
                      const displayStatus = getDisplayStatus(enrollment);
                      const allEntered = areAllGradesEntered(enrollment.id);
                      const isAtRisk = atRiskStudents.some(s => s.name === (enrollment.student?.name || ''));

                      const leafItems = templateItems.filter(t => {
                        if (t.parent_item_id) return true;
                        if (t.counts_in_final) return !templateItems.some(c => c.parent_item_id === t.id);
                        return false;
                      });
                      const enteredCount = leafItems.filter(leaf =>
                        studentGrades.some(g => g.grade_type.toUpperCase() === leaf.name.toUpperCase())
                      ).length;

                      return (
                        <TableRow key={enrollment.id} className={isAtRisk ? 'bg-amber-500/5' : ''}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {enrollment.student?.name || '—'}
                              {isAtRisk && (
                                <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Em risco" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{enrollment.student?.enrollment || '—'}</TableCell>
                          <TableCell className="text-center font-bold">
                            {avg !== null ? (
                              <span className={avgOk ? 'text-primary' : 'text-destructive'}>
                                {avg.toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40 text-xs">
                                {studentGrades.length > 0 ? 'Parcial' : '—'}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {attPct !== null ? (
                              <div className="flex items-center justify-center gap-1">
                                {attOk ? (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                                ) : (
                                  <XCircle className="w-3.5 h-3.5 text-destructive" />
                                )}
                                <span className={`text-sm font-medium ${attOk ? 'text-primary' : 'text-destructive'}`}>
                                  {attPct.toFixed(0)}%
                                </span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground/40 text-sm">S/A</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={STATUS_MAP[displayStatus]?.variant || 'default'}>
                              {STATUS_MAP[displayStatus]?.label || displayStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            {leafItems.length > 0 ? (
                              <span className={`text-xs font-medium ${allEntered ? 'text-primary' : 'text-muted-foreground'}`}>
                                {enteredCount}/{leafItems.length}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40 text-xs">{studentGrades.length} notas</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setViewStudentName(enrollment.student?.name || '');
                                setViewGrades(studentGrades);
                                setViewAvg(avg);
                                setViewDialog(true);
                              }}
                              disabled={studentGrades.length === 0}
                            >
                              <Eye className="w-4 h-4 mr-1" />
                              Ver
                            </Button>
                          </TableCell>
                          {canEdit && (
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEditDialog(enrollment)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                {canViewHistory && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => {
                                      setHistoryEnrollmentIds([enrollment.id]);
                                      setHistoryStudentName(enrollment.student?.name);
                                      setHistoryDialog(true);
                                    }}
                                  >
                                    <History className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Results count */}
            <div className="mt-2 text-xs text-muted-foreground">
              Exibindo {filteredEnrollments.length} de {enrollments.length} alunos
            </div>
          </>
        );
      })()}

      {/* Edit grades dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lançar Notas — {editStudentName}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {templateItems.length > 0 && (
              <div className="p-2 rounded border border-primary/20 bg-primary/5">
                <p className="text-xs text-muted-foreground">
                  Notas pré-configuradas pelo modelo da turma. Pesos, categorias e flags são herdados automaticamente do modelo.
                </p>
              </div>
            )}

            {templateItems.length > 0 && deletedGradeIds.length > 0 && (
              <div className="p-2 rounded border border-amber-500/30 bg-amber-500/10 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-amber-700 font-medium">
                    {deletedGradeIds.length} registro(s) fora do padrão do modelo detectado(s)
                  </p>
                  <p className="text-xs text-amber-600 mt-0.5">
                    Esses registros serão excluídos ao salvar para sincronizar com o modelo atual da turma.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-[1fr_100px_70px_70px_80px_1fr_40px] gap-2 text-xs font-semibold text-muted-foreground px-1">
              <span>Tipo</span>
              <span>Categoria</span>
              <span>Nota</span>
              <span>Peso</span>
              <span className="text-center">Média</span>
              <span>Obs.</span>
              <span></span>
            </div>

            {editRows.map((row, idx) => {
              // When template exists, these rows are locked to template spec
              const lockedByTemplate = templateItems.length > 0;
              return (
              <div key={idx} className={`grid grid-cols-[1fr_100px_70px_70px_80px_1fr_40px] gap-2 items-center p-1.5 rounded-md ${row.counts_in_final ? 'bg-primary/5 border border-primary/20' : 'bg-muted/30 border border-border'}`}>
                <Input
                  placeholder="N1, T1..."
                  value={row.grade_type}
                  onChange={e => updateGradeRow(idx, 'grade_type', e.target.value)}
                  className="text-sm font-mono"
                  disabled={lockedByTemplate}
                  title={lockedByTemplate ? 'Tipo definido pelo modelo da turma' : undefined}
                />
                <Select value={row.grade_category} onValueChange={v => updateGradeRow(idx, 'grade_category', v)} disabled={lockedByTemplate}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADE_CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  placeholder="0-10"
                  value={row.grade_value}
                  onChange={e => updateGradeRow(idx, 'grade_value', e.target.value)}
                  className="text-sm"
                />
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  placeholder="1"
                  value={row.weight}
                  onChange={e => updateGradeRow(idx, 'weight', e.target.value)}
                  className="text-sm"
                  disabled={lockedByTemplate}
                  title={lockedByTemplate ? 'Peso definido pelo modelo da turma' : undefined}
                />
                <div className="flex justify-center">
                  <Switch
                    checked={row.counts_in_final}
                    onCheckedChange={v => updateGradeRow(idx, 'counts_in_final', v)}
                    disabled={lockedByTemplate}
                  />
                </div>
                <Input
                  placeholder="Obs."
                  value={row.observations}
                  onChange={e => updateGradeRow(idx, 'observations', e.target.value)}
                  className="text-sm"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeGradeRow(idx)}
                  className="shrink-0"
                  disabled={lockedByTemplate}
                  title={lockedByTemplate ? 'Use o lançamento em lote para editar notas em massa' : 'Remover nota'}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            )})}

            {!templateItems.length && (
              <Button variant="outline" size="sm" onClick={addGradeRow} className="mt-2">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Nota
              </Button>
            )}

            {/* Preview with formula */}
            {editRows.some(r => r.grade_value.trim() !== '') && (() => {
              const parentItems = templateItems.filter(t => t.counts_in_final);

              const nCalcs: { name: string; value: number | null; details: string }[] = [];

              if (parentItems.length > 0) {
                for (const parent of parentItems) {
                  const children = templateItems.filter(t => !t.counts_in_final && t.parent_item_id === parent.id);
                  if (children.length > 0) {
                    let sum = 0;
                    let allFound = true;
                    const parts: string[] = [];
                    for (const child of children) {
                      const row = editRows.find(r => r.grade_type.toUpperCase() === child.name.toUpperCase());
                      const v = row ? parseFloat(row.grade_value) : NaN;
                      const w = child.weight;
                      if (!isNaN(v)) {
                        sum += v * w;
                        parts.push(`${child.name}(${v} × ${w} = ${(v * w).toFixed(2)})`);
                      } else {
                        allFound = false;
                        parts.push(`${child.name}(? × ${w})`);
                      }
                    }
                    nCalcs.push({ name: parent.name, value: allFound ? sum : null, details: parts.join(' + ') });
                  } else {
                    const row = editRows.find(r => r.grade_type.toUpperCase() === parent.name.toUpperCase());
                    const v = row ? parseFloat(row.grade_value) : NaN;
                    nCalcs.push({ name: parent.name, value: !isNaN(v) ? v : null, details: `${parent.name} = ${!isNaN(v) ? v.toFixed(2) : '?'}` });
                  }
                }
              }

              const validNs = nCalcs.filter(n => n.value !== null);
              const previewAvg = validNs.length > 0
                ? validNs.reduce((a, n) => a + n.value!, 0) / validNs.length
                : null;

              if (parentItems.length === 0) {
                let ws = 0, tw = 0;
                editRows.forEach(r => {
                  if (!r.counts_in_final) return;
                  const v = parseFloat(r.grade_value);
                  const w = parseFloat(r.weight) || 1;
                  if (!isNaN(v)) { ws += v * w; tw += w; }
                });
                const fallbackAvg = tw > 0 ? ws / tw : null;
                return (
                  <div className="mt-3 p-3 rounded-md border border-border bg-muted/50">
                    <p className="text-sm text-foreground">
                      <strong>Prévia da Média Ponderada:</strong>{' '}
                      {fallbackAvg !== null ? <span className="text-lg font-bold">{fallbackAvg.toFixed(2)}</span> : '—'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Fórmula: Σ(nota × peso) / Σ(peso) = {tw > 0 ? `${ws.toFixed(1)} / ${tw.toFixed(1)}` : '—'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="mt-3 p-4 rounded-md border border-border bg-muted/50 space-y-3">
                  <p className="text-sm font-semibold text-foreground">📐 Cálculo das Notas:</p>
                  {nCalcs.map((n, i) => (
                    <div key={i} className="p-2 rounded bg-background border border-border">
                      <p className="text-xs text-muted-foreground">{n.details}</p>
                      <p className="text-sm font-bold text-foreground">
                        {n.name} = {n.value !== null ? n.value.toFixed(2) : '—'}
                      </p>
                    </div>
                  ))}
                  <div className="p-3 rounded-md bg-primary/10 border border-primary/30">
                    <p className="text-xs text-muted-foreground">
                      MÉDIA = ({nCalcs.map(n => n.name).join(' + ')}) / {nCalcs.length}
                      {validNs.length > 0 && ` = ${validNs.map(n => n.value!.toFixed(2)).join(' + ')} / ${validNs.length}`}
                    </p>
                    <p className="text-lg font-bold text-primary mt-1">
                      MÉDIA = {previewAvg !== null ? previewAvg.toFixed(2) : '—'}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveGrades} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              <Save className="w-4 h-4 mr-2" />
              Salvar Notas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View grades dialog (read-only) */}
      <Dialog open={viewDialog} onOpenChange={setViewDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Notas — {viewStudentName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {viewGrades.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma nota lançada.</p>
            ) : (() => {
              const parentItems = templateItems.filter(t => t.counts_in_final);
              const hasTemplate = parentItems.length > 0;

              if (hasTemplate) {
                const nCalcs: { name: string; value: number | null; children: { name: string; category: string; grade: number | null; weight: number; result: number | null }[] }[] = [];

                for (const parent of parentItems) {
                  const childTemplates = templateItems.filter(t => !t.counts_in_final && t.parent_item_id === parent.id);
                  if (childTemplates.length > 0) {
                    const children = childTemplates.map(child => {
                      const g = viewGrades.find(vg => vg.grade_type.toUpperCase() === child.name.toUpperCase());
                      const grade = g ? g.grade_value : null;
                      return { name: child.name, category: child.category, grade, weight: child.weight, result: grade !== null ? grade * child.weight : null };
                    });
                    const allFound = children.every(c => c.result !== null);
                    const sum = allFound ? children.reduce((a, c) => a + c.result!, 0) : null;
                    nCalcs.push({ name: parent.name, value: sum, children });
                  } else {
                    const g = viewGrades.find(vg => vg.grade_type.toUpperCase() === parent.name.toUpperCase());
                    const grade = g ? g.grade_value : null;
                    nCalcs.push({ name: parent.name, value: grade, children: [{ name: parent.name, category: parent.category, grade, weight: 1, result: grade }] });
                  }
                }

                const validNs = nCalcs.filter(n => n.value !== null);
                const avg = validNs.length > 0 ? validNs.reduce((a, n) => a + n.value!, 0) / validNs.length : null;

                return (
                  <div className="space-y-3">
                    {nCalcs.map((n, i) => (
                      <div key={i} className="rounded-lg border border-border overflow-hidden">
                        <div className="px-3 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
                          <span className="text-sm font-bold text-foreground">{n.name} (Nota de Cálculo de Média)</span>
                          <span className="text-sm font-bold text-primary">{n.value !== null ? n.value.toFixed(2) : '—'}</span>
                        </div>
                        <div className="p-3 space-y-1.5">
                          {n.children.map((child, ci) => (
                            <div key={ci} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-medium text-foreground">{child.name}</span>
                                <Badge variant="secondary" className="text-xs">{categoryLabel(child.category)}</Badge>
                              </div>
                              <div className="text-muted-foreground text-xs font-mono">
                                {child.grade !== null ? (
                                  <span>{child.grade.toFixed(1)} × {child.weight} = <strong className="text-foreground">{child.result!.toFixed(2)}</strong></span>
                                ) : (
                                  <span className="text-destructive">Não lançada</span>
                                )}
                              </div>
                            </div>
                          ))}
                          <div className="pt-1.5 border-t border-border text-xs text-muted-foreground">
                            <strong>{n.name}</strong> = {n.children.map(c => c.result !== null ? c.result.toFixed(2) : '?').join(' + ')} = <strong className="text-foreground">{n.value !== null ? n.value.toFixed(2) : '—'}</strong>
                          </div>
                        </div>
                      </div>
                    ))}

                    {(() => {
                      const templateNames = new Set(templateItems.map(t => t.name.toUpperCase()));
                      const extras = viewGrades.filter(g => !templateNames.has(g.grade_type.toUpperCase()));
                      if (extras.length === 0) return null;
                      return (
                        <div className="rounded-lg border border-border overflow-hidden">
                          <div className="px-3 py-2 bg-muted/50 border-b border-border">
                            <span className="text-sm font-bold text-foreground">Outras Notas</span>
                          </div>
                          <div className="p-3 space-y-1.5">
                            {extras.map(g => (
                              <div key={g.id} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-medium">{g.grade_type}</span>
                                  <Badge variant="secondary" className="text-xs">{categoryLabel(g.grade_category)}</Badge>
                                </div>
                                <span className="font-medium">{g.grade_value.toFixed(1)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="p-4 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
                      <p className="text-xs font-mono text-muted-foreground text-center">
                        MÉDIA = ({nCalcs.map(n => n.name).join(' + ')}) / {nCalcs.length}
                      </p>
                      {validNs.length > 0 && (
                        <p className="text-xs font-mono text-muted-foreground text-center">
                          MÉDIA = ({validNs.map(n => n.value!.toFixed(2)).join(' + ')}) / {validNs.length} = {avg!.toFixed(2)}
                        </p>
                      )}
                      <p className="text-2xl font-bold text-primary text-center">{avg !== null ? avg.toFixed(2) : '—'}</p>
                    </div>
                  </div>
                );
              }

              return (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-center">Nota</TableHead>
                        <TableHead className="text-center">Peso</TableHead>
                        <TableHead className="text-center">Média</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewGrades.map(g => (
                        <TableRow key={g.id} className={g.counts_in_final !== false ? '' : 'opacity-60'}>
                          <TableCell className="font-mono font-medium">{g.grade_type}</TableCell>
                          <TableCell>{categoryLabel(g.grade_category)}</TableCell>
                          <TableCell className="text-center font-medium">{g.grade_value.toFixed(1)}</TableCell>
                          <TableCell className="text-center">{g.weight}</TableCell>
                          <TableCell className="text-center">
                            {g.counts_in_final !== false ? (
                              <Badge variant="default" className="text-xs">Sim</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">Critério</Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {viewAvg !== null && (
                    <div className="p-3 rounded-md border border-border bg-muted/50 text-center">
                      <p className="text-sm text-muted-foreground">Média Final</p>
                      <p className="text-2xl font-bold text-primary">{viewAvg.toFixed(2)}</p>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Grade History Dialog */}
      <BoletimGradeHistory
        open={historyDialog}
        onOpenChange={setHistoryDialog}
        enrollmentIds={historyEnrollmentIds}
        studentName={historyStudentName}
      />

      {/* Class Comparison Dialog */}
      <BoletimClassComparison
        open={comparisonDialog}
        onOpenChange={setComparisonDialog}
      />

      {/* Batch Grade Entry Dialog */}
      {selectedClassSubject && (
        <BoletimBatchEntry
          open={batchDialog}
          onClose={() => setBatchDialog(false)}
          classSubjectId={selectedClassSubject}
          classSubjectLabel={currentCs ? classSubjectLabel(currentCs) : ''}
          enrollments={enrollments as any}
          templateItems={templateItems}
          existingGrades={grades.map(g => ({
            id: g.id,
            enrollment_id: g.enrollment_id,
            grade_type: g.grade_type,
            grade_value: g.grade_value,
          }))}
          onSaved={() => {
            setBatchDialog(false);
            loadEnrollmentsAndGrades(selectedClassSubject);
          }}
          gradesClosed={gradesClosed}
        />
      )}
    </div>
  );
};

export default Boletim;

