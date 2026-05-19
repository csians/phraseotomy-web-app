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
    const { element_id, name, icon, image_url, color, is_whisp, core_element_type } = await req.json();

    if (!element_id) {
      return new Response(
        JSON.stringify({ error: "Element ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // If core_element_type is being updated, check if element belongs to core theme
    if (core_element_type !== undefined) {
      const { data: element } = await supabase
        .from("elements")
        .select("theme_id")
        .eq("id", element_id)
        .single();
      
      if (element?.theme_id) {
        const { data: theme } = await supabase
          .from("themes")
          .select("is_core")
          .eq("id", element.theme_id)
          .single();
        
        const isCoreTheme = theme?.is_core || false;
        
        if (core_element_type && !isCoreTheme) {
          return new Response(
            JSON.stringify({ error: "core_element_type can only be set for elements in core themes" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (icon !== undefined) updates.icon = icon;
    if (image_url !== undefined) updates.image_url = image_url;
    if (color !== undefined) updates.color = color;
    if (is_whisp !== undefined) updates.is_whisp = is_whisp;
    if (core_element_type !== undefined) {
      // If setting to null or empty, set to null. Otherwise use the value
      updates.core_element_type = core_element_type || null;
    }

    if (Object.keys(updates).length === 0) {
      return new Response(
        JSON.stringify({ error: "No updates provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data, error } = await supabase
      .from("elements")
      .update(updates)
      .eq("id", element_id)
      .select()
      .single();

    if (error) {
      console.error("Error updating element:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Element updated:", data);
    return new Response(
      JSON.stringify({ success: true, element: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in admin-update-element:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});