import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendSmtpEmail(config: {
  host: string; port: number; username: string; password: string;
  useTls: boolean; from: string; fromName: string;
  to: string; subject: string; body: string; isHtml: boolean;
}) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let conn: Deno.Conn;
  if (config.useTls && config.port === 465) {
    conn = await Deno.connectTls({ hostname: config.host, port: config.port });
  } else {
    conn = await Deno.connect({ hostname: config.host, port: config.port });
  }

  async function readResponse(): Promise<string> {
    const buf = new Uint8Array(4096);
    const n = await conn.read(buf);
    return n ? decoder.decode(buf.subarray(0, n)) : "";
  }
  async function sendCommand(cmd: string): Promise<string> {
    await conn.write(encoder.encode(cmd + "\r\n"));
    return await readResponse();
  }

  try {
    await readResponse();
    await sendCommand(`EHLO localhost`);
    if (config.useTls && config.port !== 465) {
      await sendCommand("STARTTLS");
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: config.host });
      await sendCommand(`EHLO localhost`);
    }
    await sendCommand("AUTH LOGIN");
    await sendCommand(btoa(config.username));
    const authRes = await sendCommand(btoa(config.password));
    if (!authRes.startsWith("235")) throw new Error(`Auth falhou: ${authRes.trim()}`);
    await sendCommand(`MAIL FROM:<${config.from}>`);
    await sendCommand(`RCPT TO:<${config.to}>`);
    await sendCommand("DATA");
    const contentType = config.isHtml ? `Content-Type: text/html; charset=UTF-8` : `Content-Type: text/plain; charset=UTF-8`;
    const message = [
      `From: ${config.fromName} <${config.from}>`,
      `To: ${config.to}`,
      `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(config.subject)))}?=`,
      `MIME-Version: 1.0`,
      contentType,
      `Content-Transfer-Encoding: base64`,
      ``,
      btoa(unescape(encodeURIComponent(config.body))),
      `.`,
    ].join("\r\n");
    await sendCommand(message);
    await sendCommand("QUIT");
  } finally {
    try { conn.close(); } catch {}
  }
}

const STATUS_LABELS: Record<string, string> = {
  ABERTO: "Aberto",
  EM_ATENDIMENTO: "Em Atendimento",
  RESOLVIDO: "Resolvido",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { ticket_id, student_name, subject, response, new_status, institution_id } = await req.json();

    if (!ticket_id || !institution_id) {
      return new Response(JSON.stringify({ error: "ticket_id e institution_id são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar configurações de e-mail da instituição
    const { data: emailSettings } = await supabaseAdmin
      .from("email_settings")
      .select("*")
      .eq("institution_id", institution_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!emailSettings) {
      console.log("Sem configuração SMTP — ignorando notificação ao aluno.");
      return new Response(JSON.stringify({ success: true, message: "Sem configuração SMTP." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Buscar e-mail do aluno via ticket
    const { data: ticket } = await supabaseAdmin
      .from("support_tickets")
      .select("student_id, student:students(user_id)")
      .eq("id", ticket_id)
      .maybeSingle();

    let studentEmail: string | null = null;
    if (ticket?.student_id) {
      // Tentar buscar e-mail nos student_details
      const { data: details } = await supabaseAdmin
        .from("student_details")
        .select("email")
        .eq("student_id", ticket.student_id)
        .maybeSingle();
      studentEmail = details?.email || null;
    }

    if (!studentEmail) {
      console.log("Aluno sem e-mail cadastrado — ignorando notificação.");
      return new Response(JSON.stringify({ success: true, message: "Aluno sem e-mail." }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const statusLabel = STATUS_LABELS[new_status] || new_status;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: #4f46e5; color: white; padding: 16px 24px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 18px;">✉️ Seu Ticket Foi Respondido</h2>
        </div>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; padding: 24px;">
          <p style="color: #374151; margin: 0 0 16px;">Olá, <strong>${student_name || "Aluno"}</strong>!</p>
          <p style="color: #374151; margin: 0 0 16px;">A coordenação respondeu ao seu ticket:</p>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
            <tr>
              <td style="padding: 6px 0; color: #6b7280; font-size: 13px; width: 100px;">Assunto:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #111827;">${subject}</td>
            </tr>
            <tr>
              <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Status:</td>
              <td style="padding: 6px 0; font-weight: 600; color: #111827;">${statusLabel}</td>
            </tr>
          </table>
          <div style="background: white; border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin-bottom: 16px;">
            <p style="margin: 0 0 6px; font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em;">Resposta da coordenação:</p>
            <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${response}</p>
          </div>
          <p style="margin: 0; font-size: 13px; color: #6b7280;">
            Acesse o Portal do Aluno para visualizar o histórico completo do seu ticket.
          </p>
        </div>
      </div>
    `;

    try {
      await sendSmtpEmail({
        host: emailSettings.smtp_host,
        port: emailSettings.smtp_port,
        username: emailSettings.smtp_user,
        password: emailSettings.smtp_password,
        useTls: emailSettings.use_tls,
        from: emailSettings.from_email,
        fromName: emailSettings.from_name,
        to: studentEmail,
        subject: `Resposta ao seu ticket: ${subject}`,
        body: html,
        isHtml: true,
      });
    } catch (err: any) {
      console.error(`Erro ao enviar e-mail para ${studentEmail}:`, err.message);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Erro na função notify-ticket-response:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
