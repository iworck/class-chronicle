import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function interpolateTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

async function sendViaWhaticket(apiUrl: string, apiToken: string, phone: string, message: string): Promise<{ success: boolean; external_id?: string; error?: string }> {
  try {
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
    return { success: false, error: err.message };
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

    const { campaign_id } = await req.json();
    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get campaign with template
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("whatsapp_campaigns")
      .select("*, whatsapp_templates(*)")
      .eq("id", campaign_id)
      .single();

    if (campaignError || !campaign) {
      return new Response(JSON.stringify({ error: "Campanha não encontrada" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get WhatsApp settings
    const { data: settings } = await supabaseAdmin
      .from("whatsapp_settings")
      .select("*")
      .eq("institution_id", campaign.institution_id)
      .eq("is_active", true)
      .single();

    if (!settings) {
      return new Response(JSON.stringify({ error: "Configurações do WhatsApp não encontradas" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update campaign status
    await supabaseAdmin.from("whatsapp_campaigns").update({
      status: "ENVIANDO",
      started_at: new Date().toISOString(),
    }).eq("id", campaign_id);

    // Get pending recipients
    const { data: recipients } = await supabaseAdmin
      .from("whatsapp_campaign_recipients")
      .select("*")
      .eq("campaign_id", campaign_id)
      .eq("status", "PENDENTE");

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of (recipients || [])) {
      const vars = (recipient.variables as Record<string, string>) || {};
      if (recipient.name) vars.nome = recipient.name;
      
      const messageContent = interpolateTemplate(campaign.whatsapp_templates.content, vars);
      const result = await sendViaWhaticket(settings.api_url, settings.api_token, recipient.phone, messageContent);

      await supabaseAdmin.from("whatsapp_campaign_recipients").update({
        status: result.success ? "ENVIADO" : "ERRO",
        sent_at: result.success ? new Date().toISOString() : null,
        error_message: result.error || null,
      }).eq("id", recipient.id);

      // Log
      await supabaseAdmin.from("whatsapp_message_logs").insert({
        institution_id: campaign.institution_id,
        campaign_id: campaign_id,
        recipient_phone: recipient.phone,
        recipient_name: recipient.name,
        message_type: "CAMPAIGN",
        message_content: messageContent,
        status: result.success ? "ENVIADO" : "ERRO",
        external_id: result.external_id || null,
        error_message: result.error || null,
        sent_by: caller.id,
      });

      if (result.success) sentCount++;
      else failedCount++;

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Update campaign stats
    await supabaseAdmin.from("whatsapp_campaigns").update({
      status: "CONCLUIDA",
      completed_at: new Date().toISOString(),
      sent_count: sentCount,
      failed_count: failedCount,
    }).eq("id", campaign_id);

    return new Response(JSON.stringify({ 
      success: true, 
      sent: sentCount, 
      failed: failedCount,
      total: (recipients || []).length,
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
