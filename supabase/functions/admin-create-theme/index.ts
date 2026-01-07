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
    const { name, icon, pack_id, is_core, core_theme_type, theme_id, update } = await req.json();

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
      // Only set core_theme_type if is_core is true, otherwise set to null
      const updateData: any = {
        name,
        icon: icon || "🎮",
        pack_id: pack_id || null,
        is_core: is_core || false
      };
      
      if (is_core) {
        updateData.core_theme_type = core_theme_type || null;
      } else {
        updateData.core_theme_type = null;
      }
      
      const result = await supabase
        .from("themes")
        .update(updateData)
        .eq("id", theme_id)
        .select()
        .single();
      
      data = result.data;
      error = result.error;
      console.log("Theme updated:", data);
    } else {
      // Create new theme
      // Only set core_theme_type if is_core is true, otherwise set to null
      const insertData: any = {
        name,
        icon: icon || "🎮",
        pack_id: pack_id || null,
        is_core: is_core || false
      };
      
      if (is_core) {
        insertData.core_theme_type = core_theme_type || null;
      } else {
        insertData.core_theme_type = null;
      }
      
      const result = await supabase
        .from("themes")
        .insert(insertData)
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