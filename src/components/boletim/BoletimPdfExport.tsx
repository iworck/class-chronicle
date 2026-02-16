import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface PdfExportProps {
  subjectName: string;
  classCode: string;
  minGrade: number;
  minAttendance: number;
  students: {
    name: string;
    enrollment: string;
    avg: number | null;
    attPct: number | null;
    status: string;
    grades: { type: string; value: number }[];
  }[];
  templateItems: { name: string; counts_in_final: boolean }[];
}

export function BoletimPdfExport({
  subjectName,
  classCode,
  minGrade,
  minAttendance,
  students,
  templateItems,
}: PdfExportProps) {
  function exportPdf() {
    const doc = new jsPDF({ orientation: 'landscape' });

    // Header
    doc.setFontSize(16);
    doc.text('Boletim de Notas', 14, 20);
    doc.setFontSize(10);
    doc.text(`Turma: ${classCode}  |  Disciplina: ${subjectName}`, 14, 28);
    doc.text(`Nota mínima: ${minGrade.toFixed(1)}  |  Frequência mínima: ${minAttendance.toFixed(0)}%`, 14, 34);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, 14, 40);

    // Build columns
    const gradeColumns = templateItems.length > 0
      ? templateItems.map(t => t.name)
      : [...new Set(students.flatMap(s => s.grades.map(g => g.type)))];

    const columns = ['Aluno', 'Matrícula', ...gradeColumns, 'Média', 'Freq.', 'Status'];

    const rows = students.map(s => {
      const gradeValues = gradeColumns.map(col => {
        const g = s.grades.find(gr => gr.type.toUpperCase() === col.toUpperCase());
        return g ? g.value.toFixed(1) : '—';
      });
      return [
        s.name,
        s.enrollment,
        ...gradeValues,
        s.avg !== null ? s.avg.toFixed(2) : '—',
        s.attPct !== null ? `${s.attPct.toFixed(0)}%` : 'S/A',
        s.status === 'APROVADO' ? 'Aprovado' : s.status === 'REPROVADO' ? 'Reprovado' : s.status === 'TRANCADO' ? 'Trancado' : 'Cursando',
      ];
    });

    autoTable(doc, {
      head: [columns],
      body: rows,
      startY: 46,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246] },
      didParseCell: (data) => {
        // Color status cell
        if (data.section === 'body' && data.column.index === columns.length - 1) {
          const val = String(data.cell.raw);
          if (val === 'Aprovado') {
            data.cell.styles.textColor = [16, 185, 129];
            data.cell.styles.fontStyle = 'bold';
          } else if (val === 'Reprovado') {
            data.cell.styles.textColor = [239, 68, 68];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    // Summary
    const finalY = (doc as any).lastAutoTable?.finalY || 200;
    const avgs = students.map(s => s.avg).filter((a): a is number => a !== null);
    const classAvg = avgs.length > 0 ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null;
    const aprovados = students.filter(s => s.status === 'APROVADO').length;
    const reprovados = students.filter(s => s.status === 'REPROVADO').length;

    doc.setFontSize(9);
    doc.text(`Resumo: ${students.length} alunos | ${aprovados} aprovados | ${reprovados} reprovados | Média da turma: ${classAvg !== null ? classAvg.toFixed(2) : '—'}`, 14, finalY + 10);

    doc.save(`boletim_${classCode}_${subjectName.replace(/\s/g, '_')}.pdf`);
  }

  return (
    <Button variant="outline" size="sm" onClick={exportPdf}>
      <Download className="w-4 h-4 mr-2" />
      Exportar PDF
    </Button>
  );
}
