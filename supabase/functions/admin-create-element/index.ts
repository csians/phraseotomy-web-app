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
    const { name, icon, theme_id, color, is_whisp, core_element_type } = await req.json();

    if (!name || !theme_id) {
      return new Response(
        JSON.stringify({ error: "Element name and theme_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Check if theme is core to validate core_element_type
    let isCoreTheme = false;
    if (core_element_type) {
      const { data: theme } = await supabase
        .from("themes")
        .select("is_core")
        .eq("id", theme_id)
        .single();
      
      isCoreTheme = theme?.is_core || false;
      
      if (!isCoreTheme) {
        return new Response(
          JSON.stringify({ error: "core_element_type can only be set for elements in core themes" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const insertData: any = {
      name,
      icon: icon || "🔮",
      theme_id,
      color: color || null,
      is_whisp: is_whisp || false
    };

    // Only set core_element_type if theme is core
    if (isCoreTheme) {
      insertData.core_element_type = core_element_type || null;
    } else {
      insertData.core_element_type = null;
    }

    const { data, error } = await supabase
      .from("elements")
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Error creating element:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Element created:", data);
    return new Response(
      JSON.stringify({ success: true, element: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in admin-create-element:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});