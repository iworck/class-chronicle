import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AtRiskStudent {
  studentName: string;
  enrollment: string;
  subjectName: string;
  classCode: string;
  avgGrade: number | null;
  attendancePct: number | null;
  minGrade: number;
  minAttendance: number;
  riskType: 'grade' | 'attendance' | 'both';
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check staff
    const { data: callerRoles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", caller.id);
    const roles = (callerRoles || []).map(r => r.role);
    const isStaff = roles.some(r => ['super_admin', 'admin', 'diretor', 'gerente', 'coordenador'].includes(r));
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Permissão negada" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { class_subject_id, channels = ['email'] } = await req.json();

    if (!class_subject_id) {
      return new Response(JSON.stringify({ error: "class_subject_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load class_subject details
    const { data: cs } = await supabaseAdmin
      .from("class_subjects")
      .select("id, class_id, subject_id, professor_user_id, class:classes(id, code, course_id), subject:subjects(id, name, code, min_grade, min_attendance_pct)")
      .eq("id", class_subject_id)
      .single();

    if (!cs) {
      return new Response(JSON.stringify({ error: "Disciplina não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subj = cs.subject as any;
    const cls = cs.class as any;
    const minGrade = Number(subj?.min_grade ?? 7.0);
    const minAtt = Number(subj?.min_attendance_pct ?? 75.0);

    // Get students
    const { data: classStudents } = await supabaseAdmin
      .from("class_students").select("student_id")
      .eq("class_id", cs.class_id).eq("status", "ATIVO");
    const studentIds = (classStudents || []).map(s => s.student_id);

    if (studentIds.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "Nenhum aluno na turma" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get enrollments with student details
    const { data: enrollments } = await supabaseAdmin
      .from("student_subject_enrollments")
      .select("id, student_id, status, student:students(id, name, enrollment)")
      .eq("subject_id", cs.subject_id)
      .in("student_id", studentIds);

    if (!enrollments || enrollments.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "Nenhuma matrícula encontrada" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get grades
    const enrollIds = enrollments.map(e => e.id);
    const { data: grades } = await supabaseAdmin
      .from("student_grades").select("enrollment_id, grade_value, counts_in_final, weight")
      .in("enrollment_id", enrollIds);

    // Get attendance
    const { data: sessions } = await supabaseAdmin
      .from("attendance_sessions").select("id")
      .eq("class_id", cs.class_id).eq("subject_id", cs.subject_id)
      .in("status", ["ENCERRADA", "AUDITORIA_FINALIZADA"]);
    const sessionIds = (sessions || []).map(s => s.id);
    const totalSessions = sessionIds.length;

    let attendanceRecords: any[] = [];
    if (totalSessions > 0) {
      const { data: records } = await supabaseAdmin
        .from("attendance_records").select("student_id, final_status")
        .in("session_id", sessionIds).in("student_id", studentIds);
      attendanceRecords = records || [];
    }

    // Find at-risk students
    const atRiskList: AtRiskStudent[] = [];

    for (const enr of enrollments) {
      if (enr.status === 'TRANCADO') continue;

      const student = enr.student as any;
      const studentGrades = (grades || []).filter(g => g.enrollment_id === enr.id && g.counts_in_final !== false);
      let avg: number | null = null;

      if (studentGrades.length > 0) {
        const totalWeight = studentGrades.reduce((a, g) => a + (g.weight || 1), 0);
        const weightedSum = studentGrades.reduce((a, g) => a + g.grade_value * (g.weight || 1), 0);
        avg = totalWeight > 0 ? weightedSum / totalWeight : null;
      }

      let attPct: number | null = null;
      if (totalSessions > 0) {
        const present = attendanceRecords.filter(r => r.student_id === enr.student_id && r.final_status === 'PRESENTE').length;
        attPct = (present / totalSessions) * 100;
      }

      const avgRisk = avg !== null && avg < minGrade;
      const attRisk = attPct !== null && attPct < minAtt;

      if (avgRisk || attRisk) {
        atRiskList.push({
          studentName: student?.name || '—',
          enrollment: student?.enrollment || '—',
          subjectName: subj?.name || '—',
          classCode: cls?.code || '—',
          avgGrade: avg,
          attendancePct: attPct,
          minGrade,
          minAttendance: minAtt,
          riskType: avgRisk && attRisk ? 'both' : avgRisk ? 'grade' : 'attendance',
        });
      }
    }

    if (atRiskList.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "Nenhum aluno em situação de risco" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get coordinator/admin to notify
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles").select("institution_id, email, name").eq("id", caller.id).single();

    if (!callerProfile?.institution_id) {
      return new Response(JSON.stringify({ error: "Usuário sem instituição" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get course coordinator/director emails
    const courseId = cls?.course_id;
    const recipientEmails: { email: string; name: string }[] = [];

    if (courseId) {
      const { data: course } = await supabaseAdmin
        .from("courses").select("coordinator_user_id, director_user_id").eq("id", courseId).single();

      const recipientIds: string[] = [];
      if (course?.coordinator_user_id) recipientIds.push(course.coordinator_user_id);
      if (course?.director_user_id) recipientIds.push(course.director_user_id);

      if (recipientIds.length > 0) {
        const { data: recipientProfiles } = await supabaseAdmin
          .from("profiles").select("id, email, name, phone").in("id", recipientIds);

        for (const p of (recipientProfiles || [])) {
          if (p.email) recipientEmails.push({ email: p.email, name: p.name });
        }
      }
    }

    // Also include the caller
    if (callerProfile.email && !recipientEmails.some(r => r.email === callerProfile.email)) {
      recipientEmails.push({ email: callerProfile.email, name: callerProfile.name });
    }

    let sentCount = 0;
    const errors: string[] = [];

    // Build alert content
    const riskSummary = atRiskList.map(s => {
      const issues: string[] = [];
      if (s.riskType === 'grade' || s.riskType === 'both') {
        issues.push(`Média: ${s.avgGrade?.toFixed(2) ?? '—'} (mín: ${s.minGrade.toFixed(1)})`);
      }
      if (s.riskType === 'attendance' || s.riskType === 'both') {
        issues.push(`Freq.: ${s.attendancePct?.toFixed(0) ?? '—'}% (mín: ${s.minAttendance.toFixed(0)}%)`);
      }
      return `• ${s.studentName} (${s.enrollment}): ${issues.join(' | ')}`;
    }).join('\n');

    const subjectLine = `⚠️ Alerta: ${atRiskList.length} aluno(s) em risco — ${subj?.name} (${cls?.code})`;
    const htmlBody = `
      <h2 style="color: #d97706;">⚠️ Alerta de Alunos em Risco</h2>
      <p><strong>Disciplina:</strong> ${subj?.name}<br/>
      <strong>Turma:</strong> ${cls?.code}<br/>
      <strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
      <hr/>
      <p><strong>${atRiskList.length} aluno(s) em situação de risco:</strong></p>
      <table style="border-collapse: collapse; width: 100%; font-size: 14px;">
        <tr style="background-color: #f3f4f6;">
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Aluno</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">Matrícula</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">Média</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">Freq.</th>
          <th style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">Risco</th>
        </tr>
        ${atRiskList.map(s => `
          <tr>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${s.studentName}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb;">${s.enrollment}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; ${s.riskType !== 'attendance' ? 'color: #dc2626; font-weight: bold;' : ''}">${s.avgGrade?.toFixed(2) ?? '—'}</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center; ${s.riskType !== 'grade' ? 'color: #dc2626; font-weight: bold;' : ''}">${s.attendancePct?.toFixed(0) ?? '—'}%</td>
            <td style="padding: 8px; border: 1px solid #e5e7eb; text-align: center;">
              ${s.riskType === 'both' ? '📉 Nota + Freq.' : s.riskType === 'grade' ? '📉 Nota' : '📉 Freq.'}
            </td>
          </tr>
        `).join('')}
      </table>
      <p style="margin-top: 16px; color: #6b7280; font-size: 12px;">
        Critérios: Nota mínima ${minGrade.toFixed(1)} | Frequência mínima ${minAtt.toFixed(0)}%
      </p>
    `;

    // Send emails
    if (channels.includes('email')) {
      for (const recipient of recipientEmails) {
        try {
          const { data: emailSettings } = await supabaseAdmin
            .from("email_settings").select("*")
            .eq("institution_id", callerProfile.institution_id)
            .eq("is_active", true).single();

          if (emailSettings) {
            // Call internal send-email by making the same SMTP logic
            const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": authHeader!,
              },
              body: JSON.stringify({
                to: recipient.email,
                to_name: recipient.name,
                subject: subjectLine,
                html: htmlBody,
                message_type: "ALERTA_RISCO",
              }),
            });

            if (emailResponse.ok) {
              sentCount++;
            } else {
              const errBody = await emailResponse.json();
              errors.push(`Email para ${recipient.email}: ${errBody.error}`);
            }
          }
        } catch (err: any) {
          errors.push(`Email para ${recipient.email}: ${err.message}`);
        }
      }
    }

    // Send WhatsApp
    if (channels.includes('whatsapp')) {
      // Get phone numbers of coordinators
      const phoneRecipients: { phone: string; name: string }[] = [];
      if (courseId) {
        const { data: course } = await supabaseAdmin
          .from("courses").select("coordinator_user_id, director_user_id").eq("id", courseId).single();

        const recipientIds: string[] = [];
        if (course?.coordinator_user_id) recipientIds.push(course.coordinator_user_id);
        if (course?.director_user_id) recipientIds.push(course.director_user_id);

        if (recipientIds.length > 0) {
          const { data: profiles } = await supabaseAdmin
            .from("profiles").select("phone, name").in("id", recipientIds);
          for (const p of (profiles || [])) {
            if (p.phone) phoneRecipients.push({ phone: p.phone, name: p.name });
          }
        }
      }

      const whatsappMessage = `${subjectLine}\n\n${riskSummary}\n\nCritérios: Nota ≥ ${minGrade.toFixed(1)} | Freq. ≥ ${minAtt.toFixed(0)}%`;

      for (const recipient of phoneRecipients) {
        try {
          const whatsappResponse = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": authHeader!,
            },
            body: JSON.stringify({
              phone: recipient.phone,
              message: whatsappMessage,
              institution_id: callerProfile.institution_id,
              message_type: "ALERTA_RISCO",
              recipient_name: recipient.name,
            }),
          });

          if (whatsappResponse.ok) {
            sentCount++;
          } else {
            const errBody = await whatsappResponse.json();
            errors.push(`WhatsApp para ${recipient.phone}: ${errBody.error}`);
          }
        } catch (err: any) {
          errors.push(`WhatsApp para ${recipient.phone}: ${err.message}`);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      at_risk_count: atRiskList.length,
      sent: sentCount,
      errors: errors.length > 0 ? errors : undefined,
      students: atRiskList.map(s => ({ name: s.studentName, enrollment: s.enrollment, riskType: s.riskType })),
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
