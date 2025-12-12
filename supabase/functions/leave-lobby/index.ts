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

    // Check if the session exists and get session info
    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .select("host_customer_id, status, current_storyteller_id, current_round, total_rounds")
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
      .select("id, name, turn_order")
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

    const leavingPlayerName = player.name;
    const wasStoryteller = session.current_storyteller_id === playerId;

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

    // If leaving player was storyteller and game is active, skip their turn
    if (wasStoryteller && session.status === 'active') {
      console.log("Leaving player was storyteller, advancing to next turn...");
      
      // Get remaining players ordered by turn_order
      const { data: remainingPlayers } = await supabase
        .from("game_players")
        .select("player_id, name, turn_order")
        .eq("session_id", sessionId)
        .neq("player_id", playerId)
        .order("turn_order", { ascending: true });

      if (remainingPlayers && remainingPlayers.length > 0) {
        // Find next storyteller
        const currentRound = session.current_round || 1;
        const nextRound = currentRound + 1;
        
        // Check if game should end (all rounds complete)
        if (nextRound > (session.total_rounds || remainingPlayers.length + 1)) {
          // Mark game as completed
          await supabase
            .from("game_sessions")
            .update({ 
              status: "expired",
              current_storyteller_id: null 
            })
            .eq("id", sessionId);
          
          console.log("Game completed due to storyteller leaving");
        } else {
          // Advance to next storyteller
          const nextStorytellerIndex = (currentRound - 1) % remainingPlayers.length;
          const nextStoryteller = remainingPlayers[nextStorytellerIndex] || remainingPlayers[0];
          
          // Complete current turn if exists
          const { data: currentTurn } = await supabase
            .from("game_turns")
            .select("id")
            .eq("session_id", sessionId)
            .eq("round_number", currentRound)
            .maybeSingle();

          if (currentTurn) {
            await supabase
              .from("game_turns")
              .update({ completed_at: new Date().toISOString() })
              .eq("id", currentTurn.id);
          }

          // Create new turn for next storyteller
          const { error: newTurnError } = await supabase
            .from("game_turns")
            .insert({
              session_id: sessionId,
              round_number: nextRound,
              storyteller_id: nextStoryteller.player_id,
              turn_mode: null,
            });

          if (newTurnError) {
            console.error("Error creating new turn:", newTurnError);
          }

          // Update session
          await supabase
            .from("game_sessions")
            .update({ 
              current_round: nextRound,
              current_storyteller_id: nextStoryteller.player_id,
              selected_theme_id: null
            })
            .eq("id", sessionId);

          console.log(`Advanced to round ${nextRound}, new storyteller: ${nextStoryteller.name}`);
        }
      } else {
        // No remaining players, end game
        await supabase
          .from("game_sessions")
          .update({ 
            status: "expired",
            current_storyteller_id: null 
          })
          .eq("id", sessionId);
        
        console.log("Game ended - no remaining players");
      }
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

    // Update turn orders for remaining players
    const { data: remainingPlayersForOrder } = await supabase
      .from("game_players")
      .select("id, turn_order")
      .eq("session_id", sessionId)
      .order("turn_order", { ascending: true });

    if (remainingPlayersForOrder) {
      for (let i = 0; i < remainingPlayersForOrder.length; i++) {
        await supabase
          .from("game_players")
          .update({ turn_order: i + 1 })
          .eq("id", remainingPlayersForOrder[i].id);
      }
    }

    console.log("Player successfully left lobby:", { sessionId, playerId, playerName: leavingPlayerName });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Successfully left the lobby",
        wasStoryteller,
        playerName: leavingPlayerName
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
