import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface KickPlayerRequest {
  sessionId: string;
  playerIdToKick: string;
  hostId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { sessionId, playerIdToKick, hostId }: KickPlayerRequest = await req.json();

    console.log("Kick player request:", { sessionId, playerIdToKick, hostId });

    if (!sessionId || !playerIdToKick || !hostId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the requester is the host
    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .select("host_customer_id, status")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (session.host_customer_id !== hostId) {
      return new Response(
        JSON.stringify({ error: "Only the host can kick players" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Cannot kick the host
    if (playerIdToKick === session.host_customer_id) {
      return new Response(
        JSON.stringify({ error: "Cannot kick the host" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get player name before deletion for response
    const { data: player } = await supabase
      .from("game_players")
      .select("name")
      .eq("session_id", sessionId)
      .eq("player_id", playerIdToKick)
      .single();

    if (!player) {
      return new Response(
        JSON.stringify({ error: "Player not found in this session" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete player's guesses
    const { data: turns } = await supabase
      .from("game_turns")
      .select("id")
      .eq("session_id", sessionId);

    const turnIds = (turns || []).map(t => t.id);
    
    if (turnIds.length > 0) {
      await supabase
        .from("game_guesses")
        .delete()
        .in("turn_id", turnIds)
        .eq("player_id", playerIdToKick);
    }

    // Delete player's audio
    await supabase
      .from("game_audio")
      .delete()
      .eq("session_id", sessionId)
      .eq("player_id", playerIdToKick);

    // Delete the player
    const { error: deleteError } = await supabase
      .from("game_players")
      .delete()
      .eq("session_id", sessionId)
      .eq("player_id", playerIdToKick);

    if (deleteError) {
      console.error("Error deleting player:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to kick player" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Player kicked successfully:", { sessionId, playerIdToKick, playerName: player.name });

    return new Response(
      JSON.stringify({ 
        success: true, 
        kickedPlayerName: player.name,
        message: `${player.name} has been kicked from the lobby` 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in kick-player function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
