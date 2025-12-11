import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, icon, pack_id, is_core, theme_id, update } = await req.json();

    if (!name) {
      return new Response(
        JSON.stringify({ error: "Theme name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    let data, error;

    if (update && theme_id) {
      // Update existing theme
      const result = await supabase
        .from("themes")
        .update({
          name,
          icon: icon || "🎮",
          pack_id: pack_id || null,
          is_core: is_core || false
        })
        .eq("id", theme_id)
        .select()
        .single();
      
      data = result.data;
      error = result.error;
      console.log("Theme updated:", data);
    } else {
      // Create new theme
      const result = await supabase
        .from("themes")
        .insert({
          name,
          icon: icon || "🎮",
          pack_id: pack_id || null,
          is_core: is_core || false
        })
        .select()
        .single();
      
      data = result.data;
      error = result.error;
      console.log("Theme created:", data);
    }

    if (error) {
      console.error("Error creating/updating theme:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, theme: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in admin-create-theme:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});