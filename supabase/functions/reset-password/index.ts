import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function generatePassword(length = 10): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$";
  let password = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    password += chars[array[i] % chars.length];
  }
  return password;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if caller is super_admin or admin
    const { data: callerRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const roles = (callerRoles || []).map((r: any) => r.role);
    if (!roles.includes("super_admin") && !roles.includes("admin")) {
      return new Response(JSON.stringify({ error: "Permissão negada" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, method, justification } = await req.json();

    if (!user_id || !method) {
      return new Response(JSON.stringify({ error: "user_id e method são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (method === "screen" && !justification) {
      return new Response(JSON.stringify({ error: "Justificativa é obrigatória para exibição em tela" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a new password
    const newPassword = generatePassword(12);

    // Update user password via admin API
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      password: newPassword,
    });

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user info for email/whatsapp
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("name, email, phone")
      .eq("id", user_id)
      .single();

    if (method === "email") {
      // Get email settings for the user's institution
      const { data: userProfile } = await supabaseAdmin
        .from("profiles")
        .select("institution_id")
        .eq("id", user_id)
        .single();

      if (userProfile?.institution_id && profile?.email) {
        const { data: emailSettings } = await supabaseAdmin
          .from("email_settings")
          .select("*")
          .eq("institution_id", userProfile.institution_id)
          .eq("is_active", true)
          .single();

        if (emailSettings) {
          const htmlBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">Redefinição de Senha</h2>
              <p>Olá <strong>${profile.name}</strong>,</p>
              <p>Sua senha foi redefinida pelo administrador do sistema.</p>
              <p>Sua nova senha é:</p>
              <div style="background: #f4f4f4; padding: 16px; border-radius: 8px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; margin: 16px 0;">
                ${newPassword}
              </div>
              <p style="color: #666;">Por segurança, altere sua senha após o primeiro acesso.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="color: #999; font-size: 12px;">FrequênciaEDU - Sistema de Controle de Frequência</p>
            </div>
          `;

          // Call send-email edge function
          try {
            const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": authHeader,
                "apikey": Deno.env.get("SUPABASE_ANON_KEY") || "",
              },
              body: JSON.stringify({
                to: profile.email,
                to_name: profile.name,
                subject: "Redefinição de Senha - FrequênciaEDU",
                html: htmlBody,
                message_type: "RESET_SENHA",
              }),
            });

            if (sendRes.ok) {
              return new Response(JSON.stringify({ 
                success: true, method: "email",
                message: `Senha enviada por email para ${profile.email}.`,
              }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
          } catch (e) {
            // fall through
          }
        }
      }

      return new Response(JSON.stringify({ 
        success: true, method: "email",
        message: `Senha resetada. Não foi possível enviar por email. Verifique as configurações SMTP e o email do usuário.`,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "whatsapp") {
      // Get WhatsApp settings for the user's institution
      const { data: userProfile } = await supabaseAdmin
        .from("profiles")
        .select("institution_id")
        .eq("id", user_id)
        .single();

      if (userProfile?.institution_id) {
        const { data: whatsappSettings } = await supabaseAdmin
          .from("whatsapp_settings")
          .select("*")
          .eq("institution_id", userProfile.institution_id)
          .eq("is_active", true)
          .single();

        if (whatsappSettings && profile?.phone) {
          // Send via Whaticket
          const apiUrl = `${whatsappSettings.api_url.replace(/\/$/, '')}/api/messages/send`;
          try {
            const whatsappRes = await fetch(apiUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${whatsappSettings.api_token}`,
              },
              body: JSON.stringify({
                number: profile.phone.replace(/\D/g, ""),
                body: `Olá ${profile.name}, sua nova senha é: ${newPassword}\n\nPor segurança, altere sua senha após o primeiro acesso.`,
              }),
            });

            // Log the message
            await supabaseAdmin.from("whatsapp_message_logs").insert({
              institution_id: userProfile.institution_id,
              recipient_phone: profile.phone,
              recipient_name: profile.name,
              message_type: "RESET_SENHA",
              message_content: `Reset de senha enviado para ${profile.name}`,
              status: whatsappRes.ok ? "ENVIADO" : "ERRO",
              sent_by: caller.id,
            });

            if (whatsappRes.ok) {
              return new Response(JSON.stringify({ 
                success: true, method: "whatsapp",
                message: `Senha enviada via WhatsApp para ${profile.phone}.`,
              }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
          } catch (e) {
            // fall through to default message
          }
        }
      }

      return new Response(JSON.stringify({ 
        success: true, method: "whatsapp",
        message: `Senha resetada. Não foi possível enviar via WhatsApp. Verifique as configurações e o telefone do usuário.`,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (method === "screen") {
      // Return password to display on screen (with justification logged)
      return new Response(JSON.stringify({ 
        success: true, 
        method: "screen",
        password: newPassword,
        message: "Senha resetada com sucesso. Exibindo na tela.",
        justification,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Método inválido. Use: email, whatsapp ou screen" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
