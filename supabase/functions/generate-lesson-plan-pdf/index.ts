import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { class_subject_id } = await req.json();
    if (!class_subject_id) {
      return new Response(JSON.stringify({ error: 'class_subject_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const htmlPath = `lesson_plans/${class_subject_id}.html`;

    // Check if cached HTML exists (bucket is public, use direct public URL)
    const { data: existingFile } = await supabase
      .storage
      .from('lesson-plans')
      .list('lesson_plans', { search: `${class_subject_id}.html` });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const publicUrl = `${supabaseUrl}/storage/v1/object/public/lesson-plans/${htmlPath}`;

    if (existingFile && existingFile.length > 0) {
      return new Response(JSON.stringify({ url: publicUrl, cached: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch class_subject data
    const { data: cs, error: csErr } = await supabase
      .from('class_subjects')
      .select('id, subject_id, ementa_override, plan_status, professor_user_id, bibliografia_basica, bibliografia_complementar, class_id')
      .eq('id', class_subject_id)
      .single();

    if (csErr || !cs) {
      return new Response(JSON.stringify({ error: 'Class subject not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch subject info
    const { data: subject } = await supabase
      .from('subjects')
      .select('name, code, workload_hours, min_grade, min_attendance_pct')
      .eq('id', cs.subject_id)
      .single();

    // Fetch class info
    const { data: classData } = await supabase
      .from('classes')
      .select('code, period')
      .eq('id', cs.class_id)
      .single();

    // Fetch lesson plan entries
    const { data: entries } = await supabase
      .from('lesson_plan_entries')
      .select('*')
      .eq('class_subject_id', class_subject_id)
      .order('entry_date');

    const allEntries = entries || [];
    const aulaEntries = allEntries.filter(e => e.entry_type === 'AULA');
    const provaEntries = allEntries.filter(e => e.entry_type === 'PROVA' || e.entry_type === 'AVALIACAO');

    // Generate HTML for PDF
    const html = generateHTML({
      subject: subject || { name: '—', code: '—', workload_hours: 0, min_grade: 0, min_attendance_pct: 0 },
      classData: classData || { code: '—', period: '—' },
      cs,
      aulaEntries,
      provaEntries,
      allEntries,
    });

    // Upload HTML to storage and return public URL (bucket is public)
    const htmlBytes = new TextEncoder().encode(html);

    await supabase.storage.from('lesson-plans').upload(htmlPath, htmlBytes, {
      contentType: 'text/html; charset=utf-8',
      upsert: true,
    });

    return new Response(JSON.stringify({ url: publicUrl, cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateHTML({ subject, classData, cs, aulaEntries, provaEntries, allEntries }: any) {
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const provaRows = provaEntries.map((e: any) => `
    <tr>
      <td>${e.exam_type || e.title || '—'}</td>
      <td>${formatDate(e.entry_date)}</td>
      <td>${e.title || '—'}</td>
      <td>${e.description || '—'}</td>
    </tr>
  `).join('');

  const aulaRows = aulaEntries.map((e: any) => `
    <tr>
      <td>${e.lesson_number ?? '—'}</td>
      <td>${formatDate(e.entry_date)}</td>
      <td>${e.title || '—'}</td>
      <td>${e.objective || '—'}</td>
      <td>${e.activities || '—'}</td>
      <td>${e.methodology || '—'}</td>
      <td>${e.resource || '—'}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Plano de Ensino — ${subject.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #1a1a1a; background: #fff; padding: 20px; }
    h1 { font-size: 18px; color: #1e40af; margin-bottom: 4px; }
    h2 { font-size: 13px; color: #1e40af; margin: 18px 0 6px; border-bottom: 2px solid #3b82f6; padding-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
    h3 { font-size: 11px; color: #374151; margin-bottom: 4px; font-weight: 700; text-transform: uppercase; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 3px solid #3b82f6; }
    .header-info { }
    .header-meta { text-align: right; color: #6b7280; font-size: 10px; }
    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
    .info-box { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; padding: 8px; }
    .info-box .label { font-size: 9px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px; }
    .info-box .value { font-weight: 700; color: #111827; font-size: 12px; }
    .section { margin-bottom: 14px; }
    .text-block { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 10px; white-space: pre-wrap; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-top: 4px; font-size: 10px; }
    thead tr { background: #1e40af; color: #fff; }
    thead th { padding: 6px 8px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; }
    tbody tr:nth-child(even) { background: #f9fafb; }
    tbody tr:hover { background: #eff6ff; }
    tbody td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    .badge-prova { background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; border-radius: 10px; padding: 2px 6px; font-size: 9px; font-weight: 700; text-transform: uppercase; }
    .footer { margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 8px; color: #9ca3af; font-size: 9px; display: flex; justify-content: space-between; }
    .no-data { color: #9ca3af; font-style: italic; padding: 8px 0; }
    @media print {
      body { padding: 10px; }
      @page { margin: 1.5cm; size: A4 landscape; }
      .no-print { display: none; }
    }
    .print-btn { 
      position: fixed; top: 16px; right: 16px; background: #3b82f6; color: white; 
      border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer; 
      font-size: 13px; font-weight: 600; z-index: 999;
      box-shadow: 0 2px 8px rgba(59,130,246,0.4);
    }
    .print-btn:hover { background: #2563eb; }
  </style>
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">⬇ Baixar / Imprimir PDF</button>

  <div class="header">
    <div class="header-info">
      <h1>${subject.name}</h1>
      <div style="color:#6b7280;margin-top:2px">Código: <strong>${subject.code}</strong> &nbsp;|&nbsp; Turma: <strong>${classData.code}</strong> &nbsp;|&nbsp; Período: <strong>${classData.period}</strong></div>
    </div>
    <div class="header-meta">
      <div>Plano de Ensino</div>
      <div>Gerado em ${today}</div>
      <div>Status: ${cs.plan_status}</div>
    </div>
  </div>

  <div class="info-grid">
    <div class="info-box">
      <div class="label">Carga Horária</div>
      <div class="value">${subject.workload_hours}h</div>
    </div>
    <div class="info-box">
      <div class="label">Nota Mínima</div>
      <div class="value">${subject.min_grade}</div>
    </div>
    <div class="info-box">
      <div class="label">Frequência Mínima</div>
      <div class="value">${subject.min_attendance_pct}%</div>
    </div>
  </div>

  ${cs.ementa_override ? `
  <div class="section">
    <h2>Ementa</h2>
    <div class="text-block">${cs.ementa_override}</div>
  </div>` : ''}

  ${(cs.bibliografia_basica || cs.bibliografia_complementar) ? `
  <div class="section">
    <h2>Bibliografias</h2>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">
      ${cs.bibliografia_basica ? `<div><h3>Básica</h3><div class="text-block">${cs.bibliografia_basica}</div></div>` : ''}
      ${cs.bibliografia_complementar ? `<div><h3>Complementar</h3><div class="text-block">${cs.bibliografia_complementar}</div></div>` : ''}
    </div>
  </div>` : ''}

  <div class="section">
    <h2>Metodologia de Avaliação</h2>
    ${provaEntries.length === 0 ? '<p class="no-data">Nenhuma avaliação cadastrada.</p>' : `
    <table>
      <thead><tr>
        <th>Tipo</th><th>Data</th><th>Título</th><th>Descrição</th>
      </tr></thead>
      <tbody>${provaRows}</tbody>
    </table>`}
  </div>

  <div class="section">
    <h2>Cronograma de Aulas</h2>
    ${aulaEntries.length === 0 ? '<p class="no-data">Nenhuma aula cadastrada.</p>' : `
    <table>
      <thead><tr>
        <th>#</th><th>Data</th><th>Conteúdo</th><th>Objetivo</th><th>Atividades</th><th>Metodologia</th><th>Recursos</th>
      </tr></thead>
      <tbody>${aulaRows}</tbody>
    </table>`}
  </div>

  <div class="footer">
    <span>Documento gerado automaticamente pelo sistema acadêmico</span>
    <span>${today}</span>
  </div>
</body>
</html>`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}
