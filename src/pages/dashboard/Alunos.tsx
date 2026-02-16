import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Search, Pencil, Trash2, Loader2, UserCheck, Eye, Upload, FileText, ArrowRightLeft, XCircle, PauseCircle,
} from 'lucide-react';
import EnrollmentTab from '@/components/student/EnrollmentTab';

interface Student {
  id: string;
  name: string;
  enrollment: string;
  course_id: string;
  status: 'ATIVO' | 'INATIVO';
  created_at: string;
}

interface StudentDetail {
  id: string;
  student_id: string;
  cpf: string | null;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  enrollment_status: string;
}

interface StudentDocument {
  id: string;
  student_id: string;
  document_type: string;
  file_path: string;
  file_name: string;
  created_at: string;
}

interface CourseRequest {
  id: string;
  student_id: string;
  request_type: string;
  current_course_id: string;
  target_course_id: string | null;
  justification: string;
  status: string;
  decided_by_user_id: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
}

interface Course {
  id: string;
  name: string;
}

const DOCUMENT_TYPES = [
  { value: 'RG', label: 'RG' },
  { value: 'CPF', label: 'CPF' },
  { value: 'COMPROVANTE_RESIDENCIA', label: 'Comprovante de Residência' },
  { value: 'HISTORICO', label: 'Histórico Escolar' },
  { value: 'FOTO', label: 'Foto 3x4' },
  { value: 'OUTROS', label: 'Outros' },
];

const ENROLLMENT_STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  MATRICULADO: { label: 'Matriculado', variant: 'default' },
  TRANCADO: { label: 'Trancado', variant: 'secondary' },
  CANCELADO: { label: 'Cancelado', variant: 'destructive' },
  TRANSFERIDO: { label: 'Transferido', variant: 'outline' },
};

const BRAZILIAN_STATES = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];

