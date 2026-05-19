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
    const { elements } = await req.json();

    if (!elements || !Array.isArray(elements) || elements.length === 0) {
      return new Response(
        JSON.stringify({ error: "Elements array is required and must not be empty" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate each element
    for (const element of elements) {
      if (!element.name || !element.theme_id) {
        return new Response(
          JSON.stringify({ error: "Each element must have name and theme_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get unique theme IDs and check which are core
    const themeIds = [...new Set(elements.map(e => e.theme_id))];
    const { data: themes } = await supabase
      .from("themes")
      .select("id, is_core")
      .in("id", themeIds);
    
    const coreThemeIds = new Set(
      (themes || []).filter(t => t.is_core).map(t => t.id)
    );

    // Prepare elements for insertion
    const elementsToInsert = elements.map(element => {
      const isCoreTheme = coreThemeIds.has(element.theme_id);
      const insertData: any = {
        name: element.name.trim(),
        icon: element.icon || "🔮",
        theme_id: element.theme_id,
        color: element.color || null,
        is_whisp: element.is_whisp || false
      };
      
      // Only set core_element_type if theme is core
      if (isCoreTheme) {
        insertData.core_element_type = element.core_element_type || null;
      } else {
        insertData.core_element_type = null;
      }
      
      return insertData;
    });

    const { data, error } = await supabase
      .from("elements")
      .insert(elementsToInsert)
      .select();

    if (error) {
      console.error("Error creating elements:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Successfully created ${data?.length || 0} elements`);
    return new Response(
      JSON.stringify({ success: true, elements: data, count: data?.length || 0 }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in admin-create-elements-batch:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

