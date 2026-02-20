import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SOURCE_LABELS: Record<string, string> = {
  AUTO_ALUNO: 'Automática',
  MANUAL_PROF: 'Manual (Prof.)',
  MANUAL_COORD: 'Manual (Coord.)',
};

const STATUS_LABELS: Record<string, string> = {
  PRESENTE: 'Presente',
  FALTA: 'Falta',
  JUSTIFICADO: 'Justificado',
};

interface AtaParams {
  sessionId: string;
  lessonTitle: string;
  lessonNumber: number | null;
  lessonDate: string;
  className: string;
  subjectName: string;
  professorName: string;
  sessionOpenedAt: string | null;
  sessionClosedAt: string | null;
}

export async function generateAttendanceAta(params: AtaParams) {
  const {
    sessionId, lessonTitle, lessonNumber, lessonDate,
    className, subjectName, professorName,
    sessionOpenedAt, sessionClosedAt,
  } = params;

  toast({ title: '⏳ Gerando ATA...' });

  try {
    // Load session data
    const { data: sessionData } = await supabase
      .from('attendance_sessions')
      .select('class_id, status, entry_code_hash, close_token_hash, require_geo')
      .eq('id', sessionId)
      .single();

    if (!sessionData) {
      toast({ title: 'Erro', description: 'Sessão não encontrada.', variant: 'destructive' });
      return;
    }

    // Load students + records in parallel
    const [studentsRes, recordsRes] = await Promise.all([
      supabase
        .from('class_students')
        .select('student_id, students(id, name, enrollment)')
        .eq('class_id', sessionData.class_id)
        .eq('status', 'ATIVO'),
      supabase
        .from('attendance_records')
        .select('student_id, final_status, source, registered_at')
        .eq('session_id', sessionId),
    ]);

    const studentMap = new Map<string, { name: string; enrollment: string }>();
    (studentsRes.data || []).forEach((cs: any) => {
      if (cs.students) studentMap.set(cs.students.id, { name: cs.students.name, enrollment: cs.students.enrollment });
    });

    const recordMap = new Map<string, { status: string; source: string | null; registered_at: string | null }>();
    (recordsRes.data || []).forEach((r: any) => {
      recordMap.set(r.student_id, { status: r.final_status, source: r.source, registered_at: r.registered_at });
    });

    // Build rows sorted by name
    const rows: { name: string; enrollment: string; status: string; source: string; registeredAt: string }[] = [];
    studentMap.forEach((info, studentId) => {
      const record = recordMap.get(studentId);
      rows.push({
        name: info.name,
        enrollment: info.enrollment,
        status: record ? (STATUS_LABELS[record.status] || record.status) : 'Falta',
        source: record?.source ? (SOURCE_LABELS[record.source] || record.source) : '—',
        registeredAt: record?.registered_at
          ? format(new Date(record.registered_at), "HH:mm:ss", { locale: ptBR })
          : '—',
      });
    });
    rows.sort((a, b) => a.name.localeCompare(b.name));

    // Stats
    const total = rows.length;
    const presentes = rows.filter(r => r.status === 'Presente').length;
    const faltas = rows.filter(r => r.status === 'Falta').length;
    const justificados = rows.filter(r => r.status === 'Justificado').length;

    // Generate PDF
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 15;

    // Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('ATA DE FREQUÊNCIA', pageWidth / 2, y, { align: 'center' });
    y += 10;

    // Lesson info box
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setDrawColor(180);
    doc.roundedRect(14, y, pageWidth - 28, 38, 2, 2);

    const col1 = 18;
    const col2 = pageWidth / 2 + 5;
    y += 6;

    const labelValue = (x: number, yy: number, label: string, value: string) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100);
      doc.text(label, x, yy);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40);
      doc.text(value, x + doc.getTextWidth(label) + 2, yy);
    };

    labelValue(col1, y, 'Aula:', lessonNumber ? `${lessonNumber} — ${lessonTitle}` : lessonTitle);
    labelValue(col2, y, 'Data:', format(new Date(lessonDate + 'T12:00:00'), "dd/MM/yyyy (EEEE)", { locale: ptBR }));
    y += 6;
    labelValue(col1, y, 'Turma:', className);
    labelValue(col2, y, 'Disciplina:', subjectName);
    y += 6;
    labelValue(col1, y, 'Professor:', professorName);
    labelValue(col2, y, 'Status:', sessionData.status);
    y += 6;
    labelValue(col1, y, 'Abertura:',
      sessionOpenedAt ? format(new Date(sessionOpenedAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }) : '—'
    );
    labelValue(col2, y, 'Fechamento:',
      sessionClosedAt ? format(new Date(sessionClosedAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }) : '—'
    );
    y += 6;
    labelValue(col1, y, 'Geolocalização:', sessionData.require_geo ? 'Sim' : 'Não');
    labelValue(col2, y, 'ID Sessão:', sessionId.replace(/-/g, '').substring(0, 6).toUpperCase());

    y += 12;

    // Stats summary
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40);
    doc.text(`Resumo: ${presentes} presente(s)  ·  ${faltas} falta(s)  ·  ${justificados} justificado(s)  ·  Total: ${total}`, col1, y);
    y += 7;

    // Attendance table
    autoTable(doc, {
      startY: y,
      head: [['#', 'Aluno', 'Matrícula', 'Frequência', 'Forma de Registro', 'Hora']],
      body: rows.map((r, i) => [
        String(i + 1),
        r.name,
        r.enrollment,
        r.status,
        r.source,
        r.registeredAt,
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 55 },
        2: { cellWidth: 25 },
        3: { cellWidth: 22, halign: 'center' },
        4: { cellWidth: 30 },
        5: { cellWidth: 18, halign: 'center' },
      },
      margin: { left: 14, right: 14 },
    });

    // Footer with generation timestamp
    const finalY = (doc as any).lastAutoTable?.finalY || y + 20;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(140);
    doc.text(
      `Documento gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}`,
      pageWidth / 2,
      finalY + 10,
      { align: 'center' }
    );

    // Save
    const fileName = `ATA_${className}_${lessonDate}.pdf`;
    doc.save(fileName);

    toast({ title: '✅ ATA gerada com sucesso', description: fileName });
  } catch (err: any) {
    console.error('Erro ao gerar ATA:', err);
    toast({ title: 'Erro ao gerar ATA', description: err.message, variant: 'destructive' });
  }
}
