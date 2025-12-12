import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, theme_id, pack_id } = await req.json();

    console.log("Admin manage theme-packs:", { action, theme_id, pack_id });

    if (!action || !theme_id || !pack_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: action, theme_id, pack_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "add") {
      // Add theme to pack
      const { data, error } = await supabase
        .from("theme_packs")
        .insert({ theme_id, pack_id })
        .select()
        .single();

      if (error) {
        console.error("Error adding theme to pack:", error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Theme added to pack:", data);
      return new Response(
        JSON.stringify({ success: true, data }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else if (action === "remove") {
      // Remove theme from pack
      const { error } = await supabase
        .from("theme_packs")
        .delete()
        .eq("theme_id", theme_id)
        .eq("pack_id", pack_id);

      if (error) {
        console.error("Error removing theme from pack:", error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Theme removed from pack");
      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );

    } else {
      return new Response(
        JSON.stringify({ error: "Invalid action. Use 'add' or 'remove'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    console.error("Error in admin-manage-theme-packs:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
