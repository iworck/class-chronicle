import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendRequest {
  phone: string;
  message: string;
  institution_id?: string;
  campaign_id?: string;
  message_type?: string;
  recipient_name?: string;
}

async function sendViaWhaticket(apiUrl: string, apiToken: string, phone: string, message: string): Promise<{ success: boolean; external_id?: string; error?: string }> {
  try {
    // Whaticket API: POST /api/messages/send
    const url = `${apiUrl.replace(/\/$/, '')}/api/messages/send`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiToken}`,
      },
      body: JSON.stringify({
        number: phone.replace(/\D/g, ""),
        body: message,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return { success: false, error: `Whaticket API error [${response.status}]: ${errorBody}` };
    }

    const data = await response.json();
    return { success: true, external_id: data.id || data.messageId || undefined };
  } catch (err) {
    return { success: false, error: `Whaticket connection error: ${err.message}` };
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

    // Verify caller
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

    // Check if caller is staff
    const { data: callerRoles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", caller.id);
    if (!callerRoles || callerRoles.length === 0) {
      return new Response(JSON.stringify({ error: "Permissão negada" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: SendRequest = await req.json();
    const { phone, message, institution_id, campaign_id, message_type = "MANUAL", recipient_name } = body;

    if (!phone || !message) {
      return new Response(JSON.stringify({ error: "phone e message são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get WhatsApp settings for the institution
    let settings: any = null;
    if (institution_id) {
      const { data } = await supabaseAdmin
        .from("whatsapp_settings")
        .select("*")
        .eq("institution_id", institution_id)
        .eq("is_active", true)
        .single();
      settings = data;
    }

    // If no institution-specific settings, try caller's institution
    if (!settings) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("institution_id")
        .eq("id", caller.id)
        .single();

      if (profile?.institution_id) {
        const { data } = await supabaseAdmin
          .from("whatsapp_settings")
          .select("*")
          .eq("institution_id", profile.institution_id)
          .eq("is_active", true)
          .single();
        settings = data;
      }
    }

    if (!settings) {
      return new Response(JSON.stringify({ 
        error: "Configurações do WhatsApp não encontradas. Configure a integração em Configurações > WhatsApp." 
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send via Whaticket
    const result = await sendViaWhaticket(settings.api_url, settings.api_token, phone, message);

    // Log the message
    await supabaseAdmin.from("whatsapp_message_logs").insert({
      institution_id: settings.institution_id,
      campaign_id: campaign_id || null,
      recipient_phone: phone,
      recipient_name: recipient_name || null,
      message_type: message_type,
      message_content: message,
      status: result.success ? "ENVIADO" : "ERRO",
      external_id: result.external_id || null,
      error_message: result.error || null,
      sent_by: caller.id,
    });

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, external_id: result.external_id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
