import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeaveLobbyRequest {
  sessionId: string;
  playerId: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { sessionId, playerId }: LeaveLobbyRequest = await req.json();

    console.log("Player leaving lobby:", { sessionId, playerId });

    if (!sessionId || !playerId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: sessionId and playerId" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if the session exists and get host info
    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .select("host_customer_id, status")
      .eq("id", sessionId)
      .single();

    if (sessionError || !session) {
      console.error("Session not found:", sessionError);
      return new Response(
        JSON.stringify({ error: "Session not found" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prevent host from leaving (they should use end-lobby instead)
    if (session.host_customer_id === playerId) {
      return new Response(
        JSON.stringify({ error: "Host cannot leave the lobby. Use 'End Game' instead." }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if player is in the game
    const { data: player, error: playerCheckError } = await supabase
      .from("game_players")
      .select("id")
      .eq("session_id", sessionId)
      .eq("player_id", playerId)
      .maybeSingle();

    if (playerCheckError) {
      console.error("Error checking player:", playerCheckError);
      return new Response(
        JSON.stringify({ error: "Error checking player status" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!player) {
      return new Response(
        JSON.stringify({ error: "Player not found in this session" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete player's guesses first (if any)
    const { data: turns } = await supabase
      .from("game_turns")
      .select("id")
      .eq("session_id", sessionId);

    const turnIds = (turns || []).map(t => t.id);
    
    if (turnIds.length > 0) {
      const { error: guessesError } = await supabase
        .from("game_guesses")
        .delete()
        .in("turn_id", turnIds)
        .eq("player_id", playerId);

      if (guessesError) {
        console.error("Error deleting player guesses:", guessesError);
      }
    }

    // Delete player's audio (if any)
    const { error: audioError } = await supabase
      .from("game_audio")
      .delete()
      .eq("session_id", sessionId)
      .eq("player_id", playerId);

    if (audioError) {
      console.error("Error deleting player audio:", audioError);
    }

    // Delete the player from game_players
    const { error: deleteError } = await supabase
      .from("game_players")
      .delete()
      .eq("session_id", sessionId)
      .eq("player_id", playerId);

    if (deleteError) {
      console.error("Error deleting player:", deleteError);
      return new Response(
        JSON.stringify({ error: "Failed to remove player from lobby" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Player successfully left lobby:", { sessionId, playerId });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Successfully left the lobby" 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in leave-lobby function:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
