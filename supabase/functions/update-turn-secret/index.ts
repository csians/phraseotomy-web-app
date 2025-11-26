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
    const { turnId, secretElementId } = await req.json();

    if (!turnId || !secretElementId) {
      return new Response(
        JSON.stringify({ error: "Missing turnId or secretElementId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get current turn to get all elements
    const { data: turn, error: turnError } = await supabase
      .from("game_turns")
      .select("selected_elements")
      .eq("id", turnId)
      .single();

    if (turnError || !turn) {
      return new Response(
        JSON.stringify({ error: "Turn not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reorder elements with secret element first
    const reorderedElements = [
      secretElementId,
      ...(turn.selected_elements || []).filter((id: string) => id !== secretElementId)
    ];

    // Update turn with secret element at position 0
    const { error: updateError } = await supabase
      .from("game_turns")
      .update({ 
        selected_elements: reorderedElements
      })
      .eq("id", turnId);

    if (updateError) {
      console.error("Error updating turn:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in update-turn-secret:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
