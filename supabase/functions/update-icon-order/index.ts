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
    const { turnId, iconOrder } = await req.json();

    if (!turnId) {
      return new Response(
        JSON.stringify({ error: "Missing turnId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!iconOrder || !Array.isArray(iconOrder)) {
      return new Response(
        JSON.stringify({ error: "Invalid iconOrder" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Update the icon order on the turn
    const { data: turn, error } = await supabase
      .from("game_turns")
      .update({ icon_order: iconOrder })
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

    console.log("Updated icon order for turn:", turnId, "to:", iconOrder);

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
