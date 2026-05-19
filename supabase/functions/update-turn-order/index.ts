import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TurnOrderUpdate {
  playerId: string;
  turnOrder: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId, updates } = await req.json() as {
      sessionId: string;
      updates: TurnOrderUpdate[];
    };

    if (!sessionId || !updates || !Array.isArray(updates)) {
      return new Response(
        JSON.stringify({ error: "Missing sessionId or updates array" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Updating turn order for session ${sessionId}:`, updates);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Two-pass update to avoid unique constraint violations
    // Pass 1: Set all to temporary negative values (offset by 1000)
    for (const update of updates) {
      const { error } = await supabase
        .from("game_players")
        .update({ turn_order: -(update.turnOrder + 1000) })
        .eq("session_id", sessionId)
        .eq("player_id", update.playerId);

      if (error) {
        console.error(`Error in pass 1 for player ${update.playerId}:`, error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Pass 2: Set to actual turn order values
    for (const update of updates) {
      const { error } = await supabase
        .from("game_players")
        .update({ turn_order: update.turnOrder })
        .eq("session_id", sessionId)
        .eq("player_id", update.playerId);

      if (error) {
        console.error(`Error in pass 2 for player ${update.playerId}:`, error);
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    console.log("✅ Turn order updated successfully");

    return new Response(
      JSON.stringify({ success: true, updated: updates.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in update-turn-order:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
