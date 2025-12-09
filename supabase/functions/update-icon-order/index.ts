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
    const { turnId, iconOrder, reorderedIconIds } = await req.json();

    if (!turnId) {
      return new Response(
        JSON.stringify({ error: "Missing turnId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Accept either reorderedIconIds (array of UUIDs in new order) or legacy iconOrder
    if (!reorderedIconIds && (!iconOrder || !Array.isArray(iconOrder))) {
      return new Response(
        JSON.stringify({ error: "Invalid iconOrder or reorderedIconIds" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // If we have the actual reordered icon IDs, update selected_icon_ids directly
    // This is the preferred method as it preserves the actual order
    const updateData: { icon_order?: number[]; selected_icon_ids?: string[] } = {};
    
    if (reorderedIconIds && Array.isArray(reorderedIconIds)) {
      // Store the reordered UUIDs directly - the order is preserved in the array
      updateData.selected_icon_ids = reorderedIconIds;
      console.log("Updating selected_icon_ids to:", reorderedIconIds);
    } else {
      // Legacy: just update icon_order
      updateData.icon_order = iconOrder;
      console.log("Updating icon_order to:", iconOrder);
    }

    // Update the turn
    const { data: turn, error } = await supabase
      .from("game_turns")
      .update(updateData)
      .eq("id", turnId)
      .select()
      .single();

    if (error) {
      console.error("Error updating icon order:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Updated turn:", turnId, "with:", updateData);

    return new Response(
      JSON.stringify({ success: true, turn }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in update-icon-order:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});