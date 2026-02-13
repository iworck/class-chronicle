import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    const { name, email, password, phone, institution_id, role } = await req.json();

    if (!name || !email || !password) {
      return new Response(JSON.stringify({ error: "Nome, email e senha são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "Senha deve ter no mínimo 6 caracteres" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user via admin API (auto-confirms email)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = newUser.user.id;

    // Update profile with additional info
    const profileUpdate: Record<string, any> = {};
    if (phone) profileUpdate.phone = phone;
    if (institution_id) profileUpdate.institution_id = institution_id;

    if (Object.keys(profileUpdate).length > 0) {
      await supabaseAdmin.from("profiles").update(profileUpdate).eq("id", userId);
    }

    // Assign role if provided
    if (role) {
      // Only super_admin can assign super_admin
      if (role === "super_admin" && !roles.includes("super_admin")) {
        return new Response(JSON.stringify({ error: "Apenas super_admin pode atribuir este papel" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role });
    }

    return new Response(JSON.stringify({ id: userId, email }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
