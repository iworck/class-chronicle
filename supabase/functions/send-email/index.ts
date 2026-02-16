import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple SMTP sender using Deno TCP
async function sendSmtpEmail(config: {
  host: string;
  port: number;
  username: string;
  password: string;
  useTls: boolean;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  body: string;
  isHtml: boolean;
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
    // Read greeting
    await readResponse();

    // EHLO
    await sendCommand(`EHLO localhost`);

    // STARTTLS for port 587
    if (config.useTls && config.port !== 465) {
      await sendCommand("STARTTLS");
      conn = await Deno.startTls(conn as Deno.TcpConn, { hostname: config.host });
      await sendCommand(`EHLO localhost`);
    }

    // AUTH LOGIN
    await sendCommand("AUTH LOGIN");
    await sendCommand(btoa(config.username));
    const authRes = await sendCommand(btoa(config.password));
    if (!authRes.startsWith("235")) {
      throw new Error(`Autenticação SMTP falhou: ${authRes.trim()}`);
    }

    // MAIL FROM
    await sendCommand(`MAIL FROM:<${config.from}>`);

    // RCPT TO
    await sendCommand(`RCPT TO:<${config.to}>`);

    // DATA
    await sendCommand("DATA");

    const boundary = `----=_Part_${Date.now()}`;
    const contentType = config.isHtml
      ? `Content-Type: text/html; charset=UTF-8`
      : `Content-Type: text/plain; charset=UTF-8`;

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

    const quitRes = await sendCommand(message);

    // QUIT
    await sendCommand("QUIT");
  } finally {
    try { conn.close(); } catch {}
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles").select("institution_id").eq("id", caller.id).single();

    if (!callerProfile?.institution_id) {
      return new Response(JSON.stringify({ error: "Usuário sem instituição vinculada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: emailSettings } = await supabaseAdmin
      .from("email_settings").select("*")
      .eq("institution_id", callerProfile.institution_id)
      .eq("is_active", true).single();

    if (!emailSettings) {
      return new Response(JSON.stringify({ error: "Configuração SMTP não encontrada. Configure em Configurações > Email." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { to, to_name, subject, body, html, message_type } = await req.json();

    if (!to || !subject || (!body && !html)) {
      return new Response(JSON.stringify({ error: "Campos to, subject e body/html são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      await sendSmtpEmail({
        host: emailSettings.smtp_host,
        port: emailSettings.smtp_port,
        username: emailSettings.smtp_user,
        password: emailSettings.smtp_password,
        useTls: emailSettings.use_tls,
        from: emailSettings.from_email,
        fromName: emailSettings.from_name,
        to,
        subject,
        body: html || body,
        isHtml: !!html,
      });

      await supabaseAdmin.from("email_message_logs").insert({
        institution_id: callerProfile.institution_id,
        recipient_email: to,
        recipient_name: to_name || null,
        subject,
        message_type: message_type || "GERAL",
        status: "ENVIADO",
        sent_by: caller.id,
      });

      return new Response(JSON.stringify({ success: true, message: `Email enviado para ${to}` }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (smtpError: any) {
      await supabaseAdmin.from("email_message_logs").insert({
        institution_id: callerProfile.institution_id,
        recipient_email: to,
        recipient_name: to_name || null,
        subject,
        message_type: message_type || "GERAL",
        status: "ERRO",
        error_message: smtpError.message,
        sent_by: caller.id,
      });

      return new Response(JSON.stringify({ error: `Erro SMTP: ${smtpError.message}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
