import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
    const roles = (callerRoles || []).map((r: any) => r.role);
    const isStaff = roles.some((r: string) => ['super_admin', 'admin', 'diretor', 'gerente', 'coordenador', 'professor'].includes(r));
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "Permissão negada" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { class_subject_id } = await req.json();

    if (!class_subject_id) {
      return new Response(JSON.stringify({ error: "class_subject_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load class_subject details
    const { data: cs } = await supabaseAdmin
      .from("class_subjects")
      .select("id, class_id, subject_id, class:classes(id, code, course_id), subject:subjects(id, name, code, min_attendance_pct)")
      .eq("id", class_subject_id)
      .single();

    if (!cs) {
      return new Response(JSON.stringify({ error: "Disciplina não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subj = cs.subject as any;
    const cls = cs.class as any;
    const minAtt = Number(subj?.min_attendance_pct ?? 75.0);

    // Get students with user accounts (to send email)
    const { data: classStudents } = await supabaseAdmin
      .from("class_students")
      .select("student_id, student:students(id, name, enrollment, user_id)")
      .eq("class_id", cs.class_id)
      .eq("status", "ATIVO");

    if (!classStudents || classStudents.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "Nenhum aluno na turma" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get attendance sessions
    const { data: sessions } = await supabaseAdmin
      .from("attendance_sessions")
      .select("id")
      .eq("class_id", cs.class_id)
      .eq("subject_id", cs.subject_id)
      .in("status", ["ENCERRADA", "AUDITORIA_FINALIZADA"]);

    const sessionIds = (sessions || []).map((s: any) => s.id);
    const totalSessions = sessionIds.length;

    if (totalSessions === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0, message: "Nenhuma aula registrada ainda" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const studentIds = classStudents.map((cs: any) => cs.student_id);

    // Get all attendance records for this class
    const { data: attRecords } = await supabaseAdmin
      .from("attendance_records")
      .select("student_id, final_status")
      .in("session_id", sessionIds)
      .in("student_id", studentIds);

    // Get caller's institution for email settings
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles").select("institution_id, email, name").eq("id", caller.id).single();

    if (!callerProfile?.institution_id) {
      return new Response(JSON.stringify({ error: "Usuário sem instituição" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: emailSettings } = await supabaseAdmin
      .from("email_settings")
      .select("*")
      .eq("institution_id", callerProfile.institution_id)
      .eq("is_active", true)
      .single();

    if (!emailSettings) {
      return new Response(JSON.stringify({ error: "Configurações de email não encontradas para esta instituição" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;
    const errors: string[] = [];
    const atRiskStudents: any[] = [];

    for (const cs_entry of classStudents) {
      const student = (cs_entry as any).student;
      if (!student || !student.user_id) continue; // Skip students without portal access

      const studentRecords = (attRecords || []).filter((r: any) => r.student_id === student.id);
      const presentCount = studentRecords.filter((r: any) => r.final_status === 'PRESENTE').length;
      const attPct = Math.round((presentCount / totalSessions) * 100);

      if (attPct < minAtt) {
        atRiskStudents.push({ ...student, attPct });

        // Get student's email from student_details or auth
        const { data: details } = await supabaseAdmin
          .from("student_details")
          .select("email")
          .eq("student_id", student.id)
          .single();

        const studentEmail = details?.email;
        if (!studentEmail) continue;

        // Calculate how many more absences are allowed
        const maxAbsences = Math.floor(totalSessions * (1 - minAtt / 100));
        const absencesSoFar = totalSessions - presentCount;
        const absencesRemaining = Math.max(0, maxAbsences - absencesSoFar);

        const htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background-color: #f59e0b; padding: 20px; border-radius: 8px 8px 0 0;">
              <h2 style="color: white; margin: 0;">⚠️ Alerta de Frequência</h2>
            </div>
            <div style="background-color: #fff; padding: 24px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px;">
              <p>Olá, <strong>${student.name}</strong>!</p>
              <p>Sua frequência na disciplina <strong>${subj?.name}</strong> (Turma: ${cls?.code}) está abaixo do mínimo exigido.</p>
              <div style="background-color: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 16px 0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span><strong>Sua frequência atual:</strong></span>
                  <span style="color: #dc2626; font-weight: bold;">${attPct}%</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span><strong>Frequência mínima:</strong></span>
                  <span>${minAtt}%</span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                  <span><strong>Aulas realizadas:</strong></span>
                  <span>${totalSessions}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span><strong>Faltas que ainda pode ter:</strong></span>
                  <span style="color: ${absencesRemaining === 0 ? '#dc2626' : '#059669'}; font-weight: bold;">${absencesRemaining} falta(s)</span>
                </div>
              </div>
              ${absencesRemaining === 0
                ? '<p style="color: #dc2626; font-weight: bold;">⛔ Atenção: Você não pode ter mais nenhuma falta nesta disciplina sem ser reprovado por frequência.</p>'
                : `<p>Você ainda pode ter <strong>${absencesRemaining} falta(s)</strong> sem ser reprovado por frequência. Fique atento!</p>`
              }
              <p>Acesse o Portal do Aluno para acompanhar sua situação.</p>
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 16px 0;" />
              <p style="color: #6b7280; font-size: 12px;">Esta é uma mensagem automática. Não responda este email.</p>
            </div>
          </div>
        `;

        try {
          const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": authHeader!,
            },
            body: JSON.stringify({
              to: studentEmail,
              to_name: student.name,
              subject: `⚠️ Alerta de Frequência — ${subj?.name}`,
              html: htmlBody,
              message_type: "ALERTA_FREQUENCIA_ALUNO",
            }),
          });

          if (emailResponse.ok) {
            sentCount++;
          } else {
            const errBody = await emailResponse.json();
            errors.push(`Email para ${studentEmail}: ${errBody.error}`);
          }
        } catch (err: any) {
          errors.push(`Email para ${studentEmail}: ${err.message}`);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      at_risk_count: atRiskStudents.length,
      sent: sentCount,
      errors: errors.length > 0 ? errors : undefined,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