const Alunos = () => {
  const { hasRole, user } = useAuth();
  const canManage = hasRole('super_admin') || hasRole('admin') || hasRole('coordenador') || hasRole('gerente');

  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields - basic
  const [formName, setFormName] = useState('');
  const [formEnrollment, setFormEnrollment] = useState('');
  const [formCourseId, setFormCourseId] = useState('');
  const [formStatus, setFormStatus] = useState<'ATIVO' | 'INATIVO'>('ATIVO');

  // Form fields - details
  const [formCpf, setFormCpf] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formBirthDate, setFormBirthDate] = useState('');
  const [formStreet, setFormStreet] = useState('');
  const [formNumber, setFormNumber] = useState('');
  const [formComplement, setFormComplement] = useState('');
  const [formNeighborhood, setFormNeighborhood] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formZip, setFormZip] = useState('');

  // View dialog
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewStudent, setViewStudent] = useState<Student | null>(null);
  const [viewDetails, setViewDetails] = useState<StudentDetail | null>(null);
  const [viewDocuments, setViewDocuments] = useState<StudentDocument[]>([]);
  const [viewRequests, setViewRequests] = useState<CourseRequest[]>([]);
  const [viewTab, setViewTab] = useState('dados');
  const [viewLoading, setViewLoading] = useState(false);

  // Document upload
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docType, setDocType] = useState('RG');

  // Course request dialog
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [requestType, setRequestType] = useState('TROCA');
  const [requestTargetCourseId, setRequestTargetCourseId] = useState('');
  const [requestJustification, setRequestJustification] = useState('');
  const [requestStudentId, setRequestStudentId] = useState('');
  const [requestCurrentCourseId, setRequestCurrentCourseId] = useState('');
  const [savingRequest, setSavingRequest] = useState(false);

  // Decision dialog
  const [decisionDialogOpen, setDecisionDialogOpen] = useState(false);
  const [decisionRequest, setDecisionRequest] = useState<CourseRequest | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [decidingRequest, setDecidingRequest] = useState(false);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    setLoading(true);
    const [studRes, courseRes] = await Promise.all([
      supabase.from('students').select('*').order('name'),
      supabase.from('courses').select('id, name').eq('status', 'ATIVO').order('name'),
    ]);
    if (studRes.error) {
      toast({ title: 'Erro ao carregar alunos', description: studRes.error.message, variant: 'destructive' });
    } else {
      setStudents((studRes.data as Student[]) || []);
    }
    setCourses((courseRes.data as Course[]) || []);
    setLoading(false);
  }

  const courseMap = useMemo(() => Object.fromEntries(courses.map(c => [c.id, c.name])), [courses]);

  function openCreate() {
    setEditing(null);
    setFormName(''); setFormEnrollment(''); setFormCourseId(''); setFormStatus('ATIVO');
    setFormCpf(''); setFormPhone(''); setFormEmail(''); setFormBirthDate('');
    setFormStreet(''); setFormNumber(''); setFormComplement(''); setFormNeighborhood('');
    setFormCity(''); setFormState(''); setFormZip('');
    setDialogOpen(true);
  }

  async function openEdit(student: Student) {
    setEditing(student);
    setFormName(student.name); setFormEnrollment(student.enrollment);
    setFormCourseId(student.course_id); setFormStatus(student.status);

    // Load details
    const { data } = await supabase.from('student_details').select('*').eq('student_id', student.id).maybeSingle();
    if (data) {
      const d = data as any;
      setFormCpf(d.cpf || ''); setFormPhone(d.phone || ''); setFormEmail(d.email || '');
      setFormBirthDate(d.birth_date || ''); setFormStreet(d.address_street || '');
      setFormNumber(d.address_number || ''); setFormComplement(d.address_complement || '');
      setFormNeighborhood(d.address_neighborhood || ''); setFormCity(d.address_city || '');
      setFormState(d.address_state || ''); setFormZip(d.address_zip || '');
    } else {
      setFormCpf(''); setFormPhone(''); setFormEmail(''); setFormBirthDate('');
      setFormStreet(''); setFormNumber(''); setFormComplement(''); setFormNeighborhood('');
      setFormCity(''); setFormState(''); setFormZip('');
    }
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!formName.trim() || !formEnrollment.trim() || !formCourseId) {
      toast({ title: 'Preencha nome, matrícula e curso', variant: 'destructive' });
      return;
    }

    setSaving(true);
    const studentPayload = {
      name: formName.trim(),
      enrollment: formEnrollment.trim(),
      course_id: formCourseId,
      status: formStatus,
    };

    let studentId = editing?.id;

    if (editing) {
      const { error } = await supabase.from('students').update(studentPayload).eq('id', editing.id);
      if (error) {
        toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
        setSaving(false);
        return;
      }
    } else {
      const { data, error } = await supabase.from('students').insert(studentPayload).select('id').single();
      if (error) {
        toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' });
        setSaving(false);
        return;
      }
      studentId = data.id;
    }

    // Upsert details
    if (studentId) {
      const detailPayload = {
        student_id: studentId,
        cpf: formCpf.trim() || null,
        phone: formPhone.trim() || null,
        email: formEmail.trim() || null,
        birth_date: formBirthDate || null,
        address_street: formStreet.trim() || null,
        address_number: formNumber.trim() || null,
        address_complement: formComplement.trim() || null,
        address_neighborhood: formNeighborhood.trim() || null,
        address_city: formCity.trim() || null,
        address_state: formState || null,
        address_zip: formZip.trim() || null,
      };

      const { data: existing } = await supabase.from('student_details').select('id').eq('student_id', studentId).maybeSingle();
      if (existing) {
        await supabase.from('student_details').update(detailPayload).eq('student_id', studentId);
      } else {
        await supabase.from('student_details').insert(detailPayload);
      }
    }

    toast({ title: editing ? 'Aluno atualizado com sucesso' : 'Aluno cadastrado com sucesso' });
    setDialogOpen(false);
    fetchAll();
    setSaving(false);
  }

  async function handleDeactivate(id: string) {
    const { error } = await supabase.from('students').update({ status: 'INATIVO' }).eq('id', id);
    if (error) {
      toast({ title: 'Erro ao inativar', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Aluno inativado' });
      fetchAll();
    }
  }

  // View student details
  async function openView(student: Student) {
    setViewStudent(student);
    setViewTab('dados');
    setViewDialogOpen(true);
    setViewLoading(true);

    const [detailRes, docRes, reqRes] = await Promise.all([
      supabase.from('student_details').select('*').eq('student_id', student.id).maybeSingle(),
      supabase.from('student_documents').select('*').eq('student_id', student.id).order('created_at', { ascending: false }),
      supabase.from('student_course_requests').select('*').eq('student_id', student.id).order('created_at', { ascending: false }),
    ]);

    setViewDetails((detailRes.data as StudentDetail | null) || null);
    setViewDocuments((docRes.data as StudentDocument[]) || []);
    setViewRequests((reqRes.data as CourseRequest[]) || []);
    setViewLoading(false);
  }

  // Document upload
  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.[0] || !viewStudent) return;
    const file = e.target.files[0];
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande (máx 10MB)', variant: 'destructive' });
      return;
    }

    setUploadingDoc(true);
    const filePath = `${viewStudent.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('student-documents').upload(filePath, file);
    if (uploadError) {
      toast({ title: 'Erro no upload', description: uploadError.message, variant: 'destructive' });
      setUploadingDoc(false);
      return;
    }

    const { error: insertError } = await supabase.from('student_documents').insert({
      student_id: viewStudent.id,
      document_type: docType,
      file_path: filePath,
      file_name: file.name,
      uploaded_by: user?.id,
    });

    if (insertError) {
      toast({ title: 'Erro ao registrar documento', description: insertError.message, variant: 'destructive' });
    } else {
      toast({ title: 'Documento enviado com sucesso' });
      const { data } = await supabase.from('student_documents').select('*').eq('student_id', viewStudent.id).order('created_at', { ascending: false });
      setViewDocuments((data as StudentDocument[]) || []);
    }
    setUploadingDoc(false);
    e.target.value = '';
  }

  async function handleDeleteDoc(doc: StudentDocument) {
    await supabase.storage.from('student-documents').remove([doc.file_path]);
    await supabase.from('student_documents').delete().eq('id', doc.id);
    toast({ title: 'Documento removido' });
    if (viewStudent) {
      const { data } = await supabase.from('student_documents').select('*').eq('student_id', viewStudent.id).order('created_at', { ascending: false });
      setViewDocuments((data as StudentDocument[]) || []);
    }
  }

  async function downloadDoc(doc: StudentDocument) {
    const { data, error } = await supabase.storage.from('student-documents').download(doc.file_path);
    if (error || !data) {
      toast({ title: 'Erro ao baixar', description: error?.message, variant: 'destructive' });
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.file_name;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Course requests
  function openRequestDialog(student: Student) {
    setRequestStudentId(student.id);
    setRequestCurrentCourseId(student.course_id);
    setRequestType('TROCA');
    setRequestTargetCourseId('');
    setRequestJustification('');
    setRequestDialogOpen(true);
  }

  async function handleCreateRequest() {
    if (!requestJustification.trim()) {
      toast({ title: 'Informe a justificativa', variant: 'destructive' });
      return;
    }
    if (requestType === 'TROCA' && !requestTargetCourseId) {
      toast({ title: 'Selecione o curso de destino', variant: 'destructive' });
      return;
    }

    setSavingRequest(true);
    const { error } = await supabase.from('student_course_requests').insert({
      student_id: requestStudentId,
      request_type: requestType,
      current_course_id: requestCurrentCourseId,
      target_course_id: requestType === 'TROCA' ? requestTargetCourseId : null,
      justification: requestJustification.trim(),
    });

    if (error) {
      toast({ title: 'Erro ao criar solicitação', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Solicitação criada com sucesso' });
      setRequestDialogOpen(false);
      // Refresh view if open
      if (viewStudent && viewStudent.id === requestStudentId) {
        const { data } = await supabase.from('student_course_requests').select('*').eq('student_id', viewStudent.id).order('created_at', { ascending: false });
        setViewRequests((data as CourseRequest[]) || []);
      }
    }
    setSavingRequest(false);
  }

  function openDecision(req: CourseRequest) {
    setDecisionRequest(req);
    setDecisionNote('');
    setDecisionDialogOpen(true);
  }

  async function handleDecision(approved: boolean) {
    if (!decisionRequest) return;
    setDecidingRequest(true);

    const newStatus = approved ? 'APROVADO' : 'REPROVADO';
    const { error } = await supabase.from('student_course_requests')
      .update({
        status: newStatus,
        decided_by_user_id: user?.id,
        decided_at: new Date().toISOString(),
        decision_note: decisionNote.trim() || null,
      })
      .eq('id', decisionRequest.id);

    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    } else {
      // If approved, apply the change
      if (approved && decisionRequest.request_type === 'TROCA' && decisionRequest.target_course_id) {
        await supabase.from('students').update({ course_id: decisionRequest.target_course_id }).eq('id', decisionRequest.student_id);
        // Update enrollment_status
        await supabase.from('student_details').update({ enrollment_status: 'TRANSFERIDO' }).eq('student_id', decisionRequest.student_id);
      } else if (approved && decisionRequest.request_type === 'CANCELAMENTO') {
        await supabase.from('students').update({ status: 'INATIVO' }).eq('id', decisionRequest.student_id);
        await supabase.from('student_details').update({ enrollment_status: 'CANCELADO' }).eq('student_id', decisionRequest.student_id);
      } else if (approved && decisionRequest.request_type === 'TRANCAMENTO') {
        await supabase.from('student_details').update({ enrollment_status: 'TRANCADO' }).eq('student_id', decisionRequest.student_id);
      }

      toast({ title: `Solicitação ${newStatus.toLowerCase()}` });
      setDecisionDialogOpen(false);
      fetchAll();
      // Refresh view
      if (viewStudent) {
        const { data } = await supabase.from('student_course_requests').select('*').eq('student_id', viewStudent.id).order('created_at', { ascending: false });
        setViewRequests((data as CourseRequest[]) || []);
      }
    }
    setDecidingRequest(false);
  }

  const filtered = students.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.enrollment.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = students.filter(s => s.status === 'ATIVO').length;

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-foreground">Alunos</h1>
        <p className="text-muted-foreground text-sm">Cadastro, matrícula e gestão de alunos universitários.</p>
      </div>

      {/* Stats */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="stats-card before:bg-primary">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-display font-bold text-foreground">{students.length}</p>
        </div>
        <div className="stats-card before:bg-success">
          <p className="text-sm text-muted-foreground">Ativos</p>
          <p className="text-2xl font-display font-bold text-foreground">{activeCount}</p>
        </div>
        <div className="stats-card before:bg-destructive">
          <p className="text-sm text-muted-foreground">Inativos</p>
          <p className="text-2xl font-display font-bold text-foreground">{students.length - activeCount}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-card">
        <div className="p-4 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between border-b border-border">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou matrícula..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          {canManage && (
            <Button onClick={openCreate} size="sm">
              <Plus className="w-4 h-4 mr-2" /> Novo Aluno
            </Button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <UserCheck className="w-12 h-12 mb-4 opacity-30" />
            <p>Nenhum aluno encontrado.</p>
            {canManage && (
              <Button variant="outline" size="sm" className="mt-4" onClick={openCreate}>
                <Plus className="w-4 h-4 mr-2" /> Cadastrar primeiro aluno
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Matrícula</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(student => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{student.enrollment}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{courseMap[student.course_id] || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={student.status === 'ATIVO' ? 'default' : 'secondary'}>{student.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button variant="ghost" size="icon" onClick={() => openView(student)} title="Detalhes">
                      <Eye className="w-4 h-4" />
                    </Button>
                    {canManage && (
                      <>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(student)} title="Editar">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openRequestDialog(student)} title="Solicitação">
                          <ArrowRightLeft className="w-4 h-4" />
                        </Button>
                        {student.status === 'ATIVO' && (
                          <Button variant="ghost" size="icon" onClick={() => handleDeactivate(student.id)} title="Inativar">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Aluno' : 'Novo Aluno'}</DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="basico" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basico">Dados Básicos</TabsTrigger>
              <TabsTrigger value="pessoal">Dados Pessoais</TabsTrigger>
            </TabsList>

            <TabsContent value="basico" className="space-y-4 mt-4">
              <div className="grid gap-4">
                <div>
                  <Label>Nome Completo *</Label>
                  <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Nome do aluno" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Matrícula *</Label>
                    <Input value={formEnrollment} onChange={e => setFormEnrollment(e.target.value)} placeholder="Número de matrícula" />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={formStatus} onValueChange={v => setFormStatus(v as any)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ATIVO">Ativo</SelectItem>
                        <SelectItem value="INATIVO">Inativo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Curso *</Label>
                  <Select value={formCourseId} onValueChange={setFormCourseId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o curso" /></SelectTrigger>
                    <SelectContent>
                      {courses.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="pessoal" className="space-y-4 mt-4">
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>CPF</Label>
                    <Input value={formCpf} onChange={e => setFormCpf(e.target.value)} placeholder="000.000.000-00" maxLength={14} />
                  </div>
                  <div>
                    <Label>Data de Nascimento</Label>
                    <Input type="date" value={formBirthDate} onChange={e => setFormBirthDate(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Telefone</Label>
                    <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="(00) 00000-0000" maxLength={20} />
                  </div>
                  <div>
                    <Label>E-mail</Label>
                    <Input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="email@exemplo.com" />
                  </div>
                </div>
                <div className="border-t border-border pt-4">
                  <p className="text-sm font-medium text-foreground mb-3">Endereço</p>
                  <div className="grid gap-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <Label>Rua</Label>
                        <Input value={formStreet} onChange={e => setFormStreet(e.target.value)} placeholder="Rua / Avenida" />
                      </div>
                      <div>
                        <Label>Número</Label>
                        <Input value={formNumber} onChange={e => setFormNumber(e.target.value)} placeholder="Nº" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Complemento</Label>
                        <Input value={formComplement} onChange={e => setFormComplement(e.target.value)} placeholder="Apto, Bloco..." />
                      </div>
                      <div>
                        <Label>Bairro</Label>
                        <Input value={formNeighborhood} onChange={e => setFormNeighborhood(e.target.value)} placeholder="Bairro" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label>Cidade</Label>
                        <Input value={formCity} onChange={e => setFormCity(e.target.value)} placeholder="Cidade" />
                      </div>
                      <div>
                        <Label>Estado</Label>
                        <Select value={formState} onValueChange={setFormState}>
                          <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                          <SelectContent>
                            {BRAZILIAN_STATES.map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>CEP</Label>
                        <Input value={formZip} onChange={e => setFormZip(e.target.value)} placeholder="00000-000" maxLength={10} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5" />
              {viewStudent?.name}
            </DialogTitle>
          </DialogHeader>

          {viewLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs value={viewTab} onValueChange={setViewTab} className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="dados">Dados</TabsTrigger>
                <TabsTrigger value="matricula">Matrícula</TabsTrigger>
                <TabsTrigger value="documentos">Documentos</TabsTrigger>
                <TabsTrigger value="vinculo">Vínculo</TabsTrigger>
                <TabsTrigger value="solicitacoes">Solicitações</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="mt-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <InfoField label="Nome" value={viewStudent?.name} />
                  <InfoField label="Matrícula" value={viewStudent?.enrollment} />
                  <InfoField label="Curso" value={viewStudent ? courseMap[viewStudent.course_id] : ''} />
                  <InfoField label="Status" value={viewStudent?.status} />
                </div>
                {viewDetails && (
                  <>
                    <div className="border-t border-border pt-4">
                      <p className="text-sm font-medium text-foreground mb-3">Dados Pessoais</p>
                      <div className="grid grid-cols-2 gap-4">
                        <InfoField label="CPF" value={viewDetails.cpf} />
                        <InfoField label="Data de Nascimento" value={viewDetails.birth_date} />
                        <InfoField label="Telefone" value={viewDetails.phone} />
                        <InfoField label="E-mail" value={viewDetails.email} />
                        <InfoField label="Status da Matrícula" value={ENROLLMENT_STATUS_MAP[viewDetails.enrollment_status]?.label || viewDetails.enrollment_status} />
                      </div>
                    </div>
                    <div className="border-t border-border pt-4">
                      <p className="text-sm font-medium text-foreground mb-3">Endereço</p>
                      <div className="grid grid-cols-2 gap-4">
                        <InfoField label="Rua" value={viewDetails.address_street} />
                        <InfoField label="Número" value={viewDetails.address_number} />
                        <InfoField label="Complemento" value={viewDetails.address_complement} />
                        <InfoField label="Bairro" value={viewDetails.address_neighborhood} />
                        <InfoField label="Cidade" value={viewDetails.address_city} />
                        <InfoField label="Estado" value={viewDetails.address_state} />
                        <InfoField label="CEP" value={viewDetails.address_zip} />
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>

              <TabsContent value="matricula" className="mt-4">
                {viewStudent && (
                  <EnrollmentTab
                    studentId={viewStudent.id}
                    studentCourseId={viewStudent.course_id}
                    canManage={canManage}
                  />
                )}
              </TabsContent>

              <TabsContent value="documentos" className="mt-4 space-y-4">
                {canManage && (
                  <div className="flex items-end gap-3 p-4 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <Label>Tipo de Documento</Label>
                      <Select value={docType} onValueChange={setDocType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DOCUMENT_TYPES.map(dt => (
                            <SelectItem key={dt.value} value={dt.value}>{dt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="doc-upload" className="cursor-pointer">
                        <Button asChild variant="outline" size="sm" disabled={uploadingDoc}>
                          <span>
                            {uploadingDoc ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
                            Enviar
                          </span>
                        </Button>
                      </Label>
                      <input id="doc-upload" type="file" className="hidden" onChange={handleDocUpload} accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" />
                    </div>
                  </div>
                )}

                {viewDocuments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum documento enviado.</p>
                ) : (
                  <div className="space-y-2">
                    {viewDocuments.map(doc => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium text-foreground">{doc.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {DOCUMENT_TYPES.find(dt => dt.value === doc.document_type)?.label || doc.document_type}
                              {' · '}
                              {new Date(doc.created_at).toLocaleDateString('pt-BR')}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => downloadDoc(doc)}>Baixar</Button>
                          {canManage && (
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteDoc(doc)}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="vinculo" className="mt-4 space-y-4">
                <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Curso Atual</span>
                    <span className="text-sm text-muted-foreground">{viewStudent ? courseMap[viewStudent.course_id] || '—' : '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Status da Matrícula</span>
                    {viewDetails ? (
                      <Badge variant={ENROLLMENT_STATUS_MAP[viewDetails.enrollment_status]?.variant || 'default'}>
                        {ENROLLMENT_STATUS_MAP[viewDetails.enrollment_status]?.label || viewDetails.enrollment_status}
                      </Badge>
                    ) : (
                      <Badge>Matriculado</Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">Status Geral</span>
                    <Badge variant={viewStudent?.status === 'ATIVO' ? 'default' : 'secondary'}>{viewStudent?.status}</Badge>
                  </div>
                </div>

                {canManage && viewStudent && (
                  <div className="border-t border-border pt-4">
                    <p className="text-sm font-medium text-foreground mb-3">Ações de Vínculo</p>
                    <div className="grid grid-cols-3 gap-3">
                      <Button variant="outline" size="sm" onClick={() => { setViewDialogOpen(false); openRequestDialog(viewStudent); setRequestType('TROCA'); }}>
                        <ArrowRightLeft className="w-4 h-4 mr-2" /> Trocar Curso
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { setViewDialogOpen(false); openRequestDialog(viewStudent); setRequestType('TRANCAMENTO'); }}>
                        <PauseCircle className="w-4 h-4 mr-2" /> Trancar
                      </Button>
                      <Button variant="outline" size="sm" className="text-destructive" onClick={() => { setViewDialogOpen(false); openRequestDialog(viewStudent); setRequestType('CANCELAMENTO'); }}>
                        <XCircle className="w-4 h-4 mr-2" /> Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="solicitacoes" className="mt-4 space-y-3">
                {viewRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma solicitação registrada.</p>
                ) : (
                  viewRequests.map(req => (
                    <div key={req.id} className="p-4 bg-muted/30 rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{req.request_type}</Badge>
                          <Badge variant={req.status === 'PENDENTE' ? 'secondary' : req.status === 'APROVADO' ? 'default' : 'destructive'}>
                            {req.status}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{req.justification}</p>
                      {req.request_type === 'TROCA' && req.target_course_id && (
                        <p className="text-xs text-muted-foreground">
                          De: {courseMap[req.current_course_id] || '—'} → Para: {courseMap[req.target_course_id] || '—'}
                        </p>
                      )}
                      {req.decision_note && (
                        <p className="text-xs text-muted-foreground italic">Nota: {req.decision_note}</p>
                      )}
                      {req.status === 'PENDENTE' && canManage && (hasRole('coordenador') || hasRole('admin') || hasRole('super_admin')) && (
                        <Button variant="outline" size="sm" onClick={() => openDecision(req)}>Avaliar</Button>
                      )}
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Course Request Dialog */}
      <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {requestType === 'TROCA' ? 'Solicitar Troca de Curso' : requestType === 'TRANCAMENTO' ? 'Solicitar Trancamento' : 'Solicitar Cancelamento'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Tipo de Solicitação</Label>
              <Select value={requestType} onValueChange={setRequestType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="TROCA">Troca de Curso</SelectItem>
                  <SelectItem value="TRANCAMENTO">Trancamento</SelectItem>
                  <SelectItem value="CANCELAMENTO">Cancelamento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {requestType === 'TROCA' && (
              <div>
                <Label>Curso de Destino *</Label>
                <Select value={requestTargetCourseId} onValueChange={setRequestTargetCourseId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o curso" /></SelectTrigger>
                  <SelectContent>
                    {courses.filter(c => c.id !== requestCurrentCourseId).map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Justificativa *</Label>
              <Textarea value={requestJustification} onChange={e => setRequestJustification(e.target.value)} placeholder="Descreva o motivo da solicitação..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button onClick={handleCreateRequest} disabled={savingRequest}>
              {savingRequest && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enviar Solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Decision Dialog */}
      <Dialog open={decisionDialogOpen} onOpenChange={setDecisionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Avaliar Solicitação</DialogTitle>
          </DialogHeader>
          {decisionRequest && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/30 rounded-lg space-y-1">
                <p className="text-sm"><strong>Tipo:</strong> {decisionRequest.request_type}</p>
                <p className="text-sm"><strong>Justificativa:</strong> {decisionRequest.justification}</p>
                {decisionRequest.request_type === 'TROCA' && decisionRequest.target_course_id && (
                  <p className="text-sm"><strong>Destino:</strong> {courseMap[decisionRequest.target_course_id] || '—'}</p>
                )}
              </div>
              <div>
                <Label>Observação (opcional)</Label>
                <Textarea value={decisionNote} onChange={e => setDecisionNote(e.target.value)} placeholder="Observação sobre a decisão..." rows={2} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => handleDecision(false)} disabled={decidingRequest}>
              Reprovar
            </Button>
            <Button onClick={() => handleDecision(true)} disabled={decidingRequest}>
              {decidingRequest && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Aprovar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function InfoField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || '—'}</p>
    </div>
  );
}

export default Alunos;
